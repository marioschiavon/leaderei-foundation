import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  callApollo,
  mapPersonToLeadPayload,
  mergeLeadPatch,
  searchPeopleWithCache,
  validateApolloKey,
} from "./apollo.server";
import {
  APOLLO_EMPLOYEE_RANGES,
  APOLLO_SENIORITIES,
  type ApolloConnectionStatus,
  type ApolloPerson,
  type ApolloSearchResult,
} from "./apollo.types";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

async function getActiveOrgId(supabase: any, userId: string): Promise<string> {
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

async function getApolloProviderId(supabase: any): Promise<string> {
  const { data, error } = await supabase
    .from("integration_providers")
    .select("id")
    .eq("slug", "apollo")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Provider 'apollo' não cadastrado.");
  return data.id as string;
}

async function getConnectionRow(supabase: any, organization_id: string) {
  const provider_id = await getApolloProviderId(supabase);
  const { data: conn } = await supabase
    .from("organization_integrations")
    .select("id, status, config, display_name, last_synced_at, last_error")
    .eq("organization_id", organization_id)
    .eq("provider_id", provider_id)
    .maybeSingle();
  return { provider_id, conn };
}

async function loadApiKey(_supabase: any, integration_id: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("integration_credentials")
    .select("value_encrypted")
    .eq("integration_id", integration_id)
    .eq("key", "api_key")
    .maybeSingle();
  return (data as any)?.value_encrypted ?? null;
}

// ---------------------------------------------------------------------------
// GET status
// ---------------------------------------------------------------------------

export const getApolloStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ApolloConnectionStatus> => {
    const { supabase, userId } = context;
    const organization_id = await getActiveOrgId(supabase, userId);
    const { conn } = await getConnectionRow(supabase, organization_id);

    if (!conn) {
      return {
        connected: false,
        has_key: false,
        credits_remaining: null,
        plan: null,
        owner_email: null,
        last_check_at: null,
        display_name: null,
        last_error: null,
      };
    }

    const apiKey = await loadApiKey(supabase, conn.id);
    const cfg = (conn.config ?? {}) as Record<string, any>;

    return {
      connected: conn.status === "connected" && !!apiKey,
      has_key: !!apiKey,
      credits_remaining: cfg.credits_remaining ?? null,
      plan: cfg.plan ?? null,
      owner_email: cfg.owner_email ?? null,
      last_check_at: cfg.last_check_at ?? conn.last_synced_at ?? null,
      display_name: conn.display_name ?? null,
      last_error: conn.last_error ?? null,
    };
  });

// ---------------------------------------------------------------------------
// SAVE / CONNECT
// ---------------------------------------------------------------------------

const ConnectSchema = z.object({
  api_key: z.string().trim().min(10).max(200),
});

export const connectApollo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ConnectSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const organization_id = await getActiveOrgId(supabase, userId);
    const provider_id = await getApolloProviderId(supabase);

    // Validate against Apollo
    await validateApolloKey({
      apiKey: data.api_key,
      organization_id,
      supabase,
      triggered_by: userId,
    });

    const { data: existing } = await supabase
      .from("organization_integrations")
      .select("id, config")
      .eq("organization_id", organization_id)
      .eq("provider_id", provider_id)
      .maybeSingle();

    const nowIso = new Date().toISOString();
    const newConfig: Record<string, any> = {
      ...((existing?.config ?? {}) as Record<string, any>),
      last_check_at: nowIso,
    };

    let integration_id: string;
    if (existing) {
      const { data: updated, error } = await supabase
        .from("organization_integrations")
        .update({
          status: "connected",
          config: newConfig,
          display_name: "Apollo.io",
          connected_by: userId,
          connected_at: nowIso,
          last_synced_at: nowIso,
          last_error: null,
          updated_at: nowIso,
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
          display_name: "Apollo.io",
          connected_by: userId,
          connected_at: nowIso,
          last_synced_at: nowIso,
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
          key: "api_key",
          value_encrypted: data.api_key,
          metadata: {} as any,
          updated_at: nowIso,
        },
        { onConflict: "integration_id,key" },
      );
    if (credErr) throw new Error(credErr.message);

    return { ok: true, integration_id };
  });

// ---------------------------------------------------------------------------
// DISCONNECT
// ---------------------------------------------------------------------------

export const disconnectApollo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const organization_id = await getActiveOrgId(supabase, userId);
    const { conn } = await getConnectionRow(supabase, organization_id);
    if (!conn) return { ok: true };

    await supabase.from("integration_credentials").delete().eq("integration_id", conn.id);
    await supabase
      .from("organization_integrations")
      .update({
        status: "disconnected",
        updated_at: new Date().toISOString(),
      })
      .eq("id", conn.id);

    return { ok: true };
  });

// ---------------------------------------------------------------------------
// SEARCH
// ---------------------------------------------------------------------------

const SearchSchema = z.object({
  filters: z.object({
    q_keywords: z.string().trim().max(200).optional(),
    person_titles: z.array(z.string().min(1).max(120)).max(20).optional(),
    person_seniorities: z.array(z.enum(APOLLO_SENIORITIES)).max(11).optional(),
    person_locations: z.array(z.string().min(1).max(120)).max(20).optional(),
    organization_locations: z.array(z.string().min(1).max(120)).max(20).optional(),
    organization_industries: z.array(z.string().min(1).max(120)).max(20).optional(),
    organization_num_employees_ranges: z
      .array(z.enum(APOLLO_EMPLOYEE_RANGES))
      .max(11)
      .optional(),
    per_page: z.number().int().min(1).max(100).optional(),
  }),
  page: z.number().int().min(1).max(5).default(1),
});

export const searchApolloPeople = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SearchSchema.parse(i))
  .handler(async ({ data, context }): Promise<ApolloSearchResult & { existingEmails: string[]; existingApolloIds: string[] }> => {
    const { supabase, userId } = context;
    const organization_id = await getActiveOrgId(supabase, userId);
    const { conn } = await getConnectionRow(supabase, organization_id);
    if (!conn || conn.status !== "connected") {
      throw new Error("Apollo não está conectado.");
    }
    const apiKey = await loadApiKey(supabase, conn.id);
    if (!apiKey) throw new Error("API key Apollo ausente. Reconecte a integração.");

    const result = await searchPeopleWithCache({
      supabase,
      organization_id,
      triggered_by: userId,
      apiKey,
      filters: data.filters,
      page: data.page,
    });

    // Compute dedup hints
    const emails = result.people.map((p) => p.email).filter(Boolean) as string[];
    const ids = result.people.map((p) => p.id).filter(Boolean) as string[];

    const existingEmails: string[] = [];
    const existingApolloIds: string[] = [];

    if (emails.length) {
      const { data: rows } = await supabase
        .from("leads")
        .select("email")
        .eq("organization_id", organization_id)
        .in("email", emails);
      for (const r of rows ?? []) if (r.email) existingEmails.push(String(r.email).toLowerCase());
    }
    if (ids.length) {
      const { data: rows } = await supabase
        .from("leads")
        .select("apollo_person_id")
        .eq("organization_id", organization_id)
        .in("apollo_person_id", ids);
      for (const r of rows ?? []) if (r.apollo_person_id) existingApolloIds.push(r.apollo_person_id);
    }

    return { ...result, existingEmails, existingApolloIds };
  });

// ---------------------------------------------------------------------------
// IMPORT selected
// ---------------------------------------------------------------------------

const ImportSchema = z.object({
  people: z
    .array(
      z.object({
        // Trust the client to echo back the Apollo payload we just sent it.
        // Server still validates structure; we'll re-map.
        id: z.string().min(1),
        first_name: z.string().nullable().optional(),
        last_name: z.string().nullable().optional(),
        name: z.string().nullable().optional(),
        title: z.string().nullable().optional(),
        email: z.string().email().nullable().optional().or(z.literal("")),
        linkedin_url: z.string().nullable().optional(),
        city: z.string().nullable().optional(),
        state: z.string().nullable().optional(),
        country: z.string().nullable().optional(),
        seniority: z.string().nullable().optional(),
        departments: z.array(z.string()).nullable().optional(),
        phone_numbers: z
          .array(
            z.object({
              raw_number: z.string().optional(),
              sanitized_number: z.string().optional(),
              type: z.string().optional(),
            }),
          )
          .nullable()
          .optional(),
        organization: z
          .object({
            id: z.string().optional(),
            name: z.string().optional(),
            website_url: z.string().optional(),
            primary_domain: z.string().optional(),
            industry: z.string().optional(),
            estimated_num_employees: z.number().optional(),
            linkedin_url: z.string().optional(),
          })
          .nullable()
          .optional(),
      }).passthrough(),
    )
    .min(1)
    .max(100),
});

export const importApolloLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ImportSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const organization_id = await getActiveOrgId(supabase, userId);

    // Ensure lead source 'apollo'
    let sourceId: string | null = null;
    try {
      const { data: existingSrc } = await supabase
        .from("lead_sources")
        .select("id")
        .eq("organization_id", organization_id)
        .eq("slug", "apollo")
        .maybeSingle();
      if (existingSrc?.id) {
        sourceId = existingSrc.id;
      } else {
        const { data: created } = await supabase
          .from("lead_sources")
          .insert({
            organization_id,
            name: "Apollo",
            slug: "apollo",
            color: "#1B116E",
            description: "Importado via integração Apollo.io",
          })
          .select("id")
          .single();
        sourceId = created?.id ?? null;
      }
    } catch {
      // ignore
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const person of data.people) {
      const payload = mapPersonToLeadPayload(person as ApolloPerson, organization_id);
      if (sourceId) payload.source_id = sourceId;
      if (userId) payload.created_by = userId;

      // 1) dedup by apollo_person_id
      const { data: byApollo } = await supabase
        .from("leads")
        .select("*")
        .eq("organization_id", organization_id)
        .eq("apollo_person_id", person.id)
        .maybeSingle();

      if (byApollo?.id) {
        const patch = mergeLeadPatch(byApollo, payload);
        if (Object.keys(patch).length) {
          await supabase.from("leads").update(patch as any).eq("id", byApollo.id);
        }
        updated += 1;
        continue;
      }

      // 2) dedup by email
      if (payload.email) {
        const { data: byEmail } = await supabase
          .from("leads")
          .select("*")
          .eq("organization_id", organization_id)
          .ilike("email", payload.email)
          .maybeSingle();
        if (byEmail?.id) {
          const patch = mergeLeadPatch(byEmail, payload);
          if (Object.keys(patch).length) {
            await supabase.from("leads").update(patch as any).eq("id", byEmail.id);
          }
          updated += 1;
          continue;
        }
      }

      // 3) dedup by linkedin_url
      if (payload.linkedin_url) {
        const { data: byLi } = await supabase
          .from("leads")
          .select("*")
          .eq("organization_id", organization_id)
          .eq("linkedin_url", payload.linkedin_url)
          .maybeSingle();
        if (byLi?.id) {
          const patch = mergeLeadPatch(byLi, payload);
          if (Object.keys(patch).length) {
            await supabase.from("leads").update(patch as any).eq("id", byLi.id);
          }
          updated += 1;
          continue;
        }
      }

      const { error: insErr } = await supabase.from("leads").insert(payload as any);
      if (insErr) skipped += 1;
      else created += 1;
    }


    return { ok: true, created, updated, skipped };
  });

// ---------------------------------------------------------------------------
// ENRICH single lead
// ---------------------------------------------------------------------------

const EnrichSchema = z.object({
  lead_id: z.string().uuid(),
});

export const enrichLeadWithApollo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => EnrichSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const organization_id = await getActiveOrgId(supabase, userId);
    const { conn } = await getConnectionRow(supabase, organization_id);
    if (!conn || conn.status !== "connected") {
      throw new Error("Apollo não está conectado.");
    }
    const apiKey = await loadApiKey(supabase, conn.id);
    if (!apiKey) throw new Error("API key Apollo ausente.");

    const { data: lead } = await supabase
      .from("leads")
      .select("*")
      .eq("organization_id", organization_id)
      .eq("id", data.lead_id)
      .maybeSingle();
    if (!lead) throw new Error("Lead não encontrado.");

    const matchBody: Record<string, unknown> = {
      reveal_personal_emails: false,
    };
    if (lead.email) matchBody.email = lead.email;
    if (lead.linkedin_url) matchBody.linkedin_url = lead.linkedin_url;
    if (lead.full_name) {
      const parts = String(lead.full_name).trim().split(/\s+/);
      matchBody.first_name = parts.slice(0, -1).join(" ") || parts[0];
      matchBody.last_name = parts.length > 1 ? parts.at(-1) : undefined;
    }
    if (lead.website_url) matchBody.domain = String(lead.website_url).replace(/^https?:\/\//, "").split("/")[0];
    if (lead.company_name) matchBody.organization_name = lead.company_name;

    if (!matchBody.email && !matchBody.linkedin_url && !(matchBody.first_name && matchBody.last_name && (matchBody.domain || matchBody.organization_name))) {
      throw new Error("Lead não tem dados suficientes (email, LinkedIn ou nome + empresa).");
    }

    const result = await callApollo<{ person?: any }>({
      endpoint: "people/match",
      method: "POST",
      body: matchBody,
      apiKey,
      organization_id,
      supabase,
      triggered_by: userId,
      request_summary: { lead_id: data.lead_id, has_email: !!matchBody.email },
    });

    if (!result?.person) {
      try {
        await supabase.from("lead_enrichment").insert({
          organization_id,
          lead_id: data.lead_id,
          provider: "apollo",
          payload: { status: "not_found", match_body: matchBody, triggered_by: userId },
        } as any);
      } catch { /* best-effort */ }
      return {
        ok: true,
        matched: false,
        locked: false,
        fields_updated: [] as string[],
        message: "Apollo não encontrou correspondência para este lead.",
      };
    }

    const incoming = mapPersonToLeadPayload(result.person, organization_id);
    const patch = mergeLeadPatch(lead, incoming);
    const updatedFields = Object.keys(patch).filter((k) => k !== "enrichment_data");

    if (Object.keys(patch).length) {
      await supabase.from("leads").update(patch as any).eq("id", data.lead_id);
    }

    // Detecta se o Apollo achou a pessoa mas não revelou contatos (email/telefone bloqueados)
    const rawEmail: string | undefined = result.person?.email;
    const emailLocked =
      !!rawEmail && typeof rawEmail === "string" && rawEmail.toLowerCase().includes("email_not_unlocked");
    const hasAnyPhone = Array.isArray(result.person?.phone_numbers) && result.person.phone_numbers.length > 0;
    const locked = updatedFields.length === 0 && (emailLocked || !hasAnyPhone);

    try {
      await supabase.from("lead_enrichment").insert({
        organization_id,
        lead_id: data.lead_id,
        provider: "apollo",
        payload: {
          status: locked ? "locked" : updatedFields.length ? "success" : "no_new_fields",
          apollo: result.person,
          triggered_by: userId,
          updated_fields: updatedFields,
        },
      } as any);
    } catch { /* best-effort */ }

    let message: string;
    if (locked) {
      message =
        "Apollo encontrou a pessoa, mas email/telefone estão bloqueados. Verifique seus créditos na conta Apollo.";
    } else if (updatedFields.length) {
      message = `Enriquecido: ${updatedFields.length} campo(s) atualizado(s).`;
    } else {
      message = "Apollo encontrou a pessoa, mas nenhum campo novo a adicionar.";
    }

    return {
      ok: true,
      matched: true,
      locked,
      fields_updated: updatedFields,
      message,
    };
  });



// ---------------------------------------------------------------------------
// Recent calls (telemetria)
// ---------------------------------------------------------------------------

export const listApolloRecentCalls = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const organization_id = await getActiveOrgId(supabase, userId);
    const { data } = await supabase
      .from("apollo_api_calls")
      .select("id, endpoint, status_code, credits_consumed, latency_ms, error, created_at")
      .eq("organization_id", organization_id)
      .order("created_at", { ascending: false })
      .limit(20);
    return { calls: data ?? [] };
  });
