## Problema

Ao clicar **Conectar** no Apollo, a resposta vem com **404** após ~3s. Não há linhas em `apollo_api_calls` porque o erro vem direto da Apollo antes de qualquer outra coisa funcionar.

**Causa raiz:** em `src/lib/apollo.server.ts` a constante `BASE` aponta para `https://api.apollo.io/v1`. A Apollo migrou a API para `https://api.apollo.io/api/v1` — o caminho antigo agora responde 404 em todos os endpoints (`auth/health`, `mixed_people/search`, `people/match`).

## Mudanças

### 1. `src/lib/apollo.server.ts` — corrigir base URL
- Trocar `const BASE = "https://api.apollo.io/v1"` por `const BASE = "https://api.apollo.io/api/v1"`.
- Manter os paths atuais (`auth/health`, `mixed_people/search`, `people/match`) — eles estão corretos sob a nova base.
- Continuar enviando o header `X-Api-Key` (suportado) e também o body `{ api_key }` no `validateApolloKey` (compatível com ambos os modos de auth da Apollo, evita regressão se algum ambiente exigir um ou outro).

### 2. Mensagem de 404 mais clara
No `humanizeApolloError`, adicionar tratamento para `status === 404`:
> "Endpoint Apollo não encontrado (404). Pode ser uma versão de API desatualizada — avise o suporte."

Assim, se a Apollo mudar a base de novo, a mensagem não fica genérica.

### 3. Validar manualmente após o deploy
- Reabrir o dialog **Integrações → Apollo**, colar a chave e clicar **Conectar**.
- Esperado: badge **Conectado**, linha em `organization_integrations` (status `connected`) e uma linha em `apollo_api_calls` com endpoint `auth/health` e `status_code = 200`.
- Em seguida testar uma busca em `/dashboard/leads/apollo` para garantir que `mixed_people/search` também funciona com a nova base.

## Detalhes técnicos

- Não é necessário mexer em `apollo.functions.ts`, no dialog, em telemetria, cache ou schema do banco. A correção é isolada à constante de base URL.
- Cache `apollo_search_cache` continua válido — a chave é hash dos filtros, não do endpoint.
- Sem migração de banco.
- Sem nova dependência.

## Arquivos afetados

- `src/lib/apollo.server.ts` (1 constante + 1 branch no `humanizeApolloError`)
