// Server-only helpers for Cal.com integration. Never import in client code.
import { createHmac, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CAL_API_BASE = "https://api.cal.com/v2";
const CAL_API_VERSION = "2024-08-13";

export type CalConn = {
  organization_id: string;
  integration_id: string;
  api_key: string;
  webhook_secret: string | null;
  default_event_type_id: number | null;
};

export async function getCalcomProviderId(): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("integration_providers")
    .select("id")
    .eq("slug", "cal_com")
    .maybeSingle();
  return data?.id ?? null;
}

export async function loadCalcomConnection(
  organization_id: string,
): Promise<CalConn | null> {
  const providerId = await getCalcomProviderId();
  if (!providerId) return null;

  const { data: conn } = await supabaseAdmin
    .from("organization_integrations")
    .select("id, config, status")
    .eq("organization_id", organization_id)
    .eq("provider_id", providerId)
    .maybeSingle();
  if (!conn) return null;

  const { data: creds } = await supabaseAdmin
    .from("integration_credentials")
    .select("key, value_encrypted")
    .eq("organization_id", organization_id)
    .eq("integration_id", conn.id);

  const apiKey = (creds ?? []).find((c) => c.key === "api_key")?.value_encrypted ?? "";
  const secret = (creds ?? []).find((c) => c.key === "webhook_secret")?.value_encrypted ?? null;
  if (!apiKey) return null;

  const cfg = (conn.config ?? {}) as { default_event_type_id?: number };
  return {
    organization_id,
    integration_id: conn.id,
    api_key: apiKey,
    webhook_secret: secret,
    default_event_type_id: cfg.default_event_type_id ?? null,
  };
}

export async function calcomFetch(
  conn: CalConn,
  path: string,
  init: RequestInit & { apiVersion?: string } = {},
): Promise<any> {
  const url = path.startsWith("http") ? path : `${CAL_API_BASE}${path}`;
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${conn.api_key}`);
  headers.set("cal-api-version", init.apiVersion ?? CAL_API_VERSION);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* not json */ }
  if (!res.ok) {
    const msg = json?.error?.message || json?.message || text || `Cal.com ${res.status}`;
    throw new Error(`Cal.com [${res.status}]: ${String(msg).slice(0, 300)}`);
  }
  return json;
}

export function verifyCalcomSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader || !secret) return false;
  // Cal.com sends signature as raw hex of HMAC-SHA256
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader.trim().toLowerCase());
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function makeWebhookSecret(): string {
  // 32 bytes hex
  const bytes = new Uint8Array(32);
  (globalThis.crypto as Crypto).getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// Booking actions (used by flow executor)
// ---------------------------------------------------------------------------

export type CreateBookingArgs = {
  conn: CalConn;
  event_type_id: number;
  start_iso: string;
  attendee: { email: string; name: string; timezone?: string };
  metadata?: Record<string, unknown>;
};

export async function createBookingViaApi(args: CreateBookingArgs) {
  return calcomFetch(args.conn, `/bookings`, {
    method: "POST",
    body: JSON.stringify({
      eventTypeId: args.event_type_id,
      start: args.start_iso,
      attendee: {
        name: args.attendee.name,
        email: args.attendee.email,
        timeZone: args.attendee.timezone ?? "America/Sao_Paulo",
        language: "pt-BR",
      },
      metadata: args.metadata ?? {},
    }),
  });
}

export async function cancelBookingViaApi(conn: CalConn, booking_uid: string, reason?: string) {
  return calcomFetch(conn, `/bookings/${encodeURIComponent(booking_uid)}/cancel`, {
    method: "POST",
    body: JSON.stringify({ cancellationReason: reason ?? "Cancelado via Leaderei" }),
  });
}

export async function rescheduleBookingViaApi(
  conn: CalConn,
  booking_uid: string,
  new_start_iso: string,
  reason?: string,
) {
  return calcomFetch(conn, `/bookings/${encodeURIComponent(booking_uid)}/reschedule`, {
    method: "POST",
    body: JSON.stringify({
      start: new_start_iso,
      reschedulingReason: reason ?? "Reagendado via Leaderei",
    }),
  });
}

export async function getAvailableSlots(
  conn: CalConn,
  event_type_id: number,
  date_from: string,
  date_to: string,
  timezone = "America/Sao_Paulo",
) {
  const qs = new URLSearchParams({
    eventTypeId: String(event_type_id),
    start: date_from,
    end: date_to,
    timeZone: timezone,
  });
  return calcomFetch(conn, `/slots?${qs.toString()}`, { method: "GET" });
}

export function firstSlotFromResponse(payload: any): string | null {
  // /v2/slots returns { status, data: { "YYYY-MM-DD": [{ time: "ISO" }, ...] } }
  const data = payload?.data ?? payload?.slots ?? {};
  if (Array.isArray(data)) {
    const first = data[0];
    return first?.time ?? first?.start ?? null;
  }
  const days = Object.keys(data).sort();
  for (const d of days) {
    const arr = data[d];
    if (Array.isArray(arr) && arr.length) return arr[0]?.time ?? arr[0]?.start ?? null;
  }
  return null;
}
