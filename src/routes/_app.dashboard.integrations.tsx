import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Circle,
  Clock3,
  Mail,
  MessageCircle,
  Plug,
  type LucideIcon,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listIntegrations } from "@/lib/tenant.functions";

export const Route = createFileRoute("/_app/dashboard/integrations")({
  component: IntegrationsPage,
});

const SLUG_ICON: Record<string, LucideIcon> = {
  resend: Mail,
  linkedin: MessageCircle,
  whatsapp: MessageCircle,
  hubspot: Building2,
  pipedrive: Briefcase,
  apollo: Users,
  "google-calendar": Calendar,
};

const STATUS_META: Record<string, { label: string; icon: LucideIcon; className: string; helper: string }> = {
  connected: {
    label: "Conectado",
    icon: CheckCircle2,
    className: "bg-emerald-500/10 text-emerald-700",
    helper: "Integração ativa para este tenant.",
  },
  pending: {
    label: "Pendente",
    icon: Clock3,
    className: "bg-amber-500/10 text-amber-700",
    helper: "Setup iniciado, aguardando conclusão.",
  },
  error: {
    label: "Erro",
    icon: AlertTriangle,
    className: "bg-destructive/10 text-destructive",
    helper: "Última sincronização ou autenticação falhou.",
  },
  disconnected: {
    label: "Desconectado",
    icon: Circle,
    className: "bg-muted text-muted-foreground",
    helper: "Provider disponível, sem conexão ativa ainda.",
  },
};

function IntegrationsPage() {
  const fetch = useServerFn(listIntegrations);
  const { data, isLoading, error } = useQuery({
    queryKey: ["integrations"],
    queryFn: () => fetch(),
  });

  const integrations = data ?? [];
  const connectedCount = integrations.filter((provider) => provider.connection?.status === "connected").length;
  const pendingCount = integrations.filter((provider) => provider.connection?.status === "pending").length;
  const errorCount = integrations.filter((provider) => provider.connection?.status === "error").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrações"
        description="Status reais dos provedores disponíveis para a organização atual."
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <SummaryCard label="Disponíveis" value={integrations.length} loading={isLoading} />
        <SummaryCard label="Conectadas" value={connectedCount} loading={isLoading} accent />
        <SummaryCard label="Pendentes" value={pendingCount} loading={isLoading} />
        <SummaryCard label="Com erro" value={errorCount} loading={isLoading} />
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading
            ? Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-48 animate-pulse rounded-xl bg-surface-muted/40" />
              ))
            : integrations.map((provider) => {
                const Icon = SLUG_ICON[provider.slug] ?? Plug;
                const status = provider.connection?.status ?? "disconnected";
                const meta = STATUS_META[status] ?? STATUS_META.disconnected;
                const StatusIcon = meta.icon;
                const syncLabel = provider.connection?.last_synced_at
                  ? new Date(provider.connection.last_synced_at).toLocaleString("pt-BR")
                  : null;

                return (
                  <div key={provider.id} className="flex flex-col rounded-xl border bg-surface p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-md border bg-background text-foreground">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="font-display text-base font-semibold leading-tight">{provider.name}</h3>
                          <p className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">{provider.category}</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className={`${meta.className} gap-1 border-transparent font-normal`}>
                        <StatusIcon className="h-3 w-3" />
                        {meta.label}
                      </Badge>
                    </div>

                    <p className="mt-4 text-sm text-muted-foreground">
                      {provider.connection?.display_name
                        ? `${provider.connection.display_name}. ${meta.helper}`
                        : provider.description || meta.helper}
                    </p>

                    <div className="mt-4 space-y-2 rounded-lg border bg-background p-3 text-xs text-muted-foreground">
                      <div className="flex items-center justify-between gap-3">
                        <span>Status operacional</span>
                        <span className="font-medium text-foreground">{meta.label}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Último sync</span>
                        <span>{syncLabel ?? "Ainda não sincronizado"}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Readiness</span>
                        <span>{provider.connection ? "Configuração iniciada" : "Aguardando setup"}</span>
                      </div>
                    </div>

                    {provider.connection?.last_error && (
                      <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                        {provider.connection.last_error}
                      </p>
                    )}

                    <div className="mt-5 flex-1" />

                    <Button variant={status === "connected" ? "outline" : "default"} size="sm" className="w-full">
                      {status === "connected" ? "Gerenciar" : "Configurar"}
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

function SummaryCard({
  label,
  value,
  loading,
  accent,
}: {
  label: string;
  value: number;
  loading?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-surface p-5">
      <div className="label-exec text-muted-foreground">{label}</div>
      <div className={`mt-2 font-display text-2xl font-bold tracking-tight tabular-nums ${accent ? "text-brand" : ""}`}>
        {loading ? "..." : value}
      </div>
    </div>
  );
}
