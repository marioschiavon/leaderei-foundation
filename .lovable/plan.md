
# Leaderei — Fase 1: Fundação Visual e Estrutural

Análise do estado atual + plano de execução em ordem segura. Sem código nesta etapa.

---

## 1. O que já pode ser reaproveitado

O projeto está em um estado quase "em branco" sobre uma stack moderna que serve perfeitamente:

- **Stack base**: TanStack Start + React 19 + Vite + Tailwind v4 + TypeScript estrito. Adequada para um SaaS multi-tenant; mantemos.
- **Biblioteca shadcn/ui completa** já instalada em `src/components/ui` (sidebar, dialog, dropdown, tabs, sheet, table, form, command, etc.). É praticamente todo o vocabulário de UI que vamos usar — não precisamos adicionar nada novo agora.
- **Sistema de tokens em `src/styles.css`** já estruturado com `@theme inline` + variáveis `oklch`. Vamos **manter o esqueleto** e apenas **substituir os valores** pela paleta Leaderei (laranja #e04e01, cinzas, preto).
- **Bootstrap do roteador** (`src/router.tsx`, `src/routes/__root.tsx`, `routeTree.gen.ts`) está correto. Mantemos.
- **Error boundary e Not Found** já implementados no `__root.tsx` — só precisam ser reskinned com a identidade Leaderei.

## 2. O que precisa ser reorganizado

- **`src/routes/index.tsx`** ainda é o placeholder padrão "blank-app". Será substituído pela landing/login pública da Leaderei.
- **Não existem grupos de rotas** (`_authenticated`, `_master`, `(auth)`). Precisam ser criados para separar surfaces públicas, app tenant e painel master.
- **Não existe shell/layout do app** (sidebar + topbar). Será o maior bloco novo desta fase.
- **`src/styles.css`** usa paleta neutra azulada padrão do shadcn — precisa ser totalmente retematizada para Leaderei (clean corporativo, fundo claro, laranja só em CTA/ativos).
- **Sem distinção visual entre tenant app e painel master** — precisam ser dois shells separados desde já.
- **Tipografia padrão** — definir um par tipográfico sóbrio (ex.: Inter ou Geist para UI; nada genérico de startup). Não precisa servidor de fontes complexo; pode ser via `@import` no CSS.

## 3. Fase 1 em blocos visuais e funcionais

### Bloco A — Identidade Visual (Design System Leaderei)
- Tokens em `styles.css` reescritos em oklch a partir da paleta oficial (#e04e01, #606060, #313131, #000, fundo off-white).
- Hierarquia: `--background` claro, `--foreground` quase preto, `--primary` = laranja Leaderei (uso restrito a CTA / ativo / destaque), `--muted` cinza 1, `--border` cinza muito suave.
- Tipografia: display + body sóbrios, sem variações neon.
- Radius moderado (≈ 0.5rem), sombras discretas, sem gradiente, sem glass.
- Logo/wordmark placeholder Leaderei como componente isolado.

### Bloco B — Surfaces Públicas (não-autenticadas)
- `/` — Landing simples Leaderei (hero + valor + CTA login/signup). Visual premium e sóbrio.
- `/login` — formulário de login (apenas UI por enquanto, sem backend).
- `/signup` — cadastro inicial que também cria a **organização (tenant)**: nome da organização + email + senha + slug sugerido.
- `/forgot-password` — UI apenas.

### Bloco C — Shell do App Tenant (`/app/*`)
Layout principal do produto, inspirado em Dripify:
- **Sidebar esquerda colapsável** (shadcn Sidebar): logo + navegação por módulos + bloco de organização atual no rodapé com switcher.
- **Topbar**: busca global, seletor de workspace/canal, notificações, avatar com menu.
- **Outlet central** com padding generoso (respiro), breadcrumbs e cabeçalho de página padronizado.
- Estado ativo de menu em laranja Leaderei; resto em cinzas escuros.

### Bloco D — Módulos Core (somente estrutura visual, sem lógica real)
Cada um é uma rota com um esqueleto de UI representando o módulo (estados vazios bonitos, tabelas placeholder, abas, filtros):
- `/app` — **Dashboard** (KPIs, atividade recente, próximos passos).
- `/app/leads` — **Leads / CRM** (tabela + filtros + drawer de detalhe).
- `/app/inbox` — **Caixa multicanal** (lista de conversas + painel de mensagem, referência Snov.io).
- `/app/campaigns` — **Campanhas / Sequências** (lista + estado vazio com CTA criar).
- `/app/sales` — **Sales workspace** (pipeline kanban placeholder).
- `/app/integrations` — grade de canais/integrações (cards "Conectar" — UI só).
- `/app/settings` — abas: Organização, Membros, Billing, Preferências, API.

### Bloco E — Painel Master (`/master/*`)
Visual distintamente "operacional" (mesmo design system, ênfase em dados densos):
- `/master` — overview da plataforma (nº de orgs, usuários, MRR placeholder).
- `/master/organizations` — lista de tenants com ações.
- `/master/users` — usuários globais.
- `/master/plans` — planos e features.
- `/master/logs` — eventos do sistema (placeholder).

### Bloco F — Fundação Multi-Tenant (estrutura, ainda sem backend real)
- Tipos TS para `Organization`, `Membership`, `User`, `Role` (`owner`, `admin`, `member`, `master`).
- Contexto `useCurrentOrg()` + `useCurrentUser()` com mock estático em memória, pronto para trocar por Lovable Cloud na Fase 2.
- Guards de rota: `_authenticated` (app) e `_master` (somente role master). Hoje gating mockado.
- Switcher de organização no shell já funcional contra o mock.

### Bloco G — Polimento de Estado
- Estados vazios consistentes (ícone + título + descrição + CTA laranja).
- Skeletons padronizados em tabelas/listas.
- Página 404 e error boundary já com identidade Leaderei.

---

## 4. Plano de implementação em ordem segura

A ordem garante que cada passo seja visível e não quebre nada do anterior.

1. **Design system Leaderei**
   Reescrever `src/styles.css` com tokens oklch da marca, tipografia, radius, sombras. Validar contra um par de botões/cards de teste.

2. **Componentes de marca**
   `Logo`, `Wordmark`, `BrandMark` em `src/components/brand/`. Variantes light/dark e tamanhos.

3. **Surfaces públicas**
   Reescrever `/` (landing Leaderei sóbria). Criar `/login`, `/signup`, `/forgot-password` — UI apenas.

4. **Tipos e mock multi-tenant**
   `src/lib/tenant/types.ts`, `src/lib/tenant/mock.ts`, hooks `useCurrentOrg`, `useCurrentUser`, `useMemberships`.

5. **Layouts de grupo de rotas**
   `src/routes/_authenticated.tsx` (shell do app tenant) e `src/routes/_master.tsx` (shell do master). Outlet correto, guard mockado.

6. **Shell do app tenant**
   `AppSidebar` (módulos core), `AppTopbar` (busca, org switcher, avatar), `PageHeader` padrão, breadcrumbs. Tudo dentro de `_authenticated`.

7. **Esqueletos dos módulos core**
   Criar rotas `app.tsx` (dashboard), `app.leads.tsx`, `app.inbox.tsx`, `app.campaigns.tsx`, `app.sales.tsx`, `app.integrations.tsx`, `app.settings.tsx` com layouts placeholder consistentes (header + filtros + tabela/kanban/inbox vazios bonitos).

8. **Painel master**
   `master.tsx` + filhos (`organizations`, `users`, `plans`, `logs`). Shell próprio mais denso.

9. **Polimento**
   Empty states, skeletons, 404/erro com marca, micro ajustes de espaçamento e tipografia, revisão de contraste.

Critério de pronto da Fase 1: navegar do landing → signup → app tenant → trocar org → entrar no painel master, com todas as telas core renderizando shells visuais consistentes e na identidade Leaderei. Sem backend real, sem IA, sem integrações conectadas — apenas a fundação visível e a estrutura pronta para a Fase 2.

---

Confirme se devo seguir com este plano (ou ajuste blocos/escopo) antes de eu começar a implementar.
