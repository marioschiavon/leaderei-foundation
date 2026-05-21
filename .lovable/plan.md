
# Fusão controlada: Leaderei (atual) ⇄ lead-automate (old-project)

Apenas diagnóstico e estratégia. Nenhum código será escrito sem sua aprovação deste plano.

---

## 1. Diagnóstico comparativo

### Projeto atual (base oficial)
- Stack: **TanStack Start v1 + React 19 + Vite 7 + Tailwind v4 + TS estrito**, deploy edge (Cloudflare Workers).
- Roteamento: **file-based** em `src/routes/` (TanStack Router, `routeTree.gen.ts`).
- Estado da Fase 1: design system Leaderei aplicado, shells `_app` e `_master`, surfaces públicas (`/`, `/login`, `/signup`, `/forgot-password`), 6 módulos core como skeletons (dashboard, leads, inbox, campaigns, sales, integrations, settings), painel master (overview, orgs, users, plans, logs).
- Multi-tenancy: tipos + mock estático (`src/lib/tenant/`), hooks `useCurrentOrg/useCurrentUser`, sem backend.
- Sem Lovable Cloud habilitado, sem auth real, sem dados reais.

### old-project (lead-automate)
- Stack: **Vite + React 18 + React Router DOM + Tailwind v3 + shadcn (slate)**, runtime Node padrão.
- Roteamento: `BrowserRouter` em `App.tsx`, páginas em `src/pages/`.
- **Backend Supabase maduro**: 17 migrations, 23 tabelas, RLS completa, RBAC com `app_role` (`master_admin`/`company_admin`/`user`), tenant = `companies` + `company_members`, helpers `has_role()` e `get_user_company_id()`.
- **23 Edge Functions** (cadence-executor, ai-generate-script, ai-reply, ai-variations, analyze-lead-website, inbound-email-webhook, process-email-queue, send-transactional-email, pipedrive-connect/sync, calcom-slots/confirm, extract-knowledge, etc).
- Hooks de dados ricos: `useAuth`, `useCadences`, `useConversations`, `useLeads` (via Dashboard), `useDashboardStats`, `useKnowledge`, `useLeadInsights`, `usePipedrive`, `useScripts`, `useCadenceDashboard`, `usePreviewCadenceMessages`.
- UI completa porém genérica shadcn slate, layout Sidebar tradicional — **não combina com a direção visual Dripify/Leaderei**.
- Docs internos em `docs/` (Manual do usuário + Doc técnica).

### Diferenças que importam
| Eixo | Atual | old-project | Conflito? |
|---|---|---|---|
| Framework | TanStack Start | Vite + RR DOM | **Sim** — RR DOM não roda no atual |
| Tailwind | v4 (`@theme inline`) | v3 (`tailwind.config.ts`) | Sim — não copiar config |
| React | 19 | 18 | Compatível na maioria |
| Backend | nenhum | Supabase robusto | Não — atual é vazio |
| Tenant model | `Organization` (mock) | `companies` + `company_members` | **Renomear**: Organization=Company |
| Roles | `owner/admin/member/master` (mock) | `master_admin/company_admin/user` | **Adotar do antigo** (já tem RLS) |
| Páginas | shells Leaderei | UI funcional shadcn slate | Manter visual atual |
| Edge fns | nenhuma | 23 funções | Reaproveitar com cautela |

---

## 2. O que MANTER do projeto atual (não tocar)

- Toda a stack (TanStack Start, React 19, Tailwind v4, deploy Workers).
- `src/styles.css` (design system Leaderei oklch).
- `src/components/brand/Logo.tsx`.
- `src/components/ui/*` (shadcn já adaptado ao token Leaderei).
- Shells: `_app.tsx`, `_master.tsx`, `AppSidebar`, `AppTopbar`, `PageHeader`, `EmptyState`.
- Rotas públicas: `/`, `/login`, `/signup`, `/forgot-password` (visual).
- Skeletons dos módulos core (substituiremos o conteúdo placeholder pelos dados reais, mantendo layout).
- `src/router.tsx`, `__root.tsx`, file-based routing.

## 3. O que REAPROVEITAR de old-project

### A) Backend Supabase (núcleo do valor)
- **Schema/migrations** — adaptar e reaplicar via Lovable Cloud:
  - Enums: `app_role`, `company_status`, `lead_status`, `activity_type`, `cadence_status`, `cadence_type`, `enrollment_status`, `integration_provider`.
  - Tabelas: `companies`, `company_members`, `user_roles`, `profiles`, `leads`, `lead_activities`, `lead_insights`, `cadences`, `cadence_steps`, `cadence_enrollments`, `cadence_custom_messages`, `conversations`, `messages`, `integrations`, `company_knowledge`, `script_templates`, `script_variations`, `execution_logs`, `email_send_log`, `email_send_state`, `email_unsubscribe_tokens`, `suppressed_emails`, `slot_holds`.
  - Funções `has_role()`, `get_user_company_id()`, trigger `handle_new_user()`, trigger `update_updated_at_column()`.
  - Todas as RLS policies.

### B) Lógica de Auth/RBAC
- Estrutura do `useAuth.tsx` (roles + companyId + profile + bloqueio de empresa inativa) — **reescrever** para padrões do atual (TanStack context + `_authenticated` layout + `requireSupabaseAuth` middleware em serverFns).
- `RequireMasterAdmin` → reimplementar como `beforeLoad` em `_master.tsx` checando `has_role(auth.uid(), 'master_admin')`.

### C) Hooks de dados (lógica de queries, adaptar à arquitetura)
Manter a forma das queries Supabase, mas chamar via `createServerFn` + `useSuspenseQuery`:
- `useDashboardStats`, `useLeadInsights` → alimentam `/_app/app` (Dashboard).
- `useCadences`, `useCadenceDashboard`, `usePreviewCadenceMessages` → `/_app/app/campaigns`.
- `useConversations` → `/_app/app/inbox`.
- `useScripts` → novo módulo (avaliar onde encaixar; provavelmente sub-aba de Campaigns).
- `useKnowledge` → sub-aba em Settings ou novo módulo.
- `usePipedrive` → `/_app/app/integrations`.

### D) Edge Functions (mover para TanStack: serverFn ou route `/api/public/*`)
- **serverFn** (chamada autenticada do app): `ai-generate-script`, `ai-reply`, `ai-variations`, `analyze-lead-website`, `extract-knowledge`, `parse-knowledge-doc`, `preview-cadence-messages`, `preview-transactional-email`, `pipedrive-connect`, `pipedrive-sync`, `calcom-slots`, `calcom-confirm-booking`, `reset-test-data`.
- **`/api/public/*`** (webhook/cron, com verificação de assinatura): `inbound-webhook`, `inbound-email-webhook`, `handle-email-suppression`, `handle-email-unsubscribe`, `cadence-executor` (cron), `expire-slot-holds` (cron), `process-email-queue` (cron), `send-transactional-email` (interno via serverFn ou queue).
- `_shared` (helpers compartilhados) → virar `src/lib/**` server-only.

### E) Documentação
- `docs/TECHNICAL_DOCUMENTATION.md` e `docs/MANUAL_DO_USUARIO.md` — copiar para `docs/` do atual e atualizar para refletir o nome **Leaderei**, a nova arquitetura (TanStack/Cloudflare) e remover referências ao Vite/RR antigos.

## 4. O que precisa de ADAPTAÇÃO antes de integrar

| Item antigo | Adaptação |
|---|---|
| `react-router-dom` | Substituir por TanStack Router (`createFileRoute`, `Link`, `useNavigate`). |
| `BrowserRouter`/`Routes` em `App.tsx` | Eliminado — file-based routing já existe. |
| `tailwind.config.ts` v3 | Não migrar; tokens já estão em `src/styles.css` v4. |
| `src/integrations/supabase/client.ts` | Já existe versão TanStack (`client.ts` + `client.server.ts` + `auth-middleware.ts`). Reaproveitar **só** o `types.ts` regenerado após aplicar as migrations no Lovable Cloud. |
| Páginas `src/pages/*.tsx` | **Não copiar**. Migrar o conteúdo lógico para as rotas equivalentes em `src/routes/_app.app.*.tsx`, mantendo o visual da Fase 1. |
| `AppSidebar.tsx` antigo | Descartar — já temos o novo no estilo Dripify. |
| `useAuth` global com `useState` | Virar context com `onAuthStateChange` + queries via serverFn; gate em `_authenticated`/`_master`. |
| Edge Functions Deno | Reescrever em TS para TanStack Start (serverFn ou server route). Lógica de negócio (prompts, queries, validações) é copiada quase 1:1; o transport muda. |
| Tenant `Organization` (mock atual) | Renomear para alinhar com `companies` do schema. Decidir: manter o termo "Organization" na UI (mais SaaS) e mapear para `companies` no DB, **ou** renomear UI para "Company". |
| `master_admin`/`company_admin`/`user` | Substituir o enum atual de roles (`owner/admin/member/master`) pelos do antigo. Reflete RLS já existente. |
| Cal.com / Pipedrive / Email infra | Manter no roadmap mas **não** integrar na Fase 1 — só deixar pasta `integrations/` pronta com as cascas. |

## 5. O que DESCARTAR

- `App.tsx`, `main.tsx`, `App.css`, `index.html` do antigo (substituídos pelo bootstrap TanStack).
- `tailwind.config.ts`, `postcss.config.js` v3.
- Todos os componentes `src/components/*.tsx` da raiz do antigo (AppLayout, AppSidebar, NavLink, LeadDetail, CadenceDetail, CadenceStepCard, ScriptCard, LeadMessagePreview, RequireMasterAdmin) — serão **reescritos** na nova identidade quando o módulo correspondente entrar em jogo. **Não copiar 1:1.**
- `src/components/ui/*` do antigo (já temos a versão atualizada).
- `src/hooks/use-mobile`, `use-toast` antigos (já existem).
- `package.json`/lockfiles do antigo.
- Pasta `old-project/` inteira após a fusão concluída.

---

## 6. Estratégia de fusão — ordem de execução

A fusão será feita em **fases pequenas e verificáveis**, sem grandes commits monolíticos. Em cada fase: avaliar, integrar, validar build, seguir.

### Fase F0 — Habilitar Lovable Cloud (pré-requisito)
- Ativar Cloud para ter Postgres + Auth + Storage + types gerados.
- Sem isso, nada de auth/dados reais avança.

### Fase F1 — Schema multi-tenant base
- Migration: `companies`, `company_members`, `user_roles`, `profiles`, enums `app_role` e `company_status`, funções `has_role`, `get_user_company_id`, trigger `handle_new_user`, `update_updated_at_column`.
- Adaptar nomes (manter `companies` no DB; UI continua chamando "Organização" se preferirmos manter o vocabulário SaaS atual — decisão final no início da F1).
- Aplicar RLS exatamente como no antigo.

### Fase F2 — Auth real + guards
- `_authenticated.tsx` (layout pathless) com `beforeLoad` redirecionando `/login` quando não autenticado.
- `_master.tsx` ganha `beforeLoad` adicional checando `master_admin`.
- `/login` e `/signup` passam a chamar `supabase.auth` real; signup cria `company` + `company_member` + role `company_admin` numa serverFn transacional.
- Trocar `src/lib/tenant/mock.ts` por hook real `useCurrentCompany()` que lê `company_members` da sessão. Manter assinatura igual para não quebrar componentes.

### Fase F3 — Esquema de domínio (leads + atividades)
- Migrations: `leads`, `lead_activities`, `lead_insights`, enums `lead_status` e `activity_type`.
- ServerFns: `listLeads`, `getLead`, `createLead`, `updateLead`, `addActivity`.
- `/_app/app/leads` passa a consumir dados reais (mantém o visual atual, só troca o mock por dados).
- Dashboard (`/_app/app`) passa a usar `useDashboardStats` adaptado.

### Fase F4 — Cadências (campanhas)
- Migrations: `cadences`, `cadence_steps`, `cadence_enrollments`, `cadence_custom_messages`, enums relacionados.
- ServerFns de leitura para popular `/_app/app/campaigns`.
- Por ora **sem** o executor — apenas CRUD + visualização.

### Fase F5 — Conversas / Inbox
- Migrations: `conversations`, `messages`.
- ServerFns + alimentação do `/_app/app/inbox`.

### Fase F6 — Integrações (cascas)
- Migration: `integrations`, enum `integration_provider`.
- `/_app/app/integrations` mostra cards Pipedrive / Cal.com / Email com estado "não conectado" — sem o fluxo real ainda.

### Fase F7 — Knowledge / Scripts
- Migrations: `company_knowledge`, `script_templates`, `script_variations`.
- Decidir UI: sub-abas dentro de Settings ou módulo dedicado. Sugestão: Knowledge em Settings; Scripts como sub-aba de Campaigns.

### Fase F8 — Master panel real
- `/_master/*` passa a consumir dados de verdade: lista de `companies`, membros globais, planos, logs (`execution_logs`).

### Fase F9 — Edge Functions / Workers (lote final, fora da Fase 1)
- Migrar `cadence-executor`, `process-email-queue`, `expire-slot-holds` como cron via `/api/public/*` com secret.
- Migrar `inbound-webhook`/`inbound-email-webhook` com verificação de assinatura.
- Migrar geradores IA (`ai-*`) via serverFn + Lovable AI Gateway.
- Pipedrive/Cal.com como serverFns.

### Fase F10 — Limpeza
- Copiar `docs/` adaptado.
- Deletar `old-project/`.
- Atualizar README.

### Critério de pronto da fusão
Da F0 à F8 entrega: app autenticado real, multi-tenant, com leads/cadências/inbox renderizando dados de verdade dentro do shell Leaderei, e painel master operando sobre dados reais — sem nenhum executor de IA/email ainda (esses ficam na F9). Tudo passando build sem warnings, sem código morto, sem duplicidade.

---

**Próximo passo se aprovado:** começar pela **F0 (Lovable Cloud)** e **F1 (schema base + RLS)**. Confirme se devo seguir nessa ordem (ou se quer reordenar/agrupar fases) e se prefere manter o termo **"Organization"** na UI ou alinhar para **"Company"** desde já.
