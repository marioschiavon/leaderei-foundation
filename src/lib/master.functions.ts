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

    const { data: companies, error } = await supabaseAdmin
      .from("companies")
      .select("id,name,slug,status,max_users,max_leads,created_at,updated_at,logo_url")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ids = companies.map((c) => c.id);
    const counts: Record<string, number> = {};
    if (ids.length) {
      const { data: members, error: mErr } = await supabaseAdmin
        .from("company_members")
        .select("company_id")
        .in("company_id", ids);
      if (mErr) throw new Error(mErr.message);
      for (const m of members ?? []) {
        counts[m.company_id] = (counts[m.company_id] ?? 0) + 1;
      }
    }

    return companies.map((c) => ({ ...c, member_count: counts[c.id] ?? 0 }));
  });

export const getMasterOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertMaster(context.userId);

    const [{ count: totalCompanies }, { count: activeCompanies }, { count: trialCompanies }, { count: inactiveCompanies }, { count: totalMembers }, { count: totalProfiles }] = await Promise.all([
      supabaseAdmin.from("companies").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("companies").select("*", { count: "exact", head: true }).eq("status", "active"),
      supabaseAdmin.from("companies").select("*", { count: "exact", head: true }).eq("status", "trial"),
      supabaseAdmin.from("companies").select("*", { count: "exact", head: true }).eq("status", "inactive"),
      supabaseAdmin.from("company_members").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }),
    ]);

    const { data: recent } = await supabaseAdmin
      .from("companies")
      .select("id,name,slug,status,created_at")
      .order("created_at", { ascending: false })
      .limit(5);

    return {
      totals: {
        companies: totalCompanies ?? 0,
        active: activeCompanies ?? 0,
        trial: trialCompanies ?? 0,
        inactive: inactiveCompanies ?? 0,
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
      .from("companies")
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
      .from("companies")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return updated;
  });
