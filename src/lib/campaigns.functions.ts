import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runFlowTick } from "@/lib/flow-executor.server";

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

// ---------------------------------------------------------------------------
// Eligibility helpers (channel-aware)
// ---------------------------------------------------------------------------

export function normalizePhone(phone: string | null | undefined): string {
  return (phone ?? "").replace(/\D+/g, "");
}

// Requires DDI (≥1) + DDD (2) + número (≥8) → mínimo 11 dígitos.
// Padrão BR completo tem 12-13. Aceitamos ≥10 para tolerar números
// internacionais curtos, mas rejeitamos lixo como "11111".
export function isValidWhatsAppPhone(phone: string | null | undefined): boolean {
  const d = normalizePhone(phone);
  return d.length >= 10 && d.length <= 15;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(email: string | null | undefined): boolean {
  return !!email && EMAIL_RE.test(email);
}

function isLeadEligibleForChannel(lead: { email: string | null; phone: string | null }, channel: string): boolean {
  switch (channel) {
    case "whatsapp":
    case "sms":
      return isValidWhatsAppPhone(lead.phone);
    case "email":
      return isValidEmail(lead.email);
    case "multi":
      return isValidEmail(lead.email) || isValidWhatsAppPhone(lead.phone);
    case "linkedin":
      // Sem checagem efetiva no momento — qualquer lead é elegível.
      return true;
    default:
      return true;
  }
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
// ---------------------------------------------------------------------------
// Eligibility preview — used by the activation dialog
// ---------------------------------------------------------------------------

export const listEligibleLeadsForCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ campaign_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const orgId = await getCallerOrgId(supabase, userId);

    const { data: campaign } = await supabase
      .from("campaigns").select("id, organization_id, channel").eq("id", data.campaign_id).maybeSingle();
    if (!campaign) throw new Error("Campanha não encontrada.");
    // Use the campaign's org (RLS already validated membership) — avoids false negatives
    // when the user belongs to multiple orgs and getCallerOrgId returned a different one.
    const campaignOrgId = campaign.organization_id as string;

    const { data: leads } = await supabase
      .from("leads")
      .select("id, full_name, email, phone, company_name")
      .eq("organization_id", campaignOrgId)
      .is("archived_at", null)
      .order("full_name", { ascending: true })
      .limit(5000);

    const all = (leads ?? []) as Array<{ id: string; full_name: string | null; email: string | null; phone: string | null; company_name: string | null }>;
    const eligible = all.filter((l) => isLeadEligibleForChannel(l, campaign.channel));
    const ineligible = all.filter((l) => !isLeadEligibleForChannel(l, campaign.channel));

    // Find leads that already have an active/paused enrollment in this campaign
    // (so the UI can warn that activating again won't create new enrollments for them).
    const eligibleIds = eligible.map((l) => l.id);
    let active_lead_ids: string[] = [];
    if (eligibleIds.length > 0) {
      const { data: existing } = await supabase
        .from("campaign_enrollments")
        .select("lead_id")
        .eq("campaign_id", data.campaign_id)
        .in("lead_id", eligibleIds)
        .in("status", ["active", "paused"]);
      active_lead_ids = ((existing ?? []) as Array<{ lead_id: string }>).map((r) => r.lead_id);
    }
    const active_set = new Set(active_lead_ids);
    const new_eligible_count = eligible.filter((l) => !active_set.has(l.id)).length;

    return {
      channel: campaign.channel as string,
      total: all.length,
      eligible_count: eligible.length,
      ineligible_count: ineligible.length,
      active_enrollment_count: active_lead_ids.length,
      new_eligible_count,
      active_lead_ids,
      eligible,
      ineligible,
    };
  });


// ---------------------------------------------------------------------------
// Paginated eligible-leads picker — used by the "Adicionar leads" tab
// (avoids the 5000-row in-memory cap of listEligibleLeadsForCampaign).
// ---------------------------------------------------------------------------

function applyChannelFilter(q: any, channel: string) {
  switch (channel) {
    case "whatsapp":
    case "sms":
      return q.not("phone", "is", null).neq("phone", "");
    case "email":
      return q.not("email", "is", null).neq("email", "").like("email", "%@%");
    case "multi":
      return q.or(
        "and(phone.not.is.null,phone.neq.),and(email.not.is.null,email.like.*@*)",
      );
    case "linkedin":
    default:
      return q;
  }
}

export const listEligibleLeadsPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        campaign_id: z.string().uuid(),
        page: z.number().int().min(1).default(1),
        page_size: z.number().int().min(1).max(200).default(50),
        search: z.string().trim().max(120).default(""),
        only_new: z.boolean().default(true),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: campaign } = await supabase
      .from("campaigns")
      .select("id, organization_id, channel")
      .eq("id", data.campaign_id)
      .maybeSingle();
    if (!campaign) throw new Error("Campanha não encontrada.");
    const orgId = campaign.organization_id as string;
    const channel = campaign.channel as string;

    const totalQ = supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .is("archived_at", null);
    const eligibleQ = applyChannelFilter(
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .is("archived_at", null),
      channel,
    );
    const enrolledQ = supabase
      .from("campaign_enrollments")
      .select("lead_id")
      .eq("campaign_id", data.campaign_id)
      .in("status", ["active", "paused"])
      .limit(10000);

    const [totalRes, eligibleRes, enrolledRes] = await Promise.all([
      totalQ,
      eligibleQ,
      enrolledQ,
    ]);

    const org_total = totalRes.count ?? 0;
    const eligible_total = eligibleRes.count ?? 0;
    const enrolledIds = ((enrolledRes.data ?? []) as Array<{ lead_id: string }>).map(
      (r) => r.lead_id,
    );
    const already_enrolled = enrolledIds.length;

    let rowsQ = applyChannelFilter(
      supabase
        .from("leads")
        .select("id, full_name, email, phone, company_name", { count: "exact" })
        .eq("organization_id", orgId)
        .is("archived_at", null),
      channel,
    );

    const q = data.search.trim();
    if (q) {
      const safe = q.replace(/[(),]/g, " ");
      rowsQ = rowsQ.or(
        `full_name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%,company_name.ilike.%${safe}%`,
      );
    }

    if (data.only_new && enrolledIds.length > 0 && enrolledIds.length <= 1000) {
      rowsQ = rowsQ.not("id", "in", `(${enrolledIds.join(",")})`);
    }

    const from = (data.page - 1) * data.page_size;
    const to = from + data.page_size - 1;
    rowsQ = rowsQ
      .order("full_name", { ascending: true, nullsFirst: false })
      .range(from, to);

    const { data: rows, count: pageCount, error } = await rowsQ;
    if (error) throw new Error(error.message);

    let pageRows = (rows ?? []) as Array<{
      id: string;
      full_name: string | null;
      email: string | null;
      phone: string | null;
      company_name: string | null;
    }>;
    if (data.only_new && enrolledIds.length > 1000) {
      const set = new Set(enrolledIds);
      pageRows = pageRows.filter((r) => !set.has(r.id));
    }

    const total = data.only_new
      ? Math.max(0, eligible_total - already_enrolled)
      : eligible_total;

    return {
      channel,
      page: data.page,
      page_size: data.page_size,
      total,
      page_total: pageCount ?? 0,
      rows: pageRows,
      counts: {
        org_total,
        eligible_total,
        already_enrolled,
        missing_channel: Math.max(0, org_total - eligible_total),
      },
    };
  });




// ---------------------------------------------------------------------------
// Activate campaign — enrolls eligible leads (or a manually-selected subset)
// ---------------------------------------------------------------------------

export const activateCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      campaign_id: z.string().uuid(),
      lead_ids: z.array(z.string().uuid()).optional(),
    }).parse(i)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const orgId = await getCallerOrgId(supabase, userId);

    const { data: campaign } = await supabase
      .from("campaigns").select("id, organization_id, channel, status").eq("id", data.campaign_id).maybeSingle();
    if (!campaign || campaign.organization_id !== orgId) throw new Error("Campanha não encontrada.");

    const { document_id, entry_step_id } = await resolveDocumentAndEntry(supabase, data.campaign_id);

    // Pull candidates (either explicit ids or all org leads), then filter by channel.
    const channel = campaign.channel as string;
    type LeadRow = { id: string; email: string | null; phone: string | null };
    let leadsRaw: LeadRow[] = [];

    if (data.lead_ids && data.lead_ids.length > 0) {
      // Chunk explicit ids to avoid URL/parameter-length limits on huge selections.
      const CHUNK = 300;
      for (let i = 0; i < data.lead_ids.length; i += CHUNK) {
        const slice = data.lead_ids.slice(i, i + CHUNK);
        const { data: rows } = await supabase
          .from("leads")
          .select("id, email, phone")
          .eq("organization_id", orgId)
          .is("archived_at", null)
          .in("id", slice);
        if (rows) leadsRaw.push(...(rows as LeadRow[]));
      }
    } else {
      // Whole-org activation: paginate so we don't cap at 5000.
      const PAGE = 1000;
      let page = 0;
      while (true) {
        const { data: rows } = await supabase
          .from("leads")
          .select("id, email, phone")
          .eq("organization_id", orgId)
          .is("archived_at", null)
          .order("id", { ascending: true })
          .range(page * PAGE, page * PAGE + PAGE - 1);
        const batch = (rows ?? []) as LeadRow[];
        if (batch.length === 0) break;
        leadsRaw.push(...batch);
        if (batch.length < PAGE) break;
        page += 1;
        if (page > 100) break; // safety: 100k cap
      }
    }

    const candidates = leadsRaw.filter((l) => isLeadEligibleForChannel(l, channel));


    let enrolled = 0;
    let skipped = 0;
    const now = new Date().toISOString();
    for (const l of candidates) {
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
      if (enErr || !en) { skipped += 1; continue; }
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

    return { ok: true, enrolled, skipped, requested: (data.lead_ids?.length ?? leads?.length ?? 0) };
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
    const list = (rows ?? []) as Array<any>;

    const stepIds = Array.from(new Set(list.map((r) => r.current_step_id).filter(Boolean))) as string[];
    const stepsById: Record<string, { id: string; type: string; config: any }> = {};
    const transitionsByFrom: Record<string, Array<{ from_step_id: string; to_step_id: string; branch: string }>> = {};
    if (stepIds.length > 0) {
      const { data: steps } = await supabase
        .from("flow_steps").select("id, type, config").in("id", stepIds);
      for (const s of (steps ?? []) as Array<any>) stepsById[s.id] = s;

      const { data: trans } = await supabase
        .from("flow_transitions").select("from_step_id, to_step_id, branch").in("from_step_id", stepIds);
      for (const t of (trans ?? []) as Array<any>) (transitionsByFrom[t.from_step_id] ||= []).push(t);

      const nextIds = Array.from(new Set((trans ?? []).map((t: any) => t.to_step_id))).filter(Boolean) as string[];
      if (nextIds.length > 0) {
        const { data: nextSteps } = await supabase
          .from("flow_steps").select("id, type, config").in("id", nextIds);
        for (const s of (nextSteps ?? []) as Array<any>) stepsById[s.id] = s;
      }
    }

    // Fetch end reasons for completed enrollments that ended on an `end` node
    const endReasonByEnrollment: Record<string, string | null> = {};
    const completedIds = list.filter((r) => r.status === "completed" && r.current_step_id && stepsById[r.current_step_id]?.type === "end").map((r) => r.id);
    if (completedIds.length > 0) {
      const { data: endRuns } = await supabase
        .from("flow_step_runs")
        .select("enrollment_id, output, finished_at")
        .in("enrollment_id", completedIds)
        .order("finished_at", { ascending: false })
        .limit(500);
      for (const run of (endRuns ?? []) as Array<any>) {
        if (endReasonByEnrollment[run.enrollment_id] !== undefined) continue;
        const reason = (run.output as any)?.reason ?? null;
        endReasonByEnrollment[run.enrollment_id] = reason;
      }
    }

    const nowMs = Date.now();
    return list.map((r) => {
      const cur = r.current_step_id ? stepsById[r.current_step_id] : null;
      const trs = (r.current_step_id ? transitionsByFrom[r.current_step_id] : null) ?? [];
      const next_steps = trs.map((t) => {
        const s = stepsById[t.to_step_id];
        return { id: t.to_step_id, branch: t.branch, type: s?.type ?? null, config: s?.config ?? null };
      });
      const overdueMs = r.next_run_at ? nowMs - new Date(r.next_run_at).getTime() : 0;
      const is_overdue = r.status === "active" && overdueMs > 2 * 60 * 1000;
      return {
        ...r,
        current_step: cur ? { id: cur.id, type: cur.type, config: cur.config } : null,
        next_steps,
        is_overdue,
        end_reason: endReasonByEnrollment[r.id] ?? null,
        ended_on_end_node: cur?.type === "end",
      };
    });
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
    const list = (rows ?? []) as Array<any>;
    const stepIds = Array.from(new Set(list.map((r) => r.step_id).filter(Boolean))) as string[];
    const stepsById: Record<string, { type: string; config: any }> = {};
    if (stepIds.length > 0) {
      const { data: steps } = await supabase.from("flow_steps").select("id, type, config").in("id", stepIds);
      for (const s of (steps ?? []) as Array<any>) stepsById[s.id] = { type: s.type, config: s.config };
    }
    return list.map((r) => ({ ...r, step: stepsById[r.step_id] ?? null }));
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

// Cancel a single enrollment — removes the lead from a live campaign. Keeps
// flow_step_runs intact for audit; sets enrollment status to 'cancelled' and
// cancels any pending scheduled jobs.
export const cancelEnrollment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ enrollment_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await supabase
      .from("campaign_enrollments")
      .update({ status: "cancelled", next_run_at: null, updated_at: new Date().toISOString() })
      .eq("id", data.enrollment_id);
    await supabase
      .from("scheduled_jobs")
      .update({ status: "cancelled" })
      .eq("enrollment_id", data.enrollment_id)
      .eq("status", "pending");
    return { ok: true };
  });

// ---------------------------------------------------------------------------

// Reset enrollment — moves a finished/paused lead back to the entry step so
// the user can re-run the whole flow after editing it.
// ---------------------------------------------------------------------------

async function resetOne(supabase: any, enrollment_id: string) {
  const { data: en } = await supabase
    .from("campaign_enrollments")
    .select("id, organization_id, campaign_id, status")
    .eq("id", enrollment_id)
    .maybeSingle();
  if (!en) throw new Error("Enrollment não encontrado.");
  if (!["completed", "failed", "paused"].includes(en.status)) {
    throw new Error(`Só é possível reiniciar leads concluídos, pausados ou com falha (atual: ${en.status}).`);
  }
  const { document_id, entry_step_id } = await resolveDocumentAndEntry(supabase, en.campaign_id);
  const now = new Date().toISOString();
  await supabase.from("campaign_enrollments").update({
    status: "active",
    current_step_id: entry_step_id,
    document_id,
    next_run_at: now,
    last_error: null,
    completed_at: null,
    context: {},
  }).eq("id", en.id);
  // Cancel any pending jobs first
  await supabase.from("scheduled_jobs").update({ status: "cancelled" })
    .eq("enrollment_id", en.id).eq("status", "pending");
  await supabase.from("scheduled_jobs").insert({
    organization_id: en.organization_id,
    kind: "flow_step",
    payload: { enrollment_id: en.id },
    enrollment_id: en.id,
    run_at: now,
    scope: "org",
  });
  return en.id as string;
}

export const resetEnrollment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ enrollment_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await resetOne(context.supabase, data.enrollment_id);
    return { ok: true };
  });

export const resetEnrollmentsBulk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      campaign_id: z.string().uuid(),
      scope: z.enum(["completed", "failed", "all_finished"]).default("completed"),
    }).parse(i)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const statuses = (data.scope === "all_finished"
      ? ["completed", "failed", "paused"]
      : data.scope === "failed" ? ["failed"] : ["completed"]) as Array<"completed" | "failed" | "paused">;
    const { data: rows } = await supabase
      .from("campaign_enrollments")
      .select("id")
      .eq("campaign_id", data.campaign_id)
      .in("status", statuses)
      .limit(500);
    let done = 0;
    let failed = 0;
    for (const r of (rows ?? []) as Array<{ id: string }>) {
      try { await resetOne(supabase, r.id); done += 1; }
      catch { failed += 1; }
    }
    return { ok: true, reset: done, failed };
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

// ---------------------------------------------------------------------------
// Force a single tick of the flow worker (useful for "Run now" buttons)
// ---------------------------------------------------------------------------

export const forceFlowTick = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const out = await runFlowTick(25);
    return { ok: true, ...out };
  });
