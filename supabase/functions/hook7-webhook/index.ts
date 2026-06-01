// Hook7 webhook receiver.
// Path: /functions/v1/hook7-webhook/{secret}/{org-slug}
// Always returns 200 — Hook7 must not retry on our errors.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = (Deno.env.get("HOOK7_WEBHOOK_SECRET") ?? "").trim();

function ok200() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function stripJid(jid: string | null | undefined): string | null {
  if (!jid || typeof jid !== "string") return null;
  const beforeAt = jid.split("@")[0];
  const beforeColon = beforeAt.split(":")[0];
  return beforeColon || null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return ok200();

  try {
    const url = new URL(req.url);
    // Path comes as /hook7-webhook/{secret}/{org-slug}
    const parts = url.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("hook7-webhook");
    if (idx < 0 || parts.length < idx + 3) {
      console.warn("[hook7-webhook] bad path");
      return ok200();
    }
    const secret = parts[idx + 1];
    const orgSlug = parts[idx + 2];

    if (!WEBHOOK_SECRET) {
      console.error("[hook7-webhook] HOOK7_WEBHOOK_SECRET not set on server");
      return ok200();
    }
    if (secret !== WEBHOOK_SECRET) {
      console.warn("[hook7-webhook] secret mismatch", { orgSlug });
      return ok200();
    }

    let body: any = null;
    try { body = await req.json(); } catch { return ok200(); }

    const event = body?.event;
    const instanceId = body?.instanceId;
    const instanceToken = body?.instanceToken;
    if (!event || !instanceId || !instanceToken) {
      console.warn("[hook7-webhook] missing envelope fields", { event, hasInstanceId: !!instanceId });
      return ok200();
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: org } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", orgSlug)
      .maybeSingle();
    if (!org) {
      console.warn("[hook7-webhook] org not found", { orgSlug });
      return ok200();
    }

    const { data: instance } = await supabase
      .from("hook7_instances")
      .select("id, organization_id, archived_at")
      .eq("external_id", instanceId)
      .eq("organization_id", org.id)
      .maybeSingle();
    if (!instance || instance.archived_at) {
      console.warn("[hook7-webhook] instance not found or archived", { instanceId, orgSlug });
      return ok200();
    }

    const { data: tokenFromDb, error: tokErr } = await supabase
      .rpc("get_hook7_instance_token", { _instance_id: instance.id });
    if (tokErr || !tokenFromDb || tokenFromDb !== instanceToken) {
      console.warn("[hook7-webhook] token mismatch", { instanceId, orgSlug });
      return ok200();
    }

    try {
      switch (event) {
        case "Message":
          await handleMessage(supabase, instance, body.data);
          break;
        case "Receipt":
          await handleReceipt(supabase, instance, body.data, body.state);
          break;
        case "Connected":
          await handleConnected(supabase, instance, body.data);
          break;
        case "LoggedOut":
          await handleLoggedOut(supabase, instance, body.data);
          break;
        case "ChatPresence":
          // discard
          break;
        default:
          console.log("[hook7-webhook] unknown event", { event, instanceId });
      }
    } catch (err) {
      console.error("[hook7-webhook] handler error", {
        event, instanceId, orgSlug, error: String(err),
      });
    }

    return ok200();
  } catch (e) {
    console.error("[hook7-webhook] fatal", { error: String(e) });
    return ok200();
  }
});

async function handleMessage(supabase: any, instance: any, data: any) {
  const info = data?.Info;
  if (!info || info.IsGroup === true) return;

  const externalId = info.ID;
  if (!externalId) return;

  const { data: existing } = await supabase
    .from("messages")
    .select("id")
    .eq("external_message_id", externalId)
    .maybeSingle();
  if (existing) return;

  const isOutbound = info.IsFromMe === true;
  const otherJid = isOutbound
    ? (info.RecipientAlt || info.Chat)
    : (info.Sender || info.SenderAlt);
  const otherPhone = stripJid(otherJid);
  if (!otherPhone) return;

  const text =
    data?.Message?.conversation ??
    data?.Message?.extendedTextMessage?.text ??
    null;
  if (!text) return;

  let { data: lead } = await supabase
    .from("leads")
    .select("id")
    .eq("organization_id", instance.organization_id)
    .eq("phone", otherPhone)
    .maybeSingle();

  if (!lead) {
    const { data: newLead, error: leadErr } = await supabase
      .from("leads")
      .insert({
        organization_id: instance.organization_id,
        phone: otherPhone,
        full_name: info.PushName || `+${otherPhone}`,
        needs_review: true,
        review_reason: "inbound_from_unknown_whatsapp",
      })
      .select("id")
      .single();
    if (leadErr) {
      console.error("[hook7-webhook] lead insert failed", { error: leadErr.message });
      return;
    }
    lead = newLead;
  }

  let { data: conv } = await supabase
    .from("conversations")
    .select("id")
    .eq("organization_id", instance.organization_id)
    .eq("lead_id", lead.id)
    .eq("channel", "whatsapp")
    .maybeSingle();

  if (!conv) {
    const { data: newConv, error: convErr } = await supabase
      .from("conversations")
      .insert({
        organization_id: instance.organization_id,
        lead_id: lead.id,
        channel: "whatsapp",
      })
      .select("id")
      .single();
    if (convErr) {
      console.error("[hook7-webhook] conversation insert failed", { error: convErr.message });
      return;
    }
    conv = newConv;
  }

  const ts = info.Timestamp || new Date().toISOString();
  const { error: msgErr } = await supabase.from("messages").insert({
    conversation_id: conv.id,
    organization_id: instance.organization_id,
    external_message_id: externalId,
    direction: isOutbound ? "outbound" : "inbound",
    channel: "whatsapp",
    body: text,
    source_channel: "whatsapp",
    whatsapp_status: isOutbound ? "sent" : null,
    sent_at: isOutbound ? ts : null,
    created_at: ts,
  });
  if (msgErr) {
    // unique violation on external_message_id = idempotency hit; safe to ignore
    if (!String(msgErr.message || "").toLowerCase().includes("duplicate")) {
      console.error("[hook7-webhook] message insert failed", { error: msgErr.message });
    }
    return;
  }

  // update conversation last_message_*
  await supabase
    .from("conversations")
    .update({
      last_message_at: ts,
      last_message_preview: text.slice(0, 140),
      unread_count: isOutbound ? 0 : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conv.id);
}

async function handleReceipt(supabase: any, instance: any, data: any, state: any) {
  const status = String(state || data?.Type || "").toLowerCase();
  if (!["read", "delivered"].includes(status)) return;

  const messageIds = data?.MessageIDs;
  if (!Array.isArray(messageIds) || messageIds.length === 0) return;

  await supabase
    .from("messages")
    .update({
      whatsapp_status: status,
      whatsapp_status_at: data?.Timestamp || new Date().toISOString(),
    })
    .in("external_message_id", messageIds)
    .eq("direction", "outbound")
    .eq("organization_id", instance.organization_id);
}

async function handleConnected(supabase: any, instance: any, data: any) {
  const phoneFromJid = stripJid(data?.jid);
  await supabase
    .from("hook7_instances")
    .update({
      status: "connected",
      phone_number: phoneFromJid,
      last_connected_at: new Date().toISOString(),
      connected_profile_name: data?.pushName || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", instance.id);
}

async function handleLoggedOut(supabase: any, instance: any, data: any) {
  const reason = Number(data?.Reason);
  let newStatus = "disconnected";
  if (reason === 403) newStatus = "banned";
  else if (reason >= 500) newStatus = "error";

  await supabase
    .from("hook7_instances")
    .update({
      status: newStatus,
      last_disconnected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", instance.id);
}
