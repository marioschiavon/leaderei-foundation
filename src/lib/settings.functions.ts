import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getActiveOrg(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Sem organização ativa.");
  return data as { organization_id: string; role: string };
}

async function requireAdmin(supabase: any, userId: string) {
  const m = await getActiveOrg(supabase, userId);
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const isAdmin =
    m.role === "company_admin" ||
    (roles ?? []).some((r: any) => r.role === "company_admin" || r.role === "master_admin");
  if (!isAdmin) throw new Error("Apenas administradores podem executar esta ação.");
  return m;
}

// =================== Organization ===================
export const getMyOrganization = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const m = await getActiveOrg(supabase, userId);
    const { data, error } = await supabase
      .from("organizations")
      .select("id, name, slug, logo_url, billing_email, industry, country, timezone")
      .eq("id", m.organization_id)
      .single();
    if (error) throw new Error(error.message);
    return data;
  });

const UpdateOrgSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  slug: z.string().trim().min(2).max(60).regex(/^[a-z0-9-]+$/, "Slug inválido").optional(),
  logo_url: z.string().trim().url().nullable().optional().or(z.literal("")),
  billing_email: z.string().trim().email().max(255).nullable().optional().or(z.literal("")),
  industry: z.string().trim().max(120).nullable().optional().or(z.literal("")),
  country: z.string().trim().max(120).nullable().optional().or(z.literal("")),
  timezone: z.string().trim().max(80).optional(),
});

export const updateMyOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateOrgSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const m = await requireAdmin(supabase, userId);

    if (data.slug) {
      const { data: clash } = await supabase
        .from("organizations")
        .select("id")
        .eq("slug", data.slug)
        .neq("id", m.organization_id)
        .maybeSingle();
      if (clash) throw new Error("Este slug já está em uso por outra organização.");
    }

    const patch: any = { updated_at: new Date().toISOString() };
    for (const k of Object.keys(data) as (keyof typeof data)[]) {
      const v = data[k];
      patch[k] = v === "" ? null : v;
    }

    const { data: row, error } = await supabase
      .from("organizations")
      .update(patch)
      .eq("id", m.organization_id)
      .select("id, name, slug, logo_url, billing_email, industry, country, timezone")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// =================== Members ===================
export const listOrgMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const m = await getActiveOrg(supabase, userId);
    const { data, error } = await supabase.rpc("list_org_members", { _org_id: m.organization_id });
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      id: string;
      user_id: string;
      full_name: string | null;
      email: string | null;
      role: string;
      status: string;
      joined_at: string;
    }>;
  });

export const listOrgInvitations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const m = await getActiveOrg(supabase, userId);
    const { data, error } = await supabase
      .from("organization_invitations")
      .select("id, email, role, expires_at, created_at, accepted_at, revoked_at, last_sent_at")
      .eq("organization_id", m.organization_id)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getInvitationLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ invitation_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const m = await requireAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv, error } = await supabaseAdmin
      .from("organization_invitations")
      .select("token, organization_id, accepted_at, revoked_at, expires_at")
      .eq("id", data.invitation_id)
      .single();
    if (error || !inv) throw new Error("Convite não encontrado.");
    if (inv.organization_id !== m.organization_id) throw new Error("Convite não encontrado.");
    if (inv.accepted_at || inv.revoked_at || new Date(inv.expires_at) <= new Date()) {
      throw new Error("Convite não está mais ativo.");
    }
    const base = process.env.VITE_PUBLIC_APP_URL || process.env.PUBLIC_APP_URL || "";
    return { invite_url: `${base}/invite/${inv.token}` };
  });

const InviteSchema = z.object({
  email: z.string().trim().email().max(255).transform((s) => s.toLowerCase()),
  role: z.enum(["user", "company_admin"]),
});

export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InviteSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const m = await requireAdmin(supabase, userId);

    // Check existing active member with same email
    const { data: existing } = await supabase.rpc("list_org_members", { _org_id: m.organization_id });
    const conflict = (existing ?? []).find(
      (r: any) => r.email && r.email.toLowerCase() === data.email && r.status === "active",
    );
    if (conflict) throw new Error("Já existe um membro ativo com este e-mail.");

    const { data: pending } = await supabase
      .from("organization_invitations")
      .select("id")
      .eq("organization_id", m.organization_id)
      .eq("email", data.email)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (pending) throw new Error("Convite já enviado. Reenvie ou revogue o existente.");

    const token = crypto.randomBytes(24).toString("base64url");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("organization_invitations")
      .insert({
        organization_id: m.organization_id,
        email: data.email,
        role: data.role,
        token,
        invited_by: userId,
      })
      .select("id, token")
      .single();
    if (error) throw new Error(error.message);

    const base = process.env.VITE_PUBLIC_APP_URL || process.env.PUBLIC_APP_URL || "";
    const invite_url = `${base}/invite/${row.token}`;
    return { invitation_id: row.id, invite_url };
  });

export const sendInvitationEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ invitation_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const m = await requireAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv, error } = await supabaseAdmin
      .from("organization_invitations")
      .select("id, email, organization_id, role, token, expires_at")
      .eq("id", data.invitation_id)
      .eq("organization_id", m.organization_id)
      .single();
    if (error || !inv) throw new Error("Convite não encontrado.");

    const { sendEmailInternal } = await import("./email.functions");
    const { renderInvitationEmail } = await import("./email-templates/invitation");

    const [{ data: org }, { data: inviterProfile }, { data: appUrlRow }, { data: logoRow }] = await Promise.all([
      supabaseAdmin.from("organizations").select("name").eq("id", m.organization_id).single(),
      supabaseAdmin.from("profiles").select("full_name").eq("user_id", userId).maybeSingle(),
      supabaseAdmin.rpc("get_platform_plain", { _key: "app_public_url" }),
      supabaseAdmin.rpc("get_platform_plain", { _key: "logo_public_url" }),
    ]);

    const baseUrl = (typeof appUrlRow === "string" && appUrlRow) || process.env.VITE_PUBLIC_APP_URL || "";
    const logoUrl = typeof logoRow === "string" ? logoRow : null;
    const inviteUrl = `${baseUrl}/invite/${inv.token}`;
    const inviterName = inviterProfile?.full_name ?? "Um administrador";
    const orgName = org?.name ?? "sua organização";

    const { subject, html, text } = renderInvitationEmail({
      org_name: orgName,
      inviter_name: inviterName,
      role_label: inv.role === "company_admin" ? "administrador" : "membro",
      invite_url: inviteUrl,
      expires_at: inv.expires_at,
      logo_url: logoUrl,
    });

    const r = await sendEmailInternal({
      to: inv.email,
      subject, html, text,
      purpose: "invitation",
      organization_id: m.organization_id,
      template_key: "invitation_v1",
      triggered_by: userId,
      metadata: { inviter_user_id: userId, role: inv.role, expires_at: inv.expires_at },
    });

    await supabaseAdmin
      .from("organization_invitations")
      .update({ last_sent_at: new Date().toISOString() })
      .eq("id", inv.id);

    return { sent: true, provider_message_id: r.provider_message_id };
  });

export const updateMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ member_id: z.string().uuid(), role: z.enum(["user", "company_admin"]) })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const m = await requireAdmin(supabase, userId);

    const { data: target } = await supabase
      .from("organization_members")
      .select("id, user_id, role, status, organization_id")
      .eq("id", data.member_id)
      .single();
    if (!target || target.organization_id !== m.organization_id) {
      throw new Error("Membro não encontrado.");
    }

    if (target.role === "company_admin" && data.role !== "company_admin") {
      const { count } = await supabase
        .from("organization_members")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", m.organization_id)
        .eq("role", "company_admin")
        .eq("status", "active");
      if ((count ?? 0) <= 1) {
        throw new Error("Não é possível rebaixar o último administrador.");
      }
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("organization_members")
      .update({ role: data.role, updated_at: new Date().toISOString() })
      .eq("id", data.member_id)
      .eq("organization_id", m.organization_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ member_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const m = await requireAdmin(supabase, userId);
    const { data: target } = await supabase
      .from("organization_members")
      .select("id, role, status, organization_id")
      .eq("id", data.member_id)
      .single();
    if (!target || target.organization_id !== m.organization_id) {
      throw new Error("Membro não encontrado.");
    }
    if (target.role === "company_admin" && target.status === "active") {
      const { count } = await supabase
        .from("organization_members")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", m.organization_id)
        .eq("role", "company_admin")
        .eq("status", "active");
      if ((count ?? 0) <= 1) {
        throw new Error("Não é possível remover o último administrador.");
      }
    }
    const { error } = await supabase
      .from("organization_members")
      .update({ status: "suspended", updated_at: new Date().toISOString() })
      .eq("id", data.member_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const revokeInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ invitation_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const m = await requireAdmin(supabase, userId);
    const { error } = await supabase
      .from("organization_invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.invitation_id)
      .eq("organization_id", m.organization_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =================== API keys ===================
export const listApiKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const m = await getActiveOrg(supabase, userId);
    const { data, error } = await supabase
      .from("api_keys")
      .select("id, name, key_prefix, created_at, last_used_at, revoked_at")
      .eq("organization_id", m.organization_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ name: z.string().trim().min(1).max(120) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const m = await requireAdmin(supabase, userId);

    const rand = crypto.randomBytes(24).toString("base64url");
    const plaintext = `ldr_live_${rand}`;
    const key_prefix = `${plaintext.slice(0, 16)}...`;
    const key_hash = crypto.createHash("sha256").update(plaintext).digest("hex");

    const { data: row, error } = await supabase
      .from("api_keys")
      .insert({
        organization_id: m.organization_id,
        name: data.name,
        key_prefix,
        key_hash,
        scopes: [],
        created_by: userId,
      })
      .select("id, name, key_prefix, created_at")
      .single();
    if (error) throw new Error(error.message);

    return { ...row, plaintext_key: plaintext };
  });

export const revokeApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const m = await requireAdmin(supabase, userId);
    const { error } = await supabase
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("organization_id", m.organization_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =================== Invitation public accept ===================
const TokenSchema = z.object({ token: z.string().min(8).max(128) });

export const getInvitationByToken = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TokenSchema.parse(input))
  .handler(async ({ data }) => {
    // Uses anon-callable SECURITY DEFINER function
    const { createClient } = await import("@supabase/supabase-js");
    const supa = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false } },
    );
    const { data: rows, error } = await supa.rpc("get_invitation_by_token", {
      _token: data.token,
    });
    if (error) throw new Error(error.message);
    const row = (rows ?? [])[0] ?? null;
    return row as null | {
      id: string;
      organization_id: string;
      organization_name: string;
      email: string;
      role: string;
      expires_at: string;
    };
  });

export const acceptInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TokenSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: orgId, error } = await supabase.rpc("accept_invitation", {
      _token: data.token,
    });
    if (error) throw new Error(error.message);
    return { organization_id: orgId as string };
  });
