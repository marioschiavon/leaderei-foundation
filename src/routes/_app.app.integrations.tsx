import { createFileRoute } from "@tanstack/react-router";
import {
  Users,
  Linkedin,
  Building2,
  Briefcase,
  MessageCircle,
  Mail,
  Mic,
  ArrowRight,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Clock,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/app/integrations")({
  component: IntegrationsPage,
});

type IntegrationStatus =
  | "connected"
  | "not_connected"
  | "setup_required"
  | "coming_soon"
  | "internal_setup";

type Integration = {
  name: string;
  category: string;
  desc: string;
  icon: LucideIcon;
  status: IntegrationStatus;
  note?: string;
};

const INTEGRATIONS: Integration[] = [
  {
    name: "Apollo",
    category: "Sourcing de leads",
    desc: "Importe contatos e empresas direto do banco de dados B2B do Apollo.",
    icon: Users,
    status: "not_connected",
  },
  {
    name: "LinkedIn",
    category: "Canal de prospecção",
    desc: "Envio de convites, mensagens e InMails. Automação limitada nesta fase.",
    icon: Linkedin,
    status: "setup_required",
    note: "Requer extensão e validação de conta antes do primeiro envio.",
  },
  {
    name: "HubSpot",
    category: "CRM",
    desc: "Sincronize contatos, deals e atividades com seu HubSpot.",
    icon: Building2,
    status: "not_connected",
  },
  {
    name: "Pipedrive",
    category: "CRM",
    desc: "Envie leads qualificados para o pipeline e atualize estágios automaticamente.",
    icon: Briefcase,
    status: "connected",
    note: "Pipeline padrão: Outbound LATAM.",
  },
  {
    name: "WhatsApp API",
    category: "Mensageria",
    desc: "Conversas 1:1 via WhatsApp Cloud API com número oficial.",
    icon: MessageCircle,
    status: "internal_setup",
    note: "Provisionamento do número e templates feito pelo time Leaderei.",
  },
  {
    name: "Resend",
    category: "Email transacional",
    desc: "Envio de emails de cadência e notificações com domínio próprio verificado.",
    icon: Mail,
    status: "setup_required",
    note: "Faltam registros SPF e DKIM do domínio de envio.",
  },
  {
    name: "ElevenLabs",
    category: "Voz / IA",
    desc: "Geração de voz para mensagens de áudio e agentes de chamada.",
    icon: Mic,
    status: "coming_soon",
  },
];

const STATUS_META: Record<
  IntegrationStatus,
  {
    label: string;
    icon: LucideIcon;
    badgeClass: string;
    dotClass: string;
    cta: string;
    ctaVariant: "default" | "outline" | "ghost";
    ctaDisabled?: boolean;
  }
> = {
  connected: {
    label: "Connected",
    icon: CheckCircle2,
    badgeClass: "bg-brand/10 text-brand",
    dotClass: "bg-brand",
    cta: "Gerenciar",
    ctaVariant: "outline",
  },
  not_connected: {
    label: "Not connected",
    icon: Circle,
    badgeClass: "bg-muted text-muted-foreground",
    dotClass: "bg-muted-foreground/60",
    cta: "Conectar",
    ctaVariant: "default",
  },
  setup_required: {
    label: "Setup required",
    icon: AlertTriangle,
    badgeClass: "bg-brand-soft text-brand",
    dotClass: "bg-brand",
    cta: "Concluir setup",
    ctaVariant: "default",
  },
  coming_soon: {
    label: "Coming soon",
    icon: Clock,
    badgeClass: "bg-muted text-muted-foreground",
    dotClass: "bg-muted-foreground/40",
    cta: "Em breve",
    ctaVariant: "ghost",
    ctaDisabled: true,
  },
  internal_setup: {
    label: "Internal setup needed",
    icon: Wrench,
    badgeClass: "bg-secondary/10 text-secondary",
    dotClass: "bg-secondary",
    cta: "Solicitar provisionamento",
    ctaVariant: "outline",
  },
};

function IntegrationsPage() {
  const counts = INTEGRATIONS.reduce(
    (acc, i) => {
      acc[i.status] = (acc[i.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<IntegrationStatus, number>,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrações"
        description="Conecte canais, CRMs e ferramentas externas à sua organização."
      />

      {/* Resumo de estados */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {(Object.keys(STATUS_META) as IntegrationStatus[]).map((s) => {
          const meta = STATUS_META[s];
          return (
            <div
              key={s}
              className="flex items-center justify-between rounded-lg border bg-surface px-4 py-3"
            >
              <div className="flex items-center gap-2.5">
                <span className={`h-2 w-2 rounded-full ${meta.dotClass}`} />
                <span className="text-xs font-medium text-foreground">{meta.label}</span>
              </div>
              <span className="font-display text-sm font-bold tabular-nums">
                {counts[s] ?? 0}
              </span>
            </div>
          );
        })}
      </section>

      {/* Grid de integrações */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {INTEGRATIONS.map((i) => {
          const meta = STATUS_META[i.status];
          const StatusIcon = meta.icon;
          return (
            <div
              key={i.name}
              className="flex flex-col rounded-xl border bg-surface p-5"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-md border bg-background text-foreground">
                    <i.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-display text-base font-semibold leading-tight">
                      {i.name}
                    </h3>
                    <p className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">
                      {i.category}
                    </p>
                  </div>
                </div>
                <Badge
                  variant="secondary"
                  className={`${meta.badgeClass} gap-1 border-transparent font-normal`}
                >
                  <StatusIcon className="h-3 w-3" />
                  {meta.label}
                </Badge>
              </div>

              <p className="mt-4 text-sm text-muted-foreground">{i.desc}</p>

              {i.note && (
                <p className="mt-3 rounded-md border border-dashed bg-background px-3 py-2 text-xs text-muted-foreground">
                  {i.note}
                </p>
              )}

              <div className="mt-5 flex-1" />

              <Button
                variant={meta.ctaVariant}
                size="sm"
                className="w-full"
                disabled={meta.ctaDisabled}
              >
                {meta.cta}
                {!meta.ctaDisabled && <ArrowRight className="h-3.5 w-3.5" />}
              </Button>
            </div>
          );
        })}
      </section>
    </div>
  );
}
