import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BlockKindSchema = z.enum([
  "trigger", "email", "linkedin", "whatsapp",
  "wait", "condition", "tag", "webhook", "handoff", "ai",
]);

const NodeSchema = z.object({
  id: z.string().min(1).max(60),
  kind: BlockKindSchema,
  title: z.string().min(1).max(200),
  subtitle: z.string().max(300).nullable().optional(),
  config: z.record(z.string(), z.any()).optional(),
});

const DocSchemaSchema = z.object({
  nodes: z.array(NodeSchema).max(200),
  edges: z.array(z.object({
    from: z.string(),
    to: z.string(),
    branch: z.string().max(40).nullable().optional(),
  })).max(400).optional().default([]),
});

const DEFAULT_SCHEMA = {
  nodes: [
    { id: "n1", kind: "trigger" as const, title: "Novo lead", subtitle: "Origem: importação CSV" },
  ],
  edges: [],
};

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

export const listBuilderDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("builder_documents")
      .select("id, name, description, version, is_published, updated_at, created_at")
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getBuilderDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("builder_documents")
      .select("id, name, description, schema, version, is_published, updated_at, created_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Documento não encontrado.");
    return row;
  });

export const createBuilderDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      name: z.string().trim().min(1).max(160),
      description: z.string().trim().max(500).nullable().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const organization_id = await getActiveOrgId(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("builder_documents")
      .insert({
        organization_id,
        name: data.name,
        description: data.description ?? null,
        schema: DEFAULT_SCHEMA as any,
        version: 1,
        is_published: false,
        created_by: context.userId,
        updated_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const saveBuilderDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      name: z.string().trim().min(1).max(160).optional(),
      description: z.string().trim().max(500).nullable().optional(),
      schema: DocSchemaSchema,
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: current, error: cErr } = await context.supabase
      .from("builder_documents")
      .select("version")
      .eq("id", data.id)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!current) throw new Error("Documento não encontrado.");

    const { data: row, error } = await context.supabase
      .from("builder_documents")
      .update({
        schema: data.schema as any,
        version: (current.version ?? 1) + 1,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
      })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const publishBuilderDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), publish: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("builder_documents")
      .update({
        is_published: data.publish,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteBuilderDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("builder_documents")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
