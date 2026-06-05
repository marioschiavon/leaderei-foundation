import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  normalizeCompanyDomain,
  runPipedriveSync,
  validatePipedriveToken,
  type SyncCursors,
} from "./pipedrive.server";

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

async function getPipedriveProviderId(supabase: any): Promise<string> {
  const { data, error } = await supabase
    .from("integration_providers")
    .select("id")
    .eq("slug", "pipedrive")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Provider 'pipedrive' não cadastrado.");
  return data.id as string;
}

// ---------------------------------------------------------------------------
// GET connection
// ---------------------------------------------------------------------------

export const getPipedriveConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const organization_id = await getActiveOrgId(supabase, userId);
    const provider_id = await getPipedriveProviderId(supabase);

    const { data: conn } = await supabase
      .from("organization_integrations")
      .select("id, status, config, display_name, last_synced_at, last_error")
      .eq("organization_id", organization_id)
      .eq("provider_id", provider_id)
      .maybeSingle();

    if (!conn) {
      return {
        connected: false,
        company_domain: null as string | null,
        has_token: false,
        last_sync_at: null as string | null,
        last_status: null as string | null,
        last_stats: null as any,
        display_name: null as string | null,
      };
    }

    const { data: creds } = await supabase
      .from("integration_credentials")
      .select("key, value_encrypted")
      .eq("organization_id", organization_id)
      .eq("integration_id", conn.id);
    const hasToken = (creds ?? []).some((c: any) => c.key === "api_token" && !!c.value_encrypted);

    const cfg = (conn.config ?? {}) as { company_domain?: string };

    // Last run summary
    const { data: lastRun } = await supabase
      .from("pipedrive_sync_runs")
      .select("status, stats, finished_at, started_at, error")
      .eq("organization_id", organization_id)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      connected: conn.status === "connected",
      company_domain: cfg.company_domain ?? null,
      has_token: hasToken,
      last_sync_at: lastRun?.finished_at ?? lastRun?.started_at ?? conn.last_synced_at ?? null,
      last_status: lastRun?.status ?? null,
      last_stats: lastRun?.stats ?? null,
      display_name: conn.display_name ?? null,
    };
  });

// ---------------------------------------------------------------------------
// SAVE connection
// ---------------------------------------------------------------------------

const SaveSchema = z.object({
  api_token: z.string().trim().min(10).max(200),
  company_domain: z.string().trim().min(3).max(120),
});

export const savePipedriveConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SaveSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const organization_id = await getActiveOrgId(supabase, userId);
    const provider_id = await getPipedriveProviderId(supabase);

    const company_domain = normalizeCompanyDomain(data.company_domain);
    const me = await validatePipedriveToken({ api_token: data.api_token, company_domain });

    const { data: existing } = await supabase
      .from("organization_integrations")
      .select("id, config")
      .eq("organization_id", organization_id)
      .eq("provider_id", provider_id)
      .maybeSingle();

    let integration_id: string;
    const newConfig = {
      ...(existing?.config ?? {}),
      company_domain,
      pipedrive_user_id: me.user_id,
      pipedrive_user_name: me.name,
    };

    if (existing) {
      const { data: updated, error } = await supabase
        .from("organization_integrations")
        .update({
          status: "connected",
          config: newConfig,
          display_name: company_domain,
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
      const { data: inserted, error } = await supabase
        .from("organization_integrations")
        .insert({
          organization_id,
          provider_id,
          status: "connected",
          config: newConfig,
          display_name: company_domain,
          connected_by: userId,
          connected_at: new Date().toISOString(),
          last_synced_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      integration_id = inserted.id;
    }

    const { error: credErr } = await supabase
      .from("integration_credentials")
      .upsert(
        {
          organization_id,
          integration_id,
          key: "api_token",
          value_encrypted: data.api_token,
          metadata: {} as any,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "integration_id,key" },
      );
    if (credErr) throw new Error(credErr.message);

    return { ok: true, integration_id, pipedrive_user: me };
  });

// ---------------------------------------------------------------------------
// DISCONNECT
// ---------------------------------------------------------------------------

export const disconnectPipedrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ clear_cursors: z.boolean().optional() }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const organization_id = await getActiveOrgId(supabase, userId);
    const provider_id = await getPipedriveProviderId(supabase);

    const { data: conn } = await supabase
      .from("organization_integrations")
      .select("id, config")
      .eq("organization_id", organization_id)
      .eq("provider_id", provider_id)
      .maybeSingle();
    if (!conn) return { ok: true };

    await supabase.from("integration_credentials").delete().eq("integration_id", conn.id);

    const newConfig: Record<string, any> = { ...(conn.config ?? {}) };
    if (data.clear_cursors) {
      delete newConfig.pipedrive_cursors;
    }

    await supabase
      .from("organization_integrations")
      .update({
        status: "disconnected",
        config: newConfig,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conn.id);

    return { ok: true };
  });

// ---------------------------------------------------------------------------
// SYNC NOW
// ---------------------------------------------------------------------------

export const syncPipedriveNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ full: z.boolean().optional() }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const organization_id = await getActiveOrgId(supabase, userId);
    const provider_id = await getPipedriveProviderId(supabase);

    const { data: conn } = await supabase
      .from("organization_integrations")
      .select("id, config, status")
      .eq("organization_id", organization_id)
      .eq("provider_id", provider_id)
      .maybeSingle();
    if (!conn || conn.status !== "connected") {
      throw new Error("Pipedrive não está conectado.");
    }

    const { data: creds } = await supabase
      .from("integration_credentials")
      .select("key, value_encrypted")
      .eq("integration_id", conn.id)
      .eq("key", "api_token")
      .maybeSingle();
    const api_token = creds?.value_encrypted ?? null;
    if (!api_token) throw new Error("Token Pipedrive ausente. Reconecte a integração.");

    const cfg = (conn.config ?? {}) as { company_domain?: string; pipedrive_cursors?: SyncCursors };
    const company_domain = cfg.company_domain;
    if (!company_domain) throw new Error("Domínio Pipedrive ausente. Reconecte a integração.");

    const cursors: SyncCursors = data.full ? {} : cfg.pipedrive_cursors ?? {};

    // Create run row
    const { data: run, error: runErr } = await supabase
      .from("pipedrive_sync_runs")
      .insert({
        organization_id,
        triggered_by: userId,
        status: "running",
        stats: {},
      })
      .select("id")
      .single();
    if (runErr) throw new Error(runErr.message);

    try {
      const result = await runPipedriveSync({
        supabase,
        organizationId: organization_id,
        credentials: { api_token, company_domain },
        cursors,
      });

      await supabase
        .from("pipedrive_sync_runs")
        .update({
          status: result.status,
          stats: result.stats as any,
          finished_at: new Date().toISOString(),
          error: result.status === "partial"
            ? Object.values(result.stats)
                .map((s: any) => s?.error)
                .filter(Boolean)
                .join(" | ") || null
            : null,
        })
        .eq("id", run.id);

      await supabase
        .from("organization_integrations")
        .update({
          config: { ...cfg, pipedrive_cursors: result.newCursors },
          last_synced_at: new Date().toISOString(),
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", conn.id);

      return { ok: true, run_id: run.id, status: result.status, stats: result.stats };
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      await supabase
        .from("pipedrive_sync_runs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          error: msg,
        })
        .eq("id", run.id);
      await supabase
        .from("organization_integrations")
        .update({ last_error: msg, updated_at: new Date().toISOString() })
        .eq("id", conn.id);
      throw new Error(msg);
    }
  });

// ---------------------------------------------------------------------------
// LIST recent runs
// ---------------------------------------------------------------------------

export const listPipedriveSyncRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const organization_id = await getActiveOrgId(supabase, userId);
    const { data, error } = await supabase
      .from("pipedrive_sync_runs")
      .select("id, status, stats, error, started_at, finished_at, triggered_by")
      .eq("organization_id", organization_id)
      .order("started_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return { runs: data ?? [] };
  });
