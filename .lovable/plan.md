## Objetivo

No modal "Adicionar lead" de uma campanha, mostrar **todos os leads da organização** por padrão (não só os elegíveis ao canal da campanha), e oferecer um **filtro de canal** opcional (Todos / Com WhatsApp / Com Email) para o usuário refinar quando quiser.

## Problema atual

Hoje `listEligibleLeadsPage` força o filtro pelo `campaign.channel` no banco. Numa campanha WhatsApp, leads que só têm email somem da lista — o usuário vê uma lista vazia ou muito menor e não entende porquê.

## Mudanças

### 1. Backend — `src/lib/campaigns.functions.ts`

Em `listEligibleLeadsPage`:

- Adicionar input `channel_filter: "all" | "whatsapp" | "email"` (default `"all"`).
- `"all"` → não aplica `applyChannelFilter` nas queries de `rows` e `total`. Carrega todos os leads da org (não arquivados), paginados.
- `"whatsapp"` → aplica filtro por telefone preenchido.
- `"email"` → aplica filtro por email válido.
- Manter os `counts` agregados como já estão (`org_total`, `eligible_total` calculado pelo canal **da campanha**, `already_enrolled`, `missing_channel`) — eles continuam servindo como contexto.
- Adicionar no retorno `filtered_total` = total da query aplicada (com o `channel_filter` atual), para a paginação refletir o que o usuário está vendo.
- Por linha, devolver também `eligible_for_campaign: boolean` (calculado com `isLeadEligibleForChannel(lead, campaign.channel)`) para o front poder marcar/desabilitar adequadamente.

Nada muda em `listEligibleLeadsForCampaign` nem em `activateCampaign` — eles continuam sendo a fonte de verdade da ativação inicial e já filtram inelegíveis.

### 2. Frontend — `src/routes/_app.dashboard.campaigns.tsx` (`ManageEnrollmentsDialog`)

- Novo estado `channelFilter` (default `"all"`), incluído no `queryKey` e passado para a server fn.
- Acima da lista, ao lado da busca, um `Select` compacto:
  - Todos os leads
  - Com WhatsApp
  - Com email
- A linha-resumo passa a mostrar: `5.013 leads na org · {filtered_total} no filtro atual · {eligible_total} elegíveis para {canal da campanha} · {already_enrolled} já inscritos`.
- Paginação usa `filtered_total` em vez de `total`.
- Em cada linha:
  - Se `eligible_for_campaign === false`, mostrar badge cinza "Sem {canal}" e **desabilitar o checkbox** com tooltip "Lead não tem {email|WhatsApp} cadastrado — não pode ser adicionado a esta campanha". Isso evita o usuário inscrever leads que o `activateCampaign` ignoraria silenciosamente.
- "Selecionar página" e "Selecionar todos os N" só consideram os elegíveis (`eligible_for_campaign === true`) presentes na página/total.
- O contador da aba "Adicionar · N" continua usando `eligible_total - already_enrolled` (intenção: novos elegíveis), independente do filtro visual.

### 3. Sem mudança de schema, sem mexer em ativação

Não há migration. `activateCampaign`, `ActivateCampaignDialog`, Builder, Inbox, página de Leads e pg_cron permanecem intactos.

## Gate de aceite

1. Abrir "Adicionar leads" numa campanha WhatsApp mostra por padrão **todos** os leads da org paginados, não só os com telefone.
2. Trocar o filtro para "Com WhatsApp" reduz a lista para os elegíveis; "Com email" mostra os com email; "Todos os leads" volta a mostrar tudo.
3. Leads sem o canal da campanha aparecem com badge "Sem WhatsApp/email" e checkbox desabilitado com tooltip explicativo.
4. Busca e paginação funcionam dentro do filtro escolhido (contagem `X–Y de N` reflete o filtro).
5. Linha-resumo informa quantos são elegíveis para o canal da campanha mesmo quando o filtro é "Todos".
6. Ativação inicial (`ActivateCampaignDialog`) continua se comportando exatamente como hoje.
