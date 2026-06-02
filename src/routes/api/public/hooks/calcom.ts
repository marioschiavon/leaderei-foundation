// Public webhook for Cal.com bookings. URL: /api/public/hooks/calcom?org=<organization_id>
// Cal.com sends: X-Cal-Signature-256 = HMAC-SHA256(secret, rawBody) as hex
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadCalcomConnection, verifyCalcomSignature } from "@/lib/calcom.server";

type CalAttendee = { email?: string; name?: string; timeZone?: string };
type CalBookingPayload = {
  uid?: string;
  bookingId?: number | string;
  title?: string;
  startTime?: string;
  endTime?: string;
  eventTypeId?: number;
  type?: string; // event slug
  attendees?: CalAttendee[];
  organizer?: { email?: string; name?: string };
  videoCallData?: { url?: string };
  metadata?: Record<string, unknown>;
  location?: string;
  cancellationReason?: string;
  rescheduleUid?: string;
  rescheduledFromUid?: string;
};

function jres(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/hooks/calcom")({
  server: {
    handlers: {
      GET: async () => jres({ ok: true, hint: "POST com header X-Cal-Signature-256" }),
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const orgId = url.searchParams.get("org");
        if (!orgId) return jres({ ok: false, error: "missing org" }, 400);

        const rawBody = await request.text();
        const conn = await loadCalcomConnection(orgId);
        if (!conn || !conn.webhook_secret) {
          return jres({ ok: false, error: "cal_com not configured" }, 401);
        }
        const sig =
          request.headers.get("x-cal-signature-256")
          ?? request.headers.get("X-Cal-Signature-256")
          ?? request.headers.get("x-cal-signature");

        const ok = verifyCalcomSignature(rawBody, sig, conn.webhook_secret);
        if (!ok) return jres({ ok: false, error: "invalid signature" }, 401);

        let body: any = null;
        try { body = JSON.parse(rawBody); } catch { return jres({ ok: false, error: "bad json" }, 400); }

        const trigger: string = String(body?.triggerEvent ?? body?.event ?? "").toUpperCase();
        const payload: CalBookingPayload = body?.payload ?? body?.data ?? body ?? {};

        try {
          if (trigger === "BOOKING_CREATED") {
            await handleBookingCreated(orgId, payload);
          } else if (trigger === "BOOKING_RESCHEDULED") {
            await handleBookingRescheduled(orgId, payload);
          } else if (trigger === "BOOKING_CANCELLED" || trigger === "BOOKING_CANCELED") {
            await handleBookingCancelled(orgId, payload);
          } else {
            // ignore other triggers but ack
          }
        } catch (e: any) {
          console.error("[calcom webhook]", trigger, e?.message);
          // Still 200 so Cal.com doesn't keep retrying. Log only.
          return jres({ ok: false, error: String(e?.message ?? e).slice(0, 300) });
        }
        return jres({ ok: true });
      },
    },
  },
});

async function findLeadByEmail(orgId: string, email: string) {
  if (!email) return null;
  const e = email.toLowerCase().trim();
  const { data } = await supabaseAdmin
    .from("leads")
    .select("id, full_name, owner_user_id")
    .eq("organization_id", orgId)
    .or(`email.eq.${e},personal_email.eq.${e},secondary_email.eq.${e}`)
    .limit(1);
  return data?.[0] ?? null;
}

async function findEnrollmentForLead(orgId: string, leadId: string) {
  const { data } = await supabaseAdmin
    .from("campaign_enrollments")
    .select("id, campaign_id, status, current_step_id, context")
    .eq("organization_id", orgId)
    .eq("lead_id", leadId)
    .in("status", ["active", "paused"])
    .order("enrolled_at", { ascending: false })
    .limit(1);
  return data?.[0] ?? null;
}

async function handleBookingCreated(orgId: string, p: CalBookingPayload) {
  const attendee = p.attendees?.[0] ?? {};
  const email = (attendee.email ?? "").toLowerCase();
  const lead = await findLeadByEmail(orgId, email);
  if (!lead) return; // ignore — lead não existe no CRM

  const enrollment = await findEnrollmentForLead(orgId, lead.id);
  const uid = String(p.uid ?? p.bookingId ?? "");
  if (!uid) return;

  await supabaseAdmin.from("lead_bookings").upsert(
    {
      organization_id: orgId,
      lead_id: lead.id,
      campaign_id: enrollment?.campaign_id ?? null,
      enrollment_id: enrollment?.id ?? null,
      cal_booking_id: String(p.bookingId ?? uid),
      cal_booking_uid: uid,
      event_type_id: p.eventTypeId ? Number(p.eventTypeId) : null,
      event_type_slug: p.type ?? null,
      title: p.title ?? null,
      start_at: p.startTime ?? new Date().toISOString(),
      end_at: p.endTime ?? null,
      attendee_email: attendee.email ?? null,
      attendee_name: attendee.name ?? null,
      organizer_email: p.organizer?.email ?? null,
      meeting_url: p.videoCallData?.url ?? null,
      location: p.location ?? null,
      status: "confirmed",
      raw_payload: p as any,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "cal_booking_uid" },
  );

  // Timeline
  await supabaseAdmin.from("lead_activities").insert({
    organization_id: orgId,
    lead_id: lead.id,
    type: "meeting" as any,
    title: `Reunião agendada${p.title ? `: ${p.title}` : ""}`,
    description: `Em ${formatBR(p.startTime)} com ${attendee.email ?? "—"}`,
    payload: { source: "cal.com", uid, enrollment_id: enrollment?.id ?? null } as any,
  });

  // Touch lead
  await supabaseAdmin
    .from("leads")
    .update({ last_contact_at: new Date().toISOString() })
    .eq("id", lead.id);

  // Pause enrollment so the flow doesn't keep poking the lead during meeting
  if (enrollment && enrollment.status === "active") {
    await supabaseAdmin
      .from("campaign_enrollments")
      .update({
        status: "paused",
        next_run_at: null,
        context: { ...(enrollment.context as any ?? {}), paused_by: "calcom_booking", booking_uid: uid },
      })
      .eq("id", enrollment.id);
    await supabaseAdmin
      .from("scheduled_jobs")
      .update({ status: "cancelled" })
      .eq("enrollment_id", enrollment.id)
      .eq("status", "pending");
  }
}

async function handleBookingRescheduled(orgId: string, p: CalBookingPayload) {
  const uid = String(p.uid ?? p.bookingId ?? "");
  const fromUid = p.rescheduledFromUid ?? p.rescheduleUid ?? null;
  const lookupUid = fromUid ?? uid;
  if (!lookupUid) return;

  const { data: existing } = await supabaseAdmin
    .from("lead_bookings")
    .select("id, lead_id, reschedule_count")
    .eq("organization_id", orgId)
    .eq("cal_booking_uid", lookupUid)
    .maybeSingle();
  if (!existing) {
    // Treat as new
    await handleBookingCreated(orgId, p);
    return;
  }

  await supabaseAdmin
    .from("lead_bookings")
    .update({
      cal_booking_uid: uid || lookupUid,
      start_at: p.startTime ?? new Date().toISOString(),
      end_at: p.endTime ?? null,
      meeting_url: p.videoCallData?.url ?? null,
      status: "rescheduled",
      reschedule_count: (existing.reschedule_count ?? 0) + 1,
      rescheduled_from_uid: fromUid ?? null,
      raw_payload: p as any,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id);

  await supabaseAdmin.from("lead_activities").insert({
    organization_id: orgId,
    lead_id: existing.lead_id,
    type: "meeting" as any,
    title: "Reunião reagendada",
    description: `Novo horário: ${formatBR(p.startTime)}`,
    payload: { source: "cal.com", uid } as any,
  });
}

async function handleBookingCancelled(orgId: string, p: CalBookingPayload) {
  const uid = String(p.uid ?? p.bookingId ?? "");
  if (!uid) return;
  const { data: existing } = await supabaseAdmin
    .from("lead_bookings")
    .select("id, lead_id, enrollment_id")
    .eq("organization_id", orgId)
    .eq("cal_booking_uid", uid)
    .maybeSingle();
  if (!existing) return;

  await supabaseAdmin
    .from("lead_bookings")
    .update({
      status: "cancelled",
      cancellation_reason: p.cancellationReason ?? null,
      raw_payload: p as any,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id);

  await supabaseAdmin.from("lead_activities").insert({
    organization_id: orgId,
    lead_id: existing.lead_id,
    type: "meeting" as any,
    title: "Reunião cancelada",
    description: p.cancellationReason ?? "Sem motivo informado",
    payload: { source: "cal.com", uid } as any,
  });

  // Resume the enrollment that was paused by this booking, after a retry delay
  if (existing.enrollment_id) {
    const { data: en } = await supabaseAdmin
      .from("campaign_enrollments")
      .select("id, status, current_step_id, document_id, context")
      .eq("id", existing.enrollment_id)
      .maybeSingle();
    if (en && en.status === "paused") {
      // Find the calcom_book_meeting step config to know retry_delay_business_days
      let retryDays = 3;
      if (en.current_step_id) {
        const { data: step } = await supabaseAdmin
          .from("flow_steps")
          .select("config")
          .eq("id", en.current_step_id)
          .maybeSingle();
        const cfg = (step?.config ?? {}) as any;
        if (typeof cfg?.cancel_retry_business_days === "number" && cfg.cancel_retry_business_days > 0) {
          retryDays = cfg.cancel_retry_business_days;
        }
      }
      // Compute resume time (skip weekends)
      const d = new Date();
      let remaining = retryDays;
      while (remaining > 0) {
        d.setDate(d.getDate() + 1);
        const dow = d.getUTCDay();
        if (dow !== 0 && dow !== 6) remaining -= 1;
      }
      const resumeAt = d.toISOString();

      await supabaseAdmin
        .from("campaign_enrollments")
        .update({
          status: "active",
          next_run_at: resumeAt,
          context: { ...(en.context as any ?? {}), resumed_by: "calcom_cancel", booking_uid: uid },
        })
        .eq("id", en.id);
      await supabaseAdmin.from("scheduled_jobs").insert({
        organization_id: orgId,
        kind: "flow_step",
        enrollment_id: en.id,
        run_at: resumeAt,
        status: "pending",
        payload: { reason: "calcom_cancel_retry" } as any,
      });
    }
  }
}

function formatBR(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch {
    return iso;
  }
}
