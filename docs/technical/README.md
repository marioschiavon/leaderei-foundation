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

- **Multi-tenant via `lib/tenant/mock.ts`**: troca de organização puramente client-side por enquanto. Será trocado por sessão real + RLS quando o módulo de orgs entrar.
- **Roles**: quando implementadas, **devem** ficar em tabela separada `user_roles` com `has_role()` SECURITY DEFINER (jamais no `profiles`).
- **Sem Edge Functions**: toda lógica server-side usa `createServerFn`.

## 9. Histórico de mudanças estruturais

> **Regra**: esta seção (e o manual do usuário) **devem ser atualizados a cada mudança relevante** no app — nova rota, novo módulo, alteração de design system, correção arquitetural, mudança de status de integração, etc.

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
