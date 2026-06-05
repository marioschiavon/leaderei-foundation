// Server-only Pipedrive helpers. Never imported from client code.
// API v2 docs: https://developers.pipedrive.com/docs/api/v1/

const PER_PAGE = 500;
const ENTITY_HARD_LIMIT = 5000;
const RATE_LIMIT_DELAY_MS = 250;

export type PipedriveCredentials = {
  api_token: string;
  company_domain: string; // normalized: "{slug}.pipedrive.com"
};

export type EntityStats = {
  created: number;
  updated: number;
  skipped: number;
  fetched: number;
  error?: string;
};

export type SyncStats = {
  organizations: EntityStats;
  persons: EntityStats;
  deals: EntityStats;
  activities: EntityStats;
};

export type SyncCursors = {
  persons_updated_since?: string | null;
  deals_updated_since?: string | null;
  activities_updated_since?: string | null;
};

const emptyStats = (): EntityStats => ({ created: 0, updated: 0, skipped: 0, fetched: 0 });

export function emptySyncStats(): SyncStats {
  return {
    organizations: emptyStats(),
    persons: emptyStats(),
    deals: emptyStats(),
    activities: emptyStats(),
  };
}

// ---------------------------------------------------------------------------
// Domain normalization & token validation
// ---------------------------------------------------------------------------

export function normalizeCompanyDomain(input: string): string {
  let v = input.trim().toLowerCase();
  v = v.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!v) throw new Error("Informe o domínio da empresa no Pipedrive.");
  if (!/^[a-z0-9-]+\.pipedrive\.com(\.br)?$/.test(v)) {
    if (/^[a-z0-9-]+$/.test(v)) v = `${v}.pipedrive.com`;
    else throw new Error("Domínio inválido. Use o formato suaempresa.pipedrive.com");
  }
  return v;
}

export async function validatePipedriveToken(creds: PipedriveCredentials): Promise<{ user_id: number; name: string }> {
  const url = `https://${creds.company_domain}/api/v2/users/me?api_token=${encodeURIComponent(creds.api_token)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  let res: Response;
  try {
    res = await fetch(url, { signal: ctrl.signal });
  } catch (e: any) {
    clearTimeout(timer);
    throw new Error(`Falha ao contactar Pipedrive: verifique o domínio. (${e?.message ?? e})`);
  }
  clearTimeout(timer);
  if (res.status === 401 || res.status === 403) {
    throw new Error("Token inválido — verifique em Pipedrive → Configurações pessoais → API.");
  }
  if (res.status === 404) {
    throw new Error("Domínio não encontrado. Confira o subdomínio da sua empresa no Pipedrive.");
  }
  if (!res.ok) throw new Error(`Pipedrive retornou ${res.status}.`);
  const body = (await res.json()) as any;
  const data = body?.data ?? {};
  return { user_id: data.id, name: data.name ?? "" };
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchPaginated<T>(
  creds: PipedriveCredentials,
  resource: "organizations" | "persons" | "deals" | "activities",
  updatedSince: string | null | undefined,
): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | null = null;
  let pages = 0;
  while (out.length < ENTITY_HARD_LIMIT && pages < 50) {
    const params = new URLSearchParams();
    params.set("api_token", creds.api_token);
    params.set("limit", String(PER_PAGE));
    if (cursor) params.set("cursor", cursor);
    if (updatedSince) params.set("updated_since", updatedSince);
    const url = `https://${creds.company_domain}/api/v2/${resource}?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Pipedrive ${resource} ${res.status}: ${text.slice(0, 200)}`);
    }
    const body = (await res.json()) as any;
    const items = (body?.data ?? []) as T[];
    out.push(...items);
    cursor = body?.additional_data?.next_cursor ?? null;
    pages += 1;
    if (!cursor) break;
    await sleep(RATE_LIMIT_DELAY_MS);
  }
  return out.slice(0, ENTITY_HARD_LIMIT);
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

const STAGE_MAP: Record<string, "lead" | "qualified" | "proposal" | "negotiation" | "won" | "lost"> = {
  lead: "lead",
  new: "lead",
  qualified: "qualified",
  qualification: "qualified",
  proposal: "proposal",
  proposal_made: "proposal",
  negotiation: "negotiation",
  negotiations_started: "negotiation",
  won: "won",
  closed_won: "won",
  lost: "lost",
  closed_lost: "lost",
};

function mapStage(name?: string | null): "lead" | "qualified" | "proposal" | "negotiation" | "won" | "lost" {
  if (!name) return "lead";
  return STAGE_MAP[name.toLowerCase().replace(/\s+/g, "_")] ?? "lead";
}

const ACTIVITY_TYPE_MAP: Record<string, "call" | "meeting" | "note" | "email_sent"> = {
  call: "call",
  meeting: "meeting",
  email: "email_sent",
  lunch: "meeting",
  task: "note",
  deadline: "note",
};

function mapActivityType(t?: string | null): "call" | "meeting" | "note" | "email_sent" {
  if (!t) return "note";
  return ACTIVITY_TYPE_MAP[t.toLowerCase()] ?? "note";
}

function firstValue(arr: any): string | null {
  if (!Array.isArray(arr)) return null;
  const primary = arr.find((x) => x?.primary) ?? arr[0];
  return primary?.value ?? null;
}

function restValues(arr: any): string | null {
  if (!Array.isArray(arr) || arr.length < 2) return null;
  const primaryIdx = arr.findIndex((x) => x?.primary);
  const rest = arr.filter((_, i) => i !== (primaryIdx === -1 ? 0 : primaryIdx));
  const vals = rest.map((x) => x?.value).filter(Boolean);
  return vals.length ? vals.join(", ") : null;
}

// ---------------------------------------------------------------------------
// Sync orchestrator
// ---------------------------------------------------------------------------

export type SupabaseClient = {
  from: (t: string) => any;
};

export async function runPipedriveSync(args: {
  supabase: SupabaseClient;
  organizationId: string;
  credentials: PipedriveCredentials;
  cursors: SyncCursors;
}): Promise<{ stats: SyncStats; newCursors: SyncCursors; status: "success" | "partial" | "failed"; error?: string }> {
  const { supabase, organizationId, credentials, cursors } = args;
  const stats = emptySyncStats();
  const newCursors: SyncCursors = { ...cursors };
  let anyError = false;

  // Ensure a lead_source for Pipedrive exists.
  let sourceId: string | null = null;
  try {
    const { data: existing } = await supabase
      .from("lead_sources")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("slug", "pipedrive")
      .maybeSingle();
    if (existing?.id) {
      sourceId = existing.id;
    } else {
      const { data: created } = await supabase
        .from("lead_sources")
        .insert({
          organization_id: organizationId,
          name: "Pipedrive",
          slug: "pipedrive",
          color: "#1A1A1A",
          description: "Importado via integração Pipedrive",
        })
        .select("id")
        .single();
      sourceId = created?.id ?? null;
    }
  } catch {
    // Non-fatal — leads can be created without source.
  }

  // 1) Organizations — cached in-memory
  const orgCache = new Map<number, any>();
  try {
    const orgs = await fetchPaginated<any>(credentials, "organizations", cursors.persons_updated_since ?? null);
    stats.organizations.fetched = orgs.length;
    for (const o of orgs) {
      if (o?.id) orgCache.set(o.id, o);
    }
    stats.organizations.skipped = orgs.length; // cached only
  } catch (e: any) {
    stats.organizations.error = e?.message ?? String(e);
    anyError = true;
  }

  // 2) Persons → leads
  try {
    const persons = await fetchPaginated<any>(credentials, "persons", cursors.persons_updated_since ?? null);
    stats.persons.fetched = persons.length;
    let maxUpdate = cursors.persons_updated_since ?? null;

    for (const p of persons) {
      if (p?.update_time && (!maxUpdate || p.update_time > maxUpdate)) maxUpdate = p.update_time;
      const fullName = (p?.name ?? "").trim();
      const email = firstValue(p?.emails) ?? firstValue(p?.email);
      const phone = firstValue(p?.phones) ?? firstValue(p?.phone);
      const secondaryEmail = restValues(p?.emails) ?? restValues(p?.email);
      const mobilePhone = restValues(p?.phones) ?? restValues(p?.phone);

      if (!fullName && !email && !phone) {
        stats.persons.skipped += 1;
        continue;
      }

      const org = p?.org_id ? orgCache.get(typeof p.org_id === "object" ? p.org_id.value : p.org_id) : null;
      const companyName = org?.name ?? (typeof p?.org_id === "object" ? p?.org_id?.name : null) ?? null;

      // Existing by pipedrive_person_id
      const { data: existingByPd } = await supabase
        .from("leads")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("pipedrive_person_id", p.id)
        .maybeSingle();

      const payload: Record<string, any> = {
        organization_id: organizationId,
        full_name: fullName || email || phone || `Pipedrive #${p.id}`,
        email: email ?? null,
        secondary_email: secondaryEmail,
        phone: phone ?? null,
        mobile_phone: mobilePhone,
        company_name: companyName,
        pipedrive_person_id: p.id,
        custom_fields: { pipedrive: p?.custom_fields ?? {} },
        enrichment_data: org ? { pipedrive_org: org } : undefined,
      };
      if (sourceId) payload.source_id = sourceId;

      if (existingByPd?.id) {
        await supabase.from("leads").update(payload).eq("id", existingByPd.id);
        stats.persons.updated += 1;
        continue;
      }

      // Fallback dedup: same email in org without pipedrive id
      if (email) {
        const { data: existingByEmail } = await supabase
          .from("leads")
          .select("id")
          .eq("organization_id", organizationId)
          .ilike("email", email)
          .is("pipedrive_person_id", null)
          .maybeSingle();
        if (existingByEmail?.id) {
          await supabase.from("leads").update(payload).eq("id", existingByEmail.id);
          stats.persons.updated += 1;
          continue;
        }
      }

      const { error: insErr } = await supabase.from("leads").insert(payload);
      if (insErr) {
        stats.persons.skipped += 1;
      } else {
        stats.persons.created += 1;
      }
    }
    newCursors.persons_updated_since = maxUpdate;
  } catch (e: any) {
    stats.persons.error = e?.message ?? String(e);
    anyError = true;
  }

  // Build person_id → lead_id map for deals & activities
  const personLeadMap = new Map<number, string>();
  try {
    const { data: rows } = await supabase
      .from("leads")
      .select("id, pipedrive_person_id")
      .eq("organization_id", organizationId)
      .not("pipedrive_person_id", "is", null);
    for (const r of rows ?? []) personLeadMap.set(r.pipedrive_person_id, r.id);
  } catch {
    // ignore
  }

  // 3) Deals
  try {
    const deals = await fetchPaginated<any>(credentials, "deals", cursors.deals_updated_since ?? null);
    stats.deals.fetched = deals.length;
    let maxUpdate = cursors.deals_updated_since ?? null;

    for (const d of deals) {
      if (d?.update_time && (!maxUpdate || d.update_time > maxUpdate)) maxUpdate = d.update_time;
      const personId = typeof d?.person_id === "object" ? d?.person_id?.value : d?.person_id;
      const leadId = personId ? personLeadMap.get(personId) ?? null : null;

      const status = d?.status === "won" ? "won" : d?.status === "lost" ? "lost" : "open";
      const stage = mapStage(d?.stage_name ?? d?.stage?.name ?? null);

      const payload: Record<string, any> = {
        organization_id: organizationId,
        lead_id: leadId,
        title: d?.title ?? `Pipedrive deal #${d.id}`,
        stage,
        status,
        value: Number(d?.value ?? 0) || 0,
        currency: d?.currency ?? "BRL",
        probability: Math.round(Number(d?.probability ?? 0)) || 0,
        expected_close_at: d?.expected_close_date ?? null,
        closed_at: d?.close_time ?? null,
        notes: d?.notes ?? null,
        pipedrive_deal_id: d.id,
      };

      const { data: existing } = await supabase
        .from("deals")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("pipedrive_deal_id", d.id)
        .maybeSingle();

      if (existing?.id) {
        await supabase.from("deals").update(payload).eq("id", existing.id);
        stats.deals.updated += 1;
      } else {
        const { error: insErr } = await supabase.from("deals").insert(payload);
        if (insErr) stats.deals.skipped += 1;
        else stats.deals.created += 1;
      }
    }
    newCursors.deals_updated_since = maxUpdate;
  } catch (e: any) {
    stats.deals.error = e?.message ?? String(e);
    anyError = true;
  }

  // 4) Activities → lead_activities (only those linked to a lead)
  try {
    const activities = await fetchPaginated<any>(credentials, "activities", cursors.activities_updated_since ?? null);
    stats.activities.fetched = activities.length;
    let maxUpdate = cursors.activities_updated_since ?? null;

    for (const a of activities) {
      if (a?.update_time && (!maxUpdate || a.update_time > maxUpdate)) maxUpdate = a.update_time;
      const personId = typeof a?.person_id === "object" ? a?.person_id?.value : a?.person_id;
      const leadId = personId ? personLeadMap.get(personId) ?? null : null;
      if (!leadId) {
        stats.activities.skipped += 1;
        continue;
      }

      const payload: Record<string, any> = {
        organization_id: organizationId,
        lead_id: leadId,
        type: mapActivityType(a?.type ?? null),
        title: a?.subject ?? "Atividade Pipedrive",
        description: a?.note ?? a?.public_description ?? null,
        payload: { pipedrive: a },
        pipedrive_activity_id: a.id,
      };

      const { data: existing } = await supabase
        .from("lead_activities")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("pipedrive_activity_id", a.id)
        .maybeSingle();

      if (existing?.id) {
        await supabase.from("lead_activities").update(payload).eq("id", existing.id);
        stats.activities.updated += 1;
      } else {
        const { error: insErr } = await supabase.from("lead_activities").insert(payload);
        if (insErr) stats.activities.skipped += 1;
        else stats.activities.created += 1;
      }
    }
    newCursors.activities_updated_since = maxUpdate;
  } catch (e: any) {
    stats.activities.error = e?.message ?? String(e);
    anyError = true;
  }

  const status: "success" | "partial" | "failed" = anyError ? "partial" : "success";
  return { stats, newCursors, status };
}
