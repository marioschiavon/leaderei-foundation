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

// Eventos do Hook7 que o Leaderei processa.
// Valores válidos do Hook7 (UPPER_SNAKE_CASE): MESSAGE, SEND_MESSAGE, READ_RECEIPT,
// PRESENCE, HISTORY_SYNC, CHAT_PRESENCE, CALL, CONNECTION, LABEL, CONTACT, GROUP,
// NEWSLETTER, QRCODE, BUTTON_CLICK.
const HOOK7_SUBSCRIBE_EVENTS = [
  "MESSAGE",        // Mensagens recebidas (IsFromMe:false) e enviadas (IsFromMe:true)
  "SEND_MESSAGE",   // Confirmação de envio (descartamos — MESSAGE outbound cobre)
  "READ_RECEIPT",   // delivered + read
  "CONNECTION",     // Connected / LoggedOut / Disconnected
] as const;

function buildHook7WebhookUrl(orgSlug: string): string {
  const secret = (process.env.HOOK7_WEBHOOK_SECRET ?? "").trim();
  const supaUrl = (process.env.SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
  if (!secret || !supaUrl) return "";
  return `${supaUrl}/functions/v1/hook7-webhook/${secret}/${encodeURIComponent(orgSlug)}`;
}

async function getOrgSlug(organization_id: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("organizations")
    .select("slug")
    .eq("id", organization_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.slug ?? "") as string;
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

export const getHook7WebhookStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertMasterAdmin(supabase, userId);
    const secret = (process.env.HOOK7_WEBHOOK_SECRET ?? "").trim();
    const supaUrl = (process.env.SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
    const configured = !!secret && !!supaUrl;
    const urlMasked = configured
      ? `${supaUrl}/functions/v1/hook7-webhook/****/{org-slug}`
      : null;
    return { configured, urlMasked };
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
      .select("id, display_name, external_name, status, phone_number, connected_profile_name, owner_user_id, last_connected_at, last_qr_at, created_at")
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
    if (ext_name !== external_name) {
      console.warn(`[hook7] external_name mismatch sent=${external_name} got=${ext_name} — using server truth`);
    }

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
  // Use admin client to distinguish "row missing" vs "no permission" vs "archived".
  const { data: inst, error } = await supabaseAdmin
    .from("hook7_instances")
    .select("id, organization_id, external_name, status, archived_at")
    .eq("id", instance_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!inst) {
    console.warn(`[hook7] loadInstanceForAction: not found (instance_id=${instance_id}, user_id=${userId})`);
    throw new Error(`Instância não encontrada (ID: ${instance_id}).`);
  }
  if (inst.archived_at) {
    console.warn(`[hook7] loadInstanceForAction: archived (instance_id=${instance_id}, user_id=${userId})`);
    throw new Error("Instância arquivada.");
  }
  try {
    await requireOrgAdmin(supabase, userId, inst.organization_id);
  } catch {
    console.warn(`[hook7] loadInstanceForAction: forbidden (instance_id=${instance_id}, user_id=${userId})`);
    throw new Error("Acesso negado à instância.");
  }
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
    const orgSlug = await getOrgSlug(inst.organization_id);
    const webhookUrl = buildHook7WebhookUrl(orgSlug);
    if (!webhookUrl) {
      console.warn(`[hook7] HOOK7_WEBHOOK_SECRET ausente — conectando sem webhook (instance_id=${inst.id})`);
    }
    await hook7Fetch("/instance/connect", {
      method: "POST",
      apikey: token,
      body: { immediate: true, webhookUrl, subscribe: HOOK7_SUBSCRIBE_EVENTS },
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
    // Hook7 returns { data: { Qrcode: "data:image/png;base64,...", Code: "..." } }
    const raw = r?.data?.Qrcode ?? r?.data?.qrcode ?? r?.qrcode ?? null;
    const qrcode_base64: string | null = typeof raw === "string" && raw.length > 0 ? raw : null;
    return { qrcode_base64 };
  });

export const getHook7InstanceStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => IdSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { inst, token } = await loadInstanceForAction(supabase, userId, data.instance_id);
    let r: any;
    try {
      r = await hook7Fetch("/instance/status", { method: "GET", apikey: token });
    } catch (e: any) {
      console.warn(`[hook7] status fetch failed (instance_id=${inst.id}): ${e?.message ?? "unknown"}`);
      const patch = {
        status: "error",
        last_status_check_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await supabase.from("hook7_instances").update(patch as any).eq("id", inst.id);
      return { status: "error", connected_profile_name: null };
    }
    // Hook7 returns { data: { Connected: bool, LoggedIn: bool, Name: "..." } }
    const d = r?.data ?? {};
    const Connected: boolean = d.Connected === true;
    const LoggedIn: boolean = d.LoggedIn === true;
    const Name: string | null = typeof d.Name === "string" && d.Name.length > 0 ? d.Name : null;

    let nextStatus: string;
    if (Connected && LoggedIn) {
      nextStatus = "connected";
    } else {
      // Keep waiting on QR; never auto-flip to disconnected here.
      nextStatus = inst.status === "connected" ? "connected" : "qr_ready";
    }

    const patch: Record<string, any> = {
      status: nextStatus,
      last_status_check_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (nextStatus === "connected") {
      patch.last_connected_at = new Date().toISOString();
      if (Name) patch.connected_profile_name = Name;
      // phone_number stays NULL until webhook (rodada 1B) delivers it.
    }
    await supabase.from("hook7_instances").update(patch as any).eq("id", inst.id);
    return { status: nextStatus, connected_profile_name: Name };
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
    const orgSlug = await getOrgSlug(inst.organization_id);
    const webhookUrl = buildHook7WebhookUrl(orgSlug);
    try {
      await hook7Fetch("/instance/reconnect", { method: "POST", apikey: token, body: {} });
    } catch {
      // fallback to connect
      await hook7Fetch("/instance/connect", {
        method: "POST", apikey: token,
        body: { immediate: true, webhookUrl, subscribe: HOOK7_SUBSCRIBE_EVENTS },
      });
    }
    await supabase
      .from("hook7_instances")
      .update({ status: "qr_ready", last_qr_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", inst.id);
    return { ok: true };
  });

const DeleteSchema = z.object({
  instance_id: z.string().uuid(),
  reason: z.enum(["user_delete", "cancel", "timeout"]).optional(),
});

export const deleteHook7Instance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => DeleteSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: inst, error } = await supabase
      .from("hook7_instances")
      .select("id, organization_id, external_name, status, archived_at")
      .eq("id", data.instance_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!inst) throw new Error("Instância não encontrada.");
    await requireOrgAdmin(supabase, userId, inst.organization_id);
    if (inst.archived_at) return { ok: true, skipped: "already_archived" };

    const reason = data.reason ?? "user_delete";
    // Cancel/timeout rollback: only archive if NOT connected. Defense in depth
    // so a stray cancel never nukes a freshly-connected instance.
    if ((reason === "cancel" || reason === "timeout") && inst.status === "connected") {
      console.warn(`[hook7] skip archive (reason=${reason}) — instance connected (instance_id=${inst.id}, user_id=${userId})`);
      return { ok: true, skipped: "connected" };
    }

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
    if (reason !== "user_delete") {
      console.warn(`[hook7] instance archived via ${reason}: instance_id=${inst.id}, last_status=${inst.status}, user_id=${userId}`);
    }
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

// ---------------------------------------------------------------------------
// Send WhatsApp message (used by Inbox composer; reusable by Builder later)
// ---------------------------------------------------------------------------

const SendSchema = z.object({
  lead_id: z.string().uuid(),
  text: z.string().trim().min(1).max(4096),
  instance_id: z.string().uuid().optional(),
});

function normalizePhone(raw: string): string {
  return (raw || "").replace(/\D+/g, "");
}

export const sendWhatsAppMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SendSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const org = await getCallerOrg(supabase, userId);

    // 1. Load lead, validate org + phone
    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .select("id, organization_id, phone, full_name")
      .eq("id", data.lead_id)
      .maybeSingle();
    if (leadErr) throw new Error(leadErr.message);
    if (!lead || lead.organization_id !== org.id) {
      throw new Error("Lead não encontrado nesta organização.");
    }
    const phone = normalizePhone(lead.phone ?? "");
    if (!phone) throw new Error("Lead não tem WhatsApp cadastrado.");

    // 2. Pick instance
    let instanceQuery = supabaseAdmin
      .from("hook7_instances")
      .select("id, organization_id, owner_user_id, status, archived_at")
      .eq("organization_id", org.id)
      .is("archived_at", null)
      .eq("status", "connected");
    if (data.instance_id) {
      instanceQuery = instanceQuery.eq("id", data.instance_id);
    } else if (org.whatsapp_mode === "per_user") {
      instanceQuery = instanceQuery.eq("owner_user_id", userId);
    }
    const { data: instances, error: instErr } = await instanceQuery
      .order("last_connected_at", { ascending: false })
      .limit(1);
    if (instErr) throw new Error(instErr.message);
    const inst = instances?.[0];
    if (!inst) throw new Error("Nenhuma instância WhatsApp conectada.");

    // 3. Get token
    const { data: token, error: tokErr } = await supabase.rpc("get_hook7_instance_token", {
      _instance_id: inst.id,
    });
    if (tokErr) throw new Error(tokErr.message);
    if (!token) throw new Error("Token da instância indisponível.");

    // 4. Resolve / create conversation
    let conv: { id: string } | null = null;
    {
      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .eq("organization_id", org.id)
        .eq("lead_id", lead.id)
        .eq("channel", "whatsapp")
        .maybeSingle();
      if (existing) conv = existing;
    }
    if (!conv) {
      const { data: newConv, error: cErr } = await supabase
        .from("conversations")
        .insert({ organization_id: org.id, lead_id: lead.id, channel: "whatsapp" })
        .select("id")
        .single();
      if (cErr) throw new Error(cErr.message);
      conv = newConv;
    }

    // 5. Call Hook7 /send/text
    let sendRes: any;
    try {
      sendRes = await hook7Fetch("/send/text", {
        method: "POST",
        apikey: token as string,
        body: { number: phone, text: data.text },
        timeoutMs: 15000,
      });
    } catch (e: any) {
      // Record failed message
      const { data: failedMsg } = await supabase
        .from("messages")
        .insert({
          organization_id: org.id,
          conversation_id: conv.id,
          channel: "whatsapp",
          direction: "outbound",
          body: data.text,
          source_channel: "whatsapp",
          whatsapp_status: "failed",
          status: "failed",
          sender_user_id: userId,
          failed_reason: String(e?.message ?? "send_failed").slice(0, 500),
        })
        .select("id")
        .single();
      return { ok: false, error: e?.message ?? "Falha ao enviar.", message_id: failedMsg?.id ?? null };
    }

    const info = sendRes?.data?.Info ?? {};
    const externalId: string | null = typeof info.ID === "string" ? info.ID : null;
    const ts: string = typeof info.Timestamp === "string" ? info.Timestamp : new Date().toISOString();

    // 6. Insert outbound row (idempotent via unique partial index on external_message_id)
    const { data: msg, error: mErr } = await supabase
      .from("messages")
      .insert({
        organization_id: org.id,
        conversation_id: conv.id,
        channel: "whatsapp",
        direction: "outbound",
        body: data.text,
        source_channel: "whatsapp",
        whatsapp_status: "sent",
        status: "sent",
        sent_at: ts,
        created_at: ts,
        external_message_id: externalId,
        sender_user_id: userId,
      })
      .select("id")
      .single();
    if (mErr && !String(mErr.message).toLowerCase().includes("duplicate")) {
      throw new Error(mErr.message);
    }

    // Update conversation preview
    await supabase
      .from("conversations")
      .update({
        last_message_at: ts,
        last_message_preview: data.text.slice(0, 140),
        updated_at: new Date().toISOString(),
      })
      .eq("id", conv.id);

    return { ok: true, message_id: msg?.id ?? null, external_message_id: externalId };
  });
