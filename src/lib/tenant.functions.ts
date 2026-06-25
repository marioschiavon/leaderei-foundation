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

    const [orgRes, rolesRes, profileRes] = await Promise.all([
      membership
        ? supabase
            .from("organizations")
            .select("id, name, slug, status, max_users, max_leads, logo_url")
            .eq("id", membership.organization_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase
        .from("profiles")
        .select("full_name, onboarding_completed_at")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    return {
      userId,
      organization: orgRes.data ?? null,
      role: membership?.role ?? null,
      isMaster: (rolesRes.data ?? []).some((r) => r.role === "master_admin"),
      profile: profileRes.data ?? null,
      onboardingCompleted: !!profileRes.data?.onboarding_completed_at,
    };
  });

export const markOnboardingCompleted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
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

const ListLeadsInput = z.object({
  search: z.string().trim().max(120).optional().default(""),
  status: z.string().trim().max(40).optional().default("all"),
  source_slug: z.string().trim().max(80).optional().default("all"),
  channel: z.enum(["any", "email", "whatsapp", "both"]).optional().default("any"),
  date_from: z.string().trim().max(20).optional().default(""),
  page: z.number().int().min(1).optional().default(1),
  page_size: z.number().int().min(10).max(200).optional().default(50),
});

const LEAD_COLUMNS = `
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
`;

function applyLeadFilters<T extends { eq: any; ilike: any; or: any; not: any }>(
  query: T,
  filters: { status: string; source_slug: string; channel: string; search: string },
): T {
  let q: any = query;
  if (filters.status && filters.status !== "all") q = q.eq("status", filters.status);
  if (filters.source_slug && filters.source_slug !== "all") {
    q = q.eq("lead_sources.slug", filters.source_slug);
  }
  if (filters.channel === "email") q = q.not("email", "is", null);
  else if (filters.channel === "whatsapp") q = q.not("phone", "is", null);
  else if (filters.channel === "both") {
    q = q.not("email", "is", null).not("phone", "is", null);
  }
  if (filters.search) {
    const s = filters.search.replace(/[%,]/g, " ").trim();
    if (s) {
      const like = `%${s}%`;
      q = q.or(
        `full_name.ilike.${like},email.ilike.${like},company_name.ilike.${like},job_title.ilike.${like},phone.ilike.${like}`,
      );
    }
  }
  return q as T;
}

export const listLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ListLeadsInput.parse(i ?? {}))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const page = data.page;
    const pageSize = data.page_size;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const rowsQuery = applyLeadFilters(
      supabase.from("leads").select(LEAD_COLUMNS, { count: "exact" }),
      data,
    )
      .order("created_at", { ascending: false })
      .range(from, to);

    const [rowsRes, totalRes, withEmailRes, withPhoneRes, withBothRes] = await Promise.all([
      rowsQuery,
      supabase.from("leads").select("id", { count: "exact", head: true }),
      supabase.from("leads").select("id", { count: "exact", head: true }).not("email", "is", null),
      supabase.from("leads").select("id", { count: "exact", head: true }).not("phone", "is", null),
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .not("email", "is", null)
        .not("phone", "is", null),
    ]);

    if (rowsRes.error) throw new Error(rowsRes.error.message);

    return {
      rows: rowsRes.data ?? [],
      total: rowsRes.count ?? 0,
      page,
      page_size: pageSize,
      counts: {
        total: totalRes.count ?? 0,
        with_email: withEmailRes.count ?? 0,
        with_phone: withPhoneRes.count ?? 0,
        with_both: withBothRes.count ?? 0,
      },
    };
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

    const [leadRes, activitiesRes, enrichmentRes, enrollmentsRes, bookingsRes] = await Promise.all([
      context.supabase
        .from("leads")
        .select(`
          *,
          lead_sources ( id, name, slug, color )
        `)
        .eq("id", leadId)
        .maybeSingle(),
      context.supabase
        .from("lead_activities")
        .select("id, type, title, description, created_at")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(50),
      context.supabase
        .from("lead_enrichment")
        .select("id, provider, confidence, fetched_at, payload")
        .eq("lead_id", leadId)
        .order("fetched_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      context.supabase
        .from("campaign_enrollments")
        .select(`
          id, status, enrolled_at, completed_at, next_run_at, last_error,
          campaigns ( id, name, status, channel )
        `)
        .eq("lead_id", leadId)
        .order("enrolled_at", { ascending: false })
        .limit(20),
      context.supabase
        .from("lead_bookings")
        .select("id, title, status, start_at, end_at, meeting_url, location, organizer_email, attendee_email, event_type_slug, campaign_id, created_at")
        .eq("lead_id", leadId)
        .order("start_at", { ascending: false })
        .limit(20),
    ]);

    if (leadRes.error) throw new Error(leadRes.error.message);
    if (activitiesRes.error) throw new Error(activitiesRes.error.message);
    if (enrichmentRes.error) throw new Error(enrichmentRes.error.message);
    if (enrollmentsRes.error) throw new Error(enrollmentsRes.error.message);
    if (bookingsRes.error) throw new Error(bookingsRes.error.message);

    return {
      lead: leadRes.data,
      activities: activitiesRes.data ?? [],
      enrichment: enrichmentRes.data ?? null,
      enrollments: enrollmentsRes.data ?? [],
      bookings: bookingsRes.data ?? [],
    };
  });

const ListCampaignsSchema = z.object({
  scope: z.enum(["active", "archived"]).default("active"),
}).default({ scope: "active" });

export const listCampaigns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListCampaignsSchema.parse(input ?? {}))
  .handler(async ({ context, data }) => {
    const scope = data.scope;
    // Count of archived (always returned so the toggle badge shows the right number)
    const { count: archivedCount } = await context.supabase
      .from("campaigns")
      .select("id", { count: "exact", head: true })
      .eq("status", "archived");

    let q = context.supabase
      .from("campaigns")
      .select("id, name, description, status, channel, total_enrolled, total_sent, total_replied, created_at, scheduled_at")
      .order("created_at", { ascending: false })
      .limit(100);
    q = scope === "archived" ? q.eq("status", "archived") : q.neq("status", "archived");
    const { data: campaigns, error } = await q;
    if (error) throw new Error(error.message);
    const list = campaigns ?? [];
    if (list.length === 0) return { items: [], archived_count: archivedCount ?? 0 };

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

    // For running/paused campaigns, aggregate enrollments by current_step_id so
    // the card can show which node leads are sitting on right now.
    const liveCampaignIds = list
      .filter((c) => c.status === "running" || c.status === "paused")
      .map((c) => c.id);
    const currentNodesByCampaign = new Map<string, Array<{ step_id: string; type: string; config: any; count: number }>>();
    if (liveCampaignIds.length > 0) {
      const { data: enrolls } = await context.supabase
        .from("campaign_enrollments")
        .select("campaign_id, current_step_id")
        .in("campaign_id", liveCampaignIds)
        .eq("status", "active")
        .not("current_step_id", "is", null)
        .limit(5000);
      const grouped = new Map<string, Map<string, number>>();
      for (const row of (enrolls ?? []) as Array<{ campaign_id: string; current_step_id: string }>) {
        let byStep = grouped.get(row.campaign_id);
        if (!byStep) { byStep = new Map(); grouped.set(row.campaign_id, byStep); }
        byStep.set(row.current_step_id, (byStep.get(row.current_step_id) ?? 0) + 1);
      }
      const stepIds = Array.from(new Set(
        Array.from(grouped.values()).flatMap((m) => Array.from(m.keys())),
      ));
      const stepsById = new Map<string, { type: string; config: any }>();
      if (stepIds.length > 0) {
        const { data: stepsRows } = await context.supabase
          .from("flow_steps")
          .select("id, type, config")
          .in("id", stepIds);
        for (const s of (stepsRows ?? []) as Array<{ id: string; type: string; config: any }>) {
          stepsById.set(s.id, { type: s.type, config: s.config });
        }
      }
      for (const [campId, byStep] of grouped.entries()) {
        const arr = Array.from(byStep.entries())
          .map(([step_id, count]) => {
            const s = stepsById.get(step_id);
            return { step_id, type: s?.type ?? "unknown", config: s?.config ?? {}, count };
          })
          .sort((a, b) => b.count - a.count);
        currentNodesByCampaign.set(campId, arr);
      }
    }

    const items = list.map((c) => {
      const doc = docByCampaign.get(c.id);
      return {
        ...c,
        flow_step_count: doc ? stepCountByDoc.get(doc.id) ?? 0 : null,
        flow_status: (doc?.status as string | undefined) ?? null,
        current_nodes: currentNodesByCampaign.get(c.id) ?? [],
      };
    });
    return { items, archived_count: archivedCount ?? 0 };
  });

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("conversations")
      .select("id, subject, channel, status, last_message_preview, last_message_at, unread_count, ai_enabled, lead_id, needs_human, needs_human_reason, agent_paused, assigned_to, leads(id, full_name, company_name, phone, needs_review)")
      .in("channel", ["email", "whatsapp"])
      .order("needs_human", { ascending: false })
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listLeadsNeedingReview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("leads")
      .select("id, full_name, phone, company_name, job_title, review_reason, created_at")
      .eq("needs_review", true)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const ids = (data ?? []).map((l) => l.id);
    let previewByLead = new Map<string, string>();
    if (ids.length > 0) {
      const { data: convs } = await context.supabase
        .from("conversations")
        .select("lead_id, last_message_preview, last_message_at")
        .in("lead_id", ids)
        .eq("channel", "whatsapp");
      for (const c of (convs ?? []) as any[]) {
        if (c.lead_id && c.last_message_preview && !previewByLead.has(c.lead_id)) {
          previewByLead.set(c.lead_id, c.last_message_preview);
        }
      }
    }
    return (data ?? []).map((l) => ({ ...l, preview: previewByLead.get(l.id) ?? null }));
  });

export const getLeadsNeedingReviewCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count, error } = await context.supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("needs_review", true)
      .is("archived_at", null);
    if (error) throw new Error(error.message);
    return { count: count ?? 0 };
  });

export const acceptLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("leads")
      .update({ needs_review: false, review_reason: null, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const CREDENTIAL_REQUIRED_SLUGS = new Set([
  "apollo", "pipedrive", "resend", "cal_com", "hubspot", "linkedin",
]);

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

    const connRows = connections.data ?? [];
    const connIds = connRows.map((c) => c.id);
    let credIntegrationIds = new Set<string>();
    if (connIds.length > 0) {
      const { data: creds, error: credErr } = await context.supabase
        .from("integration_credentials")
        .select("integration_id")
        .in("integration_id", connIds);
      if (credErr) throw new Error(credErr.message);
      credIntegrationIds = new Set((creds ?? []).map((c) => c.integration_id));
    }

    const byProvider = new Map(connRows.map((c) => [c.provider_id, c]));
    return (providers.data ?? []).map((p) => {
      const conn = byProvider.get(p.id) ?? null;
      if (
        conn
        && CREDENTIAL_REQUIRED_SLUGS.has(p.slug)
        && !credIntegrationIds.has(conn.id)
        && conn.status !== "disconnected"
      ) {
        return { ...p, connection: { ...conn, status: "disconnected" as const } };
      }
      return { ...p, connection: conn };
    });
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

const NullableStr = (max: number) =>
  z.union([z.string().trim().max(max), z.null()]).optional();

const NullableEmail = z
  .union([z.string().trim().email().max(255), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v === "" || v === undefined ? v : v));

const UpdateLeadSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().trim().min(1).max(120).optional(),
  email: NullableEmail,
  secondary_email: NullableEmail,
  personal_email: NullableEmail,
  phone: NullableStr(40),
  mobile_phone: NullableStr(40),
  corporate_phone: NullableStr(40),
  company_name: NullableStr(160),
  job_title: NullableStr(160),
  seniority: NullableStr(80),
  department: NullableStr(80),
  industry: NullableStr(120),
  employee_count: z.number().int().min(0).max(10_000_000).nullable().optional(),
  website_url: NullableStr(255),
  linkedin_url: NullableStr(255),
  city: NullableStr(120),
  state: NullableStr(120),
  country: NullableStr(120),
  status: z.enum(LEAD_STATUSES).optional(),
  temperature: z.enum(LEAD_TEMPERATURES).optional(),
  score: z.number().int().min(0).max(100).optional(),
  estimated_value: z.number().min(0).nullable().optional(),
  currency: z.string().trim().min(3).max(3).optional(),
  next_followup_at: z.union([z.string().datetime(), z.literal(""), z.null()]).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
  source_id: z.union([z.string().uuid(), z.literal(""), z.null()]).optional(),
});

export const updateLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateLeadSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { id, ...rest } = data;
    // Normalize "" to null for nullable fields
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (v === undefined) continue;
      patch[k] = v === "" ? null : v;
    }
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
    if (toInsert.length > 0) {
      const { error, count } = await context.supabase
        .from("leads")
        .insert(toInsert as never, { count: "exact" });
      if (error) throw new Error(error.message);
      created = count ?? toInsert.length;
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
  "stopped",
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

export const restoreCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: existing, error: e0 } = await context.supabase
      .from("campaigns")
      .select("id, status")
      .eq("id", data.id)
      .maybeSingle();
    if (e0) throw new Error(e0.message);
    if (!existing) throw new Error("Campanha não encontrada.");
    if (existing.status !== "archived") {
      throw new Error("Apenas campanhas arquivadas podem ser restauradas.");
    }
    const { data: row, error } = await context.supabase
      .from("campaigns")
      .update({
        status: "draft",
        started_at: null,
        completed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// Hard delete an archived campaign. Guards against deleting live campaigns —
// the only way to call this is after archiving first. Wipes downstream rows
// (enrollments, scheduled jobs, step runs) and soft-archives the builder
// document so flow history isn't completely lost.
export const deleteCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: campaign, error: e0 } = await supabase
      .from("campaigns")
      .select("id, organization_id, status, name")
      .eq("id", data.id)
      .maybeSingle();
    if (e0) throw new Error(e0.message);
    if (!campaign) throw new Error("Campanha não encontrada.");
    if (campaign.status !== "archived") {
      throw new Error("Arquive a campanha antes de excluir definitivamente.");
    }

    // Collect enrollment ids so we can cascade cleanups.
    const { data: enrollRows } = await supabase
      .from("campaign_enrollments")
      .select("id")
      .eq("campaign_id", data.id);
    const enrollmentIds = (enrollRows ?? []).map((r) => r.id);

    if (enrollmentIds.length > 0) {
      // Cancel pending jobs (do not delete — keep audit trail).
      await supabase
        .from("scheduled_jobs")
        .update({ status: "cancelled" })
        .in("enrollment_id", enrollmentIds)
        .eq("status", "pending");
      // Delete step runs tied to these enrollments.
      await supabase.from("flow_step_runs").delete().in("enrollment_id", enrollmentIds);
      // Delete enrollments themselves.
      await supabase.from("campaign_enrollments").delete().eq("campaign_id", data.id);
    }

    // Soft-archive any builder document(s) linked to this campaign.
    await supabase
      .from("builder_documents")
      .update({ archived_at: new Date().toISOString() })
      .eq("campaign_id", data.id)
      .is("archived_at", null);

    const { error: delErr } = await supabase.from("campaigns").delete().eq("id", data.id);
    if (delErr) throw new Error(delErr.message);

    await supabase.from("audit_logs").insert({
      organization_id: campaign.organization_id,
      actor_user_id: userId,
      action: "campaign.deleted",
      entity_type: "campaign",
      entity_id: data.id,
      before: { name: campaign.name, status: campaign.status },
      after: null,
    });

    return { ok: true };
  });
