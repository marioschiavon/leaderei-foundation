# Plano: trocar Jina por fetch nativo no scraper de site do lead

## Objetivo
Eliminar a dependência do Jina AI Reader (instável em Cloudflare Workers sem API key) e reescrever `fetchWebsiteContent` usando `fetch()` nativo + extração simples de HTML. Mantém a mesma assinatura, mesmo cache (`lead_website_cache`), mesmo limite de 2000 chars — nada mais muda.

## Mudanças

### 1. `src/lib/website-scraper.server.ts` — reescrever
- Remover toda referência a Jina (`JINA_BASE`, header `X-Return-Format`, prefixo `r.jina.ai`).
- Manter `normalizeUrl()`, cache de leitura/escrita e `purgeExpiredCache()` como estão hoje.
- Novo fluxo de scraping:
  1. `fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadereiBot/1.0; +https://leaderei.com.br)', Accept: 'text/html' }, signal: AbortSignal.timeout(8000), redirect: 'follow' })`.
  2. Se `!res.ok` ou `content-type` não começar com `text/html` → `console.warn` + `return null` (sem cachear).
  3. Ler corpo como texto, limitar leitura inicial a ~500KB para evitar páginas gigantes.
  4. Extrair conteúdo via regex puro (sem libs externas — Workers não roda cheerio/jsdom de forma confiável):
     - `<title>...</title>`
     - `<meta name="description" content="...">` e `<meta property="og:description" content="...">`
     - Remover blocos `<script>...</script>`, `<style>...</style>`, `<noscript>...</noscript>`, comentários `<!-- -->`.
     - Strip de todas as tags restantes → texto puro.
     - Colapsar whitespace (`\s+` → ` `, `\n{3,}` → `\n\n`), decodificar entidades HTML básicas (`&amp; &lt; &gt; &quot; &#39; &nbsp;`).
  5. Montar saída como `Title: ...\n\nDescription: ...\n\n<corpo>`, truncar em **2000 chars**.
  6. Se texto final estiver vazio → `return null` (sem cachear).
  7. Caso contrário, upsert em `lead_website_cache` (mesma lógica de hoje) e retornar.
- Logs `console.warn` mantêm prefixo `[scraper]` para grep.

### 2. Comentários e docs
- `src/lib/website-scraper.server.ts`: trocar comentário de cabeçalho para "Server-only website content scraper via native fetch + HTML strip. Free, no third-party dependency."
- `escopo-leaderei.md`: substituir 3 menções a Jina (linhas 769, 784, 953) por "fetch nativo + extração de HTML".

## Fora do escopo
- Não mexer em `ai-prompt-builder.server.ts`, `conversation-agent.server.ts`, `flow-executor.server.ts`, `builder.functions.ts` — todos já consomem `fetchWebsiteContent` por assinatura estável.
- Não mexer no schema da tabela `lead_website_cache` — colunas e cache de 7 dias permanecem iguais.
- Não adicionar fallback Firecrawl agora (pode entrar numa rodada futura).
- Não adicionar negative-cache nesta rodada (era para a versão com Jina + API key).

## Limitação conhecida
Sites 100% client-side (React/Vue sem SSR) e sites com forte proteção anti-bot (Cloudflare Bot Fight, Akamai) vão retornar HTML vazio ou bloqueio — `fetchWebsiteContent` devolve `null` silenciosamente, como hoje. Cobre ~80% dos sites institucionais B2B típicos.
