import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getActiveOrgId(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Sem organização ativa.");
  return data.organization_id as string;
}

// ---------------------------------------------------------------------------
// Read current connection state
// ---------------------------------------------------------------------------

export const getCalcomConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const organization_id = await getActiveOrgId(supabase, userId);

    const { data: provider } = await supabase
      .from("integration_providers")
      .select("id")
      .eq("slug", "cal_com")
      .maybeSingle();
    if (!provider) {
      return {
        provider_id: null,
        connection: null,
        has_key: false,
        has_webhook_secret: false,
        webhook_secret: null as string | null,
        webhook_url: null,
        event_types_count: 0,
      };
    }

    const { data: conn } = await supabase
      .from("organization_integrations")
      .select("id, status, config, display_name, last_synced_at, last_error")
      .eq("organization_id", organization_id)
      .eq("provider_id", provider.id)
      .maybeSingle();

    if (!conn) {
      return {
        provider_id: provider.id,
        connection: null,
        has_key: false,
        has_webhook_secret: false,
        webhook_secret: null as string | null,
        webhook_url: webhookUrlFor(organization_id),
        event_types_count: 0,
      };
    }

    const { data: creds } = await supabase
      .from("integration_credentials")
      .select("key, value_encrypted")
      .eq("organization_id", organization_id)
      .eq("integration_id", conn.id);

    const hasKey = (creds ?? []).some((c) => c.key === "api_key" && !!c.value_encrypted);
    const secretRow = (creds ?? []).find((c) => c.key === "webhook_secret");
    const webhookSecret = (secretRow?.value_encrypted as string | null) ?? null;

    const { count } = await supabase
      .from("cal_event_types_cache")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization_id);

    return {
      provider_id: provider.id,
      connection: conn,
      has_key: hasKey,
      has_webhook_secret: !!webhookSecret,
      webhook_secret: webhookSecret,
      webhook_url: webhookUrlFor(organization_id),
      event_types_count: count ?? 0,
    };
  });

// ---------------------------------------------------------------------------
// Regenerate webhook secret
// ---------------------------------------------------------------------------

export const regenerateCalcomWebhookSecret = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const organization_id = await getActiveOrgId(supabase, userId);

    const { data: provider } = await supabase
      .from("integration_providers")
      .select("id")
      .eq("slug", "cal_com")
      .maybeSingle();
    if (!provider) throw new Error("Provider 'cal_com' não cadastrado.");

    const { data: conn } = await supabase
      .from("organization_integrations")
      .select("id")
      .eq("organization_id", organization_id)
      .eq("provider_id", provider.id)
      .maybeSingle();
    if (!conn) throw new Error("Cal.com não está conectado. Salve a API key antes.");

    const bytes = new Uint8Array(32);
    (globalThis.crypto as Crypto).getRandomValues(bytes);
    const secret = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");

    const { error } = await supabase.from("integration_credentials").upsert(
      {
        organization_id,
        integration_id: conn.id,
        key: "webhook_secret",
        value_encrypted: secret,
        metadata: {} as any,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "integration_id,key" },
    );
    if (error) throw new Error(error.message);

    return { ok: true, webhook_secret: secret };
  });

function webhookUrlFor(org: string): string {
  const base = process.env.PUBLIC_APP_URL
    || (process.env.VITE_PUBLIC_APP_URL as string | undefined)
    || "https://leaderei.lovable.app";
  return `${base.replace(/\/+$/, "")}/api/public/hooks/calcom?org=${org}`;
}

// ---------------------------------------------------------------------------
// Save connection (api key + generates webhook secret if missing)
// ---------------------------------------------------------------------------

const SaveSchema = z.object({
  api_key: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().min(10).max(400).optional(),
  ),
  default_event_type_id: z.number().int().positive().optional(),
});

export const saveCalcomConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SaveSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const organization_id = await getActiveOrgId(supabase, userId);

    // Validate key by hitting Cal.com /me
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    let res: Response;
    try {
      res = await fetch("https://api.cal.com/v2/me", {
        headers: {
          Authorization: `Bearer ${data.api_key}`,
          "cal-api-version": "2024-08-13",
          Accept: "application/json",
        },
        signal: ctrl.signal,
      });
    } catch (e: any) {
      clearTimeout(timer);
      throw new Error(`Falha ao contactar Cal.com: ${e?.message ?? e}`);
    }
    clearTimeout(timer);
    if (res.status === 401 || res.status === 403) {
      throw new Error("API key inválida — verifique no dashboard do Cal.com.");
    }
    if (!res.ok) throw new Error(`Cal.com retornou ${res.status}.`);

    const { data: provider, error: pErr } = await supabase
      .from("integration_providers")
      .select("id")
      .eq("slug", "cal_com")
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!provider) throw new Error("Provider 'cal_com' não cadastrado.");

    const { data: existing } = await supabase
      .from("organization_integrations")
      .select("id, config")
      .eq("organization_id", organization_id)
      .eq("provider_id", provider.id)
      .maybeSingle();

    const cfg: Record<string, unknown> = {
      ...((existing?.config ?? {}) as any),
      ...(data.default_event_type_id ? { default_event_type_id: data.default_event_type_id } : {}),
    };

    let integration_id: string;
    if (existing) {
      const { data: updated, error } = await supabase
        .from("organization_integrations")
        .update({
          status: "connected",
          config: cfg as any,
          display_name: "Cal.com",
          connected_by: userId,
          connected_at: new Date().toISOString(),
          last_synced_at: new Date().toISOString(),
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      integration_id = updated.id;
    } else {
      const { data: inserted, error } = await supabase
        .from("organization_integrations")
        .insert({
          organization_id,
          provider_id: provider.id,
          status: "connected",
          config: cfg as any,
          display_name: "Cal.com",
          connected_by: userId,
          connected_at: new Date().toISOString(),
          last_synced_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      integration_id = inserted.id;
    }

    // Upsert api_key
    const { error: credErr } = await supabase
      .from("integration_credentials")
      .upsert(
        {
          organization_id,
          integration_id,
          key: "api_key",
          value_encrypted: data.api_key,
          metadata: {} as any,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "integration_id,key" },
      );
    if (credErr) throw new Error(credErr.message);

    // Generate webhook secret if missing
    const { data: existingSecret } = await supabase
      .from("integration_credentials")
      .select("id")
      .eq("integration_id", integration_id)
      .eq("key", "webhook_secret")
      .maybeSingle();
    if (!existingSecret) {
      const bytes = new Uint8Array(32);
      (globalThis.crypto as Crypto).getRandomValues(bytes);
      const secret = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
      await supabase.from("integration_credentials").upsert(
        {
          organization_id,
          integration_id,
          key: "webhook_secret",
          value_encrypted: secret,
          metadata: {} as any,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "integration_id,key" },
      );
    }

    return { ok: true, integration_id };
  });

export const disconnectCalcom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const organization_id = await getActiveOrgId(supabase, userId);
    const { data: provider } = await supabase
      .from("integration_providers")
      .select("id")
      .eq("slug", "cal_com")
      .maybeSingle();
    if (!provider) return { ok: true };
    const { data: conn } = await supabase
      .from("organization_integrations")
      .select("id")
      .eq("organization_id", organization_id)
      .eq("provider_id", provider.id)
      .maybeSingle();
    if (!conn) return { ok: true };
    await supabase.from("integration_credentials").delete().eq("integration_id", conn.id);
    await supabase
      .from("organization_integrations")
      .update({ status: "disconnected", updated_at: new Date().toISOString() })
      .eq("id", conn.id);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Test webhook signature end-to-end
// ---------------------------------------------------------------------------

export const testCalcomWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const organization_id = await getActiveOrgId(supabase, userId);

    const { loadCalcomConnection } = await import("./calcom.server");
    const conn = await loadCalcomConnection(organization_id);
    if (!conn) throw new Error("Cal.com não está conectado.");
    if (!conn.webhook_secret) throw new Error("Webhook secret ausente. Gere um secret antes.");

    const base = process.env.PUBLIC_APP_URL
      || (process.env.VITE_PUBLIC_APP_URL as string | undefined)
      || "https://leaderei.lovable.app";
    const url = `${base.replace(/\/+$/, "")}/api/public/hooks/calcom?org=${organization_id}`;

    // Synthetic payload — uses an unknown trigger so the handler ack's but does NOT
    // touch lead_bookings / leads / enrollments.
    const payload = {
      triggerEvent: "LEADEREI_PING",
      createdAt: new Date().toISOString(),
      payload: { test: true, organization_id },
    };
    const rawBody = JSON.stringify(payload);

    const { createHmac } = await import("node:crypto");
    const signature = createHmac("sha256", conn.webhook_secret).update(rawBody, "utf8").digest("hex");

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    let res: Response;
    let bodyText = "";
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Cal-Signature-256": signature,
        },
        body: rawBody,
        signal: ctrl.signal,
      });
      bodyText = await res.text();
    } catch (e: any) {
      clearTimeout(timer);
      throw new Error(`Falha ao contactar o webhook: ${e?.message ?? e}`);
    }
    clearTimeout(timer);

    if (res.status === 401) {
      throw new Error("Assinatura rejeitada (401). Confirme que o secret colado no Cal.com é o mesmo exibido aqui.");
    }
    if (!res.ok) {
      throw new Error(`Webhook respondeu ${res.status}: ${bodyText.slice(0, 200)}`);
    }

    return { ok: true, url, status: res.status };
  });

// ---------------------------------------------------------------------------
// Sync event types (calls Cal.com and upserts cache)
// ---------------------------------------------------------------------------

export const syncCalcomEventTypes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const organization_id = await getActiveOrgId(supabase, userId);

    const { loadCalcomConnection, calcomFetch } = await import("./calcom.server");
    const conn = await loadCalcomConnection(organization_id);
    if (!conn) throw new Error("Cal.com não está conectado.");

    const res = await calcomFetch(conn, "/event-types", { method: "GET" });
    // v2: { status, data: { eventTypeGroups: [{ eventTypes: [...] }] } } OR { data: [...] }
    const eventTypes: any[] = [];
    const data = res?.data ?? res;
    if (Array.isArray(data?.eventTypeGroups)) {
      for (const g of data.eventTypeGroups) {
        for (const et of g.eventTypes ?? []) eventTypes.push(et);
      }
    } else if (Array.isArray(data)) {
      for (const et of data) eventTypes.push(et);
    } else if (Array.isArray(data?.eventTypes)) {
      for (const et of data.eventTypes) eventTypes.push(et);
    }

    if (eventTypes.length === 0) {
      return { ok: true, count: 0 };
    }

    const rows = eventTypes.map((et: any) => ({
      organization_id,
      cal_event_type_id: Number(et.id),
      slug: String(et.slug ?? et.title ?? et.id),
      title: String(et.title ?? et.slug ?? `Evento ${et.id}`),
      length_minutes: Number(et.length ?? et.lengthInMinutes ?? 30),
      scheduling_type: et.schedulingType ?? null,
      synced_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("cal_event_types_cache")
      .upsert(rows, { onConflict: "organization_id,cal_event_type_id" });
    if (error) throw new Error(error.message);

    // Update integration last_synced_at
    const { data: provider } = await supabase
      .from("integration_providers")
      .select("id")
      .eq("slug", "cal_com")
      .maybeSingle();
    if (provider) {
      await supabase
        .from("organization_integrations")
        .update({ last_synced_at: new Date().toISOString(), last_error: null })
        .eq("organization_id", organization_id)
        .eq("provider_id", provider.id);
    }

    void userId;
    return { ok: true, count: rows.length };
  });

export const listCalcomEventTypes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const organization_id = await getActiveOrgId(supabase, userId);
    const { data, error } = await supabase
      .from("cal_event_types_cache")
      .select("cal_event_type_id, slug, title, length_minutes, scheduling_type, synced_at")
      .eq("organization_id", organization_id)
      .order("title", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ---------------------------------------------------------------------------
// Lead bookings — list per lead/campaign
// ---------------------------------------------------------------------------

const ListBookingsSchema = z.object({
  lead_id: z.string().uuid().optional(),
  campaign_id: z.string().uuid().optional(),
  status: z.enum(["confirmed", "rescheduled", "cancelled", "no_show"]).optional(),
});

export const listLeadBookings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ListBookingsSchema.parse(i ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const organization_id = await getActiveOrgId(supabase, userId);
    let q = supabase
      .from("lead_bookings")
      .select(
        "id, lead_id, campaign_id, cal_booking_uid, event_type_slug, title, start_at, end_at, meeting_url, status, reschedule_count, cancellation_reason, attendee_email, attendee_name, created_at, updated_at",
      )
      .eq("organization_id", organization_id)
      .order("start_at", { ascending: false })
      .limit(200);
    if (data.lead_id) q = q.eq("lead_id", data.lead_id);
    if (data.campaign_id) q = q.eq("campaign_id", data.campaign_id);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ---------------------------------------------------------------------------
// Manual cancel/reschedule (from lead drawer)
// ---------------------------------------------------------------------------

export const cancelLeadBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      booking_id: z.string().uuid(),
      reason: z.string().max(300).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const organization_id = await getActiveOrgId(supabase, userId);
    const { data: booking, error } = await supabase
      .from("lead_bookings")
      .select("id, cal_booking_uid, status")
      .eq("id", data.booking_id)
      .eq("organization_id", organization_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!booking) throw new Error("Agendamento não encontrado.");
    if (booking.status === "cancelled") throw new Error("Já cancelado.");

    const { loadCalcomConnection, cancelBookingViaApi } = await import("./calcom.server");
    const conn = await loadCalcomConnection(organization_id);
    if (!conn) throw new Error("Cal.com não está conectado.");

    await cancelBookingViaApi(conn, booking.cal_booking_uid, data.reason);
    // Webhook will update the row; we also optimistically update.
    await supabase
      .from("lead_bookings")
      .update({
        status: "cancelled",
        cancellation_reason: data.reason ?? "Cancelado manualmente",
        updated_at: new Date().toISOString(),
      })
      .eq("id", booking.id);

    return { ok: true };
  });
