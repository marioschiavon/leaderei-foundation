
# Builder de fluxo — canvas horizontal por campanha

Reescreve o Builder atual (vertical, sem DnD) como canvas horizontal com `@xyflow/react`, ligado 1:1 a uma campanha, com 3 tipos de step funcionais (Email, Aguardar, Condição: respondeu?) e branch condicional real.

## 1. Migration Supabase

Atualizar `builder_documents`:
- `status text not null default 'draft'` ('draft' | 'published')
- `published_at timestamptz`, `published_version integer`, `archived_at timestamptz`
- `campaign_id` já existe → unique index parcial `where campaign_id is not null` (1:1 com campanha)

Criar `flow_steps`:
- `id`, `document_id` (FK cascade), `type text`, `position_x/y double`, `config jsonb default '{}'`, `is_entry boolean default false`, `created_at`, `updated_at` + trigger
- Índices: `(document_id)` e unique parcial `(document_id) where is_entry = true`
- RLS: `is_org_member` via join com `builder_documents.organization_id` + `master_admin`

Criar `flow_transitions`:
- `id`, `document_id`, `from_step_id` (FK cascade), `to_step_id` (FK cascade), `branch text default 'next'`, `created_at`
- Unique `(from_step_id, branch)`; índices em from/to/document
- RLS espelhando flow_steps

Tabelas legadas `flow_nodes`/`flow_edges` permanecem intocadas (fora do escopo).

## 2. Server functions — `src/lib/builder.functions.ts` (reescrita)

Todas com `requireSupabaseAuth` + check de membership via documento.

- `listBuilderDocuments({ campaign_id? })`
- `getBuilderDocument({ id })` — doc + steps + transitions
- `getBuilderDocumentByCampaign({ campaign_id })` — get-or-create; ao criar, insere 1 step `message_email` vazio em `(100,200)` com `is_entry=true`
- `saveBuilderDocument({ document_id, name?, steps, transitions })` — transacional via RPC ou sequência: deleta órfãos, upsert; valida exatamente 1 entry, alcançabilidade básica, condition tem 0 ou 2 saídas (yes/no), lineares 0 ou 1 (`next`), `config` por tipo (zod discriminated union); incrementa `version`
- `publishBuilderDocument({ id })` — re-valida + checa Email tem subject e body_html, Wait tem `duration_value > 0`, condition tem `timeout_value > 0`; se ok seta `status='published'`, `published_at`, `published_version=version`; se falha retorna `{ ok:false, errors:[{step_id,message}] }` sem alterar
- `revertToDraft({ id })`
- `deleteBuilderDocument({ id })` — soft via `archived_at`; bloqueia se campanha != draft

## 3. UI — rota `/dashboard/builder/$documentId`

Renomear arquivo para `_app.dashboard.builder.$documentId.tsx` (mantém param). Substitui a UI atual da rota `_app.dashboard.builder.tsx` por uma listagem-redirect simples (ou remove se não for usada).

Instalar `@xyflow/react` via bun add.

Layout em 3 colunas dentro do shell `_app` (sidebar global preservada):

**Topbar do editor**: back arrow → `/dashboard/campaigns?id={campaign_id}`, nome editável inline, badge status (Rascunho/Publicado), "Salvo há Xmin" + indicador "alterações não salvas", botões **Salvar** (primary) e **Publicar** (outline), menu ⋯ (Renomear, Reverter, Excluir).

**Painel esquerdo (220px) — paleta**:
- Cards draggable HTML5 (`onDragStart` setData type) — sem react-dnd
- Ativos: 📧 Email, ⏱️ Aguardar, 🔀 Condição: respondeu?
- "Em breve" (drag desabilitado, opacidade reduzida): 💬 WhatsApp, 🔗 LinkedIn, ⚡ Ação

**Canvas central — `@xyflow/react`**:
- Background dots gap=20; Controls bottom-right; MiniMap bottom-left
- `panOnDrag`, `zoomOnScroll`, `minZoom=0.4`, `maxZoom=1.5`
- `onDrop` no wrapper cria step no ponto solto (com `screenToFlowPosition`); novos conectados sugerem `prev.x+280, prev.y`
- nodeTypes: `EmailStepNode`, `WaitStepNode`, `ConditionRepliedNode` — card ~240px, cores em hex literal (não CSS vars dentro do xyflow); Email mostra subject preview + chip status (✓ Pronto / ⚠ Incompleto); Wait mostra "N unidade"; Condition tem 1 handle in à esq + 2 handles out à direita (yes verde topo, no vermelho base) com labels
- Entry node: badge "Início", proteção contra delete se único
- Edges `smoothstep`; condicional yes verde claro / no vermelho claro com label
- `onConnect`: bloqueia auto-loop; em condition substitui branch existente com `confirm()`; em condition se yes ocupado → atribui no automaticamente
- Delete via tecla ou botão lixeira no nó (confirm se config preenchida); remove transitions cascata

**Painel direito (340px)** — colapsado, abre ao clicar nó, X fecha:
- Email: Subject, From alias, toggle Editar/Preview do `body_html` (textarea monospace + preview iframe sandbox), chips de variáveis (`{{ lead.full_name }}`, `{{ lead.company_name }}`, `{{ lead.first_name }}`, `{{ org.name }}`) inserindo no cursor do textarea ativo
- Wait: Duração (number) + Unidade (minutos/horas/dias/dias úteis) + helper text
- Condition: Canal (qualquer/email/whatsapp/linkedin), Janela (number), Unidade (horas/dias), helper text

Mudanças no painel atualizam state local imediatamente; persistência só no botão Salvar. Empty state: "Arraste um passo da paleta lateral para começar".

## 4. Integração com Campaigns

Em `src/routes/_app.dashboard.campaigns.tsx`:
- Botão **Editar fluxo** (outline) no card de campanha → `getBuilderDocumentByCampaign` → navigate `/dashboard/builder/{id}`; tooltip se status running/paused
- No sheet de edição da campanha: bloco "Fluxo da campanha" mostrando "X passos configurados" + badge status, ou "Nenhum passo configurado", + botão "Abrir editor de fluxo"

## 5. Validações UX

- Bloquear navegação com dirty: hook `useBlocker` do TanStack Router + `beforeunload` window listener com `confirm()`
- Falha de publish: nós do array `errors` recebem borda vermelha (state local) + toast "Corrija os passos destacados"
- Erro de save: toast vermelho, state local preservado
- Documento novo já vem com 1 nó email entry pelo `getBuilderDocumentByCampaign`

## Detalhes técnicos

- Zod discriminated union de `config` por `type` (ver schemas no prompt do user) usado tanto em `saveBuilderDocument` quanto `publishBuilderDocument`
- Server fns retornam DTOs planos (sem instâncias)
- Conversão xyflow ↔ DB: `Node{id,type,position:{x,y},data:{config,is_entry}}` ↔ `flow_steps row`; `Edge{id,source,target,sourceHandle('yes'|'no'|null),...}` ↔ `flow_transitions{branch}`
- Cores xyflow em hex literal: entry `#0ea5e9`, yes `#10b981`, no `#ef4444`, default edge `#94a3b8`
- Para cumprir critério #18, depois das edits, deixar o build do Lovable rodar (não rodar manualmente)

## Fora do escopo (restrições)

- Sem implementação funcional de WhatsApp/LinkedIn/Action (só aparecem como "Em breve")
- Sem mexer em Resend/Settings/Inbox/Leads/Master/Dashboard/Auth/Onboarding/Pipeline
- Sem auto-save; sem react-dnd; sem framer-motion para isso
- Não recriar `builder_documents`, só ALTER
- Validação de fluxo definitiva no servidor

## Relatório final

1. Checklist dos 18 critérios com ✅/❌ + motivo
2. Seção "O que toquei fora do escopo planejado"
3. Update `docs/user/README.md` (Builder) + entrada no histórico
4. Update `.lovable/plan.md` (critérios Fase 1 fechados)
5. Resumo de 4 linhas do fluxo do usuário
