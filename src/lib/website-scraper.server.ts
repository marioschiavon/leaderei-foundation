// Server-only website content scraper via Jina AI Reader (free, no API key).
// Never imported from client code. Always returns string|null — never throws.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const JINA_BASE = "https://r.jina.ai/";
const MAX_CONTENT_CHARS = 2000;
const TIMEOUT_MS = 8000;

/**
 * Normaliza a URL para usar como chave de cache e no Jina.
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

/**
 * Retorna conteúdo do site em markdown limpo, truncado em MAX_CONTENT_CHARS.
 * Usa cache de 7 dias. Retorna null em caso de falha (nunca lança exceção).
 */
export async function fetchWebsiteContent(
  websiteUrl: string | null | undefined,
): Promise<string | null> {
  if (!websiteUrl?.trim()) return null;
  const url = normalizeUrl(websiteUrl);
  if (!url) return null;

  // 1. Verificar cache
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

  // 2. Scraping via Jina
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(`${JINA_BASE}${url}`, {
      headers: {
        Accept: "text/markdown",
        "X-Return-Format": "markdown",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[scraper] Jina retornou ${res.status} para ${url}`);
      return null;
    }

    const raw = await res.text();
    if (!raw?.trim()) return null;

    const content = raw
      .replace(/!\[.*?\]\(.*?\)/g, "")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
      .replace(/#{1,6}\s/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, MAX_CONTENT_CHARS);

    if (!content) return null;

    // 3. Salvar no cache (upsert)
    try {
      await supabaseAdmin
        .from("lead_website_cache")
        .upsert(
          {
            url,
            content,
            content_length: content.length,
            scraped_at: new Date().toISOString(),
          },
          { onConflict: "url" },
        );
    } catch (err: any) {
      console.warn(`[scraper] erro ao gravar cache de ${url}:`, err?.message ?? err);
    }

    return content;
  } catch (err: any) {
    console.warn(`[scraper] erro ao scraping ${url}:`, err?.message ?? err);
    return null;
  }
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
