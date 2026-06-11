## Objetivo

No card de campanha, ao abrir "Leads" → aba "Adicionar", o usuário precisa ver **todos** os leads elegíveis ao canal da campanha (não um subconjunto truncado), com paginação, busca real e indicação clara de quantos leads ficaram de fora por falta de email/WhatsApp.

## O que muda

### 1. Backend — `listEligibleLeadsForCampaign` vira paginado e filtra no banco

Arquivo: `src/lib/campaigns.functions.ts`

- Aceitar input novo: `{ campaign_id, page?, page_size?, search?, only_new? }` (default `page=1`, `page_size=50`, `only_new=true` = esconde quem já está inscrito).
- Aplicar **no banco** (sem trazer 5000 linhas para memória):
  - `organization_id = campanha.org`
  - `archived_at is null`
  - filtro de canal:
    - canal `whatsapp` → `phone is not null and phone <> ''`
    - canal `email` → `email is not null and email <> ''`
    - canal `linkedin` → `linkedin_url is not null` (ou regra equivalente já existente)
  - `search` opcional via `or(full_name.ilike, email.ilike, phone.ilike, company_name.ilike)`
  - excluir leads já em `campaign_enrollments` com status `active`/`paused` da mesma campanha quando `only_new=true` (subquery `not in`).
- Usar `.range(from, to)` + `count: "exact"` para devolver `total` e `rows` da página.
- Devolver, em uma única chamada:
  ```
  {
    channel,
    page, page_size, total,           // página de elegíveis novos
    rows,                             // leads desta página
    counts: {
      org_total,                      // todos os leads da org (não arquivados)
      eligible_total,                 // elegíveis pelo canal
      already_enrolled,               // já inscritos active/paused
      missing_channel                 // org_total - eligible_total
    }
  }
  ```
- Os campos legados (`eligible`, `ineligible`, `eligible_count`, `new_eligible_count`, `active_lead_ids`) continuam sendo usados pelo diálogo de **ativação** (`ActivateCampaignDialog`). Para não quebrar isso, criar uma **server fn nova** `listEligibleLeadsPage` com o shape paginado e **manter** `listEligibleLeadsForCampaign` para o fluxo de ativação inicial (que ainda precisa de contagens agregadas). O modal "Adicionar" passa a usar a nova.

### 2. Frontend — diálogo "Adicionar lead" no card de campanhas

Arquivo: `src/routes/_app.dashboard.campaigns.tsx` (componente `ManageEnrollmentsDialog`, linhas ~730–960)

- Estado local: `page`, `pageSize` (default 50), `search` (com debounce de 250 ms). Resetam ao abrir/fechar o modal.
- `useQuery` chama a nova `listEligibleLeadsPage` com esses parâmetros (keepPreviousData para não piscar entre páginas).
- Topo do painel "Adicionar":
  - linha-resumo: `5.013 leads na org · 75 elegíveis para WhatsApp · 12 já inscritos · 4.938 sem WhatsApp cadastrado`
  - quando `missing_channel > 0`, mostrar um aviso curto com link para `/dashboard/leads?channel=<canal>` filtrando a lista de leads no canal certo, para o usuário enriquecer os dados.
- Lista substitui o `filter` em memória pelo conteúdo de `rows`. Busca é server-side.
- "Selecionar todos" passa a ter dois modos: **"Selecionar página"** (rows atuais) e **"Selecionar todos os N elegíveis"** (só habilita quando `total ≤ 1000` para evitar enrolar milhares por engano; acima disso, mostra mensagem pedindo refinar o filtro).
- Paginação no rodapé: `Anterior / Próximo` + `X–Y de N`.
- O contador da aba ("Adicionar · N") usa `counts.eligible_total - counts.already_enrolled`, não mais o tamanho do array em memória.

### 3. `activateCampaign` — remover o teto de 5000

Arquivo: `src/lib/campaigns.functions.ts` (linha ~225)

- Quando `lead_ids` for passado explicitamente (caso do modal de adicionar), processar em lotes (chunks de 500) em vez de um `.in()` único com `limit(5000)`. Isso garante que selecionar "todos os elegíveis" funcione mesmo com milhares de leads.
- Quando `lead_ids` não vier (ativação geral), iterar páginas até esgotar via `.range()` em vez de `limit(5000)`.

### 4. Sem mudança de schema

Não precisa migration. Tudo é query/UI.

## Restrições

- Não mexer no Builder, Inbox, página de Leads, pg_cron, ou no executor de fluxo.
- Manter o botão "Roda o worker manualmente" e o fluxo do `ActivateCampaignDialog` intactos (continuam usando a função antiga).
- Não retornar PII além do que o modal já mostra hoje (`full_name`, `email`, `phone`, `company_name`).

## Gate de aceite

1. Abrir "Leads" em uma campanha WhatsApp da sua org mostra contagem real (`75 elegíveis para WhatsApp` em vez de uma lista pequena sem explicação).
2. Busca por nome/email/telefone retorna resultados de toda a base elegível, não só dos 50 da página atual.
3. Paginação Anterior/Próximo funciona e mantém a busca.
4. Aviso "X leads sem WhatsApp cadastrado" aparece quando faz sentido, com link para a página de Leads filtrada.
5. Adicionar 500+ leads de uma vez não estoura nem trunca silenciosamente.
6. Diálogo de ativação inicial da campanha continua funcionando exatamente como hoje.
