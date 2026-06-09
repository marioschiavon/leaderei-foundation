// Server-only Apollo.io HTTP client + helpers. Never imported from client code.
// Apollo docs: https://docs.apollo.io/reference/

import { createHash } from "crypto";
import type {
  ApolloPerson,
  ApolloSearchFilters,
  ApolloSearchResult,
} from "./apollo.types";

const BASE = "https://api.apollo.io/api/v1";
const TIMEOUT_MS = 15000;
const RATE_LIMIT_PER_MIN = 30;
const CACHE_TTL_HOURS = 24;

export type SupabaseLike = { from: (t: string) => any };

// ---------------------------------------------------------------------------
// Telemetry helpers
// ---------------------------------------------------------------------------

async function logCall(
  supabase: SupabaseLike,
  args: {
    organization_id: string;
    endpoint: string;
    status_code: number | null;
    credits_consumed: number | null;
    latency_ms: number;
    request_summary?: Record<string, unknown>;
    error?: string | null;
    triggered_by?: string | null;
  },
) {
  try {
    await supabase.from("apollo_api_calls").insert({
      organization_id: args.organization_id,
      endpoint: args.endpoint,
      status_code: args.status_code,
      credits_consumed: args.credits_consumed,
      latency_ms: args.latency_ms,
      request_summary: args.request_summary ?? {},
      error: args.error ?? null,
      triggered_by: args.triggered_by ?? null,
    });
  } catch {
    // never fatal
  }
}

async function checkRateLimit(supabase: SupabaseLike, organization_id: string) {
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await supabase
    .from("apollo_api_calls")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organization_id)
    .gte("created_at", since);
  if ((count ?? 0) >= RATE_LIMIT_PER_MIN) {
    throw new Error(
      `Limite local de ${RATE_LIMIT_PER_MIN} chamadas/min atingido. Aguarde alguns segundos.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Low-level HTTP
// ---------------------------------------------------------------------------

export type ApolloCallOptions = {
  endpoint: string;            // e.g. "auth/health", "mixed_people/search"
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
  apiKey: string;
  organization_id: string;
  triggered_by?: string | null;
  supabase: SupabaseLike;
  request_summary?: Record<string, unknown>;
  skipRateLimit?: boolean;
};

export async function callApollo<T = any>(opts: ApolloCallOptions): Promise<T> {
  if (!opts.skipRateLimit) {
    await checkRateLimit(opts.supabase, opts.organization_id);
  }

  const url = `${BASE}/${opts.endpoint}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const started = Date.now();

  let status: number | null = null;
  let creditsConsumed: number | null = null;
  let errorMsg: string | null = null;
  let parsed: any = null;

  try {
    const res = await fetch(url, {
      method: opts.method ?? "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": opts.apiKey,
      },
      body: opts.method === "GET" ? undefined : JSON.stringify(opts.body ?? {}),
      signal: ctrl.signal,
    });
    status = res.status;

    // Apollo sometimes returns credits info on response headers
    const credHeader =
      res.headers.get("x-credits-consumed") ??
      res.headers.get("x-credit-consumed");
    if (credHeader && !Number.isNaN(Number(credHeader))) {
      creditsConsumed = Number(credHeader);
    }

    const text = await res.text();
    parsed = text ? safeJson(text) : null;

    if (!res.ok) {
      const apiMsg =
        parsed?.error ??
        parsed?.message ??
        parsed?.errors?.[0]?.message ??
        text.slice(0, 200);
      errorMsg = `Apollo ${res.status}: ${apiMsg}`;
      throw new Error(humanizeApolloError(res.status, apiMsg));
    }

    return parsed as T;
  } catch (e: any) {
    if (!errorMsg) errorMsg = e?.message ?? String(e);
    throw e;
  } finally {
    clearTimeout(timer);
    await logCall(opts.supabase, {
      organization_id: opts.organization_id,
      endpoint: opts.endpoint,
      status_code: status,
      credits_consumed: creditsConsumed,
      latency_ms: Date.now() - started,
      request_summary: opts.request_summary,
      error: errorMsg,
      triggered_by: opts.triggered_by ?? null,
    });
  }
}

function safeJson(text: string): any {
  try { return JSON.parse(text); } catch { return null; }
}

function humanizeApolloError(status: number, msg: string): string {
  if (status === 401 || status === 403) {
    return "API key Apollo inválida ou sem permissão. Verifique em Apollo → Settings → API.";
  }
  if (status === 404) {
    return "Endpoint Apollo não encontrado (404). Pode ser uma versão de API desatualizada — avise o suporte.";
  }
  if (status === 422) return `Filtros inválidos: ${msg}`;
  if (status === 429) return "Apollo retornou 429 (rate limit). Aguarde alguns minutos.";
  if (status >= 500) return `Apollo está instável (${status}). Tente novamente em instantes.`;
  return msg || `Erro ${status} ao chamar Apollo.`;
}

// ---------------------------------------------------------------------------
// High-level endpoints
// ---------------------------------------------------------------------------

export async function validateApolloKey(args: {
  apiKey: string;
  organization_id: string;
  supabase: SupabaseLike;
  triggered_by?: string | null;
}): Promise<{ ok: true }> {
  await callApollo<any>({
    endpoint: "auth/health",
    method: "POST",
    body: { api_key: args.apiKey },
    apiKey: args.apiKey,
    organization_id: args.organization_id,
    supabase: args.supabase,
    triggered_by: args.triggered_by,
    skipRateLimit: true,
  });
  return { ok: true };
}

export function normalizeFilters(f: ApolloSearchFilters, page = 1) {
  const clean: Record<string, unknown> = {
    page,
    per_page: Math.min(Math.max(f.per_page ?? 25, 1), 100),
  };
  if (f.q_keywords?.trim()) clean.q_keywords = f.q_keywords.trim();
  if (f.person_titles?.length) clean.person_titles = f.person_titles;
  if (f.person_seniorities?.length) clean.person_seniorities = f.person_seniorities;
  if (f.person_locations?.length) clean.person_locations = f.person_locations;
  if (f.organization_locations?.length) clean.organization_locations = f.organization_locations;
  if (f.organization_industries?.length) clean.organization_industries = f.organization_industries;
  if (f.organization_num_employees_ranges?.length)
    clean.organization_num_employees_ranges = f.organization_num_employees_ranges;
  return clean;
}

export function hashFilters(filters: Record<string, unknown>): string {
  const sorted = JSON.stringify(filters, Object.keys(filters).sort());
  return createHash("sha256").update(sorted).digest("hex");
}

export async function searchPeopleWithCache(args: {
  supabase: SupabaseLike;
  organization_id: string;
  triggered_by?: string | null;
  apiKey: string;
  filters: ApolloSearchFilters;
  page: number;
}): Promise<ApolloSearchResult> {
  const normalized = normalizeFilters(args.filters, args.page);
  const filtersWithoutPage = { ...normalized };
  delete (filtersWithoutPage as any).page;
  const queryHash = hashFilters(filtersWithoutPage);
  const nowIso = new Date().toISOString();

  // 1) try cache
  const { data: cached } = await args.supabase
    .from("apollo_search_cache")
    .select("results, total_entries")
    .eq("organization_id", args.organization_id)
    .eq("query_hash", queryHash)
    .eq("page", args.page)
    .gt("expires_at", nowIso)
    .maybeSingle();

  if (cached?.results) {
    const people = (cached.results as any)?.people ?? [];
    const pagination = (cached.results as any)?.pagination ?? {
      page: args.page,
      per_page: normalized.per_page,
      total_entries: cached.total_entries ?? people.length,
      total_pages: 1,
    };
    return { people, pagination, fromCache: true };
  }

  // 2) call Apollo
  const data = await callApollo<{ people: ApolloPerson[]; pagination: any }>({
    endpoint: "mixed_people/search",
    method: "POST",
    body: normalized,
    apiKey: args.apiKey,
    organization_id: args.organization_id,
    supabase: args.supabase,
    triggered_by: args.triggered_by,
    request_summary: { filters: filtersWithoutPage, page: args.page },
  });

  const people = data?.people ?? [];
  const pagination = data?.pagination ?? {
    page: args.page,
    per_page: normalized.per_page,
    total_entries: people.length,
    total_pages: 1,
  };

  // 3) cache (best-effort)
  try {
    const expires = new Date(Date.now() + CACHE_TTL_HOURS * 3600_000).toISOString();
    await args.supabase
      .from("apollo_search_cache")
      .upsert(
        {
          organization_id: args.organization_id,
          query_hash: queryHash,
          filters: filtersWithoutPage,
          results: { people, pagination },
          total_entries: pagination?.total_entries ?? people.length,
          page: args.page,
          expires_at: expires,
        },
        { onConflict: "organization_id,query_hash,page" },
      );
  } catch {
    // ignore
  }

  return { people, pagination, fromCache: false };
}

// ---------------------------------------------------------------------------
// Apollo person → lead mapping
// ---------------------------------------------------------------------------

export function mapPersonToLeadPayload(
  p: ApolloPerson,
  organization_id: string,
): Record<string, any> {
  const fullName =
    (p.name && p.name.trim()) ||
    [p.first_name, p.last_name].filter(Boolean).join(" ").trim() ||
    p.email ||
    `Apollo #${p.id}`;
  const primaryPhone = p.phone_numbers?.[0]?.sanitized_number ?? p.phone_numbers?.[0]?.raw_number ?? null;
  const org = p.organization ?? null;

  return {
    organization_id,
    full_name: fullName,
    email: p.email ?? null,
    job_title: p.title ?? null,
    company_name: org?.name ?? null,
    website_url: org?.website_url ?? null,
    linkedin_url: p.linkedin_url ?? null,
    industry: org?.industry ?? null,
    employee_count: org?.estimated_num_employees ?? null,
    seniority: p.seniority ?? null,
    department: p.departments?.[0] ?? null,
    city: p.city ?? null,
    state: p.state ?? null,
    country: p.country ?? null,
    phone: primaryPhone,
    apollo_person_id: p.id,
    enrichment_data: { apollo: p },
  };
}

// Only fills missing fields; never overwrites existing values.
export function mergeLeadPatch(
  existing: Record<string, any>,
  incoming: Record<string, any>,
): Record<string, any> {
  const patch: Record<string, any> = {};
  for (const [k, v] of Object.entries(incoming)) {
    if (k === "organization_id" || k === "enrichment_data") continue;
    if (v == null || v === "") continue;
    const cur = existing?.[k];
    const empty =
      cur == null ||
      cur === "" ||
      (Array.isArray(cur) && cur.length === 0);
    if (empty) patch[k] = v;
  }
  // Always merge enrichment payload
  patch.enrichment_data = {
    ...(existing?.enrichment_data ?? {}),
    apollo: incoming.enrichment_data?.apollo ?? existing?.enrichment_data?.apollo,
  };
  if (incoming.apollo_person_id && !existing?.apollo_person_id) {
    patch.apollo_person_id = incoming.apollo_person_id;
  }
  return patch;
}
