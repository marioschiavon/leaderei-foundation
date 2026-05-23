import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SystemPurposes = ["invitation", "welcome", "password_reset", "system_alert"] as const;
const OrgPurposes = ["campaign", "inbox_reply"] as const;
type SystemPurpose = (typeof SystemPurposes)[number];
type OrgPurpose = (typeof OrgPurposes)[number];
export type EmailPurpose = SystemPurpose | OrgPurpose;

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  purpose: EmailPurpose;
  organization_id?: string | null;
  template_key?: string | null;
  metadata?: Record<string, unknown>;
  reply_to?: string;
  triggered_by?: string | null;
  idempotency_key?: string;
}

interface SendResult {
  id: string;                 // email_send_log id
  provider_message_id: string | null;
  status: "sent" | "failed";
}

async function getGlobalConfig() {
  const sa = supabaseAdmin;
  const [apiKey, fromEmail, fromName] = await Promise.all([
    sa.rpc("get_platform_secret", { _key: "resend_global_api_key" }),
    sa.rpc("get_platform_plain", { _key: "resend_global_from_email" }),
    sa.rpc("get_platform_plain", { _key: "resend_global_from_name" }),
  ]);
  const key = (apiKey.data ?? null) as string | null;
  const email = (fromEmail.data ?? null) as string | null;
  const name = (fromName.data ?? null) as string | null;
  return { apiKey: key, fromEmail: email ?? "leaderei@s7cloud.com.br", fromName: name ?? "Leaderei" };
}

async function getOrgConfig(organization_id: string) {
  const sa = supabaseAdmin;
  const { data: provider } = await sa
    .from("integration_providers")
    .select("id")
    .eq("slug", "resend")
    .maybeSingle();
  if (!provider) return null;
  const { data: conn } = await sa
    .from("organization_integrations")
    .select("id, status, config")
    .eq("organization_id", organization_id)
    .eq("provider_id", provider.id)
    .maybeSingle();
  if (!conn || conn.status !== "connected") return null;
  const { data: creds } = await sa
    .from("integration_credentials")
    .select("key, value_encrypted, metadata")
    .eq("organization_id", organization_id)
    .eq("integration_id", conn.id);
  const map = new Map<string, any>((creds ?? []).map((c) => [c.key, c]));
  const apiKey = map.get("api_key")?.value_encrypted as string | undefined;
  const fromEmail = (conn.config as any)?.from_email as string | undefined;
  const fromName = (conn.config as any)?.from_name as string | undefined;
  if (!apiKey || !fromEmail) return null;
  return { apiKey, fromEmail, fromName: fromName ?? "Leaderei" };
}

/**
 * Central sendEmail router. Returns the log id and provider message id on success.
 * Throws an Error with a clear message on failure (after logging the failed attempt).
 */
export async function sendEmailInternal(input: SendEmailInput): Promise<SendResult> {
  const sa = supabaseAdmin;
  const isSystem = (SystemPurposes as readonly string[]).includes(input.purpose);

  let apiKey: string | null = null;
  let fromEmail = "";
  let fromName = "";

  if (isSystem) {
    const cfg = await getGlobalConfig();
    if (!cfg.apiKey) {
      throw new Error(
        "Chave Resend global não configurada. Um administrador master precisa configurá-la em Master → Plataforma."
      );
    }
    apiKey = cfg.apiKey;
    fromEmail = cfg.fromEmail;
    fromName = cfg.fromName;
  } else {
    if (!input.organization_id) {
      throw new Error("organization_id obrigatório para envios por organização.");
    }
    const cfg = await getOrgConfig(input.organization_id);
    if (!cfg) {
      throw new Error(
        "Esta organização não conectou o Resend. Conecte em Integrações para enviar campanhas e respostas."
      );
    }
    apiKey = cfg.apiKey;
    fromEmail = cfg.fromEmail;
    fromName = cfg.fromName;
  }

  const fromHeader = `${fromName} <${fromEmail}>`;
  const toArr = Array.isArray(input.to) ? input.to : [input.to];

  // Log queued
  const { data: logId, error: logErr } = await sa.rpc("log_email_send", {
    _organization_id: input.organization_id ?? null,
    _purpose: input.purpose,
    _from_email: fromEmail,
    _to_email: toArr.join(","),
    _subject: input.subject,
    _template_key: input.template_key ?? null,
    _triggered_by: input.triggered_by ?? null,
    _metadata: (input.metadata ?? {}) as any,
  });
  if (logErr) throw new Error(`log_email_send: ${logErr.message}`);
  const id = logId as unknown as string;

  // Send via Resend
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromHeader,
        to: toArr,
        subject: input.subject,
        html: input.html,
        text: input.text,
        reply_to: input.reply_to,
        tags: [
          { name: "purpose", value: input.purpose },
          { name: "org_id", value: input.organization_id ?? "system" },
        ],
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (payload as any)?.message || (payload as any)?.error || `HTTP ${res.status}`;
      await sa.rpc("update_email_send_status", {
        _id: id, _status: "failed", _provider_message_id: null as any, _error_message: String(msg).slice(0, 1000),
      });
      throw new Error(`Resend: ${msg}`);
    }
    const messageId = (payload as any)?.id ?? null;
    await sa.rpc("update_email_send_status", {
      _id: id, _status: "sent", _provider_message_id: (messageId ?? null) as any, _error_message: null as any,
    });
    return { id, provider_message_id: messageId, status: "sent" };
  } catch (e: any) {
    await sa.rpc("update_email_send_status", {
      _id: id, _status: "failed", _provider_message_id: null as any,
      _error_message: String(e?.message ?? e).slice(0, 1000),
    });
    throw e;
  }
}

// Exposed as a server function for the master "send test" button.
export const sendEmailFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      to: z.union([z.string().email(), z.array(z.string().email()).min(1)]),
      subject: z.string().min(1).max(300),
      html: z.string().min(1),
      text: z.string().optional(),
      purpose: z.enum(["invitation", "welcome", "password_reset", "system_alert", "campaign", "inbox_reply"]),
      organization_id: z.string().uuid().nullable().optional(),
      template_key: z.string().max(80).nullable().optional(),
      metadata: z.record(z.string(), z.any()).optional(),
      reply_to: z.string().email().optional(),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    // Only master can use the generic exposed fn (system_alert/test sends).
    const { supabase, userId } = context;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isMaster = (roles ?? []).some((r: any) => r.role === "master_admin");
    if (!isMaster) throw new Error("Forbidden");
    return sendEmailInternal({ ...data, triggered_by: userId });
  });
