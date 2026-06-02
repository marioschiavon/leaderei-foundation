import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getCallerOrgId(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data) throw new Error("Sem organização ativa.");
  return data.organization_id as string;
}

async function resolveDocumentAndEntry(supabase: any, campaign_id: string) {
  const { data: doc } = await supabase
    .from("builder_documents")
    .select("id, status, organization_id")
    .eq("campaign_id", campaign_id)
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!doc) throw new Error("Esta campanha ainda não tem fluxo. Abra o Builder.");
  if (doc.status !== "published") throw new Error("Publique o fluxo no Builder antes de ativar a campanha.");

  const { data: entry } = await supabase
    .from("flow_steps")
    .select("id")
    .eq("document_id", doc.id)
    .eq("is_entry", true)
    .maybeSingle();
  if (!entry) throw new Error("Fluxo sem passo inicial.");
  return { document_id: doc.id as string, entry_step_id: entry.id as string };
}

// ---------------------------------------------------------------------------
// Enroll a single lead
// ---------------------------------------------------------------------------

export const enrollLeadInCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ campaign_id: z.string().uuid(), lead_id: z.string().uuid() }).parse(i)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const orgId = await getCallerOrgId(supabase, userId);

    const { data: campaign } = await supabase
      .from("campaigns").select("id, organization_id").eq("id", data.campaign_id).maybeSingle();
    if (!campaign || campaign.organization_id !== orgId) throw new Error("Campanha não encontrada.");

    const { data: lead } = await supabase
      .from("leads").select("id, organization_id").eq("id", data.lead_id).maybeSingle();
    if (!lead || lead.organization_id !== orgId) throw new Error("Lead não encontrado.");

    const { document_id, entry_step_id } = await resolveDocumentAndEntry(supabase, data.campaign_id);
    const now = new Date().toISOString();

    const { data: en, error: enErr } = await supabase
      .from("campaign_enrollments")
      .upsert({
        organization_id: orgId,
        campaign_id: data.campaign_id,
        lead_id: data.lead_id,
        document_id,
        current_step_id: entry_step_id,
        status: "active",
        next_run_at: now,
        enrolled_at: now,
        context: {},
      }, { onConflict: "campaign_id,lead_id" })
      .select("id")
      .single();
    if (enErr) throw new Error(enErr.message);

    // Enqueue first job
    await supabase.from("scheduled_jobs").insert({
      organization_id: orgId,
      kind: "flow_step",
      payload: { enrollment_id: en.id },
      enrollment_id: en.id,
      run_at: now,
      scope: "org",
    });

    return { ok: true, enrollment_id: en.id };
  });

// ---------------------------------------------------------------------------
// Activate campaign — enrolls every non-archived lead in the org
// ---------------------------------------------------------------------------

export const activateCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ campaign_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const orgId = await getCallerOrgId(supabase, userId);

    const { data: campaign } = await supabase
      .from("campaigns").select("id, organization_id, status").eq("id", data.campaign_id).maybeSingle();
    if (!campaign || campaign.organization_id !== orgId) throw new Error("Campanha não encontrada.");

    const { document_id, entry_step_id } = await resolveDocumentAndEntry(supabase, data.campaign_id);

    const { data: leads } = await supabase
      .from("leads")
      .select("id")
      .eq("organization_id", orgId)
      .is("archived_at", null)
      .limit(5000);

    let enrolled = 0;
    const now = new Date().toISOString();
    for (const l of leads ?? []) {
      const { data: en, error: enErr } = await supabase
        .from("campaign_enrollments")
        .upsert({
          organization_id: orgId,
          campaign_id: data.campaign_id,
          lead_id: l.id,
          document_id,
          current_step_id: entry_step_id,
          status: "active",
          next_run_at: now,
          enrolled_at: now,
        }, { onConflict: "campaign_id,lead_id", ignoreDuplicates: false })
        .select("id")
        .single();
      if (enErr || !en) continue;
      await supabase.from("scheduled_jobs").insert({
        organization_id: orgId,
        kind: "flow_step",
        payload: { enrollment_id: en.id },
        enrollment_id: en.id,
        run_at: now,
        scope: "org",
      });
      enrolled += 1;
    }

    await supabase.from("campaigns").update({
      status: "running",
      started_at: now,
      total_enrolled: enrolled,
    }).eq("id", data.campaign_id);

    return { ok: true, enrolled };
  });

// ---------------------------------------------------------------------------
// Observability: list enrollments for a campaign
// ---------------------------------------------------------------------------

export const listCampaignEnrollments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      campaign_id: z.string().uuid(),
      status: z.enum(["all", "pending", "active", "paused", "completed", "failed", "cancelled"]).default("all"),
      limit: z.number().int().min(1).max(500).default(100),
    }).parse(i)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("campaign_enrollments")
      .select("id, lead_id, status, current_step_id, next_run_at, last_error, enrolled_at, completed_at, leads(full_name, email, phone)")
      .eq("campaign_id", data.campaign_id)
      .order("enrolled_at", { ascending: false })
      .limit(data.limit);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getEnrollmentRuns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ enrollment_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("flow_step_runs")
      .select("id, step_id, status, branch_taken, output, error, started_at, finished_at")
      .eq("enrollment_id", data.enrollment_id)
      .order("started_at", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const pauseEnrollment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ enrollment_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await supabase.from("campaign_enrollments").update({ status: "paused", next_run_at: null }).eq("id", data.enrollment_id);
    await supabase.from("scheduled_jobs").update({ status: "cancelled" })
      .eq("enrollment_id", data.enrollment_id).eq("status", "pending");
    return { ok: true };
  });

export const resumeEnrollment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ enrollment_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const now = new Date().toISOString();
    const { data: en } = await supabase
      .from("campaign_enrollments").select("id, organization_id, current_step_id").eq("id", data.enrollment_id).maybeSingle();
    if (!en) throw new Error("Enrollment não encontrado.");
    if (!en.current_step_id) throw new Error("Sem passo atual para retomar.");
    await supabase.from("campaign_enrollments").update({ status: "active", next_run_at: now, last_error: null }).eq("id", en.id);
    await supabase.from("scheduled_jobs").insert({
      organization_id: en.organization_id,
      kind: "flow_step",
      payload: { enrollment_id: en.id },
      enrollment_id: en.id,
      run_at: now,
      scope: "org",
    });
    return { ok: true };
  });

export const getCampaignExecutorStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ campaign_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows } = await supabase
      .from("campaign_enrollments")
      .select("status")
      .eq("campaign_id", data.campaign_id);
    const counts: Record<string, number> = { active: 0, paused: 0, completed: 0, failed: 0, pending: 0, cancelled: 0 };
    for (const r of rows ?? []) counts[r.status] = (counts[r.status] ?? 0) + 1;
    return counts;
  });

// Counts orgs' failed enrollments (used by sidebar badge)
export const getFailedEnrollmentsCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const orgId = await getCallerOrgId(supabase, userId);
    const { count } = await supabase
      .from("campaign_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "failed");
    return { count: count ?? 0 };
  });
