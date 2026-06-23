// Pure prompt assembly. Server-only because it reads master_system_prompt.
// Order of concatenation:
//   1. Master system prompt (platform-wide, secret)
//   2. Org brand block (voice, product, ICP, value prop, CTA, forbidden words)
//   3. Selected presets (mood / approach / length / language fragments)
//   4. Step-level extras (extra_context, must_include)
//   5. Lead context block
//   6. Final instruction

export type TonePreset = {
  kind: "mood" | "approach" | "length" | "language";
  slug: string;
  prompt_fragment: string;
};

export type OrgProfile = {
  brand_name?: string | null;
  brand_voice?: string | null;
  product_description?: string | null;
  icp_description?: string | null;
  value_proposition?: string | null;
  default_cta?: string | null;
  forbidden_words?: string[] | null;
  default_mood_slug?: string | null;
  default_approach_slug?: string | null;
  default_length_slug?: string | null;
  default_language_slug?: string | null;
};

export type StepConfig = {
  mood_slug?: string | null;
  approach_slug?: string | null;
  length_slug?: string | null;
  language_slug?: string | null;
  extra_context?: string | null;
  must_include?: string | null;
};

export type LeadContext = {
  full_name?: string | null;
  job_title?: string | null;
  company_name?: string | null;
  industry?: string | null;
  city?: string | null;
  country?: string | null;
  linkedin_url?: string | null;
  website_url?: string | null;
  custom_fields?: Record<string, unknown> | null;
} | null;

export type OrgKnowledge = {
  ai_instructions?: string | null;
  highlights?: string | null;
  items?: Array<{ title: string; content: string; kind: string }>;
  org_website_content?: string | null;
} | null;

export type BuildPromptArgs = {
  masterSystemPrompt: string;
  orgProfile: OrgProfile | null;
  stepConfig: StepConfig;
  presets: TonePreset[]; // full active catalog
  lead?: LeadContext;
  channelHint?: "whatsapp" | "email" | "linkedin" | null;
  taskInstruction?: string | null; // e.g. "Escreva a primeira mensagem fria."
  websiteContent?: string | null;
  orgKnowledge?: OrgKnowledge;
};

function findPreset(presets: TonePreset[], kind: TonePreset["kind"], slug?: string | null) {
  if (!slug) return null;
  return presets.find((p) => p.kind === kind && p.slug === slug) ?? null;
}

function brandBlock(p: OrgProfile | null): string {
  if (!p) return "";
  const lines: string[] = [];
  if (p.brand_name) lines.push(`Marca: ${p.brand_name}`);
  if (p.brand_voice) lines.push(`Voz da marca: ${p.brand_voice}`);
  if (p.product_description) lines.push(`Produto: ${p.product_description}`);
  if (p.icp_description) lines.push(`Cliente ideal (ICP): ${p.icp_description}`);
  if (p.value_proposition) lines.push(`Proposta de valor: ${p.value_proposition}`);
  if (p.default_cta) lines.push(`CTA padrão: ${p.default_cta}`);
  if (p.forbidden_words?.length) lines.push(`Palavras a evitar: ${p.forbidden_words.join(", ")}`);
  if (!lines.length) return "";
  return `\n\n[Marca]\n${lines.join("\n")}`;
}

function leadBlock(lead: LeadContext): string {
  if (!lead) return "";
  const lines: string[] = [];
  if (lead.full_name) lines.push(`Nome: ${lead.full_name}`);
  if (lead.job_title) lines.push(`Cargo: ${lead.job_title}`);
  if (lead.company_name) lines.push(`Empresa: ${lead.company_name}`);
  if (lead.industry) lines.push(`Setor: ${lead.industry}`);
  if (lead.city || lead.country) lines.push(`Localização: ${[lead.city, lead.country].filter(Boolean).join(", ")}`);
  if (lead.linkedin_url) lines.push(`LinkedIn: ${lead.linkedin_url}`);
  if (lead.website_url) lines.push(`Site: ${lead.website_url}`);
  if (!lines.length) return "";
  return `\n\n[Lead]\n${lines.join("\n")}`;
}

function presetsBlock(presets: TonePreset[], cfg: StepConfig, profile: OrgProfile | null): string {
  const moodSlug = cfg.mood_slug ?? profile?.default_mood_slug;
  const approachSlug = cfg.approach_slug ?? profile?.default_approach_slug;
  const lengthSlug = cfg.length_slug ?? profile?.default_length_slug;
  const langSlug = cfg.language_slug ?? profile?.default_language_slug ?? "pt-BR";

  const items = [
    findPreset(presets, "mood", moodSlug),
    findPreset(presets, "approach", approachSlug),
    findPreset(presets, "length", lengthSlug),
    findPreset(presets, "language", langSlug),
  ].filter(Boolean) as TonePreset[];

  if (!items.length) return "";
  return `\n\n[Estilo]\n${items.map((p) => `- ${p.prompt_fragment}`).join("\n")}`;
}

function stepExtras(cfg: StepConfig): string {
  const lines: string[] = [];
  if (cfg.extra_context?.trim()) lines.push(`Contexto extra: ${cfg.extra_context.trim()}`);
  if (cfg.must_include?.trim()) lines.push(`Precisa mencionar: ${cfg.must_include.trim()}`);
  if (!lines.length) return "";
  return `\n\n[Step]\n${lines.join("\n")}`;
}

function channelLine(channel?: "whatsapp" | "email" | "linkedin" | null): string {
  if (!channel) return "";
  const map = {
    whatsapp: "Canal de envio: WhatsApp. Mensagem curta e informal.",
    email: "Canal de envio: Email. Pode ter linha de assunto na primeira linha como 'Assunto: ...'.",
    linkedin: "Canal de envio: LinkedIn. Tom profissional, máximo 300 caracteres.",
  } as const;
  return `\n\n[Canal]\n${map[channel]}`;
}

function websiteBlock(content?: string | null): string {
  if (!content?.trim()) return "";
  return `\n\n[Site da empresa]\n${content.trim()}`;
}

export function buildPrompt(args: BuildPromptArgs): { system: string; user: string } {
  const system = args.masterSystemPrompt.trim();

  const userParts = [
    brandBlock(args.orgProfile),
    presetsBlock(args.presets, args.stepConfig, args.orgProfile),
    channelLine(args.channelHint),
    stepExtras(args.stepConfig),
    leadBlock(args.lead ?? null),
    websiteBlock(args.websiteContent),
    `\n\n[Tarefa]\n${args.taskInstruction?.trim() || "Escreva a mensagem agora. Responda apenas com o texto final, sem comentários."}`,
  ].filter(Boolean).join("");

  return { system, user: userParts.trim() };
}
