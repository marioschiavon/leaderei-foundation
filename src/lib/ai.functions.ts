import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildPrompt, type StepConfig, type TonePreset } from "./ai-prompt-builder.server";
import { callOpenAI, hasOpenAIKey } from "./openai.server";

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
  if (!data) throw new Error("Acesso negado: requer master_admin.");
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

async function assertOrgAdminOrMaster(userId: string, organizationId: string) {
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const isMaster = (roles ?? []).some((r) => r.role === "master_admin");
  if (isMaster) return;
  const { data: member } = await supabaseAdmin
    .from("organization_members")
    .select("role,status")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!member || member.status !== "active") throw new Error("Acesso negado à organização.");
  const isCompanyAdmin = (roles ?? []).some((r) => r.role === "company_admin");
  if (!isCompanyAdmin) throw new Error("Apenas o admin da organização pode editar.");
}

async function getSingletonSettings() {
  const { data, error } = await supabaseAdmin
    .from("ai_platform_settings")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

// ---------------------------------------------------------------------------
// MASTER: platform settings
// ---------------------------------------------------------------------------

export const getAiPlatformSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertMaster(context.userId);
    const row = await getSingletonSettings();
    return {
      settings: row,
      hasApiKey: hasOpenAIKey(),
    };
  });

const UpdateSettingsSchema = z.object({
  default_model: z.string().min(1).max(80),
  allowed_models: z.array(z.string().min(1).max(80)).min(1).max(20),
  master_system_prompt: z.string().min(0).max(20000),
  default_temperature: z.number().min(0).max(2),
  max_tokens_per_call: z.number().int().min(64).max(8000),
  is_enabled: z.boolean(),
});

export const updateAiPlatformSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateSettingsSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertMaster(context.userId);
    const current = await getSingletonSettings();
    if (!current) throw new Error("Configurações não inicializadas.");
    if (!data.allowed_models.includes(data.default_model)) {
      throw new Error("O modelo padrão precisa estar entre os modelos permitidos.");
    }
    const { data: updated, error } = await supabaseAdmin
      .from("ai_platform_settings")
      .update({ ...data, updated_by: context.userId })
      .eq("id", current.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return updated;
  });

// ---------------------------------------------------------------------------
// PRESETS (catálogo dos dropdowns)
// ---------------------------------------------------------------------------

export const listAiTonePresets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("ai_tone_presets")
      .select("id,kind,slug,label,description,prompt_fragment,is_active,sort_order")
      .order("kind", { ascending: true })
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const PresetSchema = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum(["mood", "approach", "length", "language"]),
  slug: z.string().min(1).max(48).regex(/^[a-z0-9-]+$/),
  label: z.string().min(1).max(80),
  description: z.string().max(280).optional().nullable(),
  prompt_fragment: z.string().min(1).max(1000),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().min(0).max(9999).default(0),
});

export const upsertAiTonePreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PresetSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertMaster(context.userId);
    if (data.id) {
      const { data: updated, error } = await supabaseAdmin
        .from("ai_tone_presets")
        .update({
          kind: data.kind,
          slug: data.slug,
          label: data.label,
          description: data.description ?? null,
          prompt_fragment: data.prompt_fragment,
          is_active: data.is_active,
          sort_order: data.sort_order,
        })
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return updated;
    }
    const { data: inserted, error } = await supabaseAdmin
      .from("ai_tone_presets")
      .insert({
        kind: data.kind,
        slug: data.slug,
        label: data.label,
        description: data.description ?? null,
        prompt_fragment: data.prompt_fragment,
        is_active: data.is_active,
        sort_order: data.sort_order,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return inserted;
  });

export const deleteAiTonePreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertMaster(context.userId);
    const { error } = await supabaseAdmin.from("ai_tone_presets").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// ORG PROFILE (voz da marca)
// ---------------------------------------------------------------------------

export const getAiOrgProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const orgId = await getActiveOrgId(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("ai_org_profile")
      .select("*")
      .eq("organization_id", orgId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { profile: data, organization_id: orgId };
  });

const OrgProfileSchema = z.object({
  brand_name: z.string().max(120).optional().nullable(),
  brand_voice: z.string().max(500).optional().nullable(),
  product_description: z.string().max(500).optional().nullable(),
  icp_description: z.string().max(500).optional().nullable(),
  value_proposition: z.string().max(280).optional().nullable(),
  default_cta: z.string().max(140).optional().nullable(),
  forbidden_words: z.array(z.string().min(1).max(40)).max(40).default([]),
  default_mood_slug: z.string().max(48).optional().nullable(),
  default_approach_slug: z.string().max(48).optional().nullable(),
  default_length_slug: z.string().max(48).optional().nullable(),
  default_language_slug: z.string().max(48).default("pt-BR"),
});

export const updateAiOrgProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => OrgProfileSchema.parse(input))
  .handler(async ({ context, data }) => {
    const orgId = await getActiveOrgId(context.supabase, context.userId);
    await assertOrgAdminOrMaster(context.userId, orgId);
    const { data: upserted, error } = await supabaseAdmin
      .from("ai_org_profile")
      .upsert({
        organization_id: orgId,
        ...data,
        updated_by: context.userId,
      }, { onConflict: "organization_id" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return upserted;
  });

// ---------------------------------------------------------------------------
// PREVIEW (testa um step de IA com lead fake ou real)
// ---------------------------------------------------------------------------

const PreviewSchema = z.object({
  stepConfig: z.object({
    mood_slug: z.string().max(48).optional().nullable(),
    approach_slug: z.string().max(48).optional().nullable(),
    length_slug: z.string().max(48).optional().nullable(),
    language_slug: z.string().max(48).optional().nullable(),
    extra_context: z.string().max(280).optional().nullable(),
    must_include: z.string().max(280).optional().nullable(),
  }),
  channel: z.enum(["whatsapp", "email", "linkedin"]).optional().nullable(),
  lead_id: z.string().uuid().optional().nullable(),
  task_instruction: z.string().max(500).optional().nullable(),
});

export const previewAiMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PreviewSchema.parse(input))
  .handler(async ({ context, data }) => {
    const orgId = await getActiveOrgId(context.supabase, context.userId);

    const settings = await getSingletonSettings();
    if (!settings || !settings.is_enabled) throw new Error("IA da plataforma está desabilitada.");
    if (!hasOpenAIKey()) throw new Error("Chave OpenAI não configurada — contate o master admin.");

    const [presetsRes, profileRes] = await Promise.all([
      supabaseAdmin
        .from("ai_tone_presets")
        .select("kind,slug,prompt_fragment")
        .eq("is_active", true),
      supabaseAdmin
        .from("ai_org_profile")
        .select("*")
        .eq("organization_id", orgId)
        .maybeSingle(),
    ]);
    if (presetsRes.error) throw new Error(presetsRes.error.message);

    let lead = null;
    if (data.lead_id) {
      const { data: l } = await context.supabase
        .from("leads")
        .select("full_name,job_title,company_name,industry,city,country,linkedin_url,website_url,custom_fields")
        .eq("id", data.lead_id)
        .maybeSingle();
      lead = l;
    } else {
      lead = {
        full_name: "Ana Souza",
        job_title: "Head of Growth",
        company_name: "Acme Tech",
        industry: "SaaS B2B",
        city: "São Paulo",
        country: "Brasil",
      };
    }

    const { system, user } = buildPrompt({
      masterSystemPrompt: settings.master_system_prompt,
      orgProfile: profileRes.data ?? null,
      stepConfig: data.stepConfig as StepConfig,
      presets: (presetsRes.data ?? []) as TonePreset[],
      lead: lead as any,
      channelHint: data.channel ?? null,
      taskInstruction: data.task_instruction ?? null,
    });

    const result = await callOpenAI({
      systemPrompt: system,
      userPrompt: user,
      model: settings.default_model,
      temperature: Number(settings.default_temperature),
      maxTokens: settings.max_tokens_per_call,
      organizationId: orgId,
      leadId: data.lead_id ?? null,
      kind: "other",
      triggeredBy: context.userId,
    });

    return {
      text: result.text,
      model: result.model,
      tokens_in: result.tokensIn,
      tokens_out: result.tokensOut,
      cost_usd: result.costUsd,
      latency_ms: result.latencyMs,
    };
  });

// ---------------------------------------------------------------------------
// USAGE STATS (master)
// ---------------------------------------------------------------------------

export const getAiUsageStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ since_hours: z.number().int().min(1).max(720).default(24) }).parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertMaster(context.userId);
    const sinceIso = new Date(Date.now() - data.since_hours * 3600_000).toISOString();
    const { data: rows, error } = await supabaseAdmin
      .from("ai_actions")
      .select("organization_id,model,status,tokens_input,tokens_output,cost_usd,latency_ms,created_at")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);

    const totals = (rows ?? []).reduce(
      (acc, r) => {
        acc.calls += 1;
        acc.tokens_in += r.tokens_input ?? 0;
        acc.tokens_out += r.tokens_output ?? 0;
        acc.cost_usd += Number(r.cost_usd ?? 0);
        if (r.status === "failed") acc.failed += 1;
        return acc;
      },
      { calls: 0, tokens_in: 0, tokens_out: 0, cost_usd: 0, failed: 0 },
    );

    const byOrg = new Map<string, { calls: number; cost: number }>();
    for (const r of rows ?? []) {
      const k = r.organization_id as string;
      const cur = byOrg.get(k) ?? { calls: 0, cost: 0 };
      cur.calls += 1;
      cur.cost += Number(r.cost_usd ?? 0);
      byOrg.set(k, cur);
    }
    const topOrgIds = [...byOrg.entries()].sort((a, b) => b[1].cost - a[1].cost).slice(0, 10);
    const ids = topOrgIds.map(([id]) => id);
    const orgsRes = ids.length
      ? await supabaseAdmin.from("organizations").select("id,name").in("id", ids)
      : { data: [] as any[], error: null };
    const orgsMap = new Map((orgsRes.data ?? []).map((o) => [o.id, o.name]));

    return {
      totals: {
        ...totals,
        cost_usd: Number(totals.cost_usd.toFixed(4)),
      },
      top_orgs: topOrgIds.map(([id, v]) => ({
        organization_id: id,
        organization_name: orgsMap.get(id) ?? "—",
        calls: v.calls,
        cost_usd: Number(v.cost.toFixed(4)),
      })),
      recent: (rows ?? []).slice(0, 20),
    };
  });
