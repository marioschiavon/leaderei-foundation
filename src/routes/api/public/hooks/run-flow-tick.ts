import { createFileRoute } from "@tanstack/react-router";
import { runFlowTick } from "@/lib/flow-executor.server";

// Public webhook — drained by pg_cron every minute.
// Auth: `apikey` header must match Supabase anon/publishable key
// (the only header pg_cron is configured to send). Always returns 200.
export const Route = createFileRoute("/api/public/hooks/run-flow-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? "";
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
        if (!expected || apikey !== expected) {
          return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        try {
          const out = await runFlowTick(25);
          return new Response(JSON.stringify({ ok: true, ...out }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e: any) {
          console.error("[run-flow-tick] error", e);
          return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
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
