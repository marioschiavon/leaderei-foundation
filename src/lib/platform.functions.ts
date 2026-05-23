import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmailInternal } from "./email.functions";
import { renderBaseTemplate } from "./email-templates/base";

async function requireMaster(supabase: any, userId: string) {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (!(roles ?? []).some((r: any) => r.role === "master_admin")) {
    throw new Error("Apenas administradores master podem executar esta ação.");
  }
}

// ----- Settings overview -----
export const getPlatformSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireMaster(context.supabase, context.userId);
    const sa = supabaseAdmin;
    const { data: rows, error } = await sa
      .from("platform_settings")
      .select("key, is_secret, value_plain, value_encrypted, description, updated_at, updated_by");
    if (error) throw new Error(error.message);
    const map: Record<string, { is_secret: boolean; value_plain: any; has_secret: boolean; description: string | null; updated_at: string | null }> = {};
    for (const r of rows ?? []) {
      map[r.key] = {
        is_secret: r.is_secret,
        value_plain: r.value_plain,
        has_secret: r.is_secret && !!r.value_encrypted,
        description: r.description,
        updated_at: r.updated_at,
      };
    }
    return map;
  });

// ----- Resend key save -----
const ResendKeySchema = z.object({
  apiKey: z.string().trim().min(20).max(200).regex(/^re_/, "A chave Resend deve começar com 're_'."),
});

export const setPlatformResendKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ResendKeySchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireMaster(context.supabase, context.userId);
    // Validate by calling Resend domains endpoint
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    let testRes: Response;
    try {
      testRes = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${data.apiKey}` },
        signal: ctrl.signal,
      });
    } catch (e: any) {
      clearTimeout(timer);
      throw new Error(`Falha ao contactar Resend: ${e?.message ?? e}`);
    }
    clearTimeout(timer);
    if (testRes.status === 401 || testRes.status === 403) {
      throw new Error("Chave inválida — verifique no dashboard do Resend.");
    }
    if (!testRes.ok) {
      throw new Error(`Resend retornou ${testRes.status}. Tente novamente.`);
    }
    // Save via SECURITY DEFINER fn (called as the master user)
    const { error } = await context.supabase.rpc("set_platform_secret", {
      _key: "resend_global_api_key",
      _value: data.apiKey,
    });
    if (error) throw new Error(error.message);

    // Audit row
    await supabaseAdmin.rpc("log_email_send", {
      _organization_id: null as any,
      _purpose: "system_alert",
      _from_email: "system",
      _to_email: "audit@leaderei",
      _subject: "Resend global key updated",
      _template_key: null as any,
      _triggered_by: context.userId as any,
      _metadata: { action: "set_resend_global_api_key" } as any,
    });
    return { ok: true };
  });

// ----- Plain settings save -----
const PlainSchema = z.object({
  key: z.enum(["app_public_url", "logo_public_url", "resend_global_from_email", "resend_global_from_name"]),
  value: z.any(),
});

export const setPlatformPlain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PlainSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireMaster(context.supabase, context.userId);
    const { error } = await context.supabase.rpc("set_platform_plain", {
      _key: data.key,
      _value: (data.value ?? null) as any,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ----- Send test email -----
export const sendTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ to: z.string().trim().email() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireMaster(context.supabase, context.userId);
    const { data: logoRow } = await supabaseAdmin.rpc("get_platform_plain", { _key: "logo_public_url" });
    const logoUrl = typeof logoRow === "string" ? logoRow : null;
    const { html, text } = renderBaseTemplate({
      preheader: "Teste de envio do Leaderei.",
      bodyHtml: `<h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1a1a1a">Funcionou! 🎉</h1>
        <p style="margin:0 0 12px">Este é um email de teste do Leaderei. Se você está vendo isso bonitinho com logo, cores e botão, o envio transacional global está operacional.</p>
        <p style="margin:0;color:#6b7280;font-size:13px">Enviado em ${new Date().toLocaleString("pt-BR")}.</p>`,
      bodyText: "Teste de envio do Leaderei — funcionou.",
      logoUrl,
    });
    const r = await sendEmailInternal({
      to: data.to,
      subject: "Teste — Leaderei email transacional",
      html, text,
      purpose: "system_alert",
      template_key: "test_v1",
      triggered_by: context.userId,
      metadata: { kind: "manual_test" },
    });
    return r;
  });

// ----- Logs -----
const LogsFiltersSchema = z.object({
  status: z.enum(["queued","sent","failed","bounced","delivered","all"]).optional().default("all"),
  purpose: z.enum(["invitation","welcome","password_reset","system_alert","campaign","inbox_reply","all"]).optional().default("all"),
  from_date: z.string().datetime().optional().nullable(),
  to_date: z.string().datetime().optional().nullable(),
  page: z.number().int().min(1).max(500).optional().default(1),
  page_size: z.number().int().min(5).max(200).optional().default(50),
});

export const listEmailSendLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => LogsFiltersSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    await requireMaster(context.supabase, context.userId);
    let q = supabaseAdmin
      .from("email_send_log")
      .select("id, organization_id, purpose, provider, from_email, to_email, subject, template_key, provider_message_id, status, error_message, metadata, created_at", { count: "exact" })
      .order("created_at", { ascending: false });
    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.purpose !== "all") q = q.eq("purpose", data.purpose);
    if (data.from_date) q = q.gte("created_at", data.from_date);
    if (data.to_date) q = q.lte("created_at", data.to_date);
    const from = (data.page - 1) * data.page_size;
    const to = from + data.page_size - 1;
    const { data: rows, error, count } = await q.range(from, to);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], total: count ?? 0, page: data.page, page_size: data.page_size };
  });

// ----- Upload arbitrary file (logo) to public-assets -----
export const uploadLogoFromDataUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      filename: z.string().trim().min(1).max(120).regex(/^[a-zA-Z0-9._-]+$/),
      data_url: z.string().min(20).max(2_000_000), // ~1.5MB image cap
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireMaster(context.supabase, context.userId);
    const m = data.data_url.match(/^data:(image\/(?:png|jpeg|jpg|svg\+xml|webp));base64,(.+)$/);
    if (!m) throw new Error("Formato inválido. Use PNG, JPG, SVG ou WebP até ~1.5MB.");
    const mime = m[1];
    const bytes = Buffer.from(m[2], "base64");
    const ext = mime.split("/")[1].replace("+xml", "");
    const path = `logos/${data.filename.replace(/\.[a-z0-9]+$/i, "")}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("public-assets")
      .upload(path, bytes, { contentType: mime, upsert: false });
    if (upErr) throw new Error(upErr.message);
    const { data: pub } = supabaseAdmin.storage.from("public-assets").getPublicUrl(path);
    // Save URL into logo_public_url
    await context.supabase.rpc("set_platform_plain", {
      _key: "logo_public_url",
      _value: pub.publicUrl as any,
    });
    return { url: pub.publicUrl };
  });
