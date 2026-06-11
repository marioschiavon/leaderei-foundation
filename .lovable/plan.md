## Diagnóstico

Sua organização tem **5.013 leads** no banco, mas a página `/dashboard/leads` mostra no máximo **200**. O motivo está em `src/lib/tenant.functions.ts` na função `listLeads`:

```ts
.order("created_at", { ascending: false })
.limit(200);   // ← trava em 200
```

A query retorna só os 200 leads mais recentes. Todo o filtro de busca/status/origem hoje é feito **no cliente, em cima desses 200**, então qualquer lead fora dessa janela some — inclusive os antigos com WhatsApp/email válidos que você quer usar nas campanhas.

Como contexto adicional: do total, **4.398 não têm email** e **4.938 não têm telefone**. Isso não é o que está "escondendo" os leads na tela (o filtro de elegibilidade só roda quando você ativa uma campanha), mas é importante mostrar isso no UI pra você saber quantos leads são realmente acionáveis por canal.

## Plano

### 1. Backend — `listLeads` com paginação, filtros e contagem real
Reescrever `listLeads` em `src/lib/tenant.functions.ts` para aceitar:
- `search` (nome / email / empresa / cargo / telefone — via `ilike` e `or`)
- `status` (string opcional)
- `source_slug` (string opcional, join em `lead_sources.slug`)
- `channel_ready` (`"any" | "email" | "whatsapp" | "both"`) — usa `email is not null` e/ou `phone is not null`
- `page` e `page_size` (default 50, máx 200)

Retorno:
```ts
{ rows: Lead[], total: number, page, page_size,
  counts: { total, with_email, with_phone, with_both } }
```
Filtros aplicados via `.eq/.ilike/.or/.not("email","is",null)` e paginação com `.range(from, to)`. `total` vem de uma segunda query `select("id", { count: "exact", head: true })` com os mesmos filtros.

Remover o `.limit(200)`.

### 2. Frontend — `src/routes/_app.dashboard.leads.index.tsx`
- Mover `query`, `statusFilter`, `sourceFilter` + novos `channelFilter` e `page` para search params da rota (`validateSearch`), com `useNavigate` para atualizar.
- `useQuery` com `queryKey` incluindo todos os filtros + página; chamar `listLeads` com esses parâmetros (deixa de filtrar no cliente).
- Adicionar barra com chips de canal: **Todos / Com email / Com WhatsApp / Com ambos** (usando os `counts` retornados).
- Adicionar paginação simples no rodapé (Anterior / Próximo + "X–Y de N leads") e seletor de tamanho de página (50 / 100 / 200).
- Mostrar no header "5.013 leads · 615 com email · 75 com WhatsApp" (números reais do backend).

### 3. Pré-visualização de elegibilidade na campanha
Hoje `previewCampaignEligibility` já calcula `eligible_count` e `ineligible_count`, mas a lista de leads não mostra essa informação antes de abrir a campanha. Adicionar na página de leads, ao lado de cada linha, um pequeno marcador de canais disponíveis (ícone de email / WhatsApp em cinza quando ausente). Isso responde direto ao seu ponto "90% das campanhas vão usar WhatsApp e email" — você consegue ver de relance quais leads atendem.

### 4. Sem mudanças em RLS / schema
Os 5.013 leads já estão acessíveis via RLS (a query confirma). Não é necessário tocar em policies, grants ou migrations.

## Resultado esperado
- Você passa a ver e paginar **todos os 5.013 leads**, não só 200.
- Filtros (status, origem, busca, canal) rodam no banco, então funcionam sobre o conjunto inteiro.
- Cada lead mostra quais canais (email/WhatsApp) estão prontos para campanha, batendo com o filtro de elegibilidade que `activateCampaign` já aplica.