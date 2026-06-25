import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const OPENAI_MODEL = "gpt-4o-mini";

export type LeadInsightsPayload = {
  resumo?: string;
  proposta_valor?: string;
  produtos?: string[];
  diferenciais?: string[];
  pain_points?: string[];
  fit_score?: "high" | "medium" | "low" | string;
  fit_reason?: string;
  oportunidades_abordagem?: Array<{
    angulo?: string;
    gancho?: string;
    conexao?: string;
    mensagem_sugerida?: string;
  }>;
};

function extractJson(text: string): any | null {
  if (!text) return null;
  // Strip code fences if present
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to find first { ... } block
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function buildSystemPrompt(args: {
  aiInstructions: string | null;
  highlights: string | null;
  items: Array<{ title: string; content: string }>;
}): string {
  const parts: string[] = [
    "Você é um especialista em inteligência comercial B2B atuando como SDR sênior.",
  ];

  if (args.aiInstructions?.trim()) {
    parts.push(
      `=== INSTRUÇÕES OBRIGATÓRIAS DA NOSSA EMPRESA (PRIORIDADE MÁXIMA) ===\n${args.aiInstructions.trim()}\nSe as regras acima indicarem que este prospect não tem fit, NÃO force conexão.`,
    );
  }

  if (args.items.length > 0) {
    const kb = args.items
      .slice(0, 8)
      .map((i) => `## ${i.title}\n${String(i.content).slice(0, 1500)}`)
      .join("\n\n");
    parts.push(`=== O QUE NOSSA EMPRESA VENDE ===\n${kb}`);
  } else {
    parts.push(
      "=== O QUE NOSSA EMPRESA VENDE ===\n(Base de conhecimento ainda não preenchida. Gere análise genérica, sem inventar produtos da nossa empresa.)",
    );
  }

  if (args.highlights?.trim()) {
    parts.push(`DIFERENCIAIS NOSSOS:\n${args.highlights.trim()}`);
  }

  parts.push(
    [
      "Analise o site do PROSPECT abaixo e gere insights estratégicos.",
      'Em "oportunidades_abordagem", CONECTE algo concreto encontrado no site do prospect ao que NÓS vendemos.',
      "Nunca invente fato sobre o prospect — se faltar informação, diga isso no resumo.",
      "Mensagens sugeridas devem ser curtas (até 350 caracteres), em PT-BR, citando o gancho específico.",
      "Retorne APENAS JSON válido com EXATAMENTE esta estrutura, sem markdown, sem texto extra:",
      JSON.stringify(
        {
          resumo: "2-3 frases sobre o prospect",
          proposta_valor: "o que o prospect entrega de valor",
          produtos: ["produto A", "produto B"],
          diferenciais: ["diferencial 1", "diferencial 2"],
          pain_points: ["dor provável 1", "dor provável 2"],
          fit_score: "high|medium|low",
          fit_reason: "por que faz ou não sentido nossa solução para este prospect",
          oportunidades_abordagem: [
            {
              angulo: "nome do ângulo",
              gancho: "fato específico encontrado no site do prospect",
              conexao: "como isso conecta ao que NOSSA empresa vende",
              mensagem_sugerida: "primeira mensagem curta em PT-BR, citando o gancho",
            },
          ],
        },
        null,
        2,
      ),
    ].join("\n"),
  );

  return parts.join("\n\n");
}

export const analyzeLeadWebsite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ lead_id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    // 1. Fetch lead (RLS garante org match)
    const { data: lead, error: leadErr } = await context.supabase
      .from("leads")
      .select("id, full_name, company_name, website_url, organization_id, industry, job_title")
      .eq("id", data.lead_id)
      .maybeSingle();
    if (leadErr) throw new Error(leadErr.message);
    if (!lead) throw new Error("Lead não encontrado.");

    const websiteUrl = (lead.website_url as string | null | undefined)?.trim() || null;
    if (!websiteUrl) {
      return { ok: false as const, error: "Lead sem website cadastrado." };
    }

    const orgId = lead.organization_id as string;

    // 2. Knowledge base
    const [profileRes, itemsRes] = await Promise.all([
      context.supabase
        .from("ai_org_profile")
        .select("ai_instructions, highlights")
        .eq("organization_id", orgId)
        .maybeSingle(),
      context.supabase
        .from("knowledge_sources")
        .select("title, name, content")
        .eq("organization_id", orgId)
        .neq("status", "error")
        .not("content", "is", null)
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

    const aiInstructions = (profileRes.data as any)?.ai_instructions ?? null;
    const highlights = (profileRes.data as any)?.highlights ?? null;
    const items = ((itemsRes.data ?? []) as any[])
      .filter((i) => i.content && String(i.content).trim())
      .map((i) => ({ title: (i.title || i.name || "Item") as string, content: i.content as string }));

    // 3. Scrape lead website
    const { fetchWebsiteContent } = await import("@/lib/website-scraper.server");
    const scraped = await fetchWebsiteContent(websiteUrl);
    const siteText = scraped
      ? scraped
      : `(Site indisponível. Gere insights com base no nome da empresa: ${lead.company_name ?? "(desconhecida)"} e domínio: ${websiteUrl})`;

    // 4. System + user prompts
    const systemPrompt = buildSystemPrompt({ aiInstructions, highlights, items });
    const userPrompt = [
      `=== DADOS DO PROSPECT ===`,
      `Nome do contato: ${lead.full_name ?? "(desconhecido)"}`,
      `Cargo: ${lead.job_title ?? "(desconhecido)"}`,
      `Empresa: ${lead.company_name ?? "(desconhecida)"}`,
      `Indústria: ${lead.industry ?? "(desconhecida)"}`,
      `Website: ${websiteUrl}`,
      ``,
      `=== CONTEÚDO DO SITE DO PROSPECT ===`,
      siteText,
    ].join("\n");

    // 5. Call OpenAI
    const { callOpenAI } = await import("@/lib/openai.server");
    const ai = await callOpenAI({
      systemPrompt,
      userPrompt,
      model: OPENAI_MODEL,
      temperature: 0.4,
      maxTokens: 1400,
      organizationId: orgId,
      leadId: lead.id as string,
      kind: "enrich",
      triggeredBy: context.userId,
    });

    // 6. Parse
    const parsed = extractJson(ai.text) as LeadInsightsPayload | null;
    const insights: LeadInsightsPayload = parsed ?? { resumo: ai.text };

    // 7. Upsert
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const analyzedAt = new Date().toISOString();
    const { error: upErr } = await supabaseAdmin
      .from("lead_insights")
      .upsert(
        {
          organization_id: orgId,
          lead_id: lead.id,
          website_url: websiteUrl,
          insights: insights as any,
          raw_summary: ai.text,
          analyzed_at: analyzedAt,
        },
        { onConflict: "lead_id" },
      );
    if (upErr) throw new Error(`Falha ao salvar insights: ${upErr.message}`);

    return {
      ok: true as const,
      insights,
      analyzed_at: analyzedAt,
      website_url: websiteUrl,
      site_available: scraped !== null,
    };
  });

export const getLeadInsights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ lead_id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("lead_insights")
      .select("insights, website_url, raw_summary, analyzed_at")
      .eq("lead_id", data.lead_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    return {
      insights: (row.insights ?? {}) as LeadInsightsPayload,
      website_url: row.website_url as string | null,
      raw_summary: row.raw_summary as string | null,
      analyzed_at: row.analyzed_at as string,
    };
  });
