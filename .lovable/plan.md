## Diagnóstico (testado direto na API)

Testei a chave `-aK3mJrvIQcF46ktJOtHgA` contra cada endpoint:

| Endpoint | Método usado hoje | Resultado | Esperado |
|---|---|---|---|
| `/api/v1/auth/health` | POST + body | **404** | **GET** + header `X-Api-Key` → `200 {"healthy":true,"is_logged_in":true}` |
| `/api/v1/mixed_people/search` | POST | **422 deprecated** | Trocar para `/api/v1/mixed_people/api_search` (POST) → `200` |
| `/api/v1/people/match` | POST | **200** | Já está correto |

A chave da Apollo é **válida**. As duas chamadas que estavam quebradas são o handshake (`auth/health`) e a busca (`mixed_people/search`). A base `https://api.apollo.io/api/v1` está correta — manter.

## Mudanças (todas em `src/lib/apollo.server.ts`)

### 1. `validateApolloKey` — usar GET
Trocar o objeto passado para `callApollo`:
- `method: "POST"` → `method: "GET"`
- Remover `body: { api_key: args.apiKey }` (não usado em GET; autenticação já vai pelo header `X-Api-Key`)

### 2. `searchPeopleWithCache` — novo endpoint
- Trocar `endpoint: "mixed_people/search"` por `endpoint: "mixed_people/api_search"`
- Body e shape de resposta (`people[]`, `pagination`, `total_entries`) permanecem iguais — confirmado no teste.

### 3. `callApollo` — pequeno ajuste defensivo
Hoje o header `Content-Type: application/json` é enviado mesmo em GET. Manter como está (Apollo aceita), porém **não** enviar `body` quando `method === "GET"` (já é o caso). Nada a fazer aqui além de confirmar.

### 4. Mensagem 404
Manter o branch novo no `humanizeApolloError` (`"Endpoint Apollo não encontrado (404)..."`) — útil para futuras quebras.

## Observação sobre dados retornados
O `mixed_people/api_search` é o endpoint público e por padrão **não devolve email/telefone reais** (devolve `has_email: true`, `last_name_obfuscated`). Isso é igual ao comportamento que o `lead-automate` usa hoje — quando o usuário importa um lead, o enrichment via `people/match` é quem traz email/telefone gastando crédito. O fluxo do app hoje já está alinhado com isso: a busca é exploratória, e o `enrichLeadWithApollo` é quem revela email.

Nenhuma mudança em UI, cache, dedupe, schema de banco, ou `apollo.functions.ts`. Apenas as 2 linhas em `apollo.server.ts`.

## Validação após o build
1. Abrir o dialog Apollo, colar a chave e clicar **Conectar** → badge **Conectado** e `apollo_api_calls` registra `auth/health` com `status_code = 200`.
2. Em `/dashboard/leads/apollo`, fazer uma busca (qualquer cargo) → resultados aparecem, `apollo_api_calls` registra `mixed_people/api_search` com `status_code = 200`.
3. Em um lead com email, rodar enriquecimento → `people/match` com `status_code = 200`.

## Arquivos afetados
- `src/lib/apollo.server.ts` (2 alterações pontuais)
