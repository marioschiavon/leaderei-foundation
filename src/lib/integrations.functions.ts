import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getActiveOrgId(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Sem organização ativa.");
  return data.organization_id as string;
}

export const getOrgResendConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const organization_id = await getActiveOrgId(supabase, userId);
    const { data: provider } = await supabase
      .from("integration_providers")
      .select("id")
      .eq("slug", "resend")
      .maybeSingle();
    if (!provider) return { provider_id: null, connection: null, from_email: null, from_name: null, has_key: false };
    const { data: conn } = await supabase
      .from("organization_integrations")
      .select("id, status, config, display_name, last_synced_at, last_error")
      .eq("organization_id", organization_id)
      .eq("provider_id", provider.id)
      .maybeSingle();
    if (!conn) return { provider_id: provider.id, connection: null, from_email: null, from_name: null, has_key: false };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: creds } = await supabaseAdmin
      .from("integration_credentials")
      .select("key, value_encrypted")
      .eq("organization_id", organization_id)
      .eq("integration_id", conn.id);
    const hasKey = (creds ?? []).some((c: any) => c.key === "api_key" && !!c.value_encrypted);
    const cfg = (conn.config ?? {}) as { from_email?: string; from_name?: string };
    return {
      provider_id: provider.id,
      connection: conn,
      from_email: cfg.from_email ?? null,
      from_name: cfg.from_name ?? null,
      has_key: hasKey,
    };
  });

const SaveSchema = z.object({
  api_key: z.string().trim().min(20).max(200).regex(/^re_/, "A chave Resend deve começar com 're_'."),
  from_email: z.string().trim().email().max(255),
  from_name: z.string().trim().min(1).max(80),
});

export const saveOrgResendConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SaveSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const organization_id = await getActiveOrgId(supabase, userId);

    // Validate key by hitting Resend
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    let res: Response;
    try {
      res = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${data.api_key}` },
        signal: ctrl.signal,
      });
    } catch (e: any) {
      clearTimeout(timer);
      throw new Error(`Falha ao contactar Resend: ${e?.message ?? e}`);
    }
    clearTimeout(timer);
    if (res.status === 401 || res.status === 403) {
      throw new Error("Chave inválida — verifique no dashboard do Resend.");
    }
    if (!res.ok) throw new Error(`Resend retornou ${res.status}.`);

    const { data: provider, error: pErr } = await supabase
      .from("integration_providers")
      .select("id")
      .eq("slug", "resend")
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!provider) throw new Error("Provider 'resend' não cadastrado.");

    // After validating org membership via getActiveOrgId, use admin client
    // for writes so the integration policy (which requires global
    // has_role(uid, 'company_admin')) doesn't block legitimate org members
    // (e.g. master_admin who is company_admin of their own org via
    // organization_members, but not in user_roles globally).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Upsert connection
    const { data: existing } = await supabaseAdmin
      .from("organization_integrations")
      .select("id")
      .eq("organization_id", organization_id)
      .eq("provider_id", provider.id)
      .maybeSingle();

    let integration_id: string;
    if (existing) {
      const { data: updated, error } = await supabaseAdmin
        .from("organization_integrations")
        .update({
          status: "connected",
          config: { from_email: data.from_email, from_name: data.from_name } as any,
          display_name: data.from_email,
          connected_by: userId,
          connected_at: new Date().toISOString(),
          last_synced_at: new Date().toISOString(),
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      integration_id = updated.id;
    } else {
      const { data: inserted, error } = await supabaseAdmin
        .from("organization_integrations")
        .insert({
          organization_id,
          provider_id: provider.id,
          status: "connected",
          config: { from_email: data.from_email, from_name: data.from_name } as any,
          display_name: data.from_email,
          connected_by: userId,
          connected_at: new Date().toISOString(),
          last_synced_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      integration_id = inserted.id;
    }

    // Upsert api_key credential
    const { error: credErr } = await supabaseAdmin
      .from("integration_credentials")
      .upsert(
        {
          organization_id,
          integration_id,
          key: "api_key",
          value_encrypted: data.api_key,
          metadata: {} as any,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "integration_id,key" },
      );
    if (credErr) throw new Error(credErr.message);

    return { ok: true, integration_id };
  });

export const disconnectOrgResend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const organization_id = await getActiveOrgId(supabase, userId);
    const { data: provider } = await supabase
      .from("integration_providers")
      .select("id")
      .eq("slug", "resend")
      .maybeSingle();
    if (!provider) return { ok: true };
    const { data: conn } = await supabase
      .from("organization_integrations")
      .select("id")
      .eq("organization_id", organization_id)
      .eq("provider_id", provider.id)
      .maybeSingle();
    if (!conn) return { ok: true };
    await supabase.from("integration_credentials").delete().eq("integration_id", conn.id);
    await supabase
      .from("organization_integrations")
      .update({ status: "disconnected", updated_at: new Date().toISOString() })
      .eq("id", conn.id);
    return { ok: true };
  });
