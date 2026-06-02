// Server-only flow executor. Drives a single enrollment forward by one step.
// Called by the /api/public/hooks/run-flow-tick worker. Never import in client code.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmailInternal } from "@/lib/email.functions";

type Json = Record<string, unknown>;

export type StepOutcome =
  | { kind: "advance"; next_step_id: string | null; delay_until: Date; branch?: string; output?: Json }
  | { kind: "wait"; resume_at: Date; output?: Json }
  | { kind: "complete"; output?: Json }
  | { kind: "fail"; error: string; output?: Json };

interface Enrollment {
  id: string;
  organization_id: string;
  campaign_id: string;
  lead_id: string;
  document_id: string | null;
  current_step_id: string | null;
  context: Json;
  status: string;
}

interface Step {
  id: string;
  type: string;
  config: Json;
  document_id: string;
  is_entry: boolean;
}

interface Transition {
  from_step_id: string;
  to_step_id: string;
  branch: string; // 'next' | 'yes' | 'no'
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addDuration(from: Date, value: number, unit: string): Date {
  const d = new Date(from.getTime());
  const v = Math.max(0, value | 0);
  switch (unit) {
    case "minutes": d.setMinutes(d.getMinutes() + v); break;
    case "hours": d.setHours(d.getHours() + v); break;
    case "days": d.setDate(d.getDate() + v); break;
    case "business_days": {
      let remaining = v;
      while (remaining > 0) {
        d.setDate(d.getDate() + 1);
        const dow = d.getUTCDay(); // 0=Sun..6=Sat
        if (dow !== 0 && dow !== 6) remaining -= 1;
      }
      break;
    }
    default: d.setDate(d.getDate() + v);
  }
  return d;
}

function renderTemplate(tpl: string, vars: Record<string, unknown>): string {
  if (!tpl) return "";
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const parts = String(key).split(".");
    let cur: any = vars;
    for (const p of parts) {
      if (cur == null) return "";
      cur = cur[p];
    }
    return cur == null ? "" : String(cur);
  });
}

async function loadLead(lead_id: string) {
  const { data, error } = await supabaseAdmin
    .from("leads")
    .select("id, organization_id, full_name, email, phone, company_name, job_title, tags, custom_fields, status, temperature")
    .eq("id", lead_id)
    .maybeSingle();
  if (error) throw new Error(`load lead: ${error.message}`);
  if (!data) throw new Error("lead não encontrado");
  return data;
}

async function findNextStep(
  document_id: string,
  from_step_id: string,
  branch: string,
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("flow_transitions")
    .select("to_step_id")
    .eq("document_id", document_id)
    .eq("from_step_id", from_step_id)
    .eq("branch", branch)
    .maybeSingle();
  if (error) throw new Error(`find next: ${error.message}`);
  return data?.to_step_id ?? null;
}

// ---------------------------------------------------------------------------
// Dispatcher per step type
// ---------------------------------------------------------------------------

async function executeStep(en: Enrollment, step: Step): Promise<StepOutcome> {
  const now = new Date();
  const lead = await loadLead(en.lead_id);
  const first_name = (lead.full_name ?? "").split(" ")[0];
  const vars = {
    lead: { ...lead, first_name },
    first_name,
    full_name: lead.full_name,
    company: lead.company_name,
    job_title: lead.job_title,
  };

  switch (step.type) {
    // -----------------------------------------------------------------------
    case "message_email": {
      const cfg = step.config as { subject?: string; body_html?: string; body_text?: string };
      if (!lead.email) {
        return { kind: "advance", next_step_id: await findNextStep(step.document_id, step.id, "next"), delay_until: now, output: { skipped: "no_email" } };
      }
      const subject = renderTemplate(cfg.subject ?? "", vars);
      const html = renderTemplate(cfg.body_html ?? "", vars);
      const text = cfg.body_text ? renderTemplate(cfg.body_text, vars) : undefined;
      const res = await sendEmailInternal({
        to: lead.email,
        subject,
        html,
        text,
        purpose: "campaign",
        organization_id: en.organization_id,
        template_key: `flow:${step.id}`,
        metadata: { enrollment_id: en.id, campaign_id: en.campaign_id, step_id: step.id },
      });
      // Log as lead activity
      await supabaseAdmin.from("lead_activities").insert({
        organization_id: en.organization_id,
        lead_id: lead.id,
        type: "email_sent",
        title: subject || "E-mail enviado",
        description: `Campanha (passo ${step.id.slice(0, 8)})`,
        payload: { enrollment_id: en.id, step_id: step.id, send_log_id: res.id },
      });
      const next = await findNextStep(step.document_id, step.id, "next");
      return { kind: "advance", next_step_id: next, delay_until: now, output: { send_log_id: res.id } };
    }

    // -----------------------------------------------------------------------
    case "message_whatsapp": {
      const cfg = step.config as { body?: string };
      const body = renderTemplate(cfg.body ?? "", vars);
      const phone = (lead.phone ?? "").replace(/\D+/g, "");
      if (phone.length < 10 || phone.length > 15) {
        return { kind: "advance", next_step_id: await findNextStep(step.document_id, step.id, "next"), delay_until: now, output: { skipped: "invalid_phone", phone } };
      }
      // Pick a connected instance for the org
      const { data: instances } = await supabaseAdmin
        .from("hook7_instances")
        .select("id")
        .eq("organization_id", en.organization_id)
        .eq("status", "connected")
        .is("archived_at", null)
        .order("last_connected_at", { ascending: false })
        .limit(1);
      const inst = instances?.[0];
      if (!inst) return { kind: "fail", error: "Nenhuma instância WhatsApp conectada." };

      const { data: token } = await supabaseAdmin.rpc("get_hook7_instance_token", { _instance_id: inst.id });
      if (!token) return { kind: "fail", error: "Token Hook7 indisponível." };

      const { data: baseUrlData } = await supabaseAdmin.rpc("get_platform_plain", { _key: "hook7_base_url" });
      const baseUrl = (typeof baseUrlData === "string" && baseUrlData) || "https://api.hook7.com.br";

      const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/send/text`, {
        method: "POST",
        headers: { apikey: token as string, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ number: phone, text: body }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        return { kind: "fail", error: `Hook7 ${res.status}: ${t.slice(0, 200)}` };
      }
      const json: any = await res.json().catch(() => ({}));
      const externalId: string | null = json?.data?.Info?.ID ?? null;

      // Ensure conversation + record outbound message
      let conv: { id: string } | null = null;
      {
        const { data: existing } = await supabaseAdmin
          .from("conversations")
          .select("id")
          .eq("organization_id", en.organization_id)
          .eq("lead_id", lead.id)
          .eq("channel", "whatsapp")
          .maybeSingle();
        conv = existing ?? null;
      }
      if (!conv) {
        const { data: nc } = await supabaseAdmin
          .from("conversations")
          .insert({ organization_id: en.organization_id, lead_id: lead.id, channel: "whatsapp" })
          .select("id")
          .single();
        conv = nc!;
      }
      await supabaseAdmin.from("messages").insert({
        organization_id: en.organization_id,
        conversation_id: conv.id,
        channel: "whatsapp",
        direction: "outbound",
        body,
        source_channel: "whatsapp",
        whatsapp_status: "sent",
        status: "sent",
        sent_at: new Date().toISOString(),
        external_message_id: externalId,
        metadata: { enrollment_id: en.id, step_id: step.id, automated: true },
      });
      await supabaseAdmin.from("conversations").update({
        last_message_at: new Date().toISOString(),
        last_message_preview: body.slice(0, 140),
      }).eq("id", conv.id);

      const next = await findNextStep(step.document_id, step.id, "next");
      return { kind: "advance", next_step_id: next, delay_until: now, output: { external_message_id: externalId } };
    }

    // -----------------------------------------------------------------------
    case "message_linkedin": {
      const next = await findNextStep(step.document_id, step.id, "next");
      return { kind: "advance", next_step_id: next, delay_until: now, output: { skipped: "linkedin_not_implemented" } };
    }

    // -----------------------------------------------------------------------
    case "wait": {
      const cfg = step.config as { duration_value?: number; duration_unit?: string };
      const resume = addDuration(now, cfg.duration_value ?? 1, cfg.duration_unit ?? "days");
      const next = await findNextStep(step.document_id, step.id, "next");
      return { kind: "advance", next_step_id: next, delay_until: resume, output: { resumed_at: resume.toISOString() } };
    }

    // -----------------------------------------------------------------------
    case "condition_replied": {
      const cfg = step.config as { scope?: string; timeout_value?: number; timeout_unit?: string };
      const ctx = (en.context ?? {}) as Json;
      const stepCtxKey = `cond_${step.id}`;
      const stepCtx = (ctx[stepCtxKey] as { started_at?: string } | undefined) ?? {};
      const startedAt = stepCtx.started_at ? new Date(stepCtx.started_at) : now;
      const deadline = addDuration(startedAt, cfg.timeout_value ?? 3, cfg.timeout_unit ?? "days");

      // Check for inbound message since startedAt
      let q = supabaseAdmin
        .from("messages")
        .select("id, channel", { count: "exact", head: true })
        .eq("organization_id", en.organization_id)
        .eq("direction", "inbound")
        .gte("created_at", startedAt.toISOString())
        .in("conversation_id",
          // subquery via separate call (PostgREST doesn't do subqueries directly)
          []);

      // Simpler: list conversations of this lead and filter by channel
      const { data: convs } = await supabaseAdmin
        .from("conversations")
        .select("id, channel")
        .eq("organization_id", en.organization_id)
        .eq("lead_id", en.lead_id);
      const convFiltered = (convs ?? []).filter((c) => {
        if (!cfg.scope || cfg.scope === "any_channel") return true;
        return c.channel === cfg.scope;
      });
      let replied = false;
      if (convFiltered.length) {
        const { count } = await supabaseAdmin
          .from("messages")
          .select("id", { count: "exact", head: true })
          .in("conversation_id", convFiltered.map((c) => c.id))
          .eq("direction", "inbound")
          .gte("created_at", startedAt.toISOString());
        replied = (count ?? 0) > 0;
      }

      if (replied) {
        const next = await findNextStep(step.document_id, step.id, "yes");
        return { kind: "advance", next_step_id: next, delay_until: now, branch: "yes", output: { replied: true } };
      }
      if (now >= deadline) {
        const next = await findNextStep(step.document_id, step.id, "no");
        return { kind: "advance", next_step_id: next, delay_until: now, branch: "no", output: { replied: false, timed_out: true } };
      }
      // Persist startedAt in context and re-check in 5 minutes
      const recheck = new Date(now.getTime() + 5 * 60_000);
      const newCtx = { ...ctx, [stepCtxKey]: { started_at: startedAt.toISOString() } };
      await supabaseAdmin.from("campaign_enrollments").update({ context: newCtx as any }).eq("id", en.id);
      return { kind: "wait", resume_at: recheck < deadline ? recheck : deadline, output: { waiting: true } };
    }

    // -----------------------------------------------------------------------
    case "action": {
      const cfg = step.config as { action_type?: string; params?: Json };
      const params = (cfg.params ?? {}) as any;
      const updates: Json = {};
      switch (cfg.action_type) {
        case "set_status": updates.status = params.status; break;
        case "set_temperature": updates.temperature = params.temperature; break;
        case "add_tag": {
          const tag = String(params.tag ?? "").trim();
          if (tag) {
            const tags = Array.isArray(lead.tags) ? lead.tags : [];
            if (!tags.includes(tag)) updates.tags = [...tags, tag];
          }
          break;
        }
        case "remove_tag": {
          const tag = String(params.tag ?? "").trim();
          if (tag) {
            const tags = Array.isArray(lead.tags) ? lead.tags : [];
            updates.tags = tags.filter((t: string) => t !== tag);
          }
          break;
        }
        case "move_pipeline":
          // No-op for now; deals/pipeline model is separate.
          break;
      }
      if (Object.keys(updates).length) {
        await supabaseAdmin.from("leads").update(updates as any).eq("id", lead.id);
      }
      const next = await findNextStep(step.document_id, step.id, "next");
      return { kind: "advance", next_step_id: next, delay_until: now, output: { action: cfg.action_type, applied: updates } };
    }

    default:
      return { kind: "fail", error: `tipo de passo desconhecido: ${step.type}` };
  }
}

// ---------------------------------------------------------------------------
// Job processor — pulls one job and drives the enrollment
// ---------------------------------------------------------------------------

function backoffMs(attempt: number): number {
  const ladder = [60_000, 5 * 60_000, 30 * 60_000, 2 * 3600_000, 12 * 3600_000];
  return ladder[Math.min(attempt, ladder.length - 1)];
}

export async function processJob(jobId: string): Promise<{ ok: boolean; error?: string; enrollment_id?: string }> {
  const { data: job } = await supabaseAdmin
    .from("scheduled_jobs")
    .select("id, enrollment_id, attempts, max_attempts, payload")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return { ok: false, error: "job não encontrado" };

  const enrollmentId = job.enrollment_id ?? (job.payload as any)?.enrollment_id;
  if (!enrollmentId) {
    await supabaseAdmin.from("scheduled_jobs").update({ status: "failed", last_error: "sem enrollment_id" }).eq("id", job.id);
    return { ok: false, error: "sem enrollment_id" };
  }

  const { data: en } = await supabaseAdmin
    .from("campaign_enrollments")
    .select("id, organization_id, campaign_id, lead_id, document_id, current_step_id, context, status")
    .eq("id", enrollmentId)
    .maybeSingle();
  if (!en) {
    await supabaseAdmin.from("scheduled_jobs").update({ status: "failed", last_error: "enrollment ausente" }).eq("id", job.id);
    return { ok: false, error: "enrollment ausente" };
  }
  if (en.status !== "active") {
    await supabaseAdmin.from("scheduled_jobs").update({ status: "completed" }).eq("id", job.id);
    return { ok: true, enrollment_id: en.id };
  }
  if (!en.current_step_id || !en.document_id) {
    await supabaseAdmin.from("campaign_enrollments").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", en.id);
    await supabaseAdmin.from("scheduled_jobs").update({ status: "completed" }).eq("id", job.id);
    return { ok: true, enrollment_id: en.id };
  }

  const { data: step } = await supabaseAdmin
    .from("flow_steps")
    .select("id, type, config, document_id, is_entry")
    .eq("id", en.current_step_id)
    .maybeSingle();
  if (!step) {
    await supabaseAdmin.from("campaign_enrollments").update({ status: "failed", last_error: "passo atual ausente" }).eq("id", en.id);
    await supabaseAdmin.from("scheduled_jobs").update({ status: "failed", last_error: "passo ausente" }).eq("id", job.id);
    return { ok: false, error: "passo ausente" };
  }

  // Record run start
  const startedAt = new Date().toISOString();
  const { data: runRow } = await supabaseAdmin
    .from("flow_step_runs")
    .insert({
      organization_id: en.organization_id,
      enrollment_id: en.id,
      step_id: step.id,
      status: "running",
      started_at: startedAt,
    })
    .select("id")
    .single();
  const runId = runRow?.id as string;

  let outcome: StepOutcome;
  try {
    outcome = await executeStep(en as Enrollment, step as Step);
  } catch (e: any) {
    outcome = { kind: "fail", error: String(e?.message ?? e).slice(0, 500) };
  }

  if (outcome.kind === "fail") {
    const nextAttempt = (job.attempts ?? 0) + 1;
    const willRetry = nextAttempt < (job.max_attempts ?? 5);
    await supabaseAdmin.from("flow_step_runs").update({
      status: "failed", error: outcome.error, finished_at: new Date().toISOString(),
      output: (outcome.output ?? {}) as any,
    }).eq("id", runId);
    if (willRetry) {
      const runAt = new Date(Date.now() + backoffMs(nextAttempt - 1)).toISOString();
      await supabaseAdmin.from("scheduled_jobs").update({
        status: "pending", run_at: runAt, last_error: outcome.error, locked_at: null, locked_by: null,
      }).eq("id", job.id);
    } else {
      await supabaseAdmin.from("scheduled_jobs").update({
        status: "failed", last_error: outcome.error,
      }).eq("id", job.id);
      await supabaseAdmin.from("campaign_enrollments").update({
        status: "failed", last_error: outcome.error,
      }).eq("id", en.id);
    }
    return { ok: false, error: outcome.error, enrollment_id: en.id };
  }

  if (outcome.kind === "complete") {
    await supabaseAdmin.from("flow_step_runs").update({
      status: "done", finished_at: new Date().toISOString(), output: (outcome.output ?? {}) as any,
    }).eq("id", runId);
    await supabaseAdmin.from("campaign_enrollments").update({
      status: "completed", completed_at: new Date().toISOString(), next_run_at: null,
    }).eq("id", en.id);
    await supabaseAdmin.from("scheduled_jobs").update({ status: "completed" }).eq("id", job.id);
    return { ok: true, enrollment_id: en.id };
  }

  if (outcome.kind === "wait") {
    await supabaseAdmin.from("flow_step_runs").update({
      status: "done", finished_at: new Date().toISOString(), output: (outcome.output ?? {}) as any,
    }).eq("id", runId);
    await supabaseAdmin.from("campaign_enrollments").update({
      next_run_at: outcome.resume_at.toISOString(),
    }).eq("id", en.id);
    await supabaseAdmin.from("scheduled_jobs").update({
      status: "pending", run_at: outcome.resume_at.toISOString(), locked_at: null, locked_by: null, last_error: null,
    }).eq("id", job.id);
    return { ok: true, enrollment_id: en.id };
  }

  // advance
  await supabaseAdmin.from("flow_step_runs").update({
    status: "done", finished_at: new Date().toISOString(),
    branch_taken: outcome.branch ?? "next",
    output: (outcome.output ?? {}) as any,
  }).eq("id", runId);

  if (!outcome.next_step_id) {
    await supabaseAdmin.from("campaign_enrollments").update({
      status: "completed", completed_at: new Date().toISOString(), next_run_at: null, current_step_id: null,
    }).eq("id", en.id);
    await supabaseAdmin.from("scheduled_jobs").update({ status: "completed" }).eq("id", job.id);
    return { ok: true, enrollment_id: en.id };
  }

  const runAt = outcome.delay_until.toISOString();
  await supabaseAdmin.from("campaign_enrollments").update({
    current_step_id: outcome.next_step_id, next_run_at: runAt, last_error: null,
  }).eq("id", en.id);
  await supabaseAdmin.from("scheduled_jobs").update({
    status: "pending", run_at: runAt, locked_at: null, locked_by: null, last_error: null,
  }).eq("id", job.id);
  return { ok: true, enrollment_id: en.id };
}

// ---------------------------------------------------------------------------
// Tick: drain up to N pending jobs
// ---------------------------------------------------------------------------

export async function runFlowTick(maxJobs = 25): Promise<{ processed: number; failed: number }> {
  // Lock a batch via raw SQL (SKIP LOCKED) using a custom RPC isn't available;
  // emulate by selecting + conditional update. Postgrest can't SKIP LOCKED, so
  // we use a soft-lock with locked_by + a random worker id.
  const workerId = (globalThis.crypto as Crypto).randomUUID();
  const nowIso = new Date().toISOString();

  // 1) Reserve a batch
  const { data: candidates } = await supabaseAdmin
    .from("scheduled_jobs")
    .select("id")
    .eq("status", "pending")
    .eq("kind", "flow_step")
    .is("locked_at", null)
    .lte("run_at", nowIso)
    .order("run_at", { ascending: true })
    .limit(maxJobs);
  const ids = (candidates ?? []).map((c) => c.id);
  if (!ids.length) return { processed: 0, failed: 0 };

  const { data: locked } = await supabaseAdmin
    .from("scheduled_jobs")
    .update({ status: "running", locked_at: nowIso, locked_by: workerId })
    .in("id", ids)
    .eq("status", "pending")
    .is("locked_at", null)
    .select("id");
  const lockedIds = (locked ?? []).map((l) => l.id);

  let processed = 0;
  let failed = 0;
  for (const id of lockedIds) {
    const r = await processJob(id);
    if (r.ok) processed += 1; else failed += 1;
  }
  return { processed, failed };
}
