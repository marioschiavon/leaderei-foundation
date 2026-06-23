# Documentação Técnica — Leaderei

> Documento vivo. Atualize a cada mudança estrutural relevante no app.

## 1. Visão geral

Leaderei é uma plataforma de operação comercial com shell SaaS próprio, identidade visual da marca e base multi-tenant em Supabase/Postgres.

- Frontend / fullstack: TanStack Start v1 (React 19 + Vite 7)
- Runtime de servidor: Cloudflare Workers
- Backend gerenciado: Supabase
- UI: Tailwind CSS v4 + shadcn/ui + Lucide
- Roteamento: file-based em `src/routes/`

## 2. Estrutura relevante

```text
src/
  components/
    app/        # Sidebar, Topbar, EmptyState, PageHeader
    brand/      # Logo Leaderei
    ui/         # Primitives shadcn
  integrations/
    supabase/   # client, auth middleware, generated types
  lib/
    auth.ts
    master.functions.ts
    tenant.functions.ts
    utils.ts
  routes/
    login.tsx, signup.tsx
    _app.tsx
    _app.dashboard.*.tsx
    _master.tsx
    _master.master*.tsx
docs/
  technical/
  user/
supabase/
  migrations/
```

## 3. Convenções de rota

- Área autenticada: `/dashboard/*`
- Área master: `/master/*`
- `_app.tsx` protege o shell autenticado
- `_master.tsx` protege o painel master e exige `master_admin`

## 4. Design system

Tokens principais em `src/styles.css`:

- `--brand`: `#e04e01`
- `--foreground`: texto principal
- `--surface`: cards e painéis
- `--muted`: superfícies secundárias
- `--secondary`: neutro escuro

Regras visuais:

- fundo claro predominante
- laranja apenas para CTA e destaque
- contraste alto
- sem glow, sem gradientes exagerados
- aparência executiva e limpa

## 5. Auth e tenant

- Auth real com Supabase.
- `src/lib/auth.ts` expõe `useAuthSession()`, `useIsMaster()` e `signOut()`.
- `src/lib/tenant.functions.ts` centraliza contexto do usuário autenticado e dados do tenant.
- `getMyContext()` retorna:
  - organização ativa do membro
  - papel dentro da organização
  - flag global `isMaster`
- Sidebar e Dashboard já usam esse contexto real.

## 6. Backend interno

- Toda lógica server-side usa `createServerFn`.
- Funções autenticadas usam `requireSupabaseAuth`.
- O schema e as policies do Supabase fazem o backstop de isolamento.

## 7. Estado atual da Fase 1

### Funcional com dados reais

| Área | Estado atual |
| --- | --- |
| Auth | Login, sessão persistida, redirect para `/login` quando sem sessão |
| Master · Overview | KPIs reais e resumo das organizações |
| Master · Organizations | Listagem, criação e mudança de status persistidas |
| Master · Users | Lista real de memberships, organização e roles |
| Master · Plans | Catálogo real de planos com criação e ativação |
| Dashboard | KPIs reais por tenant + contexto da organização + empty state real |
| Leads | Lista real, busca, filtros por status/origem e painel de detalhe |
| Integrations | Providers reais + conexão real por organização + status honestos |
| Sidebar / Topbar | Sessão real e contexto do usuário autenticado |

### Estrutural / congelado nesta etapa

| Área | Estado atual |
| --- | --- |
| Inbox | UI estrutural, sem operação real de mensagens |
| Campaigns | UI estrutural, sem execução real |
| Builder | UI estrutural, sem DnD nem persistência |
| Settings | UI estrutural, sem persistência de preferências |
| Master · Logs | Empty state honesto, sem audit log navegável ainda |

## 8. Integrações na Fase 1

O módulo `/dashboard/integrations` já lê:

- `integration_providers`
- `organization_integrations`

Estados exibidos com base real:

- `connected`
- `pending`
- `disconnected`
- `error`

Observação:

- o painel já reflete readiness real do tenant
- OAuth profundo, setup wizard e webhooks dedicados permanecem fora desta rodada

## 9. Leads na Fase 1

O módulo `/dashboard/leads` já lê:

- `leads`
- `lead_sources`
- `lead_activities`
- `lead_enrichment`

Escopo entregue nesta rodada:

- busca por nome, email, empresa, cargo e origem
- filtro por status
- filtro por origem
- seleção de lead
- painel lateral com contexto comercial, enrichment e atividade recente

Ainda fora de escopo:

- ações em lote
- criação/edição completa
- sync ativo com providers

## 10. Decisões importantes

- O schema atual do Supabase foi mantido e consumido; não houve redesign do banco nesta etapa.
- `user` ainda existe em partes do schema como papel legado, mas a UI já trata esse membro como agente operacional.
- Não foram abertas novas áreas. O foco foi fechar consumo de dados reais nos módulos prioritários.

## 11. RLS unificada para integrações (Apollo / Pipedrive)

As policies de `integration_credentials` e `pipedrive_sync_runs` foram recriadas para usar o mesmo padrão dos demais módulos:

```text
has_role(auth.uid(), 'master_admin')
  OR (is_org_member(auth.uid(), organization_id)
      AND has_role(auth.uid(), 'company_admin'))
```

Efeitos:

- `master_admin` consegue operar credenciais e sync runs de qualquer organização (não precisa também ter `company_admin`).
- `company_admin` continua gerenciando exclusivamente as integrações da própria org.
- Tabelas auxiliares (`apollo_api_calls`, `apollo_search_cache`, `organization_integrations`, `integration_providers`) seguem abertas para qualquer membro ativo da org — não foram tocadas.

## 12. Hook7 / WhatsApp — sincronização de status

A Edge Function `hook7-webhook` recebe os eventos `connection.update` do Hook7 e atualiza `hook7_instances.status` em tempo real. Após o pareamento via QR Code, o status passa de `pending` → `connected` automaticamente, sem necessidade de refresh manual. O nome do dispositivo (`Google Chrome (Evolution Go)`) é registrado pelo próprio Hook7 e exibido na UI a partir do payload `connection.update`.

## 13. Histórico recente

- 2026-06-23 — RLS unificada em `integration_credentials` e `pipedrive_sync_runs` (master_admin + company_admin da org).
- 2026-06-23 — Hook7 webhook passa a sincronizar status `connected` imediatamente após leitura do QR Code.
- 2026-05-22 — Dashboard consolidado com dados reais por tenant.
- 2026-05-22 — Sidebar passou a exibir organização ativa e papel do usuário.
- 2026-05-22 — Leads ligados ao banco com filtros reais, detalhe e atividade.
- 2026-05-22 — Integrations ligadas ao banco com status reais do tenant.
- 2026-05-22 — Documentação sincronizada para distinguir módulos reais de UI estrutural.
- 2026-05-21 — Guards de auth e master estabilizados.
- 2026-05-21 — Painel Master ligado ao backend real.
