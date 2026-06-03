import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function assertMaster(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "master_admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso negado: requer papel master_admin.");
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}

// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------

export const listCompanies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertMaster(context.userId);

    const { data: organizations, error } = await supabaseAdmin
      .from("organizations")
      .select("id,name,slug,status,max_users,max_leads,created_at,updated_at,logo_url")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ids = (organizations ?? []).map((o) => o.id);
    const counts: Record<string, number> = {};
    if (ids.length) {
      const { data: members, error: mErr } = await supabaseAdmin
        .from("organization_members")
        .select("organization_id")
        .in("organization_id", ids);
      if (mErr) throw new Error(mErr.message);
      for (const m of members ?? []) {
        counts[m.organization_id] = (counts[m.organization_id] ?? 0) + 1;
      }
    }

    return (organizations ?? []).map((o) => ({ ...o, member_count: counts[o.id] ?? 0 }));
  });

export const getMasterOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertMaster(context.userId);

    const [
      { count: totalOrgs },
      { count: activeOrgs },
      { count: trialOrgs },
      { count: inactiveOrgs },
      { count: totalMembers },
      { count: totalProfiles },
    ] = await Promise.all([
      supabaseAdmin.from("organizations").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("organizations").select("*", { count: "exact", head: true }).eq("status", "active"),
      supabaseAdmin.from("organizations").select("*", { count: "exact", head: true }).eq("status", "trial"),
      supabaseAdmin.from("organizations").select("*", { count: "exact", head: true }).eq("status", "inactive"),
      supabaseAdmin.from("organization_members").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }),
    ]);

    const { data: recent } = await supabaseAdmin
      .from("organizations")
      .select("id,name,slug,status,created_at")
      .order("created_at", { ascending: false })
      .limit(5);

    return {
      totals: {
        companies: totalOrgs ?? 0,
        active: activeOrgs ?? 0,
        trial: trialOrgs ?? 0,
        inactive: inactiveOrgs ?? 0,
        members: totalMembers ?? 0,
        profiles: totalProfiles ?? 0,
      },
      recent: recent ?? [],
    };
  });

const CreateCompanySchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(48).regex(/^[a-z0-9-]+$/).optional(),
  status: z.enum(["trial", "active", "inactive"]).default("trial"),
  max_users: z.number().int().min(1).max(10000).default(5),
  max_leads: z.number().int().min(0).max(10_000_000).default(1000),
});

export const createCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateCompanySchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertMaster(context.userId);

    const slug = data.slug ?? slugify(data.name);
    const { data: inserted, error } = await supabaseAdmin
      .from("organizations")
      .insert({
        name: data.name,
        slug,
        status: data.status,
        max_users: data.max_users,
        max_leads: data.max_leads,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return inserted;
  });

const SetStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["trial", "active", "inactive"]),
});

export const setCompanyStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SetStatusSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertMaster(context.userId);
    const { data: updated, error } = await supabaseAdmin
      .from("organizations")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return updated;
  });

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

export const listPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertMaster(context.userId);
    const { data, error } = await supabaseAdmin
      .from("plans")
      .select("*")
      .order("price_cents", { ascending: true });
    if (error) throw new Error(error.message);

    const ids = (data ?? []).map((p) => p.id);
    const subsByPlan: Record<string, number> = {};
    if (ids.length) {
      const { data: subs } = await supabaseAdmin
        .from("subscriptions")
        .select("plan_id, status")
        .in("plan_id", ids)
        .in("status", ["trialing", "active"]);
      for (const s of subs ?? []) {
        subsByPlan[s.plan_id] = (subsByPlan[s.plan_id] ?? 0) + 1;
      }
    }
    return (data ?? []).map((p) => ({ ...p, active_subscriptions: subsByPlan[p.id] ?? 0 }));
  });

const CreatePlanSchema = z.object({
  slug: z.string().min(2).max(48).regex(/^[a-z0-9-]+$/),
  name: z.string().min(2).max(80),
  description: z.string().max(280).optional(),
  price_cents: z.number().int().min(0).max(100_000_000),
  currency: z.string().min(3).max(3).default("BRL"),
  billing_period: z.enum(["monthly", "quarterly", "yearly"]).default("monthly"),
  max_users: z.number().int().min(1).max(100_000),
  max_leads: z.number().int().min(0).max(100_000_000),
  max_messages_per_month: z.number().int().min(0).max(100_000_000),
  is_public: z.boolean().default(true),
});

export const createPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreatePlanSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertMaster(context.userId);
    const { data: inserted, error } = await supabaseAdmin
      .from("plans")
      .insert(data)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return inserted;
  });

const TogglePlanSchema = z.object({ id: z.string().uuid(), is_active: z.boolean() });

export const setPlanActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TogglePlanSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertMaster(context.userId);
    const { data: updated, error } = await supabaseAdmin
      .from("plans")
      .update({ is_active: data.is_active })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return updated;
  });

// ---------------------------------------------------------------------------
// Members (global, master view)
// ---------------------------------------------------------------------------

export const listAllMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertMaster(context.userId);

    const { data: members, error } = await supabaseAdmin
      .from("organization_members")
      .select("id,user_id,organization_id,role,status,joined_at")
      .order("joined_at", { ascending: false });
    if (error) throw new Error(error.message);

    const userIds = Array.from(new Set((members ?? []).map((m) => m.user_id)));
    const orgIds = Array.from(new Set((members ?? []).map((m) => m.organization_id)));

    const [profilesRes, orgsRes, rolesRes] = await Promise.all([
      userIds.length
        ? supabaseAdmin.from("profiles").select("user_id,full_name,avatar_url").in("user_id", userIds)
        : Promise.resolve({ data: [] as any[], error: null }),
      orgIds.length
        ? supabaseAdmin.from("organizations").select("id,name,slug,status").in("id", orgIds)
        : Promise.resolve({ data: [] as any[], error: null }),
      userIds.length
        ? supabaseAdmin.from("user_roles").select("user_id,role").in("user_id", userIds)
        : Promise.resolve({ data: [] as any[], error: null }),
    ]);
    if (profilesRes.error) throw new Error(profilesRes.error.message);
    if (orgsRes.error) throw new Error(orgsRes.error.message);
    if (rolesRes.error) throw new Error(rolesRes.error.message);

    const profilesMap = new Map((profilesRes.data ?? []).map((p) => [p.user_id, p]));
    const orgsMap = new Map((orgsRes.data ?? []).map((o) => [o.id, o]));
    const rolesByUser = new Map<string, string[]>();
    for (const r of rolesRes.data ?? []) {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    }

    return (members ?? []).map((m) => ({
      id: m.id,
      user_id: m.user_id,
      organization_id: m.organization_id,
      role: m.role,
      status: m.status,
      joined_at: m.joined_at,
      profile: profilesMap.get(m.user_id) ?? null,
      organization: orgsMap.get(m.organization_id) ?? null,
      global_roles: rolesByUser.get(m.user_id) ?? [],
    }));
  });

// ---------------------------------------------------------------------------
// Logs (master-only views)
// ---------------------------------------------------------------------------

const LogsSinceSchema = z.object({
  since_hours: z.number().int().min(1).max(720).default(24),
});

function sinceIso(hours: number) {
  return new Date(Date.now() - hours * 3600 * 1000).toISOString();
}

// --- Email logs ---
export const listEmailLogsForMaster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => LogsSinceSchema.parse(input ?? {}))
  .handler(async ({ context, data }) => {
    await assertMaster(context.userId);
    const { data: rows, error } = await supabaseAdmin
      .from("email_send_log")
      .select("id, organization_id, purpose, provider, from_email, to_email, subject, template_key, provider_message_id, status, error_message, metadata, created_at")
      .gte("created_at", sinceIso(data.since_hours))
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

// --- Flow step runs ---
export const listFlowStepRunsForMaster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    LogsSinceSchema.extend({ only_failed: z.boolean().optional().default(false) }).parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertMaster(context.userId);
    let q = supabaseAdmin
      .from("flow_step_runs")
      .select("id, organization_id, enrollment_id, step_id, status, branch_taken, output, error, started_at, finished_at, created_at")
      .gte("started_at", sinceIso(data.since_hours))
      .order("started_at", { ascending: false })
      .limit(100);
    if (data.only_failed) q = q.eq("status", "failed");
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const stepIds = Array.from(new Set((rows ?? []).map((r) => r.step_id).filter(Boolean)));
    const enrollmentIds = Array.from(new Set((rows ?? []).map((r) => r.enrollment_id).filter(Boolean)));
    const orgIds = Array.from(new Set((rows ?? []).map((r) => r.organization_id).filter(Boolean)));

    const [stepsRes, enrollmentsRes, orgsRes] = await Promise.all([
      stepIds.length
        ? supabaseAdmin.from("flow_steps").select("id, type, config").in("id", stepIds)
        : Promise.resolve({ data: [] as any[], error: null }),
      enrollmentIds.length
        ? supabaseAdmin.from("campaign_enrollments").select("id, lead_id, campaign_id").in("id", enrollmentIds)
        : Promise.resolve({ data: [] as any[], error: null }),
      orgIds.length
        ? supabaseAdmin.from("organizations").select("id, name").in("id", orgIds)
        : Promise.resolve({ data: [] as any[], error: null }),
    ]);
    if (stepsRes.error) throw new Error(stepsRes.error.message);
    if (enrollmentsRes.error) throw new Error(enrollmentsRes.error.message);
    if (orgsRes.error) throw new Error(orgsRes.error.message);

    const leadIds = Array.from(new Set((enrollmentsRes.data ?? []).map((e) => e.lead_id).filter(Boolean)));
    const campaignIds = Array.from(new Set((enrollmentsRes.data ?? []).map((e) => e.campaign_id).filter(Boolean)));
    const [leadsRes, campaignsRes] = await Promise.all([
      leadIds.length
        ? supabaseAdmin.from("leads").select("id, full_name").in("id", leadIds)
        : Promise.resolve({ data: [] as any[], error: null }),
      campaignIds.length
        ? supabaseAdmin.from("campaigns").select("id, name").in("id", campaignIds)
        : Promise.resolve({ data: [] as any[], error: null }),
    ]);
    if (leadsRes.error) throw new Error(leadsRes.error.message);
    if (campaignsRes.error) throw new Error(campaignsRes.error.message);

    const stepsMap = new Map((stepsRes.data ?? []).map((s) => [s.id, s]));
    const enrMap = new Map((enrollmentsRes.data ?? []).map((e) => [e.id, e]));
    const leadsMap = new Map((leadsRes.data ?? []).map((l) => [l.id, l]));
    const campaignsMap = new Map((campaignsRes.data ?? []).map((c) => [c.id, c]));
    const orgsMap = new Map((orgsRes.data ?? []).map((o) => [o.id, o]));

    return {
      rows: (rows ?? []).map((r) => {
        const step = stepsMap.get(r.step_id) as any;
        const enr = enrMap.get(r.enrollment_id) as any;
        const lead = enr ? (leadsMap.get(enr.lead_id) as any) : null;
        const campaign = enr ? (campaignsMap.get(enr.campaign_id) as any) : null;
        const org = orgsMap.get(r.organization_id) as any;
        return {
          ...r,
          step_type: step?.type ?? null,
          lead_name: lead?.full_name ?? null,
          campaign_name: campaign?.name ?? null,
          organization_name: org?.name ?? null,
        };
      }),
    };
  });

// --- Webhook events ---
export const listWebhookEventsForMaster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    LogsSinceSchema.extend({
      source: z.string().max(40).optional(),
      status: z.string().max(40).optional(),
    }).parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertMaster(context.userId);
    let q = supabaseAdmin
      .from("webhook_events")
      .select("id, received_at, source, event_type, organization_id, instance_id, cal_booking_uid, status, http_status, error, payload, headers")
      .gte("received_at", sinceIso(data.since_hours))
      .order("received_at", { ascending: false })
      .limit(100);
    if (data.source) q = q.eq("source", data.source);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const orgIds = Array.from(new Set((rows ?? []).map((r) => r.organization_id).filter(Boolean)));
    const orgsRes = orgIds.length
      ? await supabaseAdmin.from("organizations").select("id, name").in("id", orgIds)
      : { data: [] as any[], error: null };
    if (orgsRes.error) throw new Error(orgsRes.error.message);
    const orgsMap = new Map((orgsRes.data ?? []).map((o) => [o.id, o]));

    return {
      rows: (rows ?? []).map((r) => ({
        ...r,
        organization_name: r.organization_id ? (orgsMap.get(r.organization_id) as any)?.name ?? null : null,
      })),
    };
  });

// --- Audit logs ---
export const listAuditLogsForMaster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => LogsSinceSchema.parse(input ?? {}))
  .handler(async ({ context, data }) => {
    await assertMaster(context.userId);
    const { data: rows, error } = await supabaseAdmin
      .from("audit_logs")
      .select("id, action, entity_type, entity_id, organization_id, actor_user_id, ip_address, user_agent, before, after, created_at")
      .gte("created_at", sinceIso(data.since_hours))
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);

    const userIds = Array.from(new Set((rows ?? []).map((r) => r.actor_user_id).filter(Boolean)));
    const orgIds = Array.from(new Set((rows ?? []).map((r) => r.organization_id).filter(Boolean)));
    const [profilesRes, orgsRes] = await Promise.all([
      userIds.length
        ? supabaseAdmin.from("profiles").select("user_id, full_name").in("user_id", userIds)
        : Promise.resolve({ data: [] as any[], error: null }),
      orgIds.length
        ? supabaseAdmin.from("organizations").select("id, name").in("id", orgIds)
        : Promise.resolve({ data: [] as any[], error: null }),
    ]);
    if (profilesRes.error) throw new Error(profilesRes.error.message);
    if (orgsRes.error) throw new Error(orgsRes.error.message);
    const profilesMap = new Map((profilesRes.data ?? []).map((p) => [p.user_id, p]));
    const orgsMap = new Map((orgsRes.data ?? []).map((o) => [o.id, o]));

    return {
      rows: (rows ?? []).map((r) => ({
        ...r,
        actor_name: r.actor_user_id ? (profilesMap.get(r.actor_user_id) as any)?.full_name ?? null : null,
        organization_name: r.organization_id ? (orgsMap.get(r.organization_id) as any)?.name ?? null : null,
      })),
    };
  });


