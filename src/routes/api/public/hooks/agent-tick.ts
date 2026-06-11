import { createFileRoute } from "@tanstack/react-router";
import { runAgentTick } from "@/lib/conversation-agent.server";

export const Route = createFileRoute("/api/public/hooks/agent-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? "";
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
        if (!expected || apikey !== expected) {
          return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
            status: 401, headers: { "Content-Type": "application/json" },
          });
        }
        try {
          const out = await runAgentTick(10);
          return new Response(JSON.stringify({ ok: true, ...out }), {
            status: 200, headers: { "Content-Type": "application/json" },
          });
        } catch (e: any) {
          console.error("[agent-tick] error", e);
          return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), {
            status: 200, headers: { "Content-Type": "application/json" },
          });
        }
      },
      GET: async () =>
        new Response(JSON.stringify({ ok: true, hint: "POST com header apikey" }), {
          status: 200, headers: { "Content-Type": "application/json" },
        }),
    },
  },
});
