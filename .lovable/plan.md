# Repaginar Leads + acessar Apollo Search

Dois problemas resolvidos juntos: (1) a busca Apollo existia mas não tinha link no menu, e (2) o detalhe do lead aparecia num painel lateral apertado, mostrando só parte dos dados e sem edição completa.

## 1. Acesso ao Apollo Search

- Adicionar botão **"Buscar no Apollo"** no header da página `/dashboard/leads` (ao lado de "Importar" e "Novo lead"), apontando para `/dashboard/leads/apollo`.
- Adicionar entrada **"Buscar no Apollo"** no sidebar, dentro do grupo *Ferramentas*, com ícone de busca (visível só quando a integração Apollo estiver conectada — quando desconectada, mostra greyed-out com tooltip "Conecte o Apollo em Integrações").

## 2. Página dedicada do Lead

Hoje `LeadsPage` mostra lista + `<aside>` com `LeadDetailPanel`. Vamos transformar em **rota própria**: `/dashboard/leads/$leadId`, ocupando a largura inteira.

Comportamento:
- Lista de leads (`/dashboard/leads`) continua igual, mas clicar num lead **navega** para `/dashboard/leads/$leadId` (não mais selecionar in-place).
- Botão "Voltar para Leads" no topo da página de detalhe.
- O `<aside>` antigo é removido — a lista volta a ocupar toda a largura.

Layout da página do lead (2 colunas em telas grandes):

```text
┌────────────────────────────────────────────────────────────┐
│  ← Voltar    [Nome do Lead]              [Status] [Editar] │
│              cargo · empresa            [Arquivar] [Apollo]│
├────────────────────────────────────────────────────────────┤
│  COLUNA PRINCIPAL (2/3)         │  COLUNA LATERAL (1/3)    │
│                                  │                          │
│  ▸ Dados de contato              │  ▸ Resumo comercial      │
│    email, secondary, personal    │    score, temperatura    │
│    phone, mobile, corporate      │    valor estimado        │
│                                  │    próximo follow-up     │
│  ▸ Empresa & cargo               │    último contato        │
│    company, job, seniority,      │                          │
│    departamento, indústria,      │  ▸ Origem & owner        │
│    nº funcionários               │                          │
│                                  │  ▸ Tags (editáveis)      │
│  ▸ Localização                   │                          │
│    cidade, estado, país          │  ▸ Links                 │
│                                  │    LinkedIn, Website     │
│  ▸ Campanhas                     │                          │
│    lista de enrollments          │  ▸ Enrichment (Apollo)   │
│    (campanha, status, datas)     │    provider, confiança,  │
│                                  │    highlights            │
│  ▸ Reuniões agendadas            │                          │
│    (lead_bookings)               │  ▸ IDs externos          │
│                                  │    apollo_id, pipedrive  │
│  ▸ Atividade recente             │                          │
│    timeline completa             │                          │
└────────────────────────────────────────────────────────────┘
```

Modo edição:
- Botão "Editar" troca a página para formulário inline (mesma estrutura, inputs no lugar dos textos) — não usa Sheet/modal.
- Campos editáveis: full_name, email, secondary_email, personal_email, phone, mobile_phone, corporate_phone, company_name, job_title, seniority, department, industry, employee_count, website_url, linkedin_url, city, state, country, status, temperature, score, estimated_value, currency, next_followup_at, tags, source_id.
- "Salvar" / "Cancelar" no topo e no rodapé.

## Detalhes técnicos

**Backend (`src/lib/tenant.functions.ts`):**
- `getLeadDetail`: ampliar `select` para todos os campos da tabela `leads` (incluir secondary_email, personal_email, mobile_phone, corporate_phone, seniority, department, industry, employee_count, state, apollo_person_id, pipedrive_person_id, owner_user_id, custom_fields, enrichment_data, archived_at, updated_at). Adicionar 2 queries em paralelo: `campaign_enrollments` (com join em `campaigns(name, status, channel)`) e `lead_bookings` filtradas por `lead_id`.
- `updateLead` (`UpdateLeadSchema`): adicionar os campos novos editáveis listados acima + tags (array string) + source_id (uuid nullable).

**Rotas (TanStack file-based):**
- Novo arquivo `src/routes/_app.dashboard.leads.$leadId.tsx` com `createFileRoute("/_app/dashboard/leads/$leadId")`. Recebe `leadId` via `Route.useParams()`, busca via `getLeadDetail`, renderiza o layout acima. Inclui `errorComponent` e `notFoundComponent`.
- Em `_app.dashboard.leads.tsx`: clique no item da lista usa `<Link to="/dashboard/leads/$leadId" params={{ leadId: lead.id }}>`. Remover `<aside>` e o componente `LeadDetailPanel` (mover lógica para a nova rota). Remover `selectedLeadId` state.

**Sidebar (`src/components/app/AppSidebar.tsx`):**
- Adicionar `{ title: "Buscar no Apollo", url: "/dashboard/leads/apollo", icon: Search }` no array `TOOLS`.

**Header da Leads (`PageHeader actions`):**
- Adicionar `<Button variant="outline" asChild><Link to="/dashboard/leads/apollo">Buscar no Apollo</Link></Button>` antes de "Importar".

## Fora de escopo (próximos passos, se quiser)

- Edição inline de atividades (criar nova nota/atividade manual).
- Histórico de mensagens (conversations/messages) na timeline do lead.
- Mover lead entre owners.
