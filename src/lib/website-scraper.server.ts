// Server-only website content scraper via native fetch + HTML strip.
// Free, no third-party dependency. Never imported from client code.
// Always returns string|null — never throws.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const MAX_CONTENT_CHARS = 2000;
const MAX_HTML_BYTES = 500_000;
const TIMEOUT_MS = 8000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; LeadereiBot/1.0; +https://leaderei.com.br)";

/**
 * Normaliza a URL para usar como chave de cache.
 * Remove trailing slash, garante https://, lowercase do host.
 */
function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return `${u.protocol}//${u.hostname.toLowerCase()}${u.pathname}`.replace(/\/$/, "");
  } catch {
    return null;
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => {
      try { return String.fromCodePoint(Number(n)); } catch { return ""; }
    });
}

function extractMeta(html: string, attr: "name" | "property", value: string): string | null {
  const re = new RegExp(
    `<meta[^>]+${attr}\\s*=\\s*["']${value}["'][^>]*content\\s*=\\s*["']([^"']+)["']`,
    "i",
  );
  const m = html.match(re);
  if (m?.[1]) return decodeEntities(m[1]).trim();
  // tenta ordem invertida (content antes de name/property)
  const re2 = new RegExp(
    `<meta[^>]+content\\s*=\\s*["']([^"']+)["'][^>]*${attr}\\s*=\\s*["']${value}["']`,
    "i",
  );
  const m2 = html.match(re2);
  return m2?.[1] ? decodeEntities(m2[1]).trim() : null;
}

function htmlToText(html: string): { title: string | null; description: string | null; body: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch?.[1] ? decodeEntities(titleMatch[1]).replace(/\s+/g, " ").trim() : null;

  const description =
    extractMeta(html, "name", "description") ??
    extractMeta(html, "property", "og:description");

  // Remove blocos não-conteúdo
  let body = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<head[\s\S]*?<\/head>/gi, " ");

  // Strip de todas as tags restantes
  body = body.replace(/<[^>]+>/g, " ");
  body = decodeEntities(body);
  body = body.replace(/[ \t\f\v]+/g, " ").replace(/\n\s*\n\s*\n+/g, "\n\n").trim();

  return { title, description, body };
}

export type ScrapeResult = {
  content: string | null;
  error: string | null;
  fetchedAt: string;
  contentLength: number;
};

export async function fetchWebsiteContentVerbose(
  websiteUrl: string | null | undefined,
): Promise<ScrapeResult> {
  const fetchedAt = new Date().toISOString();
  if (!websiteUrl?.trim()) return { content: null, error: "URL vazia.", fetchedAt, contentLength: 0 };
  const url = normalizeUrl(websiteUrl);
  if (!url) return { content: null, error: "URL inválida.", fetchedAt, contentLength: 0 };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        },
        redirect: "follow",
        signal: controller.signal,
      });
    } catch (e: any) {
      clearTimeout(timeout);
      const msg = e?.name === "AbortError"
        ? `Tempo esgotado após ${TIMEOUT_MS / 1000}s.`
        : `Falha de rede: ${e?.message ?? "desconhecida"}.`;
      return { content: null, error: msg, fetchedAt, contentLength: 0 };
    }
    clearTimeout(timeout);

    if (!res.ok) {
      return { content: null, error: `Site retornou HTTP ${res.status}.`, fetchedAt, contentLength: 0 };
    }
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.toLowerCase().includes("text/html")) {
      return { content: null, error: `Tipo de conteúdo não suportado (${ct || "desconhecido"}).`, fetchedAt, contentLength: 0 };
    }

    const buf = await res.arrayBuffer();
    const slice = buf.byteLength > MAX_HTML_BYTES ? buf.slice(0, MAX_HTML_BYTES) : buf;
    const html = new TextDecoder("utf-8", { fatal: false }).decode(slice);
    if (!html?.trim()) return { content: null, error: "Página vazia.", fetchedAt, contentLength: 0 };

    const { title, description, body } = htmlToText(html);
    const parts: string[] = [];
    if (title) parts.push(`Title: ${title}`);
    if (description) parts.push(`Description: ${description}`);
    if (body) parts.push(body);
    const content = parts.join("\n\n").slice(0, MAX_CONTENT_CHARS).trim();

    if (!content) return { content: null, error: "Não foi possível extrair texto da página.", fetchedAt, contentLength: 0 };

    // Cache opcional (best-effort)
    try {
      await supabaseAdmin
        .from("lead_website_cache")
        .upsert(
          { url, content, content_length: content.length, scraped_at: fetchedAt },
          { onConflict: "url" },
        );
    } catch (err: any) {
      console.warn(`[scraper] erro ao gravar cache de ${url}:`, err?.message ?? err);
    }

    return { content, error: null, fetchedAt, contentLength: content.length };
  } catch (err: any) {
    return { content: null, error: `Erro inesperado: ${err?.message ?? "desconhecido"}.`, fetchedAt, contentLength: 0 };
  }
}

/**
 * Retorna conteúdo do site em texto limpo, truncado em MAX_CONTENT_CHARS.
 * Usa cache de 7 dias. Retorna null em caso de falha (nunca lança exceção).
 */
export async function fetchWebsiteContent(
  websiteUrl: string | null | undefined,
): Promise<string | null> {
  if (!websiteUrl?.trim()) return null;
  const url = normalizeUrl(websiteUrl);
  if (!url) return null;

  // Verificar cache primeiro
  try {
    const { data: cached } = await supabaseAdmin
      .from("lead_website_cache")
      .select("content, expires_at")
      .eq("url", url)
      .maybeSingle();
    if (cached && new Date(cached.expires_at) > new Date()) {
      return cached.content;
    }
  } catch (err: any) {
    console.warn(`[scraper] erro ao ler cache de ${url}:`, err?.message ?? err);
  }

  const r = await fetchWebsiteContentVerbose(websiteUrl);
  return r.content;
}


/**
 * Limpa entradas expiradas do cache (pode ser chamado periodicamente).
 */
export async function purgeExpiredCache(): Promise<number> {
  try {
    const { count } = await supabaseAdmin
      .from("lead_website_cache")
      .delete({ count: "exact" })
      .lt("expires_at", new Date().toISOString());
    return count ?? 0;
  } catch {
    return 0;
  }
}
