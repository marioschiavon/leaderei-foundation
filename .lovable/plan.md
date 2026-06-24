## Problema

Ao salvar o site da empresa, o usuário não vê se a indexação está em andamento, deu certo ou falhou — só some o toast e fica "Não indexado ainda".

Fluxo atual:
- `saveOrgWebsiteUrl` salva o URL e dispara `fetchWebsiteContent` em background (fire-and-forget).
- O frontend invalida a query e o `getOrgKnowledgeBase` chama `fetchWebsiteContent` de novo (com timeout de 8s) — mas como é o mesmo background call, pode retornar `null` (sem distinguir "ainda processando" de "falhou").
- A UI só tem dois estados: tem `websiteCache.fetched_at` → ✅ preview; senão → "Não indexado ainda".

## Solução

Indexação síncrona explícita com feedback visual claro de 4 estados.

### Mudanças no backend (`src/lib/knowledge.functions.ts`)

1. Nova server fn `indexOrgWebsite` que:
   - Aguarda o scrape (até ~8s, o timeout já existente).
   - Retorna `{ ok: true, contentLength, preview, fetchedAt }` em sucesso.
   - Retorna `{ ok: false, error: "mensagem amigável" }` em falha (HTTP X, timeout, sem conteúdo, content-type inválido).

2. `saveOrgWebsiteUrl`: parar o fire-and-forget. Apenas salvar o URL. A indexação vira passo explícito.

3. `getOrgKnowledgeBase`: passar a ler o status persistido (ver passo 4) em vez de re-scrapear a cada load do dashboard (hoje toda visita à página re-busca o site).

### Mudança no scraper (`src/lib/website-scraper.server.ts`)

Adicionar variante `fetchWebsiteContentVerbose(url)` que retorna `{ content, error, fetchedAt, contentLength }` em vez de só `string | null`. Mantém `fetchWebsiteContent` como wrapper para compatibilidade.

### Persistência de status (migration)

Adicionar campos em `ai_org_profile` para guardar o resultado da última indexação:
- `website_indexed_at timestamptz` — quando concluiu com sucesso
- `website_index_status text` — `'success' | 'error' | 'pending'`
- `website_index_error text` — mensagem amigável quando falhou
- `website_content_length int` — tamanho do conteúdo indexado
- `website_preview text` — primeiros 200 chars (para mostrar no card)

`indexOrgWebsite` atualiza esses campos ao terminar.

### Mudança no frontend (`src/routes/_app.dashboard.knowledge.tsx`)

Card "Site da empresa" passa a ter 4 estados visuais:

1. **Sem URL** — input vazio, botão "Salvar".
2. **Indexando** (após salvar/reindexar):
   - Spinner + texto "Indexando o site…"
   - Barra de progresso animada com timer "{elapsed}s / ~8s"
   - Bloqueia o botão
3. **Sucesso**:
   - ✅ verde "Indexado em {data/hora relativa, ex: 'há 2 minutos'}"
   - Badge com `{contentLength} caracteres`
   - Preview italicizado
   - Botão "Reindexar agora" (chama `indexOrgWebsite` de novo)
4. **Falha**:
   - ⚠️ vermelho "Falha ao indexar: {motivo}" (ex: "Site retornou HTTP 403", "Tempo esgotado após 8s", "Conteúdo vazio")
   - Botão "Tentar novamente"

Fluxo de salvar: `saveOrgWebsiteUrl` → status local "indexando" + timer começa → `indexOrgWebsite` → invalida query → mostra resultado. O timer é puro client-side (setInterval de 100ms até a mutation terminar, com cap em ~10s).

## Arquivos afetados

- `supabase/migrations/<novo>.sql` — adicionar 5 colunas em `ai_org_profile`.
- `src/lib/website-scraper.server.ts` — adicionar `fetchWebsiteContentVerbose`.
- `src/lib/knowledge.functions.ts` — nova `indexOrgWebsite`, ajustar `saveOrgWebsiteUrl` e `getOrgKnowledgeBase`.
- `src/routes/_app.dashboard.knowledge.tsx` — substituir bloco do card "Site" pelos 4 estados + timer + botão reindexar.

## Fora de escopo

- Não muda destaques, instruções, base de conhecimento, nem outros cards.
- Não mexe em `knowledge_chunks` nem em embeddings.
- Não toca em RLS além de garantir que as novas colunas usam a política existente do `ai_org_profile`.
