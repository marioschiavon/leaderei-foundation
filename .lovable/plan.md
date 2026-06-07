# Plano — Integração OpenAI nativa (multi-tenant com controle do master admin)

## 1. Princípios

- **Chave OpenAI é da plataforma** (não do cliente). Fica em `OPENAI_API_KEY` (secret do servidor), nunca exposta ao browser nem replicada por organização.
- **Master admin controla**: chave, modelos habilitados, prompt mestre global, limites de uso por plano/org, presets de humor/abordagem disponíveis.
- **Org/usuário comum controla**: dentro de cada step de IA do fluxo, escolhe via **dropdown** o humor, o tipo de abordagem, idioma, comprimento; e preenche **caixas de texto curtas** (até ~280 chars cada) para contexto da marca (produto, ICP, diferencial, CTA).
- Toda chamada à OpenAI passa por um único helper server-side que **monta o prompt final** combinando: `prompt mestre (master) + perfil da org (marca) + parâmetros do step (usuário) + dados do lead/contexto`.
- Reuso máximo: `ai_actions` (já existe) registra cada chamada (tokens, custo, latência, status).

## 2. O que entra no escopo (`escopo-leaderei.md` §6)

Atualizar §6.4 e §6.6 para refletir:
- Modelo principal definido: **OpenAI** (gpt-4.1-mini default; gpt-4.1 para tarefas pesadas; configurável pelo master).
- Stack de IA: provider = nativo da plataforma; sem chave por org.
- Nova §6.8 "Camadas de configuração de IA" descrevendo os 3 níveis (master → org → step).

## 3. Modelo de dados (migration única)

### 3.1 `ai_platform_settings` (singleton — master admin)
Uma linha só. Guarda config global da plataforma.
```
id (uuid pk, default gen_random_uuid)
default_model text not null default 'gpt-4.1-mini'
allowed_models text[] not null default '{gpt-4.1-mini,gpt-4.1,gpt-4o-mini}'
master_system_prompt text not null  -- prompt mestre, base de tudo
default_temperature numeric(3,2) not null default 0.7
max_tokens_per_call int not null default 1200
is_enabled boolean not null default true
updated_by uuid, updated_at timestamptz, created_at timestamptz
```
RLS: SELECT/UPDATE só `master_admin`. SELECT do `master_system_prompt` **nunca** vai pro client de org — fica server-side.

### 3.2 `ai_tone_presets` (catálogo gerenciado pelo master)
Opções que aparecem nos dropdowns dos usuários.
```
id uuid pk
kind text check in ('mood','approach','length','language')  -- tipo do dropdown
slug text unique               -- ex: 'consultivo', 'descontraido', 'curto'
label text                     -- ex: 'Consultivo'
prompt_fragment text           -- pedaço injetado no prompt final
is_active boolean default true
sort_order int default 0
```
Seed inicial:
- mood: profissional, consultivo, descontraído, direto, empático
- approach: educativo, provocativo, social proof, dor-solução, pergunta aberta
- length: curto (1-2 frases), médio (3-5), longo (parágrafo)
- language: pt-BR, en, es

### 3.3 `ai_org_profile` (1:1 com `organizations` — config da marca pelo company_admin)
```
organization_id uuid pk
brand_name text
brand_voice text                -- até 500 chars, livre
product_description text        -- até 500 chars
icp_description text            -- até 500 chars
value_proposition text          -- até 280 chars
default_cta text                -- até 140 chars
forbidden_words text[]          -- palavras a evitar
default_mood_slug text          -- preset default que aparece selecionado nos steps
default_approach_slug text
default_language_slug text default 'pt-BR'
updated_at, created_at
```
RLS: company_admin da org gerencia; master vê tudo.

### 3.4 `flow_steps.config` (sem migration de coluna — é jsonb)
Para steps do tipo `ai_message` / `ai_rewrite`, o config passa a aceitar:
```json
{
  "mood_slug": "consultivo",
  "approach_slug": "dor-solucao",
  "length_slug": "curto",
  "language_slug": "pt-BR",
  "extra_context": "Lead veio de evento SaaSHolic",   // textarea curta (280 chars)
  "must_include": "menção ao case Mauna",             // textarea curta (280 chars)
  "model_override": null,                              // só master pode setar via UI master
  "temperature_override": null
}
```
Validação dos slugs contra `ai_tone_presets` no save.

### 3.5 `ai_actions` (já existe — só passar a popular)
Garantir que toda chamada grava `model`, `tokens_input`, `tokens_output`, `cost_usd`, `latency_ms`, `status`, `lead_id`, `conversation_id`, `input` (com hash do prompt final, não o texto puro pra economizar), `output`.

### 3.6 Grants/RLS (recap)
Todas as 3 novas tabelas:
```
GRANT SELECT, INSERT, UPDATE, DELETE ON public.<t> TO authenticated;
GRANT ALL ON public.<t> TO service_role;
```
`ai_platform_settings`: SELECT só master_admin (org_admin NÃO lê o prompt mestre — ele é segredo da plataforma).
`ai_tone_presets`: SELECT para `authenticated` (todo mundo precisa ler pros dropdowns), ALL só master_admin.
`ai_org_profile`: SELECT/UPDATE org_admin da org; SELECT all members; ALL master.

## 4. Backend (server functions)

Arquivos novos:
- `src/lib/openai.server.ts` — cliente OpenAI (SDK oficial `openai` npm), helper `callOpenAI({ messages, model, temperature, maxTokens, orgId, leadId? })` que **sempre grava em `ai_actions`** e respeita rate-limit por org.
- `src/lib/ai-prompt-builder.server.ts` — função pura `buildPrompt({ masterSettings, orgProfile, stepConfig, lead, conversationHistory? })` que retorna `{ system, user }`. Concatena na ordem: master prompt → bloco da marca → preset mood/approach/length → contexto do step → dados do lead → instrução final.
- `src/lib/ai.functions.ts` — server functions consumidas pelo client:
  - `getAiPlatformSettings` (master)
  - `updateAiPlatformSettings` (master)
  - `listAiTonePresets` (todos)
  - `upsertAiTonePreset` (master)
  - `getAiOrgProfile` (org admin/member — sem prompt mestre)
  - `updateAiOrgProfile` (org admin)
  - `previewAiMessage({ stepConfig, leadId? })` — gera 1 mensagem de teste no editor do step
  - `getAiUsageStats({ orgId?, sinceHours })` — telemetria

Executor de fluxos (`flow-executor.server.ts`) passa a chamar `callOpenAI` quando o step for `ai_message`/`ai_rewrite`, usando `buildPrompt`.

Limites:
- Rate-limit local por org (ex.: 60 req/min) — tabela `ai_rate_window` em memória/edge ou contagem via `ai_actions` últimos 60s.
- Hard cap de tokens por chamada vindo do master (`max_tokens_per_call`).

Erros tratados: 401 (chave inválida → alerta master), 429 (backoff), 402/insufficient_quota (mensagem clara), validation.

## 5. UI

### 5.1 Master (`/master`)
Nova rota `/master/ai`:
- Card "Chave OpenAI" → status (configurada ✓), botão "Rotacionar" (abre fluxo de `add_secret`).
- Editor do **prompt mestre** (textarea grande, monospace, versionamento simples via `updated_at`).
- Seletor de `default_model` + checkbox dos `allowed_models`.
- Sliders: `default_temperature`, `max_tokens_per_call`.
- Tabela CRUD de `ai_tone_presets` (criar/editar/desativar — por tipo).
- Dashboard de uso: chamadas/dia, custo/dia, top orgs consumidoras (lê `ai_actions`).

### 5.2 Org admin (`/dashboard/settings`)
Nova aba "IA da marca":
- Form do `ai_org_profile` (brand_voice, product, ICP, value_prop, CTA, forbidden_words como chips, defaults de mood/approach/language em dropdowns alimentados por `listAiTonePresets`).
- Aviso visual: "O prompt mestre da plataforma é aplicado automaticamente. Aqui você só ajusta a voz da sua marca."

### 5.3 Usuário no Builder (step de IA dentro do fluxo)
No painel lateral do step `ai_message`/`ai_rewrite` em `FlowEditor.tsx`:
- 4 dropdowns curtos: Humor, Abordagem, Tamanho, Idioma (defaults vêm do `ai_org_profile`).
- 2 textareas curtas (280 chars): "Contexto extra deste step", "Precisa mencionar".
- Botão "Pré-visualizar com lead de teste" → chama `previewAiMessage`, mostra resultado + tokens + custo estimado.
- Nada de chave, modelo ou temperatura — escondidos do usuário comum.

## 6. Segurança

- `OPENAI_API_KEY` só lida dentro de handlers de server function (`process.env`).
- Prompt mestre nunca trafega pro client — `previewAiMessage` retorna só o output final.
- Validação Zod em todos os inputs (slugs, comprimentos, model dentro de `allowed_models`).
- Auditoria: toda mudança no `ai_platform_settings` e `ai_tone_presets` grava em `audit_logs`.

## 7. Milestones (ordem de execução)

1. **Migration** — 3 tabelas + grants + RLS + seeds dos presets + seed singleton de `ai_platform_settings` com prompt mestre placeholder.
2. **Secret** — registrar `OPENAI_API_KEY` (já temos a chave — usar `add_secret`).
3. **Backend** — `openai.server.ts`, `ai-prompt-builder.server.ts`, `ai.functions.ts` + integração no `flow-executor.server.ts`.
4. **UI master** — rota `/master/ai` (prompt mestre, modelos, presets, uso).
5. **UI org** — aba "IA da marca" em `/dashboard/settings`.
6. **UI builder** — painel do step IA com dropdowns + textareas + preview.
7. **Escopo** — atualizar §6.4, §6.6 e adicionar §6.8.

## 8. Fora de escopo (próximas fases)

- Fallback multi-provider (Claude/Gemini).
- Negociação Cal.com em linguagem natural (§5.4).
- Score comportamental (§6.7).
- ElevenLabs / áudio.
- Fine-tune próprio.

## 9. Pré-requisito do usuário

Confirmar para eu seguir: **registro o secret `OPENAI_API_KEY` agora** (via fluxo seguro de `add_secret` — você cola a chave numa caixa segura, não no chat). OK?
