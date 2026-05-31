import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INSTANCE_PREFIX = (process.env.HOOK7_INSTANCE_PREFIX ?? "lead").trim() || "lead";
const DEFAULT_BASE_URL = "https://api.hook7.com.br";

// ---------------------------------------------------------------------------
// Helpers (server-only; not exported as server fns)
// ---------------------------------------------------------------------------

function slugify(input: string): string {
  return (input ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function shortId(len = 6): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < len; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

function buildExternalName(orgSlug: string, displayName: string): string {
  const o = slugify(orgSlug) || "org";
  const n = slugify(displayName) || "wa";
  return `${INSTANCE_PREFIX}-${o}-${n}-${shortId(6)}`;
}

function uuidv4(): string {
  // crypto.randomUUID is available in workerd
  return (globalThis.crypto as Crypto).randomUUID();
}

async function getHook7BaseUrl(): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc("get_platform_plain", { _key: "hook7_base_url" });
  if (error) throw new Error(error.message);
  const v = typeof data === "string" ? data : DEFAULT_BASE_URL;
  return (v || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function getHook7GlobalApiKey(): string {
  const key = (process.env.HOOK7_GLOBAL_APIKEY ?? "").trim();
  if (!key) {
    throw new Error("HOOK7_GLOBAL_APIKEY não configurada. Configure no painel de deploy.");
  }
  return key;
}

type Hook7FetchOpts = {
  method: "GET" | "POST" | "DELETE" | "PUT" | "PATCH";
  apikey: string;
  body?: unknown;
  timeoutMs?: number;
  baseUrl?: string;
};

async function hook7Fetch<T = any>(path: string, opts: Hook7FetchOpts): Promise<T> {
  const base = opts.baseUrl ?? (await getHook7BaseUrl());
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 15000);
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method,
      headers: {
        apikey: opts.apikey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: ctrl.signal,
    });
  } catch (e: any) {
    clearTimeout(timer);
    throw new Error(`Falha ao contactar Hook7: ${e?.name === "AbortError" ? "tempo esgotado" : e?.message ?? "erro de rede"}`);
  }
  clearTimeout(timer);
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* ignore */ }
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error("Hook7: credencial inválida.");
    if (res.status === 404) throw new Error("Hook7: recurso não encontrado.");
    const msg = json?.message || json?.error || `HTTP ${res.status}`;
    throw new Error(`Hook7: ${msg}`);
  }
  return json as T;
}

async function requireOrgAdmin(supabase: any, userId: string, organization_id: string) {
  const { data: rolesRow } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (rolesRow ?? []).map((r: any) => r.role);
  if (roles.includes("master_admin")) return { isMaster: true };
  const { data: mem } = await supabase
    .from("organization_members")
    .select("role,status")
    .eq("user_id", userId)
    .eq("organization_id", organization_id)
    .eq("status", "active")
    .maybeSingle();
  if (!mem) throw new Error("Sem acesso à organização.");
  if (!roles.includes("company_admin") && mem.role !== "company_admin") {
    throw new Error("Apenas administradores da organização podem executar esta ação.");
  }
  return { isMaster: false };
}

async function getCallerOrg(supabase: any, userId: string): Promise<{ id: string; slug: string; whatsapp_mode: string }> {
  const { data: mem } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!mem) throw new Error("Sem organização ativa.");
  const { data: org } = await supabase
    .from("organizations")
    .select("id, slug, whatsapp_mode")
    .eq("id", mem.organization_id)
    .maybeSingle();
  if (!org) throw new Error("Organização não encontrada.");
  return { id: org.id, slug: org.slug, whatsapp_mode: (org as any).whatsapp_mode ?? "shared" };
}

// ---------------------------------------------------------------------------
// Master: platform-level config
// ---------------------------------------------------------------------------

async function assertMasterAdmin(supabase: any, userId: string) {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (!(roles ?? []).some((r: any) => r.role === "master_admin")) {
    throw new Error("Apenas administradores master podem executar esta ação.");
  }
}

export const getHook7PlatformConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertMasterAdmin(supabase, userId);
    const { data: row } = await supabaseAdmin
      .from("platform_settings")
      .select("value_plain")
      .eq("key", "hook7_base_url")
      .maybeSingle();
    const base_url = typeof row?.value_plain === "string" ? row.value_plain : DEFAULT_BASE_URL;
    const has_apikey = !!(process.env.HOOK7_GLOBAL_APIKEY ?? "").trim();
    return {
      has_apikey,
      base_url,
      instance_prefix: INSTANCE_PREFIX,
    };
  });

export const getHook7GlobalApiKeyStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertMasterAdmin(supabase, userId);
    return { configured: !!(process.env.HOOK7_GLOBAL_APIKEY ?? "").trim() };
  });

export const testHook7Connection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertMasterAdmin(supabase, userId);
    let apikey: string;
    try {
      apikey = getHook7GlobalApiKey();
    } catch (e: any) {
      return { ok: false, message: "Chave global do Hook7 não configurada no servidor." };
    }
    // Validation: create a throwaway instance, then delete.
    const validationName = `${INSTANCE_PREFIX}-healthcheck-${Date.now()}-${shortId(4)}`;
    const validationToken = uuidv4();
    try {
      const created: any = await hook7Fetch("/instance/create", {
        method: "POST",
        apikey,
        body: { name: validationName, token: validationToken },
        timeoutMs: 12000,
      });
      const createdName = created?.data?.name ?? validationName;
      try {
        await hook7Fetch(`/instance/${encodeURIComponent(createdName)}`, {
          method: "DELETE", apikey, timeoutMs: 8000,
        });
      } catch { /* non-fatal */ }
      return { ok: true, message: "Conexão OK." };
    } catch {
      return { ok: false, message: "Não foi possível conectar — verifique a chave e a URL base." };
    }
  });

export const setHook7BaseUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ baseUrl: z.string().trim().url().max(255) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMasterAdmin(supabase, userId);
    const { error } = await context.supabase.rpc("set_platform_plain", {
      _key: "hook7_base_url",
      _value: data.baseUrl.replace(/\/+$/, "") as any,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Org-level: WhatsApp mode
// ---------------------------------------------------------------------------

export const getWhatsAppMode = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const org = await getCallerOrg(supabase, userId);
    return { mode: org.whatsapp_mode as "shared" | "per_user" };
  });

export const updateWhatsAppMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ mode: z.enum(["shared", "per_user"]) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const org = await getCallerOrg(supabase, userId);
    await requireOrgAdmin(supabase, userId, org.id);
    const { error } = await supabase
      .from("organizations")
      .update({ whatsapp_mode: data.mode, updated_at: new Date().toISOString() })
      .eq("id", org.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Instances
// ---------------------------------------------------------------------------

export const listHook7Instances = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const org = await getCallerOrg(supabase, userId);
    const { data, error } = await supabase
      .from("hook7_instances")
      .select("id, display_name, external_name, status, phone_number, owner_user_id, last_connected_at, last_qr_at, created_at")
      .eq("organization_id", org.id)
      .is("archived_at", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { instances: data ?? [], whatsapp_mode: org.whatsapp_mode as "shared" | "per_user" };
  });

const CreateSchema = z.object({
  display_name: z.string().trim().min(1).max(60),
  owner_user_id: z.string().uuid().nullable().optional(),
});

export const createHook7Instance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => CreateSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const org = await getCallerOrg(supabase, userId);
    await requireOrgAdmin(supabase, userId, org.id);

    const external_name = buildExternalName(org.slug, data.display_name);
    const suggestedToken = uuidv4();

    const apikey = getHook7GlobalApiKey();
    const created: any = await hook7Fetch("/instance/create", {
      method: "POST",
      apikey,
      body: { name: external_name, token: suggestedToken },
    });
    const ext_id = created?.data?.id;
    const ext_name = created?.data?.name ?? external_name;
    const token = created?.data?.token ?? suggestedToken;
    if (!ext_id || !token) throw new Error("Resposta inesperada do Hook7 ao criar instância.");

    // Resolve owner depending on mode
    let owner_user_id: string | null = null;
    if (org.whatsapp_mode === "per_user") {
      owner_user_id = data.owner_user_id ?? userId;
    }

    const { data: ins, error: insErr } = await supabase
      .from("hook7_instances")
      .insert({
        organization_id: org.id,
        owner_user_id,
        display_name: data.display_name,
        external_id: ext_id,
        external_name: ext_name,
        status: "pending_qr",
        created_by: userId,
      })
      .select("id, display_name, external_name, status")
      .single();
    if (insErr) {
      // Best-effort cleanup on Hook7 if local insert fails
      try { await hook7Fetch(`/instance/${encodeURIComponent(ext_name)}`, { method: "DELETE", apikey, timeoutMs: 8000 }); } catch {}
      throw new Error(insErr.message);
    }

    // Encrypt + store token via SECURITY DEFINER fn
    const { error: tokErr } = await supabase.rpc("set_hook7_instance_token", {
      _instance_id: ins.id,
      _token: token,
    });
    if (tokErr) {
      // rollback: delete local + remote
      await supabase.from("hook7_instances").delete().eq("id", ins.id);
      try { await hook7Fetch(`/instance/${encodeURIComponent(ext_name)}`, { method: "DELETE", apikey, timeoutMs: 8000 }); } catch {}
      throw new Error(`Falha ao salvar token: ${tokErr.message}`);
    }

    return { instance: ins };
  });

async function loadInstanceForAction(supabase: any, userId: string, instance_id: string) {
  const { data: inst, error } = await supabase
    .from("hook7_instances")
    .select("id, organization_id, external_name, status")
    .eq("id", instance_id)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!inst) throw new Error("Instância não encontrada.");
  await requireOrgAdmin(supabase, userId, inst.organization_id);
  const { data: token, error: tErr } = await supabase.rpc("get_hook7_instance_token", { _instance_id: inst.id });
  if (tErr) throw new Error(tErr.message);
  if (!token) throw new Error("Token da instância indisponível.");
  return { inst, token: token as string };
}

const IdSchema = z.object({ instance_id: z.string().uuid() });

export const connectHook7Instance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => IdSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { inst, token } = await loadInstanceForAction(supabase, userId, data.instance_id);
    await hook7Fetch("/instance/connect", {
      method: "POST",
      apikey: token,
      body: { immediate: true, webhookUrl: "", subscribe: [] },
    });
    await supabase
      .from("hook7_instances")
      .update({ status: "qr_ready", last_qr_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", inst.id);
    return { ok: true };
  });

export const getHook7InstanceQR = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => IdSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { token } = await loadInstanceForAction(supabase, userId, data.instance_id);
    const r: any = await hook7Fetch("/instance/qr", { method: "GET", apikey: token });
    const raw = r?.data?.qrcode ?? r?.qrcode ?? r?.data?.qr ?? null;
    let qrcode_base64: string | null = null;
    if (typeof raw === "string" && raw.length > 0) {
      // Strip optional data: prefix
      qrcode_base64 = raw.replace(/^data:image\/[a-z+]+;base64,/i, "");
    }
    return { qrcode_base64 };
  });

export const getHook7InstanceStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => IdSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { inst, token } = await loadInstanceForAction(supabase, userId, data.instance_id);
    const r: any = await hook7Fetch("/instance/status", { method: "GET", apikey: token });
    const d = r?.data ?? r ?? {};
    const isConnected: boolean = !!d.connected;
    const jid: string | undefined = d.jid ?? d.wid ?? d.phone ?? undefined;
    const phoneFromJid = jid ? String(jid).split("@")[0] : undefined;
    const disconnectReason: string | undefined = d.disconnect_reason ?? d.disconnectReason ?? undefined;
    let nextStatus: string;
    let phone_number: string | null | undefined = undefined;
    if (isConnected) {
      nextStatus = "connected";
      phone_number = phoneFromJid ?? null;
    } else if (d.banned === true || /ban/i.test(disconnectReason ?? "")) {
      nextStatus = "banned";
    } else if (!disconnectReason) {
      nextStatus = "qr_ready";
    } else {
      nextStatus = "error";
    }

    const patch: Record<string, any> = {
      status: nextStatus,
      last_status_check_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (nextStatus === "connected") {
      patch.last_connected_at = new Date().toISOString();
      if (phone_number !== undefined) patch.phone_number = phone_number;
    }
    await supabase.from("hook7_instances").update(patch as any).eq("id", inst.id);
    return { status: nextStatus, phone_number: phone_number ?? undefined };
  });

export const disconnectHook7Instance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => IdSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { inst, token } = await loadInstanceForAction(supabase, userId, data.instance_id);
    try {
      await hook7Fetch("/instance/disconnect", { method: "POST", apikey: token, body: {} });
    } catch (e: any) {
      // swallow remote error if instance already gone, but still mark local
    }
    await supabase
      .from("hook7_instances")
      .update({ status: "disconnected", last_disconnected_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", inst.id);
    return { ok: true };
  });

export const reconnectHook7Instance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => IdSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { inst, token } = await loadInstanceForAction(supabase, userId, data.instance_id);
    try {
      await hook7Fetch("/instance/reconnect", { method: "POST", apikey: token, body: {} });
    } catch {
      // fallback to connect
      await hook7Fetch("/instance/connect", {
        method: "POST", apikey: token,
        body: { immediate: true, webhookUrl: "", subscribe: [] },
      });
    }
    await supabase
      .from("hook7_instances")
      .update({ status: "qr_ready", last_qr_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", inst.id);
    return { ok: true };
  });

export const deleteHook7Instance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => IdSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: inst, error } = await supabase
      .from("hook7_instances")
      .select("id, organization_id, external_name")
      .eq("id", data.instance_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!inst) throw new Error("Instância não encontrada.");
    await requireOrgAdmin(supabase, userId, inst.organization_id);

    const apikey = getHook7GlobalApiKey();
    try {
      await hook7Fetch(`/instance/${encodeURIComponent(inst.external_name)}`, {
        method: "DELETE", apikey, timeoutMs: 10000,
      });
    } catch {
      // best-effort
    }
    await supabase
      .from("hook7_instances")
      .update({ archived_at: new Date().toISOString(), status: "disconnected", updated_at: new Date().toISOString() })
      .eq("id", inst.id);
    return { ok: true };
  });

const RenameSchema = z.object({
  instance_id: z.string().uuid(),
  display_name: z.string().trim().min(1).max(60),
});

export const renameHook7Instance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => RenameSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: inst } = await supabase
      .from("hook7_instances").select("id, organization_id").eq("id", data.instance_id).maybeSingle();
    if (!inst) throw new Error("Instância não encontrada.");
    await requireOrgAdmin(supabase, userId, inst.organization_id);
    const { error } = await supabase
      .from("hook7_instances")
      .update({ display_name: data.display_name, updated_at: new Date().toISOString() })
      .eq("id", inst.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
