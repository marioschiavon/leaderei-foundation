import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  TrendingUp,
  Users,
  Inbox,
  Send,
  Play,
  Pause,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Mail,
  Linkedin,
  MessageCircle,
  Calendar,
  Plug,
  Reply,
  UserPlus,
  Activity,
} from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuthSession } from "@/lib/auth";

export const Route = createFileRoute("/_app/dashboard/")({
  component: Dashboard,
});

// ---------- mock data (estrutural; será trocado por dados reais) ----------
const KPIS = [
  { label: "Novos leads", value: "1.284", delta: "+12,4%", trend: "up", icon: Users },
  { label: "Conversas abertas", value: "327", delta: "+3,1%", trend: "up", icon: Inbox },
  { label: "Mensagens enviadas", value: "8.912", delta: "+22%", trend: "up", icon: Send },
  { label: "Taxa de resposta", value: "18,7%", delta: "+1,2pp", trend: "up", icon: TrendingUp },
];

const ACTIVE_CAMPAIGNS = [
  { name: "Outbound — SaaS LATAM", status: "Ativa", sent: 1240, reply: 18, progress: 64 },
  { name: "Webinar follow-up", status: "Ativa", sent: 192, reply: 24, progress: 42 },
  { name: "Reativação Q4", status: "Pausada", sent: 880, reply: 11, progress: 100 },
];

const RECENT_LEADS = [
  { name: "Carla Mendes", company: "Northwind", stage: "Novo", source: "LinkedIn", when: "há 4 min" },
  { name: "Pedro Lima", company: "Globex", stage: "Qualificado", source: "Email", when: "há 27 min" },
  { name: "Sofia Reis", company: "Initech", stage: "Em conversa", source: "Inbound", when: "há 1 h" },
  { name: "Marcos Tavares", company: "Umbrella", stage: "Proposta", source: "LinkedIn", when: "há 3 h" },
  { name: "Beatriz Costa", company: "Stark Co", stage: "Novo", source: "Importado", when: "ontem" },
];

const INTEGRATIONS = [
  { name: "Email", icon: Mail, connected: true },
  { name: "LinkedIn", icon: Linkedin, connected: false },
  { name: "WhatsApp", icon: MessageCircle, connected: false },
  { name: "Calendar", icon: Calendar, connected: true },
];

const ACTIVITY = [
  { icon: Reply, text: "Sofia Reis respondeu na campanha Outbound — SaaS LATAM", when: "há 12 min" },
  { icon: UserPlus, text: "23 novos leads importados via CSV", when: "há 1 h" },
  { icon: Send, text: "Sequência Webinar follow-up enviou 96 mensagens", when: "há 2 h" },
  { icon: Pause, text: "Reativação Q4 foi pausada por limite de envio diário", when: "há 5 h" },
  { icon: CheckCircle2, text: "Google Calendar reconectado com sucesso", when: "ontem" },
];

const ALERTS = [
  { level: "warn", text: "LinkedIn não conectado — campanhas multicanal limitadas.", cta: "Conectar", href: "/dashboard/integrations" },
  { level: "warn", text: "Domínio de envio sem SPF/DKIM verificados.", cta: "Verificar", href: "/dashboard/settings" },
  { level: "info", text: "Reativação Q4 atingiu o limite diário de envio.", cta: "Revisar", href: "/dashboard/campaigns" },
];

const NEXT_STEPS = [
  { text: "Conectar primeira caixa de email", done: true, href: "/dashboard/integrations" },
  { text: "Importar lista inicial de leads", done: true, href: "/dashboard/leads" },
  { text: "Conectar LinkedIn", done: false, href: "/dashboard/integrations" },
  { text: "Configurar pipeline padrão", done: false, href: "/dashboard/settings" },
  { text: "Convidar membros da equipe", done: false, href: "/dashboard/settings" },
];

const stageStyle: Record<string, string> = {
  Novo: "bg-muted text-foreground",
  Qualificado: "bg-secondary/10 text-secondary",
  "Em conversa": "bg-brand/10 text-brand",
  Proposta: "bg-foreground text-background",
};

const statusStyle: Record<string, string> = {
  Ativa: "bg-brand/10 text-brand",
  Pausada: "bg-muted text-muted-foreground",
  Rascunho: "bg-secondary/10 text-secondary",
};

function Dashboard() {
  const { user } = useAuthSession();
  const fullName =
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email?.split("@")[0] ??
    "";
  const firstName = fullName.split(" ")[0] || "olá";
  const orgName = (user?.user_metadata?.org_name as string | undefined) ?? "sua organização";
  const completed = NEXT_STEPS.filter((s) => s.done).length;
  const onboardingPct = Math.round((completed / NEXT_STEPS.length) * 100);

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Olá, ${firstName}`}
        description={`Resumo operacional de ${orgName} nos últimos 7 dias (UI estrutural — números ainda não refletem dados reais).`}
        actions={
          <Button asChild>
            <Link to="/dashboard/campaigns">
              <Plus className="h-4 w-4" />
              Nova campanha
            </Link>

          </Button>
        }
      />

      {/* Visão geral — KPIs */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KPIS.map((k) => (
          <div key={k.label} className="rounded-xl border bg-surface p-5">
            <div className="flex items-start justify-between">
              <span className="label-exec text-muted-foreground">{k.label}</span>
              <k.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-3 font-display text-3xl font-bold tracking-tight">
              {k.value}
            </div>
            <div className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand">
              <ArrowUpRight className="h-3 w-3" />
              {k.delta}
              <span className="ml-1 text-muted-foreground">vs. semana anterior</span>
            </div>
          </div>
        ))}
      </section>

      {/* Linha 1 — Atividade da semana + Próximos passos */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-surface p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-semibold">Atividade da semana</h2>
              <p className="text-xs text-muted-foreground">Mensagens enviadas por dia</p>
            </div>
            <span className="label-exec text-muted-foreground">7 dias</span>
          </div>
          <div className="flex h-56 items-end gap-2">
            {[40, 65, 48, 72, 90, 58, 84].map((v, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <div
                  className="w-full rounded-t bg-secondary/80 transition-colors hover:bg-brand"
                  style={{ height: `${v}%` }}
                />
                <span className="text-[0.65rem] text-muted-foreground">
                  {["S", "T", "Q", "Q", "S", "S", "D"][i]}
                </span>
              </div>
            ))}
          </div>
        </div>

        <OnboardingCard pct={onboardingPct} done={completed} total={NEXT_STEPS.length} />
      </section>

      {/* Linha 2 — Campanhas + Alertas */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-surface p-6 lg:col-span-2">
          <SectionHeader
            title="Campanhas em destaque"
            subtitle="Sequências ativas e recém-pausadas"
            href="/dashboard/campaigns"
          />
          <div className="mt-4 space-y-3">
            {ACTIVE_CAMPAIGNS.map((c) => (
              <div
                key={c.name}
                className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 rounded-lg border bg-background p-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{c.name}</span>
                    <Badge
                      variant="secondary"
                      className={`${statusStyle[c.status]} border-transparent font-normal`}
                    >
                      {c.status}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Progress value={c.progress} className="h-1 max-w-[220px]" />
                    <span className="text-xs text-muted-foreground">{c.progress}%</span>
                  </div>
                </div>
                <MiniStat label="Enviadas" value={c.sent} />
                <MiniStat label="Respostas" value={c.reply} accent />
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  {c.status === "Ativa" ? (
                    <Pause className="h-3.5 w-3.5" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-surface p-6">
          <SectionHeader title="Alertas" subtitle={`${ALERTS.length} para revisar`} />
          <ul className="mt-4 space-y-3">
            {ALERTS.map((a, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-lg border bg-background p-3"
              >
                <div
                  className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md ${
                    a.level === "warn"
                      ? "bg-brand-soft text-brand"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug">{a.text}</p>
                  <Link
                    to={a.href}
                    className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
                  >
                    {a.cta}
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Linha 3 — Leads recentes + Integrações */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-surface p-6 lg:col-span-2">
          <SectionHeader
            title="Leads recentes"
            subtitle="Últimas entradas no funil"
            href="/dashboard/leads"
          />
          <div className="mt-4 divide-y">
            {RECENT_LEADS.map((l) => (
              <div
                key={l.name}
                className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{l.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {l.company} · {l.source}
                  </div>
                </div>
                <Badge
                  variant="secondary"
                  className={`${stageStyle[l.stage]} border-transparent font-normal`}
                >
                  {l.stage}
                </Badge>
                <span className="text-xs text-muted-foreground">{l.when}</span>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-surface p-6">
          <SectionHeader
            title="Integrações"
            subtitle="Status dos canais"
            href="/dashboard/integrations"
          />
          <ul className="mt-4 space-y-2">
            {INTEGRATIONS.map((i) => (
              <li
                key={i.name}
                className="flex items-center justify-between rounded-lg border bg-background px-3 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-8 w-8 place-items-center rounded-md bg-muted text-foreground">
                    <i.icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium">{i.name}</span>
                </div>
                {i.connected ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-brand">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                    Conectado
                  </span>
                ) : (
                  <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
                    <Link to="/dashboard/integrations">
                      <Plug className="h-3 w-3" />
                      Conectar
                    </Link>
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Linha 4 — Atividade recente */}
      <section className="rounded-xl border bg-surface p-6">
        <SectionHeader title="Atividade recente" subtitle="Eventos do workspace" />
        <ul className="mt-4 space-y-1">
          {ACTIVITY.map((a, i) => (
            <li
              key={i}
              className="flex items-start gap-3 rounded-md px-2 py-2.5 hover:bg-muted/40"
            >
              <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-muted text-foreground">
                <a.icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug">{a.text}</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{a.when}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-center border-t pt-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Activity className="h-3 w-3" />
            Histórico completo em breve
          </span>
        </div>
      </section>
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  href,
}: {
  title: string;
  subtitle?: string;
  href?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="font-display text-base font-semibold">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {href && (
        <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
          <Link to={href}>
            Ver tudo
            <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
      )}
    </div>
  );
}

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="w-16 text-right">
      <div className={`font-display text-base font-bold ${accent ? "text-brand" : ""}`}>
        {value}
      </div>
      <div className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function OnboardingCard({
  pct,
  done,
  total,
}: {
  pct: number;
  done: number;
  total: number;
}) {
  return (
    <div className="rounded-xl border bg-surface p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-base font-semibold">Próximos passos</h2>
          <p className="text-xs text-muted-foreground">
            {done} de {total} concluídos
          </p>
        </div>
        <span className="font-display text-2xl font-bold text-brand">{pct}%</span>
      </div>
      <Progress value={pct} className="mt-3 h-1.5" />
      <ul className="mt-4 space-y-2">
        {NEXT_STEPS.map((s) => (
          <li key={s.text}>
            <Link
              to={s.href}
              className="group flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/40"
            >
              {s.done ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-brand" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <span
                className={`flex-1 text-sm ${
                  s.done ? "text-muted-foreground line-through" : ""
                }`}
              >
                {s.text}
              </span>
              <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
