import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getOrgId(supabase: any, userId: string): Promise<string> {
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

// ----- Read -----
export const getOrgKnowledgeBase = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const orgId = await getOrgId(context.supabase, context.userId);
    const [profileRes, itemsRes] = await Promise.all([
      context.supabase
        .from("ai_org_profile")
        .select("ai_instructions, highlights, website_url")
        .eq("organization_id", orgId)
        .maybeSingle(),
      context.supabase
        .from("knowledge_sources")
        .select("id, title, name, content, kind, source_url, file_path, status, created_at, updated_at")
        .eq("organization_id", orgId)
        .neq("status", "error")
        .order("created_at", { ascending: false }),
    ]);

    let cacheStatus: { fetched_at: string | null; preview: string | null } = { fetched_at: null, preview: null };
    const websiteUrl = (profileRes.data as any)?.website_url as string | null | undefined;
    if (websiteUrl) {
      const { fetchWebsiteContent } = await import("@/lib/website-scraper.server");
      const content = await fetchWebsiteContent(websiteUrl);
      if (content) cacheStatus = { fetched_at: new Date().toISOString(), preview: content.slice(0, 200) };
    }

    return {
      aiInstructions: (profileRes.data as any)?.ai_instructions ?? null,
      highlights: (profileRes.data as any)?.highlights ?? null,
      websiteUrl: websiteUrl ?? null,
      websiteCache: cacheStatus,
      items: (itemsRes.data ?? []) as any[],
    };
  });

// ----- Profile fields -----
async function upsertProfileField(supabase: any, orgId: string, field: string, value: string | null) {
  const { error } = await supabase
    .from("ai_org_profile")
    .upsert(
      { organization_id: orgId, [field]: value, updated_at: new Date().toISOString() },
      { onConflict: "organization_id" },
    );
  if (error) throw new Error(error.message);
}

export const saveAiInstructions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ ai_instructions: z.string().max(8000).nullable() }).parse(i))
  .handler(async ({ context, data }) => {
    const orgId = await getOrgId(context.supabase, context.userId);
    await upsertProfileField(context.supabase, orgId, "ai_instructions", data.ai_instructions);
    return { ok: true };
  });

export const saveHighlights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ highlights: z.string().max(4000).nullable() }).parse(i))
  .handler(async ({ context, data }) => {
    const orgId = await getOrgId(context.supabase, context.userId);
    await upsertProfileField(context.supabase, orgId, "highlights", data.highlights);
    return { ok: true };
  });

export const saveOrgWebsiteUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ website_url: z.string().max(500).nullable() }).parse(i))
  .handler(async ({ context, data }) => {
    const orgId = await getOrgId(context.supabase, context.userId);
    const url = data.website_url?.trim() || null;
    await upsertProfileField(context.supabase, orgId, "website_url", url);
    // fire-and-forget cache warmup
    if (url) {
      const { fetchWebsiteContent } = await import("@/lib/website-scraper.server");
      fetchWebsiteContent(url).catch(() => null);
    }
    return { ok: true };
  });

// ----- Knowledge items CRUD -----
const KindSchema = z.enum(["text", "url", "file", "document", "faq"]);

export const createKnowledgeItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      title: z.string().min(1).max(200),
      content: z.string().min(1).max(50000),
      kind: KindSchema,
      source_url: z.string().max(1000).nullable().optional(),
      file_path: z.string().max(1000).nullable().optional(),
    }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const orgId = await getOrgId(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("knowledge_sources")
      .insert({
        organization_id: orgId,
        name: data.title,
        title: data.title,
        content: data.content,
        kind: data.kind as any,
        source_url: data.source_url ?? null,
        file_path: data.file_path ?? null,
        status: "ready" as any,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const updateKnowledgeItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(200).optional(),
      content: z.string().min(1).max(50000).optional(),
    }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const orgId = await getOrgId(context.supabase, context.userId);
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.title !== undefined) {
      patch.title = data.title;
      patch.name = data.title;
    }
    if (data.content !== undefined) patch.content = data.content;
    const { error } = await context.supabase
      .from("knowledge_sources")
      .update(patch)
      .eq("id", data.id)
      .eq("organization_id", orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteKnowledgeItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const orgId = await getOrgId(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("knowledge_sources")
      .delete()
      .eq("id", data.id)
      .eq("organization_id", orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ----- URL extraction -----
export const extractUrlContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ url: z.string().min(4).max(1000) }).parse(i))
  .handler(async ({ context, data }) => {
    await getOrgId(context.supabase, context.userId);
    const { fetchWebsiteContent } = await import("@/lib/website-scraper.server");
    const content = await fetchWebsiteContent(data.url);
    if (!content) throw new Error("Não foi possível extrair conteúdo desta URL.");
    let title = data.url;
    try {
      const u = new URL(data.url.startsWith("http") ? data.url : `https://${data.url}`);
      title = `${u.hostname}${u.pathname !== "/" ? u.pathname : ""}`;
    } catch {}
    return { title, content };
  });

// ----- Document upload -----
export const uploadKnowledgeDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      file_name: z.string().min(1).max(300),
      file_base64: z.string().min(8),
      file_type: z.string().max(100),
    }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const orgId = await getOrgId(context.supabase, context.userId);
    const lower = data.file_name.toLowerCase();
    if (!lower.endsWith(".pdf") && !lower.endsWith(".txt")) {
      throw new Error("Formato não suportado. Apenas .pdf e .txt.");
    }

    // decode base64
    const b64 = data.file_base64.replace(/^data:[^;]+;base64,/, "");
    const binary = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const filePath = `${orgId}/${Date.now()}_${data.file_name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: upErr } = await supabaseAdmin.storage
      .from("knowledge-docs")
      .upload(filePath, binary, { contentType: data.file_type || "application/octet-stream", upsert: false });
    if (upErr) throw new Error(`Falha no upload: ${upErr.message}`);

    // Invoke edge function
    let extracted: { title: string; content: string | null; warning?: string } = {
      title: data.file_name,
      content: null,
    };
    try {
      const { data: parsed, error: fnErr } = await supabaseAdmin.functions.invoke("parse-knowledge-doc", {
        body: { file_path: filePath, file_name: data.file_name },
      });
      if (!fnErr && parsed) extracted = parsed as any;
      else if (fnErr) extracted.warning = `Extração falhou: ${fnErr.message}`;
    } catch (e: any) {
      extracted.warning = `Extração falhou: ${String(e?.message ?? e)}`;
    }

    return {
      file_path: filePath,
      title: extracted.title || data.file_name,
      content: extracted.content,
      warning: extracted.warning,
    };
  });
