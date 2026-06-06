import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { RefreshCw, ScrollText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/app/EmptyState";
import {
  listEmailLogsForMaster, listFlowStepRunsForMaster,
  listWebhookEventsForMaster, listAuditLogsForMaster,
} from "@/lib/master.functions";

export const Route = createFileRoute("/_master/master/logs")({
  component: LogsPage,
});

const REFRESH_MS = 30_000;

function LogsPage() {
  const [sinceHours, setSinceHours] = useState<number>(24);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-5">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Logs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Auditoria operacional da plataforma — últimos 100 registros por categoria.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Período</span>
          <Select value={String(sinceHours)} onValueChange={(v) => setSinceHours(Number(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Última 1h</SelectItem>
              <SelectItem value="24">Últimas 24h</SelectItem>
              <SelectItem value="168">Últimos 7d</SelectItem>
              <SelectItem value="720">Últimos 30d</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="emails">
        <TabsList>
          <TabsTrigger value="emails">Emails</TabsTrigger>
          <TabsTrigger value="flows">Fluxos</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="audit">Auditoria</TabsTrigger>
        </TabsList>
        <TabsContent value="emails" className="mt-4">
          <EmailLogsTab sinceHours={sinceHours} />
        </TabsContent>
        <TabsContent value="flows" className="mt-4">
          <FlowLogsTab sinceHours={sinceHours} />
        </TabsContent>
        <TabsContent value="webhooks" className="mt-4">
          <WebhookLogsTab sinceHours={sinceHours} />
        </TabsContent>
        <TabsContent value="audit" className="mt-4">
          <AuditLogsTab sinceHours={sinceHours} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TabShell({
  title, count, isLoading, onRefresh, filters, children,
}: {
  title: string; count: number; isLoading: boolean; onRefresh: () => void;
  filters?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <div>
          <h2 className="font-display text-base font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{count} registro(s) no período</p>
        </div>
        <div className="flex items-center gap-2">
          {filters}
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
            <RefreshCw className={"mr-2 h-3.5 w-3.5 " + (isLoading ? "animate-spin" : "")} />
            Atualizar
          </Button>
        </div>
      </div>
      {children}
    </section>
  );
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  const s = (status ?? "").toLowerCase();
  let cls = "bg-muted text-muted-foreground";
  if (["sent", "delivered", "processed", "success", "completed"].includes(s))
    cls = "bg-emerald-500/10 text-emerald-700";
  else if (["failed", "bounced", "error"].includes(s))
    cls = "bg-destructive/10 text-destructive";
  else if (["queued", "pending", "received"].includes(s))
    cls = "bg-amber-500/10 text-amber-700";
  else if (["ignored"].includes(s))
    cls = "bg-slate-500/10 text-slate-700";
  return <Badge className={cls}>{status ?? "—"}</Badge>;
}

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("pt-BR"); } catch { return iso; }
}

function JsonViewer({ value, label = "Ver payload" }: { value: any; label?: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 text-xs">{label}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Payload</DialogTitle></DialogHeader>
        <pre className="max-h-[60vh] overflow-auto rounded-md bg-muted/40 p-3 text-xs">
          {JSON.stringify(value ?? {}, null, 2)}
        </pre>
      </DialogContent>
    </Dialog>
  );
}

// --------------- Emails ---------------
function EmailLogsTab({ sinceHours }: { sinceHours: number }) {
  const fetchFn = useServerFn(listEmailLogsForMaster);
  const [status, setStatus] = useState<string>("all");
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["master-logs-emails", sinceHours],
    queryFn: () => fetchFn({ data: { since_hours: sinceHours } }),
    refetchInterval: REFRESH_MS,
  });
  const all: any[] = (data as any)?.rows ?? [];
  const rows = status === "all" ? all : all.filter((r) => r.status === status);

  return (
    <TabShell
      title="Emails enviados"
      count={rows.length}
      isLoading={isLoading || isFetching}
      onRefresh={() => refetch()}
      filters={
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="queued">Queued</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="bounced">Bounced</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      {isLoading ? <Loading /> : rows.length === 0 ? <Empty msg="Nenhum email no período." /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Quando</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Propósito</th>
                <th className="px-4 py-2">Para</th>
                <th className="px-4 py-2">Assunto</th>
                <th className="px-4 py-2">Erro / ID</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">{fmt(r.created_at)}</td>
                  <td className="px-4 py-2"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-2"><Badge variant="outline">{r.purpose}</Badge></td>
                  <td className="px-4 py-2 font-mono text-xs">{r.to_email}</td>
                  <td className="px-4 py-2 max-w-xs truncate">{r.subject}</td>
                  <td className="px-4 py-2 text-xs">
                    {r.error_message && <div className="text-destructive max-w-xs truncate">{r.error_message}</div>}
                    {r.provider_message_id && <div className="font-mono text-muted-foreground truncate max-w-xs">{r.provider_message_id}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </TabShell>
  );
}

// --------------- Flow step runs ---------------
function FlowLogsTab({ sinceHours }: { sinceHours: number }) {
  const fetchFn = useServerFn(listFlowStepRunsForMaster);
  const [onlyFailed, setOnlyFailed] = useState(false);
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["master-logs-flows", sinceHours, onlyFailed],
    queryFn: () => fetchFn({ data: { since_hours: sinceHours, only_failed: onlyFailed } }),
    refetchInterval: REFRESH_MS,
  });
  const rows: any[] = (data as any)?.rows ?? [];

  return (
    <TabShell
      title="Execução de fluxos (Builder)"
      count={rows.length}
      isLoading={isLoading || isFetching}
      onRefresh={() => refetch()}
      filters={
        <Select value={onlyFailed ? "failed" : "all"} onValueChange={(v) => setOnlyFailed(v === "failed")}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="failed">Só falhas</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      {isLoading ? <Loading /> : rows.length === 0 ? <Empty msg="Nenhuma execução no período." /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Quando</th>
                <th className="px-4 py-2">Org</th>
                <th className="px-4 py-2">Campanha</th>
                <th className="px-4 py-2">Lead</th>
                <th className="px-4 py-2">Step</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Branch</th>
                <th className="px-4 py-2">Duração</th>
                <th className="px-4 py-2">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => {
                const dur = r.started_at && r.finished_at
                  ? Math.max(0, new Date(r.finished_at).getTime() - new Date(r.started_at).getTime())
                  : null;
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">{fmt(r.started_at)}</td>
                    <td className="px-4 py-2 text-xs truncate max-w-[140px]">{r.organization_name ?? "—"}</td>
                    <td className="px-4 py-2 text-xs truncate max-w-[180px]">{r.campaign_name ?? "—"}</td>
                    <td className="px-4 py-2 text-xs truncate max-w-[160px]">{r.lead_name ?? "—"}</td>
                    <td className="px-4 py-2"><Badge variant="outline" className="text-[10px]">{r.step_type ?? "—"}</Badge></td>
                    <td className="px-4 py-2"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-2 text-xs">{r.branch_taken ?? "—"}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{dur != null ? `${dur}ms` : "—"}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1">
                        <JsonViewer value={{ output: r.output, error: r.error }} label="Ver" />
                        {r.error && <span className="text-xs text-destructive truncate max-w-[200px]">{r.error}</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </TabShell>
  );
}

// --------------- Webhooks ---------------
function WebhookLogsTab({ sinceHours }: { sinceHours: number }) {
  const fetchFn = useServerFn(listWebhookEventsForMaster);
  const [source, setSource] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["master-logs-webhooks", sinceHours, source, status],
    queryFn: () => fetchFn({
      data: {
        since_hours: sinceHours,
        source: source === "all" ? undefined : source,
        status: status === "all" ? undefined : status,
      },
    }),
    refetchInterval: REFRESH_MS,
  });
  const rows: any[] = (data as any)?.rows ?? [];

  return (
    <TabShell
      title="Webhooks recebidos"
      count={rows.length}
      isLoading={isLoading || isFetching}
      onRefresh={() => refetch()}
      filters={
        <>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas origens</SelectItem>
              <SelectItem value="calcom">Cal.com</SelectItem>
              <SelectItem value="hook7">Hook7</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="processed">Processed</SelectItem>
              <SelectItem value="ignored">Ignored</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </>
      }
    >
      {isLoading ? <Loading /> : rows.length === 0 ? <Empty msg="Nenhum webhook no período." /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Quando</th>
                <th className="px-4 py-2">Origem</th>
                <th className="px-4 py-2">Evento</th>
                <th className="px-4 py-2">Org</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">HTTP</th>
                <th className="px-4 py-2">Erro / Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">{fmt(r.received_at)}</td>
                  <td className="px-4 py-2"><Badge variant="outline">{r.source}</Badge></td>
                  <td className="px-4 py-2 text-xs font-mono">{r.event_type ?? "—"}</td>
                  <td className="px-4 py-2 text-xs truncate max-w-[160px]">{r.organization_name ?? "—"}</td>
                  <td className="px-4 py-2"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-2 text-xs">{r.http_status ?? "—"}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1">
                      <JsonViewer value={{ payload: r.payload, headers: r.headers }} />
                      {r.error && <span className="text-xs text-destructive truncate max-w-[220px]">{r.error}</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </TabShell>
  );
}

// --------------- Audit ---------------
function AuditLogsTab({ sinceHours }: { sinceHours: number }) {
  const fetchFn = useServerFn(listAuditLogsForMaster);
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["master-logs-audit", sinceHours],
    queryFn: () => fetchFn({ data: { since_hours: sinceHours } }),
    refetchInterval: REFRESH_MS,
  });
  const rows: any[] = (data as any)?.rows ?? [];

  return (
    <TabShell
      title="Auditoria administrativa"
      count={rows.length}
      isLoading={isLoading || isFetching}
      onRefresh={() => refetch()}
    >
      {isLoading ? <Loading /> : rows.length === 0 ? (
        <div className="p-8">
          <EmptyState
            icon={ScrollText}
            title="Nenhum evento de auditoria"
            description="A captura de eventos administrativos (login, criação de organização, mudanças de plano) ainda não está plugada nas ações — entra junto com a Fase 2. Quando começarem a ser gravados, aparecem aqui."
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Quando</th>
                <th className="px-4 py-2">Ator</th>
                <th className="px-4 py-2">Ação</th>
                <th className="px-4 py-2">Entidade</th>
                <th className="px-4 py-2">Org</th>
                <th className="px-4 py-2">IP</th>
                <th className="px-4 py-2">Diff</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">{fmt(r.created_at)}</td>
                  <td className="px-4 py-2 text-xs">{r.actor_name ?? "—"}</td>
                  <td className="px-4 py-2"><Badge variant="outline">{r.action}</Badge></td>
                  <td className="px-4 py-2 text-xs">
                    {r.entity_type ?? "—"}
                    {r.entity_id && <div className="font-mono text-muted-foreground text-[10px] truncate max-w-[180px]">{r.entity_id}</div>}
                  </td>
                  <td className="px-4 py-2 text-xs truncate max-w-[160px]">{r.organization_name ?? "—"}</td>
                  <td className="px-4 py-2 text-xs font-mono text-muted-foreground">{r.ip_address ?? "—"}</td>
                  <td className="px-4 py-2">
                    <JsonViewer value={{ before: r.before, after: r.after }} label="Ver diff" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </TabShell>
  );
}

function Loading() {
  return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
}
function Empty({ msg }: { msg: string }) {
  return <div className="p-6 text-sm text-muted-foreground">{msg}</div>;
}
