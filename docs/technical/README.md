# Documentação Técnica — Leaderei

> Documento vivo. Atualize a cada mudança estrutural relevante no app.

## 1. Visão geral

Leaderei é uma plataforma de operação comercial (outbound + inbox + CRM-light) inspirada em produtos como Dripify, com identidade visual própria (laranja `#e04e01`, neutros profundos, estética executiva).

- **Frontend / fullstack**: TanStack Start v1 (React 19 + Vite 7)
- **Runtime de servidor**: Cloudflare Workers (nodejs_compat)
- **Backend gerenciado**: Lovable Cloud (Supabase por baixo)
- **Estilização**: Tailwind CSS v4 via `src/styles.css` + tokens semânticos em `oklch`
- **UI primitives**: shadcn/ui (Radix) + Lucide icons
- **Roteamento**: file-based em `src/routes/` (auto-gera `routeTree.gen.ts`)

## 2. Estrutura de pastas

```
src/
  components/
    app/        # Shell do produto (Sidebar, Topbar, PageHeader, EmptyState)
    brand/      # Logo Leaderei
    ui/         # shadcn primitives
  integrations/
    supabase/   # client.ts, client.server.ts, auth-middleware.ts (não editar)
  lib/
    tenant/     # mock de organização e usuário corrente
    utils.ts    # cn() helper
  routes/
    __root.tsx
    index.tsx                    # /
    login.tsx, signup.tsx, forgot-password.tsx
    _app.tsx                     # layout autenticado (sidebar + topbar)
    _app.dashboard.tsx           # /dashboard (home operacional)
    _app.dashboard.campaigns.tsx # /dashboard/campaigns
    _app.dashboard.leads.tsx     # /dashboard/leads
    _app.dashboard.inbox.tsx     # /dashboard/inbox
    _app.dashboard.integrations.tsx
    _app.dashboard.builder.tsx
    _app.dashboard.settings.tsx
    _master.tsx                  # layout admin
    _master.master.tsx           # /master
    _master.master.{users,organizations,plans,logs}.tsx
  router.tsx
  start.ts
  styles.css                     # design tokens + Tailwind v4
docs/
  technical/   # este documento
  user/        # manual de uso
supabase/
  config.toml
```

## 3. Convenções de rota

- File-based, ponto-separado (sem subpastas).
- `_prefix` = layout pathless (não aparece na URL).
- A área autenticada vive em `/dashboard/*` (anteriormente `/app/*`, renomeado em 2026-05).
- Toda rota com `loader` deve definir `errorComponent` **e** `notFoundComponent`.

## 4. Design system

Tokens em `src/styles.css` (`oklch`):

| Token            | Uso                                         |
| ---------------- | ------------------------------------------- |
| `--background`   | Fundo base claro                            |
| `--surface`      | Cards, painéis                              |
| `--foreground`   | Texto principal (#000)                      |
| `--muted`        | Bg secundário (cinza claro)                 |
| `--brand`        | Laranja Leaderei `#e04e01` (ação/destaque)  |
| `--brand-soft`   | Laranja translúcido (badges, hovers)        |
| `--secondary`    | Neutro escuro `#313131`                     |
| `--border`       | Bordas limpas, sem sombra                   |

Tipografia: **Poppins** (display + body) + **Ibrand** (somente logo/hero). Documentado como fallback do brandbook.

Regras visuais:
- Sem sombras pesadas, sem glow, sem gradientes lúdicos.
- Laranja **apenas** como destaque e CTA.
- Bordas 1px, raio 8–12px.
- Contraste forte, estética executiva.

## 5. Shell do produto

- `AppSidebar` — agrupada em **Workspace** (Dashboard, Campaigns, Leads, Inbox), **Tools** (Integrations, Builder), **Admin** (Master, Settings) + seletor de organização no rodapé.
- `AppTopbar` — breadcrumb + busca global + ações.
- `PageHeader` — título, descrição, ações por página.

## 6. Backend (Lovable Cloud)

- Use `createServerFn` de `@tanstack/react-start` para lógica server-side interna.
- `requireSupabaseAuth` para funções autenticadas.
- `supabaseAdmin` (em `client.server.ts`) **somente** em server routes verificadas (webhooks).
- Webhooks públicos: `src/routes/api/public/*` com verificação de assinatura obrigatória.
- **Nunca editar**: `client.ts`, `client.server.ts`, `auth-middleware.ts`, `auth-attacher.ts`, `types.ts`, `.env`.

## 7. Integrações (status atual — Fase 1)

| Integração   | Status                | Observação                              |
| ------------ | --------------------- | --------------------------------------- |
| Apollo       | Not connected         | Estrutural                              |
| LinkedIn     | Setup required        | Requer extensão + validação de conta    |
| HubSpot      | Not connected         | Estrutural                              |
| Pipedrive    | Connected             | Pipeline Outbound LATAM                 |
| WhatsApp API | Internal setup needed | Provisionado pelo time Leaderei         |
| Resend       | Setup required        | Faltam SPF/DKIM                         |
| ElevenLabs   | Coming soon           | Fora do escopo da Fase 1                |

## 8. Decisões arquiteturais relevantes

- **Auth real (Supabase)**: login/signup usam `supabase.auth.signInWithPassword` / `signUp`. Sessão persistida em `localStorage` via cliente padrão.
- **Guards de rota**: `_app.tsx` e `_master.tsx` são gates client-side baseados em `useAuthSession()` (`src/lib/auth.ts`). Sem sessão → redirect a `/login`. `_master` valida adicionalmente `user_roles.role = master_admin` via `useIsMaster()` (RLS permite o user ler suas próprias roles).
- **Sem mock de organização**: `lib/tenant/mock.ts` foi removido. Sidebar/topbar refletem o usuário real (`user.user_metadata.full_name`, `user.email`). A unificação completa de multi-tenancy (seletor real de orgs, sessão de org corrente) entra na Fase 2.
- **Roles** ficam em `public.user_roles` (separado de `profiles`) com `has_role()` SECURITY DEFINER — jamais no `profiles`.
- **Sem Edge Functions**: toda lógica server-side usa `createServerFn`.

## 8.1 Estado atual da Fase 1

| Área                      | Estado                                                                 |
| ------------------------- | ---------------------------------------------------------------------- |
| Auth (login/signup)       | **Real** — Supabase Auth, sessão persistida, gates funcionais          |
| Master · Overview         | **Real** — KPIs e organizações recentes vêm de `companies` no banco    |
| Master · Organizations    | **Real** — listagem, criação e mudança de status persistem no banco    |
| Master · Users            | **Em breve / Fase 2** — empty state honesto                            |
| Master · Plans            | **Em breve / Fase 2** — empty state honesto                            |
| Master · Logs             | **Em breve / Fase 2** — empty state honesto                            |
| Dashboard (home)          | **UI estrutural** — KPIs/atividade/alertas ainda mockados              |
| Leads                     | **UI estrutural** — lista e detalhe são mock                           |
| Inbox                     | **UI estrutural** — 4 painéis, sem envio real                          |
| Campaigns                 | **UI estrutural** — cards/listagem mock                                |
| Builder                   | **UI estrutural** — canvas/blocos sem DnD nem persistência             |
| Integrations              | **UI estrutural** — status visual, sem OAuth real                      |
| Settings                  | **UI estrutural** — nome/email pré-preenchidos da sessão; sem persist. |
| Sidebar/Topbar (user)     | **Real** — usuário autenticado da sessão                               |
| Seletor de organização    | **Removido na Fase 1** — entra na Fase 2 com tenancy real              |


## 9. Histórico de mudanças estruturais

> **Regra**: esta seção (e o manual do usuário) **devem ser atualizados a cada mudança relevante** no app.

- **2026-05-21** — **Consolidação Fase 1**.
  - **Auth real**: login/signup agora chamam `supabase.auth.signInWithPassword` / `signUp` (antes apenas faziam `window.location.href = "/dashboard"`).
  - **Guards**: novo hook `src/lib/auth.ts` (`useAuthSession`, `useIsMaster`, `signOut`). `_app.tsx` redireciona a `/login` quando sem sessão. `_master.tsx` redireciona a `/login` quando sem sessão e exibe "Acesso restrito" quando o usuário não tem `master_admin` em `user_roles`. Isso elimina o erro `Unauthorized: No authorization header provided` causado por chamadas a `getMasterOverview` sem sessão.
  - **Sidebar/Topbar reais**: passam a usar `useAuthSession()` (nome do user metadata, email, iniciais). `Sair` chama `supabase.auth.signOut()` e navega a `/login`. Link "Master" só aparece quando `useIsMaster` retorna `true`.
  - **Removido**: rota órfã `_app.dashboard.sales.tsx` (pipeline kanban nunca linkado na sidebar). Módulo `src/lib/tenant/mock.ts` + `types.ts` (mocks de orgs/usuário). Seletor de organização da sidebar (volta na Fase 2 com tenancy real).
  - **Master placeholders honestos**: `_master.master.users.tsx`, `.plans.tsx`, `.logs.tsx` substituídos por `EmptyState` "Em breve — Fase 2". Listas/métricas falsas foram removidas.
  - **Toaster**: `<Toaster />` adicionado ao root para feedback de erros de auth.
  - **Mocks que permanecem (UI estrutural)**: Dashboard home, Leads, Inbox, Campaigns, Builder, Integrations, Settings. Foram mantidos para preservar o shell visual da Fase 1; o Dashboard agora indica explicitamente que os números não refletem dados reais. Refatoração dos arquivos monolíticos e troca por dados reais ficam para fases seguintes.


- **2026-05-21** — **Painel Master v1 — dados reais**.
  - Novo módulo de server functions `src/lib/master.functions.ts`: `getMasterOverview`, `listCompanies`, `createCompany`, `setCompanyStatus`. Todos protegidos por `requireSupabaseAuth` + checagem explícita de `master_admin` via `assertMaster()` consultando `user_roles` com `supabaseAdmin`.
  - Wiring de auth: `attachSupabaseAuth` adicionado a `functionMiddleware` em `src/start.ts` para anexar o Bearer token automaticamente em chamadas `createServerFn`.
  - `_master.master.tsx` (Overview): KPIs reais (organizações totais/ativas/trial/inativas, membros, perfis) via TanStack Query, lista de organizações recentes e card de "próximas fases" (sem MRR/eventos falsos).
  - `_master.master.organizations.tsx`: lista real de `companies` com membros agregados, busca, filtros por status, criação via diálogo (Zod validado: nome, slug auto-gerado, status inicial, limites de usuários/leads), e ativar/inativar/trial via dropdown otimista (invalida queries de Overview + Organizations).
  - Componente compartilhado `StatusPill` + tipo `CompanyStatus` exportados de `_master.master.tsx`. RLS continua sendo o backstop — políticas existentes para `companies`/`company_members` exigem `has_role(auth.uid(), 'master_admin')`.
- **2026-05-21** — **Campaigns v1 + Builder v1**.
  - **Campaigns** (`_app.dashboard.campaigns.tsx`): KPI strip (4 cards), toolbar com busca + filtros por status + alternador grid/lista, cards de campanha com canais/progresso/stats, linhas de tabela equivalentes, card "Nova campanha" inline e empty state elegante com templates sugeridos. Domínio: `CampaignStatus` (`active|paused|draft|scheduled|finished`), `Channel`, `Campaign`. Mapas `STATUS_META` e `CHANNEL_META` para UI consistente.
  - **Builder** (`_app.dashboard.builder.tsx`): layout de 3 colunas em altura cheia (`260px / 1fr / 320px`) — paleta de blocos, canvas e inspector. Paleta com grupos (Início, Canais, Lógica, Ações) e itens `draggable`. Canvas com toolbar (undo/redo, validar, auto-organizar, zoom), fundo de grid pontilhado e fluxo vertical de nós com conectores. Nó inicial obrigatório (`trigger`) + nós seguintes selecionáveis. Inspector contextual por tipo de bloco. Domínio: `BlockKind` (10 tipos) + `BLOCK_META`. **Sem lógica real de DnD/persistência ainda** — estrutura pronta para integrar `dnd-kit` ou `react-flow` na próxima fase.
- **2026-05-21** — Inbox v1: layout de 4 painéis (views rail · lista · conversa · contexto do lead), filtros por canal/status/atribuição, busca, barra de IA + handoff humano, composer multi-canal. Estrutural, sem lógica de envio real. Componentes-chave: `ViewsRail`, `ThreadList`, `ConversationPanel`, `LeadContextPanel`. Tipos `Channel`, `ThreadStatus`, `Assignee` centralizam o domínio.
- **2026-05-21** — Fix de roteamento: `_app.dashboard.tsx` era pai das rotas filhas (`leads`, `inbox`, etc.) mas não renderizava `<Outlet />`, então qualquer URL filha continuava mostrando a home. Separado em layout (`_app.dashboard.tsx` com `<Outlet />`) + index (`_app.dashboard.index.tsx` com o conteúdo da home). Padrão a seguir para qualquer rota pai com filhos.
- **2026-05-21** — Rota base `/app/*` renomeada para `/dashboard/*`. Corrigido bug de `@import` Google Fonts em `styles.css` (precisa preceder `@import "tailwindcss"`), que quebrava o build CSS e impedia render de `/leads` e `/integrations`.
- **2026-05-21** — Criados módulos de Leads (workspace split-pane) e Integrations (7 conectores).
- **2026-05-21** — Dashboard com 7 blocos (KPIs, atividade, onboarding, campanhas, alertas, leads recentes, integrações).
- **2026-05-20** — Shell principal (sidebar/topbar) implementado.
- **2026-05-20** — Design system Leaderei criado em `src/styles.css`.



## 10. Comandos úteis

- O dev-server roda automaticamente no sandbox.
- `routeTree.gen.ts` é regerado pelo plugin Vite — **não editar**.
- Para adicionar uma rota: criar `src/routes/<nome>.tsx` com `createFileRoute("/<path>")` e o plugin registra sozinho.
