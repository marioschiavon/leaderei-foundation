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

