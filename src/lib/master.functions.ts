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
// Reads
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

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

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
