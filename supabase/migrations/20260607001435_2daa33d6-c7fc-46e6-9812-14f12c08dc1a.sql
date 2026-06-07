
-- ============================================================
-- 1. ai_platform_settings (singleton, master only)
-- ============================================================
CREATE TABLE public.ai_platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  default_model text NOT NULL DEFAULT 'gpt-4.1-mini',
  allowed_models text[] NOT NULL DEFAULT ARRAY['gpt-4.1-mini','gpt-4.1','gpt-4o-mini']::text[],
  master_system_prompt text NOT NULL DEFAULT '',
  default_temperature numeric(3,2) NOT NULL DEFAULT 0.7,
  max_tokens_per_call integer NOT NULL DEFAULT 1200,
  is_enabled boolean NOT NULL DEFAULT true,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_platform_settings TO authenticated;
GRANT ALL ON public.ai_platform_settings TO service_role;

ALTER TABLE public.ai_platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master admins manage ai_platform_settings"
ON public.ai_platform_settings
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'master_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'master_admin'::app_role));

CREATE TRIGGER set_ai_platform_settings_updated_at
BEFORE UPDATE ON public.ai_platform_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. ai_tone_presets (catálogo de dropdowns, gerenciado pelo master)
-- ============================================================
CREATE TABLE public.ai_tone_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('mood','approach','length','language')),
  slug text NOT NULL,
  label text NOT NULL,
  description text,
  prompt_fragment text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, slug)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_tone_presets TO authenticated;
GRANT ALL ON public.ai_tone_presets TO service_role;

ALTER TABLE public.ai_tone_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read ai_tone_presets"
ON public.ai_tone_presets
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Master admins manage ai_tone_presets"
ON public.ai_tone_presets
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'master_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'master_admin'::app_role));

CREATE TRIGGER set_ai_tone_presets_updated_at
BEFORE UPDATE ON public.ai_tone_presets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. ai_org_profile (1:1 com organizations)
-- ============================================================
CREATE TABLE public.ai_org_profile (
  organization_id uuid PRIMARY KEY,
  brand_name text,
  brand_voice text,
  product_description text,
  icp_description text,
  value_proposition text,
  default_cta text,
  forbidden_words text[] NOT NULL DEFAULT '{}'::text[],
  default_mood_slug text,
  default_approach_slug text,
  default_length_slug text,
  default_language_slug text NOT NULL DEFAULT 'pt-BR',
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (char_length(coalesce(brand_voice,'')) <= 500),
  CHECK (char_length(coalesce(product_description,'')) <= 500),
  CHECK (char_length(coalesce(icp_description,'')) <= 500),
  CHECK (char_length(coalesce(value_proposition,'')) <= 280),
  CHECK (char_length(coalesce(default_cta,'')) <= 140)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_org_profile TO authenticated;
GRANT ALL ON public.ai_org_profile TO service_role;

ALTER TABLE public.ai_org_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master admins manage all ai_org_profile"
ON public.ai_org_profile
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'master_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'master_admin'::app_role));

CREATE POLICY "Org members view ai_org_profile"
ON public.ai_org_profile
FOR SELECT
TO authenticated
USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org admins manage ai_org_profile"
ON public.ai_org_profile
FOR ALL
TO authenticated
USING (is_org_member(auth.uid(), organization_id) AND has_role(auth.uid(), 'company_admin'::app_role))
WITH CHECK (is_org_member(auth.uid(), organization_id) AND has_role(auth.uid(), 'company_admin'::app_role));

CREATE TRIGGER set_ai_org_profile_updated_at
BEFORE UPDATE ON public.ai_org_profile
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 4. Seeds
-- ============================================================
INSERT INTO public.ai_platform_settings (master_system_prompt, default_model)
VALUES (
  'Você é um SDR sênior altamente qualificado da plataforma Leaderei. Sua missão é gerar mensagens de prospecção B2B personalizadas, naturais e respeitosas, baseadas no contexto do lead e na voz da marca do cliente. Nunca invente fatos sobre o lead. Sempre escreva em primeira pessoa, sem clichês de vendas (nada de "espero que esta mensagem te encontre bem"), e termine com um CTA claro e de baixa fricção.',
  'gpt-4.1-mini'
);

INSERT INTO public.ai_tone_presets (kind, slug, label, prompt_fragment, sort_order) VALUES
-- Humor
('mood','profissional','Profissional','Tom profissional, formal mas acessível, sem gírias.',10),
('mood','consultivo','Consultivo','Tom consultivo: faça perguntas inteligentes, demonstre expertise sem ser arrogante.',20),
('mood','descontraido','Descontraído','Tom leve e descontraído, como uma conversa entre colegas. Pode usar contrações.',30),
('mood','direto','Direto','Vá direto ao ponto, sem rodeios. Frases curtas, foco em valor imediato.',40),
('mood','empatico','Empático','Tom empático: reconheça a dor do lead antes de propor solução.',50),
-- Abordagem
('approach','educativo','Educativo','Aborde compartilhando um insight ou dado relevante para o setor do lead.',10),
('approach','provocativo','Provocativo','Provoque com uma pergunta ou afirmação que desafie o status quo do lead.',20),
('approach','social-proof','Social proof','Mencione um case ou empresa similar à do lead como prova social.',30),
('approach','dor-solucao','Dor → Solução','Identifique a dor provável do cargo do lead e proponha a solução de forma sutil.',40),
('approach','pergunta-aberta','Pergunta aberta','Abra com uma pergunta aberta que convide o lead a responder.',50),
-- Tamanho
('length','curto','Curto (1-2 frases)','Mensagem muito curta: máximo 2 frases, ideal para WhatsApp e LinkedIn.',10),
('length','medio','Médio (3-5 frases)','Mensagem média: 3 a 5 frases, ideal para email frio.',20),
('length','longo','Longo (parágrafo)','Mensagem longa: até 1 parágrafo completo, ideal para follow-up com contexto.',30),
-- Idioma
('language','pt-BR','Português (BR)','Escreva em português brasileiro natural.',10),
('language','en','Inglês','Write in natural business English.',20),
('language','es','Espanhol','Escribe en español neutro de negocios.',30);
