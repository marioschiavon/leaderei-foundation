// Server-only OpenAI client + telemetry helper. Never import from client code.
import OpenAI from "openai";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

let _client: OpenAI | undefined;
function getClient() {
  if (_client) return _client;
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY não configurada na plataforma.");
  _client = new OpenAI({ apiKey: key });
  return _client;
}

// Approximate USD pricing (per 1M tokens) — used for telemetry only.
// Source: https://openai.com/pricing (snapshot 2026-06).
const PRICING: Record<string, { in: number; out: number }> = {
  "gpt-4.1-mini": { in: 0.4, out: 1.6 },
  "gpt-4.1": { in: 2, out: 8 },
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
};

function estimateCost(model: string, inT: number, outT: number) {
  const p = PRICING[model] ?? { in: 0.5, out: 2 };
  return Number((((inT * p.in) + (outT * p.out)) / 1_000_000).toFixed(6));
}

export type CallOpenAIArgs = {
  systemPrompt: string;
  userPrompt: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  organizationId: string;
  leadId?: string | null;
  conversationId?: string | null;
  kind?: "rewrite" | "generate" | "preview" | "negotiate" | "classify";
  triggeredBy?: string | null;
};

export type CallOpenAIResult = {
  text: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  latencyMs: number;
};

/**
 * Centralized OpenAI call. Always logs to ai_actions.
 * Throws on any provider error (caller decides how to surface).
 */
export async function callOpenAI(args: CallOpenAIArgs): Promise<CallOpenAIResult> {
  const started = Date.now();
  const client = getClient();
  const kind = args.kind ?? "generate";

  let text = "";
  let tokensIn = 0;
  let tokensOut = 0;
  let error: string | null = null;
  let status: "succeeded" | "failed" = "succeeded";

  try {
    const resp = await client.chat.completions.create({
      model: args.model,
      temperature: args.temperature ?? 0.7,
      max_tokens: args.maxTokens ?? 1200,
      messages: [
        { role: "system", content: args.systemPrompt },
        { role: "user", content: args.userPrompt },
      ],
    });
    text = resp.choices[0]?.message?.content ?? "";
    tokensIn = resp.usage?.prompt_tokens ?? 0;
    tokensOut = resp.usage?.completion_tokens ?? 0;
  } catch (e: any) {
    status = "failed";
    error = e?.message ?? String(e);
  }

  const latencyMs = Date.now() - started;
  const costUsd = estimateCost(args.model, tokensIn, tokensOut);

  // Telemetry (never throws on log failure — fire-and-forget shape but awaited).
  try {
    await supabaseAdmin.from("ai_actions").insert({
      organization_id: args.organizationId,
      lead_id: args.leadId ?? null,
      conversation_id: args.conversationId ?? null,
      kind,
      model: args.model,
      status,
      tokens_input: tokensIn,
      tokens_output: tokensOut,
      cost_usd: costUsd,
      latency_ms: latencyMs,
      input: {
        system_chars: args.systemPrompt.length,
        user_chars: args.userPrompt.length,
        temperature: args.temperature ?? 0.7,
        max_tokens: args.maxTokens ?? 1200,
        triggered_by: args.triggeredBy ?? null,
      },
      output: status === "succeeded" ? { text } : {},
      error,
    });
  } catch (logErr) {
    console.error("[openai.server] failed to log ai_actions:", logErr);
  }

  if (status === "failed") {
    throw new Error(error ?? "Falha na chamada à OpenAI.");
  }

  return { text, model: args.model, tokensIn, tokensOut, costUsd, latencyMs };
}

export function hasOpenAIKey(): boolean {
  return !!process.env.OPENAI_API_KEY;
}
