# Apollo: consertar o botão "Enriquecer com Apollo"

## Diagnóstico

O botão "Enriquecer com Apollo" no detalhe do lead chama `enrichLeadWithApollo`, mas hoje falha por três motivos:

1. **RLS bloqueia telemetria/cache silenciosamente.** As tabelas `apollo_api_calls` e `apollo_search_cache` só têm policy de SELECT — nenhum INSERT/UPDATE. Toda chamada Apollo tenta logar e cachear, falha sem erro (engolido por try/catch). Resultado: zero registro de chamadas (tabela vazia mesmo com Apollo conectado), cache de 24h inútil, e nenhuma forma de auditar.

2. **Email "bloqueado" do Apollo é tratado como email válido.** Quando Apollo devolve `email: "email_not_unlocked@domain.com"`, `mapPersonToLeadPayload` grava no lead, sujando o campo email com lixo.

3. **Sinal fraco para o usuário.** Hoje o handler retorna `{ ok, matched, fields_updated }` mas a UI só mostra um toast. Se o Apollo não encontrou match (`matched=false`), o usuário não tem ideia do porquê (faltou email/LinkedIn? Apollo não conhece a pessoa?).

## Mudanças

### 1. Migration: completar RLS das tabelas Apollo
- `apollo_api_calls`: adicionar policy INSERT (`is_org_member` + service_role).
- `apollo_search_cache`: adicionar policies INSERT/UPDATE/DELETE (`is_org_member` + service_role).

### 2. `src/lib/apollo.server.ts`
- Em `mapPersonToLeadPayload`: descartar email se contém `email_not_unlocked` ou se `email_status` for `unavailable`/`bounced` — preserva o resto do payload, só não escreve no campo `email` do lead.

### 3. `src/lib/apollo.functions.ts` (`enrichLeadWithApollo`)
- Após o match, classificar o resultado em três estados claros:
  - `not_found` — Apollo não retornou pessoa.
  - `locked` — retornou pessoa mas email/telefone bloqueados (sem créditos para revelar).
  - `success` — algo foi atualizado.
- Retornar `{ matched, locked, fields_updated, message }` para a UI mostrar mensagem precisa.
- Continuar gravando em `lead_enrichment` (já existe).

### 4. `src/routes/_app.dashboard.leads.$leadId.tsx`
- Trocar o toast genérico atual por mensagem que reflete o estado (`success` mostra quais campos atualizou; `locked` avisa "Apollo encontrou mas email/telefone bloqueados — verifique créditos"; `not_found` mantém o toast atual).
- Sem mudanças de layout.

## Fora do escopo
- Sem auto-enriquecimento em background (confirmado pelo usuário).
- Sem mudanças na busca Apollo (`/dashboard/leads/apollo`).
- Sem mudanças em Pipedrive/Hook7/Resend.
- Sem enriquecimento em massa.
