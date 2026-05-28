import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "proposal",
  "won",
  "lost",
  "archived",
] as const;
const LEAD_TEMPERATURES = ["cold", "warm", "hot"] as const;

async function getActiveOrgId(
  supabase: { from: (table: string) => any },
  userId: string,
) {
  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Sem organização ativa para este usuário.");
  return data.organization_id as string;
}

/**
 * Returns the active organization of the authenticated user, the org-scoped
 * membership row, and the global role flags. Uses RLS-bound client so the
 * caller can only ever see what they're allowed to.
 */
export const getMyContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id, role, status, joined_at")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const [orgRes, rolesRes] = await Promise.all([
      membership
        ? supabase
            .from("organizations")
            .select("id, name, slug, status, max_users, max_leads, logo_url")
            .eq("id", membership.organization_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);

    return {
      userId,
      organization: orgRes.data ?? null,
      role: membership?.role ?? null,
      isMaster: (rolesRes.data ?? []).some((r) => r.role === "master_admin"),
    };
  });

export const getDashboardSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;

    const [leadsAll, leadsNew, convsOpen, msgsSent, campsActive] = await Promise.all([
      supabase.from("leads").select("*", { count: "exact", head: true }),
      supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "new"),
      supabase.from("conversations").select("*", { count: "exact", head: true }).eq("status", "open"),
      supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("direction", "outbound")
        .gte("created_at", new Date(Date.now() - 7 * 86400_000).toISOString()),
      supabase.from("campaigns").select("*", { count: "exact", head: true }).eq("status", "running"),
    ]);

    return {
      leads_total: leadsAll.count ?? 0,
      leads_new: leadsNew.count ?? 0,
      conversations_open: convsOpen.count ?? 0,
      messages_sent_7d: msgsSent.count ?? 0,
      campaigns_active: campsActive.count ?? 0,
    };
  });

export const listLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("leads")
      .select(`
        id,
        full_name,
        email,
        phone,
        company_name,
        job_title,
        status,
        temperature,
        score,
        source_id,
        estimated_value,
        next_followup_at,
        created_at,
        last_contact_at,
        lead_sources (
          id,
          name,
          slug,
          color
        )
      `)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listLeadSources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("lead_sources")
      .select("id, name, slug, color")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getLeadDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((payload: { leadId: string }) => payload)
  .handler(async ({ context, data }) => {
    const { leadId } = data;

    const [leadRes, activitiesRes, enrichmentRes] = await Promise.all([
      context.supabase
        .from("leads")
        .select(`
          id,
          full_name,
          email,
          phone,
          company_name,
          job_title,
          status,
          temperature,
          score,
          city,
          country,
          linkedin_url,
          website_url,
          tags,
          currency,
          estimated_value,
          next_followup_at,
          last_contact_at,
          created_at,
          lead_sources (
            id,
            name,
            slug,
            color
          )
        `)
        .eq("id", leadId)
        .maybeSingle(),
      context.supabase
        .from("lead_activities")
        .select("id, type, title, description, created_at")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(12),
      context.supabase
        .from("lead_enrichment")
        .select("id, provider, confidence, fetched_at, payload")
        .eq("lead_id", leadId)
        .order("fetched_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (leadRes.error) throw new Error(leadRes.error.message);
    if (activitiesRes.error) throw new Error(activitiesRes.error.message);
    if (enrichmentRes.error) throw new Error(enrichmentRes.error.message);

    return {
      lead: leadRes.data,
      activities: activitiesRes.data ?? [],
      enrichment: enrichmentRes.data ?? null,
    };
  });

export const listCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: campaigns, error } = await context.supabase
      .from("campaigns")
      .select("id, name, description, status, channel, total_enrolled, total_sent, total_replied, created_at, scheduled_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const list = campaigns ?? [];
    if (list.length === 0) return [];

    const campaignIds = list.map((c) => c.id);
    const { data: docs, error: docsErr } = await context.supabase
      .from("builder_documents")
      .select("id, campaign_id, status")
      .in("campaign_id", campaignIds)
      .is("archived_at", null);
    if (docsErr) throw new Error(docsErr.message);

    const docList = docs ?? [];
    const docIds = docList.map((d) => d.id);
    const stepCountByDoc = new Map<string, number>();
    if (docIds.length > 0) {
      const { data: steps, error: stepsErr } = await context.supabase
        .from("flow_steps")
        .select("document_id")
        .in("document_id", docIds);
      if (stepsErr) throw new Error(stepsErr.message);
      for (const s of (steps ?? []) as Array<{ document_id: string }>) {
        stepCountByDoc.set(s.document_id, (stepCountByDoc.get(s.document_id) ?? 0) + 1);
      }
    }
    const docByCampaign = new Map(docList.map((d) => [d.campaign_id, d]));

    return list.map((c) => {
      const doc = docByCampaign.get(c.id);
      return {
        ...c,
        flow_step_count: doc ? stepCountByDoc.get(doc.id) ?? 0 : null,
        flow_status: (doc?.status as string | undefined) ?? null,
      };
    });
  });

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("conversations")
      .select("id, subject, channel, status, last_message_preview, last_message_at, unread_count, ai_enabled, leads(full_name, company_name)")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listIntegrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [providers, connections] = await Promise.all([
      context.supabase
        .from("integration_providers")
        .select("id, slug, name, category, description, logo_url")
        .eq("is_active", true)
        .order("name"),
      context.supabase
        .from("organization_integrations")
        .select("id, provider_id, status, display_name, last_synced_at, last_error"),
    ]);
    if (providers.error) throw new Error(providers.error.message);
    if (connections.error) throw new Error(connections.error.message);

    const byProvider = new Map(
      (connections.data ?? []).map((c) => [c.provider_id, c]),
    );
    return (providers.data ?? []).map((p) => ({
      ...p,
      connection: byProvider.get(p.id) ?? null,
    }));
  });

const CreateLeadSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(40).optional().nullable(),
  company_name: z.string().trim().max(160).optional().nullable(),
  job_title: z.string().trim().max(160).optional().nullable(),
  source_id: z.string().uuid().optional().nullable(),
  status: z.enum(LEAD_STATUSES).optional(),
});

export const createLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateLeadSchema.parse(input))
  .handler(async ({ context, data }) => {
    const organization_id = await getActiveOrgId(context.supabase, context.userId);
    const { data: inserted, error } = await context.supabase
      .from("leads")
      .insert({
        organization_id,
        full_name: data.full_name,
        email: data.email,
        phone: data.phone ?? null,
        company_name: data.company_name ?? null,
        job_title: data.job_title ?? null,
        source_id: data.source_id ?? null,
        status: data.status ?? "new",
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return inserted;
  });

const UpdateLeadSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().email().max(255).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  company_name: z.string().trim().max(160).nullable().optional(),
  job_title: z.string().trim().max(160).nullable().optional(),
  status: z.enum(LEAD_STATUSES).optional(),
  temperature: z.enum(LEAD_TEMPERATURES).optional(),
  score: z.number().int().min(0).max(100).optional(),
  estimated_value: z.number().min(0).nullable().optional(),
  next_followup_at: z.string().datetime().nullable().optional(),
});

export const updateLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateLeadSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { id, ...patch } = data;
    const { data: updated, error } = await context.supabase
      .from("leads")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return updated;
  });

export const archiveLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: updated, error } = await context.supabase
      .from("leads")
      .update({ status: "archived", archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return updated;
  });

// -------- Lead import (CSV) --------
const KNOWN_LEAD_FIELDS = [
  "full_name",
  "first_name",
  "last_name",
  "email",
  "secondary_email",
  "personal_email",
  "phone",
  "mobile_phone",
  "corporate_phone",
  "company_name",
  "job_title",
  "seniority",
  "department",
  "industry",
  "employee_count",
  "website_url",
  "linkedin_url",
  "city",
  "state",
  "country",
  "tags",
] as const;

type KnownLeadField = (typeof KNOWN_LEAD_FIELDS)[number];

const ImportLeadCellSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.string()),
]);

const ImportLeadsSchema = z.object({
  rows: z
    .array(z.record(z.string(), ImportLeadCellSchema.optional()))
    .min(1)
    .max(2000),
  source_id: z.string().uuid().nullable().optional(),
});

function asString(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.join(", ");
  return String(v).trim();
}

function normalizeUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  const candidate = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(candidate);
    if (!u.hostname.includes(".")) return null;
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function parseEmployeeCount(raw: string): number | null {
  const m = raw.match(/\d[\d.,]*/);
  if (!m) return null;
  const n = parseInt(m[0].replace(/[.,]/g, ""), 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export const importLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ImportLeadsSchema.parse(input))
  .handler(async ({ context, data }) => {
    const organization_id = await getActiveOrgId(context.supabase, context.userId);

    const errors: Array<{ row: number; message: string }> = [];
    const toInsert: Array<Record<string, unknown>> = [];

    data.rows.forEach((raw, idx) => {
      const rowNum = idx + 2;
      const get = (k: string) => asString(raw[k as keyof typeof raw]);

      // Compose full_name from first/last if needed
      let full_name = get("full_name");
      const first = get("first_name");
      const last = get("last_name");
      if (!full_name) full_name = [first, last].filter(Boolean).join(" ").trim();

      const email = get("email").toLowerCase();
      const parsedEmail = z.string().email().safeParse(email);
      if (!full_name || full_name.length < 1) {
        errors.push({ row: rowNum, message: "Nome ausente" });
        return;
      }
      if (!parsedEmail.success) {
        errors.push({ row: rowNum, message: "Email inválido ou ausente" });
        return;
      }

      const websiteRaw = get("website_url");
      const linkedinRaw = get("linkedin_url");
      const employeeRaw = get("employee_count");

      // tags: accept array or delimited string
      const tagsRaw = raw["tags" as keyof typeof raw];
      let tags: string[] = [];
      if (Array.isArray(tagsRaw)) tags = tagsRaw.map(String).map((t) => t.trim()).filter(Boolean);
      else if (typeof tagsRaw === "string")
        tags = tagsRaw.split(/[,;]/).map((t) => t.trim()).filter(Boolean);

      // enrichment_data: any key not in KNOWN_LEAD_FIELDS
      const enrichment_data: Record<string, unknown> = {};
      for (const k of Object.keys(raw)) {
        if ((KNOWN_LEAD_FIELDS as readonly string[]).includes(k)) continue;
        const v = raw[k as keyof typeof raw];
        if (v == null || v === "") continue;
        enrichment_data[k] = v;
      }

      const row: Record<string, unknown> = {
        organization_id,
        full_name: full_name.slice(0, 120),
        email: email.slice(0, 255),
        phone: get("phone") || null,
        mobile_phone: get("mobile_phone") || null,
        corporate_phone: get("corporate_phone") || null,
        secondary_email: get("secondary_email").toLowerCase() || null,
        personal_email: get("personal_email").toLowerCase() || null,
        company_name: get("company_name") || null,
        job_title: get("job_title") || null,
        seniority: get("seniority") || null,
        department: get("department") || null,
        industry: get("industry") || null,
        employee_count: employeeRaw ? parseEmployeeCount(employeeRaw) : null,
        website_url: websiteRaw ? normalizeUrl(websiteRaw) : null,
        linkedin_url: linkedinRaw ? normalizeUrl(linkedinRaw) : null,
        city: get("city") || null,
        state: get("state") || null,
        country: get("country") || null,
        tags,
        enrichment_data,
        source_id: data.source_id ?? null,
        status: "new" as const,
        created_by: context.userId,
      };
      toInsert.push(row);
    });

    let created = 0;
    let created = 0;
    if (toInsert.length > 0) {
      const { error, count } = await context.supabase
        .from("leads")
        .insert(toInsert as never, { count: "exact" });
      if (error) throw new Error(error.message);
      created = count ?? toInsert.length;
    }

    }

    return {
      received: data.rows.length,
      created,
      skipped: errors.length,
      errors: errors.slice(0, 25),
    };
  });

// Re-export type so the importer UI can stay in sync.
export type ImportableLeadField = KnownLeadField;


// -------- Campaigns CRUD --------
const CAMPAIGN_CHANNELS = ["email", "whatsapp", "linkedin", "sms", "multi"] as const;
const CAMPAIGN_STATUSES = [
  "draft",
  "scheduled",
  "running",
  "paused",
  "completed",
  "archived",
] as const;

const CreateCampaignSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).nullable().optional(),
  channel: z.enum(CAMPAIGN_CHANNELS),
  objective: z.string().trim().max(255).nullable().optional(),
  daily_send_limit: z.number().int().min(1).max(10000).nullable().optional(),
});

export const createCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateCampaignSchema.parse(input))
  .handler(async ({ context, data }) => {
    const organization_id = await getActiveOrgId(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("campaigns")
      .insert({
        organization_id,
        name: data.name,
        description: data.description ?? null,
        channel: data.channel,
        objective: data.objective ?? null,
        daily_send_limit: data.daily_send_limit ?? null,
        status: "draft",
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const UpdateCampaignSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  channel: z.enum(CAMPAIGN_CHANNELS).optional(),
  objective: z.string().trim().max(255).nullable().optional(),
  daily_send_limit: z.number().int().min(1).max(10000).nullable().optional(),
});

export const updateCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateCampaignSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { id, ...patch } = data;
    const { data: row, error } = await context.supabase
      .from("campaigns")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const changeCampaignStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ id: z.string().uuid(), status: z.enum(CAMPAIGN_STATUSES) })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const nowIso = new Date().toISOString();
    const patch: {
      status: typeof data.status;
      updated_at: string;
      started_at?: string;
      completed_at?: string;
    } = { status: data.status, updated_at: nowIso };
    if (data.status === "running") patch.started_at = nowIso;
    if (data.status === "completed") patch.completed_at = nowIso;
    const { data: row, error } = await context.supabase
      .from("campaigns")
      .update(patch)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const duplicateCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: src, error: e1 } = await context.supabase
      .from("campaigns")
      .select(
        "organization_id, name, description, channel, objective, daily_send_limit, settings",
      )
      .eq("id", data.id)
      .single();
    if (e1) throw new Error(e1.message);
    const { data: row, error } = await context.supabase
      .from("campaigns")
      .insert({
        organization_id: src.organization_id,
        name: `${src.name} (cópia)`,
        description: src.description,
        channel: src.channel,
        objective: src.objective,
        daily_send_limit: src.daily_send_limit,
        settings: src.settings ?? {},
        status: "draft",
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const archiveCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("campaigns")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
