import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Building2, Users, CircleDot, PauseCircle, Activity, Sparkles, AlertCircle, ArrowUpRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { getMasterOverview } from "@/lib/master.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_master/master")({
  component: MasterOverview,
});

function MasterOverview() {
  const fetchOverview = useServerFn(getMasterOverview);
  const { data, isLoading, error } = useQuery({
    queryKey: ["master", "overview"],
    queryFn: () => fetchOverview(),
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Visão consolidada da plataforma Leaderei — apenas dados reais.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-md border bg-surface px-2.5 py-1 text-xs text-muted-foreground">
          <Activity className="h-3.5 w-3.5 text-emerald-500" />
          Backend conectado
        </div>
      </div>

      {error ? (
        <ErrorBox message={(error as Error).message} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard icon={Building2} label="Organizações" value={data?.totals.companies} hint={`${data?.totals.active ?? 0} ativas`} loading={isLoading} />
            <KpiCard icon={CircleDot} label="Em trial" value={data?.totals.trial} loading={isLoading} accent="text-amber-600" />
            <KpiCard icon={PauseCircle} label="Inativas" value={data?.totals.inactive} loading={isLoading} accent="text-muted-foreground" />
            <KpiCard icon={Users} label="Membros" value={data?.totals.members} hint={`${data?.totals.profiles ?? 0} perfis no total`} loading={isLoading} />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="rounded-xl border bg-surface">
              <div className="flex items-center justify-between border-b px-5 py-3">
                <h2 className="font-display text-sm font-semibold">Organizações recentes</h2>
                <Link to="/master/organizations" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  Ver todas <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
              {isLoading ? (
                <div className="space-y-2 p-5">
                  {[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded bg-surface-muted/60" />)}
                </div>
              ) : !data?.recent.length ? (
                <EmptyHint />
              ) : (
                <ul className="divide-y">
                  {data.recent.map((c) => (
                    <li key={c.id} className="flex items-center justify-between px-5 py-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{c.name}</div>
                        <div className="font-mono text-xs text-muted-foreground">{c.slug}</div>
                      </div>
                      <StatusPill status={c.status as CompanyStatus} />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border bg-surface p-5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-brand" />
                <h2 className="font-display text-sm font-semibold">Próximas fases</h2>
              </div>
              <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                <li>• MRR e cobrança quando billing entrar</li>
                <li>• Eventos de auditoria reais (logs)</li>
                <li>• Métricas de uso por organização</li>
                <li>• Convites e gestão de membros master-side</li>
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared (used here and in /organizations)
// ---------------------------------------------------------------------------

export type CompanyStatus = "active" | "trial" | "inactive";

const STATUS_META: Record<CompanyStatus, { label: string; dot: string; chip: string }> = {
  active:   { label: "Ativa",   dot: "bg-emerald-500", chip: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  trial:    { label: "Trial",   dot: "bg-amber-500",   chip: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  inactive: { label: "Inativa", dot: "bg-muted-foreground/60", chip: "bg-muted text-muted-foreground" },
};

export function StatusPill({ status }: { status: CompanyStatus }) {
  const m = STATUS_META[status] ?? STATUS_META.inactive;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium", m.chip)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", m.dot)} />
      {m.label}
    </span>
  );
}

function KpiCard({
  icon: Icon, label, value, hint, loading, accent,
}: { icon: typeof Building2; label: string; value?: number; hint?: string; loading?: boolean; accent?: string }) {
  return (
    <div className="rounded-xl border bg-surface p-5">
      <div className="flex items-start justify-between">
        <span className="text-2xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className={cn("h-4 w-4 text-muted-foreground", accent)} />
      </div>
      <div className="mt-3 font-display text-3xl font-bold tracking-tight">
        {loading ? <span className="inline-block h-8 w-16 animate-pulse rounded bg-surface-muted/60" /> : (value ?? 0).toLocaleString("pt-BR")}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function EmptyHint() {
  return (
    <div className="p-8 text-center text-sm text-muted-foreground">
      Nenhuma organização criada ainda.
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
      <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
      <div>
        <div className="font-medium text-destructive">Não foi possível carregar o painel</div>
        <div className="mt-0.5 text-muted-foreground">{message}</div>
      </div>
    </div>
  );
}
