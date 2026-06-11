import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const assumeConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ conversation_id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("conversations")
      .update({
        agent_paused: true,
        needs_human: false,
        needs_human_reason: null,
        assigned_to: context.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.conversation_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const returnToAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ conversation_id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("conversations")
      .update({
        agent_paused: false,
        assigned_to: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.conversation_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getConversationsNeedingAttentionCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count, error } = await context.supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("needs_human", true);
    if (error) throw new Error(error.message);
    return { count: count ?? 0 };
  });
