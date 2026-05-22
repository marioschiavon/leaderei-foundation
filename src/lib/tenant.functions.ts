import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Returns the active organization of the authenticated user, the org-scoped
 * membership row, and the global role flags. Uses RLS-bound client so the
 * caller can only ever see what they're allowed to.
 */
export const getMyContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id, role, status, joined_at")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const [orgRes, rolesRes] = await Promise.all([
      membership
        ? supabase
            .from("organizations")
            .select("id, name, slug, status, max_users, max_leads, logo_url")
            .eq("id", membership.organization_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);

    return {
      userId,
      organization: orgRes.data ?? null,
      role: membership?.role ?? null,
      isMaster: (rolesRes.data ?? []).some((r) => r.role === "master_admin"),
    };
  });

export const getDashboardSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;

    const [leadsAll, leadsNew, convsOpen, msgsSent, campsActive] = await Promise.all([
      supabase.from("leads").select("*", { count: "exact", head: true }),
      supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "new"),
      supabase.from("conversations").select("*", { count: "exact", head: true }).eq("status", "open"),
      supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("direction", "outbound")
        .gte("created_at", new Date(Date.now() - 7 * 86400_000).toISOString()),
      supabase.from("campaigns").select("*", { count: "exact", head: true }).eq("status", "running"),
    ]);

    return {
      leads_total: leadsAll.count ?? 0,
      leads_new: leadsNew.count ?? 0,
      conversations_open: convsOpen.count ?? 0,
      messages_sent_7d: msgsSent.count ?? 0,
      campaigns_active: campsActive.count ?? 0,
    };
  });

export const listLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("leads")
      .select("id, full_name, email, company_name, job_title, status, temperature, score, source_id, created_at, last_contact_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("campaigns")
      .select("id, name, description, status, channel, total_enrolled, total_sent, total_replied, created_at, scheduled_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("conversations")
      .select("id, subject, channel, status, last_message_preview, last_message_at, unread_count, ai_enabled, leads(full_name, company_name)")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listIntegrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [providers, connections] = await Promise.all([
      context.supabase
        .from("integration_providers")
        .select("id, slug, name, category, description, logo_url")
        .eq("is_active", true)
        .order("name"),
      context.supabase
        .from("organization_integrations")
        .select("id, provider_id, status, display_name, last_synced_at, last_error"),
    ]);
    if (providers.error) throw new Error(providers.error.message);
    if (connections.error) throw new Error(connections.error.message);

    const byProvider = new Map(
      (connections.data ?? []).map((c) => [c.provider_id, c]),
    );
    return (providers.data ?? []).map((p) => ({
      ...p,
      connection: byProvider.get(p.id) ?? null,
    }));
  });
