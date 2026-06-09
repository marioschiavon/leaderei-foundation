# Simplificar conexão Pipedrive: só API token

Hoje o usuário precisa preencher **API token + domínio da empresa**. No projeto antigo (`lead-automate`) só era pedido o token — o domínio era descoberto automaticamente chamando o endpoint global `https://api.pipedrive.com/v1/users/me`, que retorna `data.company_domain`. Vamos replicar esse comportamento aqui, mantendo o resto da sync (v2 com cursor) intacto.

## Mudanças

### 1. `src/lib/pipedrive.server.ts`
- Nova função `discoverCompanyDomain(api_token)`: chama `https://api.pipedrive.com/v1/users/me?api_token=…`, lê `data.company_domain` e devolve `{slug}.pipedrive.com`. Trata 401/403 como "token inválido".
- `validatePipedriveToken` passa a aceitar só `api_token`, usa `discoverCompanyDomain` internamente e devolve `{ user_id, name, company_domain }`.
- Remover `normalizeCompanyDomain` (não é mais necessário).

### 2. `src/lib/pipedrive.functions.ts`
- Server fn de salvar conexão: aceita só `api_token`. Internamente descobre o domínio e grava ambos (`api_token` + `company_domain` descoberto) nas credenciais — assim o sync v2 continua funcionando sem mudanças.
- Server fn de status retorna o domínio descoberto (somente leitura, para exibir na UI).

### 3. `src/components/app/PipedriveConnectDialog.tsx`
- Remover o input "Domínio da empresa" e a validação correspondente.
- Deixar só o campo "API token" + botão Conectar.
- Após sucesso, exibir o domínio detectado em modo leitura (ex.: "Conectado a `suaempresa.pipedrive.com`").

### 4. Documentação
- Atualizar `docs/user/UPDATES.md` com uma entrada explicando que a conexão Pipedrive agora pede apenas o token.

## O que NÃO muda
- Sync continua usando v2 (`{empresa}.pipedrive.com/api/v2/...`) com paginação por cursor.
- Mapeamento de leads/deals/activities.
- Tabelas e RLS.

## Detalhes técnicos
- O endpoint `/v1/users/me` é global e aceita qualquer `api_token` válido — é o mesmo método usado pelo projeto antigo, então elimina o erro atual "Domínio não encontrado" causado por usuário digitando subdomínio errado.
- Se o token for inválido, retornamos a mesma mensagem amigável ("Token inválido — verifique em Pipedrive → Configurações pessoais → API").
