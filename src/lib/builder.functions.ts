import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const STEP_TYPES = [
  "message_email",
  "message_whatsapp",
  "message_linkedin",
  "ai_message",
  "ai_generate_text",
  "wait",
  "condition_replied",
  "action",
  "calcom_check_availability",
  "calcom_book_meeting",
  "calcom_cancel_booking",
  "calcom_reschedule_booking",
  "end",
] as const;
export type StepType = (typeof STEP_TYPES)[number];

const EmailConfig = z.object({
  subject: z.string().max(200).default(""),
  body_html: z.string().max(50000).default(""),
  body_text: z.string().max(50000).optional(),
  from_alias: z.string().max(120).optional(),
  body_source: z.enum(["fixed", "ai"]).default("fixed").optional(),
  ai_text_label: z.string().max(120).optional(),
});
const WhatsappConfig = z.object({
  body: z.string().max(4000).default(""),
  media_url: z.string().url().optional(),
  body_source: z.enum(["fixed", "ai"]).default("fixed").optional(),
  ai_text_label: z.string().max(120).optional(),
});
const LinkedinConfig = z.object({
  message_type: z.enum(["connection_request", "inmail", "message"]).default("message"),
  body: z.string().max(2000).default(""),
});
const WaitConfig = z.object({
  duration_value: z.number().int().min(0).max(10000).default(1),
  duration_unit: z.enum(["minutes", "hours", "days", "business_days"]).default("days"),
});
const ConditionRepliedConfig = z.object({
  scope: z.enum(["any_channel", "email", "whatsapp", "linkedin"]).default("any_channel"),
  timeout_value: z.number().int().min(0).max(365).default(3),
  timeout_unit: z.enum(["hours", "days"]).default("days"),
});
const ActionConfig = z.object({
  action_type: z.enum([
    "set_status",
    "set_temperature",
    "add_tag",
    "remove_tag",
    "move_pipeline",
  ]),
  params: z.record(z.string(), z.any()).default({}),
});
const EndConfig = z.object({
  reason: z.string().max(160).optional(),
});

const AiMessageConfig = z.object({
  channel: z.enum(["whatsapp", "email"]).default("whatsapp"),
  task_instruction: z.string().max(500).default(""),
  email_subject_template: z.string().max(200).default("").optional(),
  mood_slug: z.string().max(48).nullable().optional(),
  approach_slug: z.string().max(48).nullable().optional(),
  length_slug: z.string().max(48).nullable().optional(),
  language_slug: z.string().max(48).nullable().optional(),
  extra_context: z.string().max(280).nullable().default("").optional(),
  must_include: z.string().max(280).nullable().default("").optional(),
});

const AiGenerateTextConfig = z.object({
  output_label: z.string().max(120).default(""),
  channel_hint: z.enum(["whatsapp", "email"]).default("whatsapp"),
  task_instruction: z.string().max(500).default("").optional(),
  mood_slug: z.string().max(48).nullable().optional(),
  approach_slug: z.string().max(48).nullable().optional(),
  length_slug: z.string().max(48).nullable().optional(),
  language_slug: z.string().max(48).nullable().optional(),
  extra_context: z.string().max(280).nullable().default("").optional(),
  must_include: z.string().max(280).nullable().default("").optional(),
});

const CalCheckAvailabilityConfig = z.object({
  event_type_id: z.number().int().positive(),
  window_days: z.number().int().min(1).max(60).default(7),
  business_hours_only: z.boolean().default(true),
});
const CalBookMeetingConfig = z.object({
  event_type_id: z.number().int().positive(),
  slot_strategy: z.enum(["first_available", "ai_decided", "lead_picks_link"]).default("first_available"),
  fallback_link_text: z.string().max(500).optional(),
  cancel_retry_business_days: z.number().int().min(0).max(60).default(3),
});
const CalCancelBookingConfig = z.object({
  reason_template: z.string().max(300).optional(),
});
const CalRescheduleBookingConfig = z.object({
  event_type_id: z.number().int().positive(),
  strategy: z.enum(["first_available", "lead_picks_link"]).default("first_available"),
});

function validateConfigForType(type: StepType, config: unknown): unknown {
  switch (type) {
    case "message_email":
      return EmailConfig.parse(config ?? {});
    case "message_whatsapp":
      return WhatsappConfig.parse(config ?? {});
    case "message_linkedin":
      return LinkedinConfig.parse(config ?? {});
    case "wait":
      return WaitConfig.parse(config ?? {});
    case "condition_replied":
      return ConditionRepliedConfig.parse(config ?? {});
    case "action":
      return ActionConfig.parse(config ?? {});
    case "calcom_check_availability":
      return CalCheckAvailabilityConfig.parse(config ?? {});
    case "calcom_book_meeting":
      return CalBookMeetingConfig.parse(config ?? {});
    case "calcom_cancel_booking":
      return CalCancelBookingConfig.parse(config ?? {});
    case "calcom_reschedule_booking":
      return CalRescheduleBookingConfig.parse(config ?? {});
    case "end":
      return EndConfig.parse(config ?? {});
    case "ai_message":
      return AiMessageConfig.parse(config ?? {});
    case "ai_generate_text":
      return AiGenerateTextConfig.parse(config ?? {});
  }
}

const StepInput = z.object({
  id: z.string().uuid(),
  type: z.enum(STEP_TYPES),
  position_x: z.number(),
  position_y: z.number(),
  config: z.record(z.string(), z.any()).default({}),
  is_entry: z.boolean().default(false),
});

const TransitionInput = z.object({
  id: z.string().uuid(),
  from_step_id: z.string().uuid(),
  to_step_id: z.string().uuid(),
  branch: z.enum(["next", "yes", "no", "failed", "no_slots"]).default("next"),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadDocOrThrow(supabase: any, id: string) {
  const { data, error } = await supabase
    .from("builder_documents")
    .select("id, organization_id, campaign_id, name, description, version, status, published_at, published_version, updated_at, created_at, archived_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Documento não encontrado.");
  if (data.archived_at) throw new Error("Documento arquivado.");
  return data;
}

async function getActiveOrgId(supabase: any, userId: string) {
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

type ValidationError = { step_id: string | null; message: string };

function validateGraph(
  steps: z.infer<typeof StepInput>[],
  transitions: z.infer<typeof TransitionInput>[],
  opts: { strict: boolean },
): ValidationError[] {
  const errors: ValidationError[] = [];
  if (steps.length === 0) {
    errors.push({ step_id: null, message: "O fluxo precisa de ao menos 1 passo." });
    return errors;
  }
  const entries = steps.filter((s) => s.is_entry);
  if (entries.length !== 1) {
    errors.push({
      step_id: null,
      message: `O fluxo precisa de exatamente 1 passo inicial (encontrado: ${entries.length}).`,
    });
  }
  const stepById = new Map(steps.map((s) => [s.id, s]));
  for (const t of transitions) {
    if (!stepById.has(t.from_step_id) || !stepById.has(t.to_step_id)) {
      errors.push({ step_id: null, message: "Transição aponta para passo inexistente." });
    }
    if (t.from_step_id === t.to_step_id) {
      errors.push({ step_id: t.from_step_id, message: "Auto-conexão não permitida." });
    }
  }
  // Outgoing per step by branch
  const outgoing = new Map<string, Set<string>>();
  for (const t of transitions) {
    if (!outgoing.has(t.from_step_id)) outgoing.set(t.from_step_id, new Set());
    const set = outgoing.get(t.from_step_id)!;
    if (set.has(t.branch)) {
      errors.push({
        step_id: t.from_step_id,
        message: `Duas transições com mesma ramificação "${t.branch}".`,
      });
    }
    set.add(t.branch);
  }
  for (const s of steps) {
    const out = outgoing.get(s.id) ?? new Set();
    if (s.type === "end") {
      if (out.size > 0) {
        errors.push({
          step_id: s.id,
          message: 'O nó "Fim" não pode ter saídas.',
        });
      }
    } else if (s.type === "condition_replied") {
      if (out.size !== 0 && !(out.has("yes") && out.has("no") && out.size === 2)) {
        errors.push({
          step_id: s.id,
          message: 'Condição precisa de 0 ou 2 saídas ("Sim" e "Não").',
        });
      }
    } else if (s.type === "calcom_check_availability") {
      // allowed: 'next' (slots found) and/or 'no_slots'
      for (const b of out) {
        if (b !== "next" && b !== "no_slots") {
          errors.push({ step_id: s.id, message: `Saída "${b}" inválida em Consultar agenda.` });
        }
      }
      if (opts.strict && out.size === 0) {
        errors.push({ step_id: s.id, message: 'Passo sem próximo nó. Conecte a um nó "Fim" para encerrar o fluxo.' });
      }
    } else if (s.type === "calcom_book_meeting") {
      // allowed: 'next' (booked) and/or 'failed' (no slot / api error)
      for (const b of out) {
        if (b !== "next" && b !== "failed") {
          errors.push({ step_id: s.id, message: `Saída "${b}" inválida em Agendar reunião.` });
        }
      }
      if (opts.strict && out.size === 0) {
        errors.push({ step_id: s.id, message: 'Passo sem próximo nó. Conecte a um nó "Fim" para encerrar o fluxo.' });
      }
    } else {
      if (out.size > 1 || (out.size === 1 && !out.has("next"))) {
        errors.push({
          step_id: s.id,
          message: 'Passo linear só pode ter 1 saída "next".',
        });
      }
      if (opts.strict && out.size === 0) {
        errors.push({
          step_id: s.id,
          message: 'Passo sem próximo nó. Conecte a um nó "Fim" para encerrar o fluxo.',
        });
      }
    }
    // Per-type config validation
    try {
      const cfg = validateConfigForType(s.type, s.config) as any;
      if (opts.strict) {
        if (s.type === "message_email") {
          if (!cfg.subject?.trim())
            errors.push({ step_id: s.id, message: "Email: assunto vazio." });
          if (!cfg.body_html?.trim())
            errors.push({ step_id: s.id, message: "Email: corpo vazio." });
        }
        if (s.type === "wait") {
          if (!cfg.duration_value || cfg.duration_value <= 0)
            errors.push({ step_id: s.id, message: "Aguardar: duração precisa ser > 0." });
        }
        if (s.type === "condition_replied") {
          if (!cfg.timeout_value || cfg.timeout_value <= 0)
            errors.push({ step_id: s.id, message: "Condição: janela precisa ser > 0." });
        }
      }
    } catch (e) {
      errors.push({
        step_id: s.id,
        message: `Configuração inválida: ${(e as Error).message}`,
      });
    }
  }
  return errors;
}

async function fetchStepsAndTransitions(supabase: any, document_id: string) {
  const [stepsRes, trRes] = await Promise.all([
    supabase
      .from("flow_steps")
      .select("id, type, position_x, position_y, config, is_entry, created_at, updated_at")
      .eq("document_id", document_id),
    supabase
      .from("flow_transitions")
      .select("id, from_step_id, to_step_id, branch, created_at")
      .eq("document_id", document_id),
  ]);
  if (stepsRes.error) throw new Error(stepsRes.error.message);
  if (trRes.error) throw new Error(trRes.error.message);
  return { steps: stepsRes.data ?? [], transitions: trRes.data ?? [] };
}

// ---------------------------------------------------------------------------
// Server functions
// ---------------------------------------------------------------------------

export const listBuilderDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ campaign_id: z.string().uuid().optional() }).optional().parse(i),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("builder_documents")
      .select("id, name, description, status, version, published_at, updated_at, created_at, campaign_id")
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(200);
    if (data?.campaign_id) q = q.eq("campaign_id", data.campaign_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getBuilderDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const doc = await loadDocOrThrow(context.supabase, data.id);
    const { steps, transitions } = await fetchStepsAndTransitions(
      context.supabase,
      data.id,
    );
    return { document: doc, steps, transitions };
  });

export const getBuilderDocumentByCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ campaign_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Verify caller is org member of campaign owner
    const { data: campaign, error: cErr } = await supabase
      .from("campaigns")
      .select("id, name, organization_id")
      .eq("id", data.campaign_id)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!campaign) throw new Error("Campanha não encontrada.");

    // Try to find existing doc
    const { data: existing, error: exErr } = await supabase
      .from("builder_documents")
      .select("id")
      .eq("campaign_id", data.campaign_id)
      .is("archived_at", null)
      .maybeSingle();
    if (exErr) throw new Error(exErr.message);

    let docId = existing?.id as string | undefined;
    if (!docId) {
      const orgId = await getActiveOrgId(supabase, userId);
      const { data: created, error: insErr } = await supabase
        .from("builder_documents")
        .insert({
          organization_id: campaign.organization_id ?? orgId,
          campaign_id: data.campaign_id,
          name: `Fluxo — ${campaign.name}`,
          schema: {} as any,
          version: 1,
          status: "draft",
          created_by: userId,
          updated_by: userId,
        })
        .select("id")
        .single();
      if (insErr) throw new Error(insErr.message);
      docId = created.id;

      // Seed entry step
      const { error: seedErr } = await supabase.from("flow_steps").insert({
        document_id: docId,
        type: "ai_message",
        position_x: 100,
        position_y: 200,
        config: {
          channel: "whatsapp",
          task_instruction: "",
          mood_slug: null,
          approach_slug: null,
          length_slug: null,
          language_slug: null,
          extra_context: "",
          must_include: "",
        },
        is_entry: true,
      });
      if (seedErr) throw new Error(seedErr.message);
    }

    const doc = await loadDocOrThrow(supabase, docId!);
    const { steps, transitions } = await fetchStepsAndTransitions(supabase, docId!);
    return { document: doc, steps, transitions };
  });

const SaveInput = z.object({
  document_id: z.string().uuid(),
  name: z.string().trim().min(1).max(160).optional(),
  steps: z.array(StepInput).max(200),
  transitions: z.array(TransitionInput).max(400),
});

export const saveBuilderDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SaveInput.parse(i))
  .handler(async ({ data, context }) => {
    const doc = await loadDocOrThrow(context.supabase, data.document_id);
    const errors = validateGraph(data.steps, data.transitions, { strict: false });
    if (errors.length) {
      return { ok: false as const, errors };
    }

    const { supabase, userId } = context;
    const stepIds = data.steps.map((s) => s.id);
    const trIds = data.transitions.map((t) => t.id);

    // Delete orphaned transitions first (FK), then steps
    const trDel = supabase
      .from("flow_transitions")
      .delete()
      .eq("document_id", data.document_id);
    const { error: trDelErr } = await (trIds.length
      ? trDel.not("id", "in", `(${trIds.join(",")})`)
      : trDel);
    if (trDelErr) throw new Error(trDelErr.message);

    const stDel = supabase
      .from("flow_steps")
      .delete()
      .eq("document_id", data.document_id);
    const { error: stDelErr } = await (stepIds.length
      ? stDel.not("id", "in", `(${stepIds.join(",")})`)
      : stDel);
    if (stDelErr) throw new Error(stDelErr.message);

    // Upsert steps
    if (data.steps.length) {
      const stepRows = data.steps.map((s) => ({
        id: s.id,
        document_id: data.document_id,
        type: s.type,
        position_x: s.position_x,
        position_y: s.position_y,
        config: validateConfigForType(s.type, s.config) as any,
        is_entry: s.is_entry,
      }));
      const { error: upStErr } = await supabase
        .from("flow_steps")
        .upsert(stepRows, { onConflict: "id" });
      if (upStErr) throw new Error(upStErr.message);
    }

    // Upsert transitions
    if (data.transitions.length) {
      const trRows = data.transitions.map((t) => ({
        id: t.id,
        document_id: data.document_id,
        from_step_id: t.from_step_id,
        to_step_id: t.to_step_id,
        branch: t.branch,
      }));
      const { error: upTrErr } = await supabase
        .from("flow_transitions")
        .upsert(trRows, { onConflict: "id" });
      if (upTrErr) throw new Error(upTrErr.message);
    }

    const { data: updated, error: updErr } = await supabase
      .from("builder_documents")
      .update({
        version: (doc.version ?? 1) + 1,
        updated_by: userId,
        updated_at: new Date().toISOString(),
        ...(data.name ? { name: data.name } : {}),
      })
      .eq("id", data.document_id)
      .select()
      .single();
    if (updErr) throw new Error(updErr.message);

    const fresh = await fetchStepsAndTransitions(supabase, data.document_id);
    return {
      ok: true as const,
      document: updated,
      steps: fresh.steps,
      transitions: fresh.transitions,
    };
  });

export const publishBuilderDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const doc = await loadDocOrThrow(context.supabase, data.id);
    const { steps, transitions } = await fetchStepsAndTransitions(
      context.supabase,
      data.id,
    );
    const parsedSteps = steps.map((s: any) => ({
      id: s.id,
      type: s.type,
      position_x: s.position_x,
      position_y: s.position_y,
      config: s.config ?? {},
      is_entry: s.is_entry,
    }));
    const parsedTr = transitions.map((t: any) => ({
      id: t.id,
      from_step_id: t.from_step_id,
      to_step_id: t.to_step_id,
      branch: t.branch,
    }));
    const errors = validateGraph(parsedSteps, parsedTr, { strict: true });
    if (errors.length) return { ok: false as const, errors };

    const { data: row, error } = await context.supabase
      .from("builder_documents")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        published_version: doc.version,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { ok: true as const, document: row };
  });

export const revertToDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("builder_documents")
      .update({
        status: "draft",
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const renameBuilderDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(160) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("builder_documents")
      .update({
        name: data.name,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteBuilderDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const doc = await loadDocOrThrow(context.supabase, data.id);
    if (doc.campaign_id) {
      const { data: camp } = await context.supabase
        .from("campaigns")
        .select("status")
        .eq("id", doc.campaign_id)
        .maybeSingle();
      if (camp && camp.status !== "draft") {
        throw new Error("Só é possível excluir o fluxo quando a campanha está em rascunho.");
      }
    }
    const { error } = await context.supabase
      .from("builder_documents")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
