// Server-only conversation agent.
// Triggered by /api/public/hooks/agent-tick (pg_cron every minute).
// For each pending scheduled_jobs row of kind='agent_respond', loads the
// conversation context, asks the LLM to pick ONE of 6 actions via OpenAI
// function calling, and executes it deterministically.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmailInternal } from "@/lib/email.functions";
import { callOpenAI, hasOpenAIKey } from "@/lib/openai.server";

type Json = Record<string, unknown>;

const DEFAULT_AGENT_GOAL =
  "Seu objetivo principal é conduzir a conversa de forma natural e consultiva, " +
  "identificar o momento de interesse do lead, e propor agendar uma reunião assim " +
  "que houver abertura. Priorize sempre avançar a conversa em direção ao " +
  "agendamento, sem ser insistente ou repetitivo.";

const AGENT_TOOL_SCHEMA = {
  name: "decide_action",
  description:
    "Decide qual ação tomar na conversa com o lead. Escolha exatamente UMA ação. " +
    "Use 'oferecer_horarios' quando o lead demonstrar interesse em conversar/reunir-se. " +
    "Use 'confirmar_agendamento' quando o lead escolher um dos horários já oferecidos. " +
    "Use 'marcar_quente_humano' quando o lead pedir algo que requer humano (preço customizado, contrato, decisão técnica complexa). " +
    "Use 'encerrar_cadencia' quando o lead pedir para parar de receber mensagens. " +
    "Use 'ignorar' apenas quando a mensagem inbound for irrelevante (ex: emoji solto, áudio sem transcrição). " +
    "Caso contrário use 'responder'.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      action: {
        type: "string",
        enum: [
          "responder",
          "oferecer_horarios",
          "confirmar_agendamento",
          "marcar_quente_humano",
          "encerrar_cadencia",
          "ignorar",
        ],
      },
      message_text: {
        type: "string",
        description: "Texto a enviar ao lead. Obrigatório para 'responder' e 'oferecer_horarios'. Opcional para 'confirmar_agendamento' e 'encerrar_cadencia'.",
      },
      slots_count: {
        type: "integer",
        description: "Quantos horários sugerir (1-3). Somente para 'oferecer_horarios'.",
        minimum: 1,
        maximum: 3,
      },
      chosen_slot_iso: {
        type: "string",
        description: "ISO 8601 do horário escolhido pelo lead. Somente para 'confirmar_agendamento'. Precisa estar entre os horários oferecidos anteriormente.",
      },
      reason: {
        type: "string",
        description: "Motivo (uma frase). Para 'marcar_quente_humano' e 'encerrar_cadencia'.",
      },
    },
    required: ["action"],
  },
} as const;

type AgentAction =
  | { action: "responder"; message_text: string }
  | { action: "oferecer_horarios"; message_text: string; slots_count?: number }
  | { action: "confirmar_agendamento"; chosen_slot_iso: string; message_text?: string }
  | { action: "marcar_quente_humano"; reason: string }
  | { action: "encerrar_cadencia"; reason?: string; message_text?: string }
  | { action: "ignorar" };

// ---------------------------------------------------------------------------
// Conversation history → dialogue format
// ---------------------------------------------------------------------------

function formatHistory(messages: Array<{ direction: string; body: string | null; created_at: string; sent_by_ai: boolean | null }>): string {
  const lines: string[] = [];
  for (const m of messages) {
    if (!m.body) continue;
    const speaker = m.direction === "inbound" ? "Lead" : (m.sent_by_ai ? "Você (agente IA)" : "Você (vendedor)");
    lines.push(`${speaker}: ${m.body}`);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Send helpers (channel-aware)
// ---------------------------------------------------------------------------

async function sendWhatsAppFromAgent(args: {
  organization_id: string;
  conversation_id: string;
  lead_id: string;
  phone: string;
  text: string;
}) {
  const { data: instances } = await supabaseAdmin
    .from("hook7_instances")
    .select("id")
    .eq("organization_id", args.organization_id)
    .eq("status", "connected")
    .is("archived_at", null)
    .order("last_connected_at", { ascending: false })
    .limit(1);
  const inst = instances?.[0];
  if (!inst) throw new Error("Nenhuma instância WhatsApp conectada.");

  const { data: token } = await supabaseAdmin.rpc("get_hook7_instance_token", { _instance_id: inst.id });
  if (!token) throw new Error("Token Hook7 indisponível.");

  const { data: baseUrlData } = await supabaseAdmin.rpc("get_platform_plain", { _key: "hook7_base_url" });
  const baseUrl = (typeof baseUrlData === "string" && baseUrlData) || "https://api.hook7.com.br";

  const phone = (args.phone || "").replace(/\D+/g, "");
  if (phone.length < 10 || phone.length > 15) throw new Error("Telefone inválido.");

  const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/send/text`, {
    method: "POST",
    headers: { apikey: token as string, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ number: phone, text: args.text }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Hook7 ${res.status}: ${t.slice(0, 200)}`);
  }
  const json: any = await res.json().catch(() => ({}));
  const externalId: string | null = json?.data?.Info?.ID ?? null;

  await supabaseAdmin.from("messages").insert({
    organization_id: args.organization_id,
    conversation_id: args.conversation_id,
    channel: "whatsapp",
    direction: "outbound",
    body: args.text,
    source_channel: "whatsapp",
    whatsapp_status: "sent",
    status: "sent",
    sent_at: new Date().toISOString(),
    sent_by_ai: true,
    external_message_id: externalId,
    metadata: { agent: true, origin: "conversation_agent" },
  });

  await supabaseAdmin.from("conversations").update({
    last_message_at: new Date().toISOString(),
    last_message_preview: args.text.slice(0, 140),
    updated_at: new Date().toISOString(),
  }).eq("id", args.conversation_id);
}

async function sendEmailFromAgent(args: {
  organization_id: string;
  conversation_id: string;
  lead_email: string;
  lead_name: string | null;
  subject: string | null;
  text: string;
}) {
  const subj = args.subject?.trim() || "Continuação";
  await sendEmailInternal({
    to: args.lead_email,
    subject: subj,
    text: args.text,
    html: `<p>${args.text.replace(/\n/g, "<br/>")}</p>`,
    purpose: "inbox_reply",
    organization_id: args.organization_id,
    template_key: `agent:reply`,
    metadata: { conversation_id: args.conversation_id, agent: true },
  });

  await supabaseAdmin.from("messages").insert({
    organization_id: args.organization_id,
    conversation_id: args.conversation_id,
    channel: "email",
    direction: "outbound",
    body: args.text,
    source_channel: "email",
    status: "sent",
    sent_at: new Date().toISOString(),
    sent_by_ai: true,
    metadata: { agent: true, origin: "conversation_agent", subject: subj },
  });
  await supabaseAdmin.from("conversations").update({
    last_message_at: new Date().toISOString(),
    last_message_preview: args.text.slice(0, 140),
    updated_at: new Date().toISOString(),
  }).eq("id", args.conversation_id);
}

async function sendToLead(opts: {
  channel: string;
  organization_id: string;
  conversation_id: string;
  lead: { id: string; phone: string | null; email: string | null; full_name: string | null };
  subject: string | null;
  text: string;
}) {
  if (opts.channel === "whatsapp") {
    if (!opts.lead.phone) throw new Error("Lead sem WhatsApp.");
    await sendWhatsAppFromAgent({
      organization_id: opts.organization_id,
      conversation_id: opts.conversation_id,
      lead_id: opts.lead.id,
      phone: opts.lead.phone,
      text: opts.text,
    });
    return;
  }
  if (opts.channel === "email") {
    if (!opts.lead.email) throw new Error("Lead sem e-mail.");
    await sendEmailFromAgent({
      organization_id: opts.organization_id,
      conversation_id: opts.conversation_id,
      lead_email: opts.lead.email,
      lead_name: opts.lead.full_name,
      subject: opts.subject,
      text: opts.text,
    });
    return;
  }
  throw new Error(`Canal não suportado pelo agente: ${opts.channel}`);
}

// ---------------------------------------------------------------------------
// Slot formatting
// ---------------------------------------------------------------------------

function formatSlotPt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    weekday: "long", day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
  });
}

// ---------------------------------------------------------------------------
// Decide action via OpenAI tool calling
// ---------------------------------------------------------------------------

import OpenAI from "openai";

async function decideAction(args: {
  systemPrompt: string;
  history: string;
  organization_id: string;
  conversation_id: string;
  lead_id: string;
  model: string;
  temperature: number;
  maxTokens: number;
}): Promise<AgentAction> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY ausente");
  const client = new OpenAI({ apiKey });

  const started = Date.now();
  let chosen: AgentAction | null = null;
  let tokensIn = 0;
  let tokensOut = 0;
  let errMsg: string | null = null;
  try {
    const resp = await client.chat.completions.create({
      model: args.model,
      temperature: args.temperature,
      max_tokens: args.maxTokens,
      tools: [{ type: "function", function: AGENT_TOOL_SCHEMA as any }],
      tool_choice: { type: "function", function: { name: AGENT_TOOL_SCHEMA.name } },
      messages: [
        { role: "system", content: args.systemPrompt },
        { role: "user", content: `Histórico da conversa:\n\n${args.history}\n\nDecida a próxima ação.` },
      ],
    });
    tokensIn = resp.usage?.prompt_tokens ?? 0;
    tokensOut = resp.usage?.completion_tokens ?? 0;
    const call: any = resp.choices[0]?.message?.tool_calls?.[0];
    const raw: string | undefined = call?.function?.arguments;
    if (!raw) throw new Error("Modelo não retornou tool_call.");
    const parsed = JSON.parse(raw);
    if (!parsed?.action || !["responder","oferecer_horarios","confirmar_agendamento","marcar_quente_humano","encerrar_cadencia","ignorar"].includes(parsed.action)) {
      throw new Error("Ação inválida do modelo.");
    }
    chosen = parsed as AgentAction;
  } catch (e: any) {
    errMsg = String(e?.message ?? e);
  }

  const latencyMs = Date.now() - started;
  try {
    await supabaseAdmin.from("ai_actions").insert({
      organization_id: args.organization_id,
      lead_id: args.lead_id,
      conversation_id: args.conversation_id,
      kind: "auto_reply",
      model: args.model,
      status: chosen ? "succeeded" : "failed",
      tokens_input: tokensIn,
      tokens_output: tokensOut,
      cost_usd: 0,
      latency_ms: latencyMs,
      input: { agent: true, history_chars: args.history.length },
      output: chosen ? (chosen as any) : {},
      error: errMsg,
    });
  } catch (e) {
    console.error("[agent] log ai_actions:", e);
  }

  if (!chosen) throw new Error(errMsg ?? "Falha ao decidir ação");
  return chosen;
}

// ---------------------------------------------------------------------------
// Process a single job
// ---------------------------------------------------------------------------

async function processAgentJob(jobId: string): Promise<{ ok: boolean; error?: string }> {
  const { data: job } = await supabaseAdmin
    .from("scheduled_jobs")
    .select("id, payload, attempts, max_attempts")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return { ok: false, error: "job não encontrado" };

  const payload = (job.payload ?? {}) as any;
  const conversation_id: string | undefined = payload.conversation_id;
  const lead_id: string | undefined = payload.lead_id;
  const organization_id: string | undefined = payload.organization_id;
  if (!conversation_id || !lead_id || !organization_id) {
    await supabaseAdmin.from("scheduled_jobs").update({ status: "failed", last_error: "payload incompleto" }).eq("id", job.id);
    return { ok: false, error: "payload incompleto" };
  }

  // 1. Load conversation; respect agent_paused
  const { data: conv } = await supabaseAdmin
    .from("conversations")
    .select("id, organization_id, lead_id, channel, agent_paused, ai_enabled, agent_context, subject")
    .eq("id", conversation_id)
    .maybeSingle();
  if (!conv) {
    await supabaseAdmin.from("scheduled_jobs").update({ status: "failed", last_error: "conversa ausente" }).eq("id", job.id);
    return { ok: false, error: "conversa ausente" };
  }
  if (conv.agent_paused) {
    await supabaseAdmin.from("scheduled_jobs").update({ status: "completed", last_error: "agente pausado" }).eq("id", job.id);
    return { ok: true };
  }
  if (conv.ai_enabled === false) {
    await supabaseAdmin.from("scheduled_jobs").update({ status: "completed", last_error: "ai desativada" }).eq("id", job.id);
    return { ok: true };
  }

  // 2. Pause active enrollments for this lead
  await supabaseAdmin
    .from("campaign_enrollments")
    .update({
      status: "paused",
      last_error: "lead_replied",
    })
    .eq("organization_id", organization_id)
    .eq("lead_id", lead_id)
    .eq("status", "active");

  // 3. Load lead + history + AI settings + memory
  const [{ data: lead }, { data: msgs }, { data: settings }, { data: profile }, { data: presets }, { data: memory }] = await Promise.all([
    supabaseAdmin.from("leads").select("id, full_name, email, phone, company_name, job_title, industry, city, country, custom_fields").eq("id", lead_id).maybeSingle(),
    supabaseAdmin.from("messages").select("direction, body, created_at, sent_by_ai").eq("conversation_id", conversation_id).order("created_at", { ascending: true }).limit(20),
    supabaseAdmin.from("ai_platform_settings").select("*").order("created_at", { ascending: true }).limit(1).maybeSingle(),
    supabaseAdmin.from("ai_org_profile").select("*").eq("organization_id", organization_id).maybeSingle(),
    supabaseAdmin.from("ai_tone_presets").select("kind,slug,prompt_fragment").eq("is_active", true),
    supabaseAdmin.from("lead_memory_items").select("category, key, value").eq("lead_id", lead_id).is("archived_at", null).order("category").limit(20),
  ]);

  if (!lead) {
    await supabaseAdmin.from("scheduled_jobs").update({ status: "failed", last_error: "lead ausente" }).eq("id", job.id);
    return { ok: false, error: "lead ausente" };
  }
  if (!settings || !settings.is_enabled) {
    await supabaseAdmin.from("scheduled_jobs").update({ status: "completed", last_error: "IA da plataforma desabilitada" }).eq("id", job.id);
    return { ok: true };
  }
  if (!hasOpenAIKey()) {
    await supabaseAdmin.from("scheduled_jobs").update({ status: "failed", last_error: "sem OPENAI_API_KEY" }).eq("id", job.id);
    return { ok: false, error: "sem chave" };
  }

  const goal = (profile?.conversation_agent_goal && profile.conversation_agent_goal.trim()) || DEFAULT_AGENT_GOAL;
  const brandLines: string[] = [];
  if (profile?.brand_name) brandLines.push(`Marca: ${profile.brand_name}`);
  if (profile?.brand_voice) brandLines.push(`Voz: ${profile.brand_voice}`);
  if (profile?.product_description) brandLines.push(`Produto: ${profile.product_description}`);
  if (profile?.icp_description) brandLines.push(`ICP: ${profile.icp_description}`);
  if (profile?.value_proposition) brandLines.push(`Proposta: ${profile.value_proposition}`);
  if (profile?.default_cta) brandLines.push(`CTA preferido: ${profile.default_cta}`);
  if (profile?.forbidden_words?.length) brandLines.push(`Evitar palavras: ${profile.forbidden_words.join(", ")}`);

  const toneFragments: string[] = [];
  for (const kind of ["mood", "approach", "length", "language"] as const) {
    const slugKey = `default_${kind}_slug` as const;
    const slug = (profile as any)?.[slugKey];
    if (slug) {
      const found = (presets ?? []).find((p) => p.kind === kind && p.slug === slug);
      if (found?.prompt_fragment) toneFragments.push(`- ${found.prompt_fragment}`);
    }
  }

  const agentCtx = (conv.agent_context ?? {}) as any;
  const offeredSlots: string[] = Array.isArray(agentCtx.offered_slots) ? agentCtx.offered_slots : [];

  const memoryLines = (memory ?? [])
    .map((m) => `- [${m.category}] ${m.key}: ${m.value}`)
    .join("\n");

  const systemPrompt = [
    settings.master_system_prompt?.trim() ?? "",
    "",
    "[Objetivo do agente de conversa]",
    goal,
    "",
    brandLines.length ? `[Marca]\n${brandLines.join("\n")}` : "",
    toneFragments.length ? `[Estilo]\n${toneFragments.join("\n")}` : "",
    `[Canal]\nA conversa está acontecendo via ${conv.channel === "whatsapp" ? "WhatsApp (mensagens curtas, informais)" : "e-mail"}.`,
    offeredSlots.length ? `[Horários já oferecidos anteriormente]\n${offeredSlots.map(formatSlotPt).join("\n")}\nUse 'confirmar_agendamento' apenas com um destes ISOs: ${offeredSlots.join(", ")}` : "",
    `[Lead]\nNome: ${lead.full_name ?? "—"} | Empresa: ${lead.company_name ?? "—"} | Cargo: ${lead.job_title ?? "—"}`,
    memoryLines ? `[O que a IA já sabe sobre este lead]\n${memoryLines}` : "",
    "",
    "[Instruções do menu]",
    "Você DEVE chamar a função decide_action com exatamente uma ação. Não escreva texto livre fora da function call.",
  ].filter(Boolean).join("\n");

  const history = formatHistory(msgs ?? []);

  let decision: AgentAction;
  try {
    decision = await decideAction({
      systemPrompt,
      history,
      organization_id,
      conversation_id,
      lead_id,
      model: settings.default_model,
      temperature: Number(settings.default_temperature ?? 0.7),
      maxTokens: settings.max_tokens_per_call ?? 800,
    });
  } catch (e: any) {
    const attempts = (job.attempts ?? 0) + 1;
    const willRetry = attempts < (job.max_attempts ?? 3);
    await supabaseAdmin.from("scheduled_jobs").update({
      status: willRetry ? "pending" : "failed",
      run_at: willRetry ? new Date(Date.now() + 60_000 * attempts).toISOString() : undefined,
      attempts,
      last_error: String(e?.message ?? e).slice(0, 500),
      locked_at: null, locked_by: null,
    }).eq("id", job.id);
    return { ok: false, error: String(e?.message ?? e) };
  }

  // 3.5 Verifica fila de aprovação (regra da org → global → safe default = auto)
  const shouldQueue = await shouldEnqueueAction(decision.action, organization_id);
  if (shouldQueue) {
    await supabaseAdmin.from("agent_action_queue").insert({
      organization_id,
      conversation_id,
      lead_id,
      action_type: decision.action,
      action_params: decision as any,
      status: "pending",
    });
    await supabaseAdmin.from("lead_activities").insert({
      organization_id,
      lead_id,
      type: "system" as any,
      title: `Agente aguardando aprovação: ${decision.action}`,
      description: `Ação "${decision.action}" enfileirada para aprovação do master.`,
      payload: { agent: true, action: decision.action, queued: true, conversation_id },
    });
    await supabaseAdmin.from("scheduled_jobs")
      .update({ status: "completed", last_error: "ação enfileirada para aprovação" })
      .eq("id", job.id);
    return { ok: true };
  }

  // 4. Execute action
  try {
    await executeAction(decision, {
      organization_id,
      conversation_id,
      conversation_channel: conv.channel,
      conversation_subject: conv.subject ?? null,
      lead: {
        id: lead.id,
        full_name: lead.full_name,
        email: lead.email,
        phone: lead.phone,
      },
      offered_slots: offeredSlots,
      agent_context: agentCtx,
    });
    await supabaseAdmin.from("scheduled_jobs").update({ status: "completed" }).eq("id", job.id);
    return { ok: true };
  } catch (e: any) {
    const attempts = (job.attempts ?? 0) + 1;
    const willRetry = attempts < (job.max_attempts ?? 3);
    await supabaseAdmin.from("scheduled_jobs").update({
      status: willRetry ? "pending" : "failed",
      run_at: willRetry ? new Date(Date.now() + 60_000 * attempts).toISOString() : undefined,
      attempts,
      last_error: String(e?.message ?? e).slice(0, 500),
      locked_at: null, locked_by: null,
    }).eq("id", job.id);
    return { ok: false, error: String(e?.message ?? e) };
  }
}

async function shouldEnqueueAction(actionType: string, organizationId: string): Promise<boolean> {
  const { data: orgRule } = await supabaseAdmin
    .from("agent_action_rules")
    .select("auto_execute, enabled")
    .eq("organization_id", organizationId)
    .eq("action_type", actionType)
    .maybeSingle();
  if (orgRule) {
    if (!orgRule.enabled) return false;
    return !orgRule.auto_execute;
  }
  const { data: globalRule } = await supabaseAdmin
    .from("agent_action_rules")
    .select("auto_execute, enabled")
    .is("organization_id", null)
    .eq("action_type", actionType)
    .maybeSingle();
  if (globalRule) {
    if (!globalRule.enabled) return false;
    return !globalRule.auto_execute;
  }
  return false;
}

/** Reaproveita executeAction para um item da fila aprovado pelo master. */
export async function executeAgentActionFromQueue(queueId: string): Promise<void> {
  const { data: row, error } = await supabaseAdmin
    .from("agent_action_queue")
    .select("organization_id, conversation_id, lead_id, action_params")
    .eq("id", queueId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("Item da fila não encontrado.");

  const [{ data: conv }, { data: lead }] = await Promise.all([
    supabaseAdmin.from("conversations")
      .select("id, channel, subject, agent_context")
      .eq("id", row.conversation_id).maybeSingle(),
    supabaseAdmin.from("leads")
      .select("id, full_name, email, phone")
      .eq("id", row.lead_id).maybeSingle(),
  ]);
  if (!conv) throw new Error("Conversa ausente.");
  if (!lead) throw new Error("Lead ausente.");

  const agentCtx = (conv.agent_context ?? {}) as any;
  const offeredSlots: string[] = Array.isArray(agentCtx.offered_slots) ? agentCtx.offered_slots : [];

  await executeAction(row.action_params as AgentAction, {
    organization_id: row.organization_id,
    conversation_id: row.conversation_id,
    conversation_channel: conv.channel,
    conversation_subject: conv.subject ?? null,
    lead: { id: lead.id, full_name: lead.full_name, email: lead.email, phone: lead.phone },
    offered_slots: offeredSlots,
    agent_context: agentCtx,
  });
}

async function executeAction(
  decision: AgentAction,
  ctx: {
    organization_id: string;
    conversation_id: string;
    conversation_channel: string;
    conversation_subject: string | null;
    lead: { id: string; full_name: string | null; email: string | null; phone: string | null };
    offered_slots: string[];
    agent_context: Json;
  },
) {
  const baseActivity: any = {
    organization_id: ctx.organization_id,
    lead_id: ctx.lead.id,
    payload: { agent: true, action: decision.action, conversation_id: ctx.conversation_id },
  };

  switch (decision.action) {
    case "ignorar": {
      await supabaseAdmin.from("lead_activities").insert({
        ...baseActivity, type: "system" as any,
        title: "Agente decidiu ignorar mensagem",
        description: "Mensagem inbound considerada irrelevante.",
      });
      return;
    }

    case "responder": {
      const text = (decision as any).message_text?.trim();
      if (!text) throw new Error("responder sem message_text");
      await sendToLead({
        channel: ctx.conversation_channel,
        organization_id: ctx.organization_id,
        conversation_id: ctx.conversation_id,
        lead: ctx.lead,
        subject: ctx.conversation_subject ? `Re: ${ctx.conversation_subject}` : null,
        text,
      });
      await supabaseAdmin.from("lead_activities").insert({
        ...baseActivity, type: "message_sent" as any,
        title: "Agente respondeu",
        description: text.slice(0, 280),
      });
      return;
    }

    case "oferecer_horarios": {
      const count = Math.max(1, Math.min(3, (decision as any).slots_count ?? 3));
      const preamble = (decision as any).message_text?.trim() || "Olha só, tenho esses horários disponíveis:";
      const { loadCalcomConnection, getAvailableSlots } = await import("@/lib/calcom.server");
      const conn = await loadCalcomConnection(ctx.organization_id);
      if (!conn || !conn.default_event_type_id) {
        const fallback = "Posso te chamar pra alinharmos? Me diz um horário que funciona pra você nos próximos dias.";
        await sendToLead({
          channel: ctx.conversation_channel,
          organization_id: ctx.organization_id,
          conversation_id: ctx.conversation_id,
          lead: ctx.lead,
          subject: ctx.conversation_subject ? `Re: ${ctx.conversation_subject}` : null,
          text: `${preamble}\n\n${fallback}`,
        });
        await supabaseAdmin.from("lead_activities").insert({
          ...baseActivity, type: "system" as any,
          title: "Agente quis oferecer horários, mas Cal.com não configurado",
          description: "Enviado pedido manual de horário.",
        });
        return;
      }
      const start = new Date();
      const end = new Date(Date.now() + 7 * 86400_000);
      const r = await getAvailableSlots(conn, conn.default_event_type_id, start.toISOString(), end.toISOString());
      const data = r?.data ?? r?.slots ?? {};
      const collected: string[] = [];
      if (Array.isArray(data)) {
        for (const s of data) { if (s?.time || s?.start) collected.push(s.time ?? s.start); if (collected.length >= count) break; }
      } else {
        for (const day of Object.keys(data).sort()) {
          const arr = data[day];
          if (!Array.isArray(arr)) continue;
          for (const s of arr) { collected.push(s?.time ?? s?.start); if (collected.length >= count) break; }
          if (collected.length >= count) break;
        }
      }
      if (!collected.length) {
        const fallback = "No momento minha agenda está cheia. Me diz qual dia/horário funciona pra você e eu confirmo.";
        await sendToLead({
          channel: ctx.conversation_channel, organization_id: ctx.organization_id, conversation_id: ctx.conversation_id,
          lead: ctx.lead, subject: ctx.conversation_subject ? `Re: ${ctx.conversation_subject}` : null, text: fallback,
        });
        return;
      }
      const slotLines = collected.map((iso, i) => `${i + 1}) ${formatSlotPt(iso)}`).join("\n");
      const text = `${preamble}\n\n${slotLines}\n\nMe diz qual te atende.`;
      await sendToLead({
        channel: ctx.conversation_channel, organization_id: ctx.organization_id, conversation_id: ctx.conversation_id,
        lead: ctx.lead, subject: ctx.conversation_subject ? `Re: ${ctx.conversation_subject}` : null, text,
      });
      await supabaseAdmin.from("conversations").update({
        agent_context: { ...ctx.agent_context, offered_slots: collected, offered_at: new Date().toISOString() },
      }).eq("id", ctx.conversation_id);
      await supabaseAdmin.from("lead_activities").insert({
        ...baseActivity, type: "message_sent" as any,
        title: "Agente ofereceu horários",
        description: collected.map(formatSlotPt).join(" | "),
        payload: { ...(baseActivity.payload as any), offered_slots: collected },
      });
      return;
    }

    case "confirmar_agendamento": {
      const chosen = (decision as any).chosen_slot_iso as string | undefined;
      if (!chosen) throw new Error("confirmar_agendamento sem chosen_slot_iso");
      if (!ctx.offered_slots.includes(chosen)) {
        // Fallback: trate como responder pedindo esclarecimento
        await sendToLead({
          channel: ctx.conversation_channel, organization_id: ctx.organization_id, conversation_id: ctx.conversation_id,
          lead: ctx.lead, subject: ctx.conversation_subject ? `Re: ${ctx.conversation_subject}` : null,
          text: "Esse horário não consta nos que sugeri. Pode escolher um dos que mandei na mensagem anterior?",
        });
        await supabaseAdmin.from("lead_activities").insert({
          ...baseActivity, type: "system" as any,
          title: "Agente rejeitou horário fora da lista oferecida",
        });
        return;
      }
      const { loadCalcomConnection, createBookingViaApi } = await import("@/lib/calcom.server");
      const conn = await loadCalcomConnection(ctx.organization_id);
      if (!conn || !conn.default_event_type_id) throw new Error("Cal.com não configurado");
      if (!ctx.lead.email) throw new Error("Lead sem e-mail para agendar.");
      const booking = await createBookingViaApi({
        conn,
        event_type_id: conn.default_event_type_id,
        start_iso: chosen,
        attendee: { email: ctx.lead.email, name: ctx.lead.full_name ?? ctx.lead.email },
        metadata: { conversation_id: ctx.conversation_id, lead_id: ctx.lead.id, source: "conversation_agent" },
      });
      const data = booking?.data ?? booking;
      const uid = String(data?.uid ?? data?.id ?? "");
      const meetingUrl = data?.videoCallData?.url ?? data?.meetingUrl ?? null;
      if (uid) {
        await supabaseAdmin.from("lead_bookings").upsert({
          organization_id: ctx.organization_id,
          lead_id: ctx.lead.id,
          cal_booking_id: String(data?.id ?? uid),
          cal_booking_uid: uid,
          event_type_id: conn.default_event_type_id,
          title: data?.title ?? null,
          start_at: data?.startTime ?? chosen,
          end_at: data?.endTime ?? null,
          attendee_email: ctx.lead.email,
          attendee_name: ctx.lead.full_name ?? null,
          meeting_url: meetingUrl,
          status: "confirmed",
          raw_payload: data as any,
          updated_at: new Date().toISOString(),
        }, { onConflict: "cal_booking_uid" });
      }
      await supabaseAdmin.from("leads").update({ status: "qualified", temperature: "hot" }).eq("id", ctx.lead.id);
      const confirmText = ((decision as any).message_text as string | undefined)?.trim()
        || `Reunião confirmada para ${formatSlotPt(chosen)}. ${meetingUrl ? `Link: ${meetingUrl}` : "Você receberá o convite no seu e-mail."}`;
      await sendToLead({
        channel: ctx.conversation_channel, organization_id: ctx.organization_id, conversation_id: ctx.conversation_id,
        lead: ctx.lead, subject: ctx.conversation_subject ? `Re: ${ctx.conversation_subject}` : "Reunião confirmada",
        text: confirmText,
      });
      await supabaseAdmin.from("lead_activities").insert({
        ...baseActivity, type: "meeting" as any,
        title: "Reunião agendada pelo agente",
        description: `Início: ${chosen}${meetingUrl ? ` | Link: ${meetingUrl}` : ""}`,
        payload: { ...(baseActivity.payload as any), booking_uid: uid, start_at: chosen, meeting_url: meetingUrl },
      });
      return;
    }

    case "marcar_quente_humano": {
      const reason = (decision as any).reason || "Lead pediu atenção humana";
      await supabaseAdmin.from("conversations").update({
        needs_human: true,
        needs_human_reason: String(reason).slice(0, 280),
        updated_at: new Date().toISOString(),
      }).eq("id", ctx.conversation_id);
      await supabaseAdmin.from("leads").update({ temperature: "hot" }).eq("id", ctx.lead.id);
      await supabaseAdmin.from("lead_activities").insert({
        ...baseActivity, type: "system" as any,
        title: "Agente sinalizou: precisa de humano",
        description: String(reason).slice(0, 280),
      });
      return;
    }

    case "encerrar_cadencia": {
      const reason = (decision as any).reason || "Lead pediu para parar";
      await supabaseAdmin.from("campaign_enrollments")
        .update({ status: "cancelled", last_error: `agent:encerrar:${reason}`.slice(0, 200) })
        .eq("organization_id", ctx.organization_id)
        .eq("lead_id", ctx.lead.id)
        .in("status", ["active", "paused", "pending"]);
      await supabaseAdmin.from("leads").update({ status: "archived" }).eq("id", ctx.lead.id);
      const text = ((decision as any).message_text as string | undefined)?.trim();
      if (text) {
        try {
          await sendToLead({
            channel: ctx.conversation_channel, organization_id: ctx.organization_id, conversation_id: ctx.conversation_id,
            lead: ctx.lead, subject: ctx.conversation_subject ? `Re: ${ctx.conversation_subject}` : null, text,
          });
        } catch (e) { console.warn("[agent] encerrar send failed", e); }
      }
      await supabaseAdmin.from("lead_activities").insert({
        ...baseActivity, type: "system" as any,
        title: "Agente encerrou cadência",
        description: String(reason).slice(0, 280),
      });
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// Tick: drain pending agent_respond jobs
// ---------------------------------------------------------------------------

export async function runAgentTick(maxJobs = 10): Promise<{ processed: number; succeeded: number; failed: number }> {
  const workerId = (globalThis.crypto as Crypto).randomUUID();
  const nowIso = new Date().toISOString();

  const { data: candidates } = await supabaseAdmin
    .from("scheduled_jobs")
    .select("id")
    .eq("status", "pending")
    .eq("kind", "agent_respond")
    .is("locked_at", null)
    .lte("run_at", nowIso)
    .order("run_at", { ascending: true })
    .limit(maxJobs);
  const ids = (candidates ?? []).map((c) => c.id);
  if (!ids.length) return { processed: 0, succeeded: 0, failed: 0 };

  const { data: locked } = await supabaseAdmin
    .from("scheduled_jobs")
    .update({ status: "running", locked_at: nowIso, locked_by: workerId })
    .in("id", ids)
    .eq("status", "pending")
    .is("locked_at", null)
    .select("id");
  const lockedIds = (locked ?? []).map((l) => l.id);

  let succeeded = 0;
  let failed = 0;
  for (const id of lockedIds) {
    const r = await processAgentJob(id);
    if (r.ok) succeeded += 1; else failed += 1;
  }
  return { processed: lockedIds.length, succeeded, failed };
}
