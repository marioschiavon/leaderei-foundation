import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Plus,
  Play,
  Pause,
  MoreHorizontal,
  Search,
  Mail,
  Linkedin,
  MessageCircle,
  Megaphone,
  TrendingUp,
  Users,
  Send,
  Reply,
  LayoutGrid,
  Rows3,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/dashboard/campaigns")({
  component: CampaignsPage,
});

// ---------------------------------------------------------------------------
// Domain
// ---------------------------------------------------------------------------

type CampaignStatus = "active" | "paused" | "draft" | "scheduled" | "finished";
type Channel = "email" | "linkedin" | "whatsapp";

type Campaign = {
  id: string;
  name: string;
  goal: string;
  status: CampaignStatus;
  channels: Channel[];
  leads: number;
  sent: number;
  replied: number;
  progress: number;
  updatedAt: string;
  owner: string;
};

const STATUS_META: Record<CampaignStatus, { label: string; dot: string; chip: string }> = {
  active:    { label: "Em execução", dot: "bg-emerald-500", chip: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  paused:    { label: "Pausada",     dot: "bg-amber-500",   chip: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  draft:     { label: "Rascunho",    dot: "bg-muted-foreground/60", chip: "bg-muted text-muted-foreground" },
  scheduled: { label: "Agendada",    dot: "bg-sky-500",     chip: "bg-sky-500/10 text-sky-700 dark:text-sky-300" },
  finished:  { label: "Concluída",   dot: "bg-foreground/60", chip: "bg-foreground/5 text-foreground/70" },
};

const CHANNEL_META: Record<Channel, { label: string; icon: LucideIcon }> = {
  email:    { label: "Email",    icon: Mail },
  linkedin: { label: "LinkedIn", icon: Linkedin },
  whatsapp: { label: "WhatsApp", icon: MessageCircle },
};

const CAMPAIGNS: Campaign[] = [
  {
    id: "c1",
    name: "Outbound — SaaS LATAM",
    goal: "Gerar reuniões com Heads de RevOps em SaaS B2B (BR/MX/AR).",
    status: "active",
    channels: ["email", "linkedin"],
    leads: 412, sent: 1240, replied: 188, progress: 64,
    updatedAt: "há 12 min", owner: "Marina",
  },
  {
    id: "c2",
    name: "Reativação Q4",
    goal: "Reengajar contas frias dos últimos 180 dias.",
    status: "paused",
    channels: ["email"],
    leads: 220, sent: 880, replied: 41, progress: 100,
    updatedAt: "ontem", owner: "Marina",
  },
  {
    id: "c3",
    name: "Webinar follow-up",
    goal: "Converter inscritos do webinar em demos qualificadas.",
    status: "active",
    channels: ["email", "whatsapp"],
    leads: 96, sent: 192, replied: 48, progress: 42,
    updatedAt: "há 1 h", owner: "Pedro",
  },
  {
    id: "c4",
    name: "Cold LinkedIn — Diretores",
    goal: "Prospecção fria de Diretores Comerciais (250+ empresas).",
    status: "draft",
    channels: ["linkedin"],
    leads: 0, sent: 0, replied: 0, progress: 0,
    updatedAt: "há 3 dias", owner: "Você",
  },
  {
    id: "c5",
    name: "Lançamento Produto v2",
    goal: "Anunciar v2 para base existente segmentada por uso.",
    status: "scheduled",
    channels: ["email", "whatsapp"],
    leads: 1320, sent: 0, replied: 0, progress: 0,
    updatedAt: "agendada · 28/05",
    owner: "Marina",
  },
];

const STATUS_FILTERS: { value: "all" | CampaignStatus; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "active", label: "Em execução" },
  { value: "scheduled", label: "Agendadas" },
  { value: "paused", label: "Pausadas" },
  { value: "draft", label: "Rascunhos" },
  { value: "finished", label: "Concluídas" },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function CampaignsPage() {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [statusFilter, setStatusFilter] = useState<"all" | CampaignStatus>("all");
  const [query, setQuery] = useState("");
  const [empty, setEmpty] = useState(false);

  const data = empty ? [] : CAMPAIGNS;

  const filtered = useMemo(() => {
    return data.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (query && !c.name.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [data, statusFilter, query]);

  const totals = useMemo(() => {
    return data.reduce(
      (acc, c) => ({
        active: acc.active + (c.status === "active" ? 1 : 0),
        leads: acc.leads + c.leads,
        sent: acc.sent + c.sent,
        replied: acc.replied + c.replied,
      }),
      { active: 0, leads: 0, sent: 0, replied: 0 }
    );
  }, [data]);

  const replyRate = totals.sent ? Math.round((totals.replied / totals.sent) * 1000) / 10 : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campanhas"
        description="Sequências multicanal automatizadas. Crie, monitore e otimize."
        actions={
          <>
            <Button variant="outline" onClick={() => setEmpty((v) => !v)}>
              <Sparkles className="h-4 w-4" />
              {empty ? "Ver exemplos" : "Ver estado vazio"}
            </Button>
            <Button>
              <Plus className="h-4 w-4" />
              Nova campanha
            </Button>
          </>
        }
      />

      {/* KPI strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={Megaphone} label="Em execução" value={totals.active} hint={`${data.length} no total`} />
        <KpiCard icon={Users}     label="Leads alcançados" value={totals.leads.toLocaleString("pt-BR")} />
        <KpiCard icon={Send}      label="Mensagens enviadas" value={totals.sent.toLocaleString("pt-BR")} />
        <KpiCard icon={Reply}     label="Taxa de resposta" value={`${replyRate}%`} hint={`${totals.replied} respostas`} accent />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border bg-surface p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar campanha por nome…"
              className="h-9 pl-9"
            />
          </div>
          <div className="hidden h-6 w-px bg-border lg:block" />
          <div className="flex flex-wrap items-center gap-1">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s.value}
                onClick={() => setStatusFilter(s.value)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  statusFilter === s.value
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-md border bg-surface-muted/40 p-0.5">
          <button
            onClick={() => setView("grid")}
            className={cn(
              "flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors",
              view === "grid" ? "bg-surface text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Cards
          </button>
          <button
            onClick={() => setView("list")}
            className={cn(
              "flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors",
              view === "list" ? "bg-surface text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Rows3 className="h-3.5 w-3.5" /> Lista
          </button>
        </div>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <EmptyState onCreate={() => setEmpty(false)} hasQuery={Boolean(query) || statusFilter !== "all"} />
      ) : view === "grid" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => <CampaignCard key={c.id} c={c} />)}
          <NewCampaignCard />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-surface">
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-6 border-b bg-surface-muted/40 px-5 py-2.5 text-2xs uppercase tracking-wider text-muted-foreground">
            <span>Campanha</span>
            <span className="text-right">Leads</span>
            <span className="text-right">Enviadas</span>
            <span className="text-right">Respostas</span>
            <span />
            <span />
          </div>
          {filtered.map((c) => <CampaignRow key={c.id} c={c} />)}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function KpiCard({
  icon: Icon, label, value, hint, accent,
}: { icon: LucideIcon; label: string; value: string | number; hint?: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border bg-surface p-4">
      <div className="flex items-center justify-between">
        <span className="label-exec">{label}</span>
        <Icon className={cn("h-4 w-4", accent ? "text-brand" : "text-muted-foreground")} />
      </div>
      <div className={cn("mt-2 font-display text-2xl font-bold tracking-tight", accent && "text-brand")}>
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function CampaignCard({ c }: { c: Campaign }) {
  const status = STATUS_META[c.status];
  const replyRate = c.sent ? Math.round((c.replied / c.sent) * 1000) / 10 : 0;

  return (
    <div className="group flex flex-col rounded-xl border bg-surface transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3 border-b p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
            <span className="text-xs font-medium text-muted-foreground">{status.label}</span>
          </div>
          <h3 className="mt-1.5 truncate font-display text-base font-semibold">{c.name}</h3>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.goal}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-3 divide-x divide-border border-b">
        <CardStat label="Leads" value={c.leads} />
        <CardStat label="Enviadas" value={c.sent} />
        <CardStat label="Resposta" value={`${replyRate}%`} accent />
      </div>

      <div className="space-y-3 p-4">
        <div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Progresso</span>
            <span className="font-medium">{c.progress}%</span>
          </div>
          <Progress value={c.progress} className="mt-1.5 h-1.5" />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {c.channels.map((ch) => {
              const M = CHANNEL_META[ch];
              return (
                <span
                  key={ch}
                  title={M.label}
                  className="grid h-6 w-6 place-items-center rounded-md border bg-surface-muted/40 text-muted-foreground"
                >
                  <M.icon className="h-3 w-3" />
                </span>
              );
            })}
          </div>
          <span className="text-xs text-muted-foreground">{c.updatedAt}</span>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1">
            {c.status === "active" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {c.status === "active" ? "Pausar" : "Iniciar"}
          </Button>
          <Button variant="ghost" size="sm" className="flex-1">Abrir</Button>
        </div>
      </div>
    </div>
  );
}

function CardStat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="p-3 text-center">
      <div className={cn("font-display text-base font-bold", accent && "text-brand")}>{value}</div>
      <div className="text-2xs uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function NewCampaignCard() {
  return (
    <button className="group flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border-strong bg-surface-muted/30 p-6 text-center transition-colors hover:border-brand hover:bg-brand-soft/30">
      <div className="grid h-11 w-11 place-items-center rounded-lg bg-surface text-brand shadow-sm transition-transform group-hover:scale-105">
        <Plus className="h-5 w-5" />
      </div>
      <div>
        <div className="font-display text-base font-semibold">Nova campanha</div>
        <div className="mt-1 text-xs text-muted-foreground">Comece de um template ou em branco</div>
      </div>
    </button>
  );
}

function CampaignRow({ c }: { c: Campaign }) {
  const status = STATUS_META[c.status];
  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-6 border-b px-5 py-4 last:border-b-0 hover:bg-surface-muted/30">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
          <h3 className="truncate font-display text-sm font-semibold">{c.name}</h3>
          <Badge variant="secondary" className={cn(status.chip, "border-transparent font-normal")}>
            {status.label}
          </Badge>
          <div className="flex items-center gap-0.5">
            {c.channels.map((ch) => {
              const M = CHANNEL_META[ch];
              return <M.icon key={ch} className="h-3 w-3 text-muted-foreground" />;
            })}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <Progress value={c.progress} className="h-1.5 max-w-[240px]" />
          <span className="text-xs text-muted-foreground">{c.progress}% · {c.updatedAt}</span>
        </div>
      </div>
      <RowStat label="Leads" value={c.leads} />
      <RowStat label="Enviadas" value={c.sent} />
      <RowStat label="Respostas" value={c.replied} accent />
      <Button variant="outline" size="sm">
        {c.status === "active" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        {c.status === "active" ? "Pausar" : "Iniciar"}
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8">
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </div>
  );
}

function RowStat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="text-right">
      <div className={cn("font-display text-base font-bold", accent && "text-brand")}>
        {value.toLocaleString("pt-BR")}
      </div>
      <div className="text-2xs uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function EmptyState({ onCreate, hasQuery }: { onCreate: () => void; hasQuery: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed border-border-strong bg-surface-muted/20 p-12">
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <div className="relative">
          <div className="absolute inset-0 rounded-2xl bg-brand/10 blur-xl" />
          <div className="relative grid h-14 w-14 place-items-center rounded-2xl border bg-surface text-brand shadow-sm">
            <Megaphone className="h-6 w-6" />
          </div>
        </div>
        <h3 className="mt-5 font-display text-xl font-bold tracking-tight">
          {hasQuery ? "Nenhuma campanha encontrada" : "Nenhuma campanha por aqui"}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {hasQuery
            ? "Ajuste a busca ou os filtros para ver mais resultados."
            : "Crie sua primeira sequência multicanal e comece a engajar leads de forma automatizada."}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Button onClick={onCreate}>
            <Plus className="h-4 w-4" />
            Criar campanha
          </Button>
          <Button variant="outline">
            <TrendingUp className="h-4 w-4" />
            Explorar templates
          </Button>
        </div>

        <div className="mt-8 grid w-full grid-cols-3 gap-2">
          {["Outbound frio", "Reativação", "Pós-evento"].map((t) => (
            <div key={t} className="rounded-lg border bg-surface px-3 py-2 text-left">
              <div className="text-2xs uppercase tracking-wider text-muted-foreground">Template</div>
              <div className="mt-0.5 text-xs font-medium">{t}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
