# Corrigir página dedicada do Lead

## Diagnóstico

`/dashboard/leads/<leadId>` abre em branco (só o spinner do shell). Razão técnica:

- Existem 3 arquivos irmãos: `_app.dashboard.leads.tsx` (lista), `_app.dashboard.leads.$leadId.tsx` (detalhe) e `_app.dashboard.leads.apollo.tsx` (busca).
- No TanStack Router, quando há arquivos com prefixo `leads.`, o `leads.tsx` vira **rota pai** de `$leadId` e `apollo`. Confirmado no `routeTree.gen.ts`: `getParentRoute: () => AppDashboardLeadsRoute`.
- Uma rota pai precisa renderizar `<Outlet />` para a filha aparecer. Hoje o componente `LeadsPage` renderiza a lista direto e **não tem `<Outlet />`** — então o filho casa, mas nada mostra; a UI continua exibindo a lista (ou fica em branco enquanto a query do detalhe carrega).

O mesmo bug afeta `/dashboard/leads/apollo` — provavelmente nunca abriu de verdade.

## Correção

Padrão recomendado pelo TanStack quando uma rota "vira layout": mover o conteúdo para `*.index.tsx` e transformar o arquivo pai em layout puro.

1. **Renomear** `src/routes/_app.dashboard.leads.tsx` → `src/routes/_app.dashboard.leads.index.tsx`.
2. Dentro do arquivo renomeado, trocar:
   ```ts
   createFileRoute("/_app/dashboard/leads")
   ```
   por:
   ```ts
   createFileRoute("/_app/dashboard/leads/")
   ```
   (o resto do componente `LeadsPage` permanece igual).
3. **Criar** novo `src/routes/_app.dashboard.leads.tsx` mínimo, só layout:
   ```tsx
   import { createFileRoute, Outlet } from "@tanstack/react-router";
   export const Route = createFileRoute("/_app/dashboard/leads")({
     component: () => <Outlet />,
   });
   ```

Resultado:
- `/dashboard/leads` → continua mostrando a lista (vinda do `index`).
- `/dashboard/leads/<id>` → mostra a página dedicada do lead.
- `/dashboard/leads/apollo` → mostra a busca Apollo.

Nenhuma mudança no detalhe do lead, na navegação ou nos server functions — o bug é só estrutural de rotas. O `routeTree.gen.ts` é regenerado automaticamente.

## Fora de escopo

- Nada muda no layout, dados, edição ou enriquecimento do lead.
- Sidebar e botões de header já estão corretos.
