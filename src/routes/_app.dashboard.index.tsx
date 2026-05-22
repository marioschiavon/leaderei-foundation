import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight, Plus, Users, Inbox, Send, Megaphone, Sparkles, Plug, Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { useAuthSession } from "@/lib/auth";
import { getDashboardSummary, getMyContext } from "@/lib/tenant.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/dashboard/")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuthSession();
  const fetchSummary = useServerFn(getDashboardSummary);
  const fetchContext = useServerFn(getMyContext);

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: () => fetchSummary(),
  });

  const { data: ctx } = useQuery({
    queryKey: ["tenant", "context"],
    queryFn: () => fetchContext(),
  });

  const fullName =
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email?.split("@")[0] ?? "";
  const firstName = fullName.split(" ")[0] || "olá";
  const orgName = ctx?.organization?.name ?? "sua organização";

  const isEmpty =
    summary &&
    summary.leads_total === 0 &&
    summary.campaigns_active === 0 &&
    summary.conversations_open === 0 &&
    summary.messages_sent_7d === 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Olá, ${firstName}`}
        description={`Resumo operacional de ${orgName}.`}
        actions={
          <Button asChild>
            <Link to="/dashboard/campaigns">
              <Plus className="h-4 w-4" />
              Nova campanha
            </Link>
          </Button>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Leads" value={summary?.leads_total} hint={`${summary?.leads_new ?? 0} novos`} icon={Users} loading={loadingSummary} />
        <Kpi label="Conversas abertas" value={summary?.conversations_open} icon={Inbox} loading={loadingSummary} />
        <Kpi label="Mensagens (7d)" value={summary?.messages_sent_7d} icon={Send} loading={loadingSummary} />
        <Kpi label="Campanhas ativas" value={summary?.campaigns_active} icon={Megaphone} loading={loadingSummary} />
      </section>

      {isEmpty && (
        <section className="rounded-2xl border border-dashed bg-surface px-6 py-10">
          <div className="mx-auto flex max-w-xl flex-col items-center text-center">
            <div className="grid h-12 w-12 place-items-center rounded-xl border bg-background text-brand">
              <Sparkles className="h-5 w-5" />
            </div>
            <h2 className="mt-4 font-display text-xl font-bold tracking-tight">Bem-vindo ao Leaderei</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Ainda não há atividade. Comece conectando seus canais e adicionando os primeiros leads.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <Button asChild>
                <Link to="/dashboard/integrations"><Plug className="h-4 w-4" /> Conectar canais</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/dashboard/leads"><Users className="h-4 w-4" /> Importar leads</Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {!isEmpty && (
        <section className="grid gap-4 lg:grid-cols-3">
          <QuickLink to="/dashboard/leads" icon={Users} title="Leads" desc="Pipeline, qualificação e contexto." />
          <QuickLink to="/dashboard/campaigns" icon={Megaphone} title="Campanhas" desc="Sequências multicanal automatizadas." />
          <QuickLink to="/dashboard/inbox" icon={Inbox} title="Inbox" desc="Conversas centralizadas por canal." />
        </section>
      )}
    </div>
  );
}

function Kpi({
  label, value, hint, icon: Icon, loading,
}: { label: string; value?: number; hint?: string; icon: typeof Users; loading?: boolean }) {
  return (
    <div className="rounded-xl border bg-surface p-5">
      <div className="flex items-start justify-between">
        <span className="label-exec text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-3 font-display text-3xl font-bold tracking-tight tabular-nums">
        {loading
          ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          : (value ?? 0).toLocaleString("pt-BR")}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function QuickLink({
  to, icon: Icon, title, desc,
}: { to: string; icon: typeof Users; title: string; desc: string }) {
  return (
    <Link to={to} className={cn("group flex items-center gap-4 rounded-xl border bg-surface p-5 transition-colors hover:border-foreground/20")}>
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-muted text-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-display text-sm font-semibold">{title}</div>
        <div className="truncate text-xs text-muted-foreground">{desc}</div>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
