import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2, Circle, AlertTriangle, ArrowRight, Plug, type LucideIcon,
  Mail, Linkedin, MessageCircle, Building2, Briefcase, Users, Calendar,
} from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listIntegrations } from "@/lib/tenant.functions";

export const Route = createFileRoute("/_app/dashboard/integrations")({
  component: IntegrationsPage,
});

const SLUG_ICON: Record<string, LucideIcon> = {
  email: Mail,
  linkedin: Linkedin,
  whatsapp: MessageCircle,
  hubspot: Building2,
  pipedrive: Briefcase,
  apollo: Users,
  "google-calendar": Calendar,
};

const STATUS_META: Record<string, { label: string; icon: LucideIcon; class: string }> = {
  connected:  { label: "Conectado",   icon: CheckCircle2, class: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  pending:    { label: "Pendente",    icon: AlertTriangle, class: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  error:      { label: "Erro",        icon: AlertTriangle, class: "bg-destructive/10 text-destructive" },
  disconnected:{label: "Desconectado",icon: Circle,       class: "bg-muted text-muted-foreground" },
};

function IntegrationsPage() {
  const fetch = useServerFn(listIntegrations);
  const { data, isLoading, error } = useQuery({ queryKey: ["integrations"], queryFn: () => fetch() });

  const connectedCount = (data ?? []).filter((p) => p.connection?.status === "connected").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrações"
        description="Canais, CRMs e ferramentas externas conectadas à organização."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Disponíveis" value={data?.length ?? 0} loading={isLoading} />
        <SummaryCard label="Conectadas" value={connectedCount} loading={isLoading} accent />
        <SummaryCard label="Pendentes" value={(data ?? []).filter((p) => p.connection?.status === "pending").length} loading={isLoading} />
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-44 animate-pulse rounded-xl bg-surface-muted/40" />
              ))
            : (data ?? []).map((p) => {
                const Icon = SLUG_ICON[p.slug] ?? Plug;
                const status = p.connection?.status ?? "disconnected";
                const meta = STATUS_META[status] ?? STATUS_META.disconnected;
                const StatusIcon = meta.icon;
                return (
                  <div key={p.id} className="flex flex-col rounded-xl border bg-surface p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-md border bg-background text-foreground">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="font-display text-base font-semibold leading-tight">{p.name}</h3>
                          <p className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">{p.category}</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className={`${meta.class} gap-1 border-transparent font-normal`}>
                        <StatusIcon className="h-3 w-3" />
                        {meta.label}
                      </Badge>
                    </div>
                    {p.description && <p className="mt-4 text-sm text-muted-foreground">{p.description}</p>}
                    {p.connection?.last_error && (
                      <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                        {p.connection.last_error}
                      </p>
                    )}
                    <div className="mt-5 flex-1" />
                    <Button variant={status === "connected" ? "outline" : "default"} size="sm" className="w-full">
                      {status === "connected" ? "Gerenciar" : "Conectar"}
                      {status !== "connected" && <ArrowRight className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                );
              })}
        </section>
      )}
    </div>
  );
}

function SummaryCard({ label, value, loading, accent }: { label: string; value: number; loading?: boolean; accent?: boolean }) {
  return (
    <div className="rounded-xl border bg-surface p-5">
      <div className="label-exec text-muted-foreground">{label}</div>
      <div className={`mt-2 font-display text-2xl font-bold tracking-tight tabular-nums ${accent ? "text-brand" : ""}`}>
        {loading ? "…" : value}
      </div>
    </div>
  );
}
