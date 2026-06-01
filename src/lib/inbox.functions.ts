import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getConversationMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ conversation_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const [convRes, msgsRes] = await Promise.all([
      supabase
        .from("conversations")
        .select(
          `id, subject, channel, status, ai_enabled, lead_id,
           leads(id, full_name, company_name, job_title, email, phone, linkedin_url,
                 status, temperature, score, next_followup_at, needs_review, review_reason,
                 lead_sources(id, name, color))`,
        )
        .eq("id", data.conversation_id)
        .maybeSingle(),
      supabase
        .from("messages")
        .select("id, body, direction, status, sent_by_ai, created_at, sent_at, delivered_at, read_at, source_channel, whatsapp_status, whatsapp_status_at, external_message_id")
        .eq("conversation_id", data.conversation_id)
        .order("created_at", { ascending: true })
        .limit(500),
    ]);
    if (convRes.error) throw new Error(convRes.error.message);
    if (msgsRes.error) throw new Error(msgsRes.error.message);
    return {
      conversation: convRes.data,
      messages: msgsRes.data ?? [],
    };
  });
