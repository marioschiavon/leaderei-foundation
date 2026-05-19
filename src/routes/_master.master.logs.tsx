import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_master/master/logs")({
  component: LogsPage,
});

const LOGS = [
  { t: "12:04:21", level: "info", msg: "Org acme: novo lead criado via API", actor: "system" },
  { t: "12:03:55", level: "info", msg: "User marina@acme.com fez login", actor: "auth" },
  { t: "12:01:12", level: "warn", msg: "Org northwind: rate limit próximo do teto", actor: "system" },
  { t: "11:58:02", level: "info", msg: "Campanha 'Outbound LATAM' enviada (412 leads)", actor: "campaigns" },
  { t: "11:55:48", level: "error", msg: "Falha ao sincronizar Calendar para org helix", actor: "integrations" },
];

const levelStyle: Record<string, string> = {
  info: "text-muted-foreground",
  warn: "text-secondary",
  error: "text-brand",
};

function LogsPage() {
  return (
    <div className="space-y-6">
      <div className="border-b pb-5">
        <h1 className="font-display text-2xl font-bold tracking-tight">Logs</h1>
        <p className="mt-1 text-sm text-muted-foreground">Eventos do sistema em tempo real.</p>
      </div>
      <div className="overflow-hidden rounded-xl border bg-secondary text-secondary-foreground">
        <div className="divide-y divide-white/5 font-mono text-xs">
          {LOGS.map((l, i) => (
            <div key={i} className="grid grid-cols-[80px_60px_120px_1fr] items-center gap-3 px-4 py-2.5">
              <span className="text-white/40">{l.t}</span>
              <span className={`uppercase font-semibold ${levelStyle[l.level]}`}>{l.level}</span>
              <span className="text-white/60">{l.actor}</span>
              <span className="text-white/90">{l.msg}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
