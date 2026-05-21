import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Plus,
  Filter,
  Download,
  Search,
  Linkedin,
  Mail,
  Globe,
  Upload,
  ArrowUpRight,
  Building2,
  Users,
  Sparkles,
  Inbox as InboxIcon,
  MoreHorizontal,
  X,
  ChevronRight,
  Phone,
  MapPin,
  CalendarClock,
  MessageSquare,
} from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/app/leads")({
  component: LeadsPage,
});

// ---------------------------------------------------------------------------
// Domain
// ---------------------------------------------------------------------------

type Stage = "Novo" | "Qualificado" | "Em conversa" | "Proposta" | "Ganho" | "Perdido";
type Source = "LinkedIn" | "Email" | "Inbound" | "Importado" | "Apollo";

type Lead = {
  id: string;
  name: string;
  title: string;
  company: string;
  email: string;
  phone?: string;
  location?: string;
  stage: Stage;
  source: Source;
  owner: string;
  lastTouch: string;
  score: number;
  notes?: string;
};

const LEADS: Lead[] = [
  { id: "1", name: "Carla Mendes",  title: "Head of Growth",       company: "Northwind",  email: "carla@northwind.io",  phone: "+55 11 99888-1010", location: "São Paulo, BR", stage: "Novo",         source: "LinkedIn",  owner: "Daniel S.", lastTouch: "há 2h",  score: 82 },
  { id: "2", name: "Pedro Lima",    title: "VP Sales",             company: "Globex",     email: "pedro@globex.com",     phone: "+55 21 98777-2020", location: "Rio de Janeiro, BR", stage: "Qualificado", source: "Email",     owner: "Marina C.", lastTouch: "ontem",  score: 74 },
  { id: "3", name: "Sofia Reis",    title: "CMO",                  company: "Initech",    email: "sofia@initech.dev",    location: "Lisboa, PT",         stage: "Em conversa", source: "Inbound",   owner: "Daniel S.", lastTouch: "há 30m", score: 91 },
  { id: "4", name: "Marcos Tavares",title: "Diretor Comercial",    company: "Umbrella",   email: "marcos@umbrella.co",   phone: "+55 31 97666-3030", location: "Belo Horizonte, BR", stage: "Proposta",   source: "LinkedIn",  owner: "Marina C.", lastTouch: "há 3d",  score: 88 },
  { id: "5", name: "Beatriz Costa", title: "Operations Manager",   company: "Stark Co",   email: "bia@stark.co",          location: "Curitiba, BR",       stage: "Novo",         source: "Importado", owner: "—",         lastTouch: "há 5d",  score: 41 },
  { id: "6", name: "João Almeida",  title: "Head of Partnerships", company: "Hooli",      email: "joao@hooli.com",        location: "Porto Alegre, BR",   stage: "Qualificado",  source: "Email",     owner: "Daniel S.", lastTouch: "ontem",  score: 66 },
  { id: "7", name: "Helena Duarte", title: "Founder & CEO",        company: "Pied Piper", email: "helena@piedpiper.io",   location: "Florianópolis, BR",  stage: "Em conversa",  source: "Apollo",    owner: "Marina C.", lastTouch: "há 4h",  score: 79 },
  { id: "8", name: "Rafael Pinto",  title: "RevOps Lead",          company: "Acme Inc.",  email: "rafael@acme.com",       location: "São Paulo, BR",      stage: "Ganho",        source: "Inbound",   owner: "Daniel S.", lastTouch: "há 1d",  score: 95 },
];

// Stage visual map — restrained, executive
const STAGE_META: Record<Stage, { dot: string; chip: string; label: Stage }> = {
  Novo:          { label: "Novo",         dot: "bg-foreground/60", chip: "bg-muted text-foreground" },
  Qualificado:   { label: "Qualificado",  dot: "bg-foreground",    chip: "bg-foreground/10 text-foreground" },
  "Em conversa": { label: "Em conversa",  dot: "bg-brand",         chip: "bg-brand/10 text-brand" },
  Proposta:      { label: "Proposta",     dot: "bg-warning",       chip: "bg-warning/15 text-foreground" },
  Ganho:         { label: "Ganho",        dot: "bg-success",       chip: "bg-success/15 text-foreground" },
  Perdido:       { label: "Perdido",      dot: "bg-destructive",   chip: "bg-destructive/10 text-destructive" },
};

const STAGES: Stage[] = ["Novo", "Qualificado", "Em conversa", "Proposta", "Ganho", "Perdido"];

const SOURCE_META: Record<Source, { icon: typeof Mail; label: Source }> = {
  LinkedIn:   { icon: Linkedin, label: "LinkedIn" },
  Email:      { icon: Mail,     label: "Email" },
  Inbound:    { icon: Globe,    label: "Inbound" },
  Importado:  { icon: Upload,   label: "Importado" },
  Apollo:     { icon: Sparkles, label: "Apollo" },
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function LeadsPage() {
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<Stage | "Todos">("Todos");
  const [sourceFilter, setSourceFilter] = useState<Source | "Todas">("Todas");
  const [selectedId, setSelectedId] = useState<string | null>(LEADS[0]?.id ?? null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [loading] = useState(false); // wired for future async data

  const filtered = useMemo(() => {
    return LEADS.filter((l) => {
      if (stageFilter !== "Todos" && l.stage !== stageFilter) return false;
      if (sourceFilter !== "Todas" && l.source !== sourceFilter) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        l.name.toLowerCase().includes(q) ||
        l.company.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        l.title.toLowerCase().includes(q)
      );
    });
  }, [query, stageFilter, sourceFilter]);

  const selected = filtered.find((l) => l.id === selectedId) ?? filtered[0] ?? null;

  const stats = useMemo(() => {
    const total = LEADS.length;
    const qualif = LEADS.filter((l) => l.stage === "Qualificado" || l.stage === "Em conversa" || l.stage === "Proposta").length;
    const novos = LEADS.filter((l) => l.stage === "Novo").length;
    const ganhos = LEADS.filter((l) => l.stage === "Ganho").length;
    return { total, qualif, novos, ganhos };
  }, []);

  const toggleAll = () => {
    if (checked.size === filtered.length) setChecked(new Set());
    else setChecked(new Set(filtered.map((l) => l.id)));
  };
  const toggleOne = (id: string) => {
    const next = new Set(checked);
    next.has(id) ? next.delete(id) : next.add(id);
    setChecked(next);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description="Workspace comercial — pipeline, conversas e contexto em um único lugar."
        actions={
          <>
            <Button variant="outline">
              <Upload className="h-4 w-4" />
              Importar
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4" />
              Exportar
            </Button>
            <Button>
              <Plus className="h-4 w-4" />
              Novo lead
            </Button>
          </>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard icon={Users}     label="Total"         value={stats.total} />
        <KpiCard icon={InboxIcon} label="Novos"         value={stats.novos} />
        <KpiCard icon={Sparkles}  label="Em pipeline"   value={stats.qualif} accent />
        <KpiCard icon={ArrowUpRight} label="Ganhos"     value={stats.ganhos} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border bg-surface p-3 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, empresa, email ou cargo…"
            className="pl-9"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:bg-muted"
              aria-label="Limpar busca"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <Separator orientation="vertical" className="hidden h-6 lg:block" />

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="label-exec mr-1">Estágio</span>
          <FilterPill active={stageFilter === "Todos"} onClick={() => setStageFilter("Todos")}>Todos</FilterPill>
          {STAGES.map((s) => (
            <FilterPill key={s} active={stageFilter === s} onClick={() => setStageFilter(s)}>
              <span className={cn("mr-1.5 inline-block h-1.5 w-1.5 rounded-full", STAGE_META[s].dot)} />
              {s}
            </FilterPill>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <span className="label-exec mr-1">Origem</span>
          <FilterPill active={sourceFilter === "Todas"} onClick={() => setSourceFilter("Todas")}>Todas</FilterPill>
          {(Object.keys(SOURCE_META) as Source[]).map((s) => {
            const Icon = SOURCE_META[s].icon;
            return (
              <FilterPill key={s} active={sourceFilter === s} onClick={() => setSourceFilter(s)}>
                <Icon className="mr-1.5 h-3 w-3" />
                {s}
              </FilterPill>
            );
          })}
          <Button variant="ghost" size="sm">
            <Filter className="h-3.5 w-3.5" />
            Mais
          </Button>
        </div>
      </div>

      {/* Bulk bar */}
      {checked.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-foreground/10 bg-foreground px-4 py-2 text-background">
          <div className="text-sm">
            <span className="font-semibold">{checked.size}</span> selecionado{checked.size > 1 ? "s" : ""}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="text-background hover:bg-background/10 hover:text-background">
              Mover de estágio
            </Button>
            <Button size="sm" variant="ghost" className="text-background hover:bg-background/10 hover:text-background">
              Atribuir
            </Button>
            <Button size="sm" variant="ghost" className="text-background hover:bg-background/10 hover:text-background">
              Adicionar à campanha
            </Button>
            <button
              onClick={() => setChecked(new Set())}
              className="grid h-7 w-7 place-items-center rounded hover:bg-background/10"
              aria-label="Limpar seleção"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Workspace: list + detail */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="overflow-hidden rounded-xl border bg-surface">
          {/* List header */}
          <div className="flex items-center gap-3 border-b bg-surface-muted/50 px-4 py-2.5">
            <Checkbox
              checked={filtered.length > 0 && checked.size === filtered.length}
              onCheckedChange={toggleAll}
            />
            <div className="text-xs font-medium text-muted-foreground">
              {filtered.length} lead{filtered.length !== 1 ? "s" : ""}
            </div>
            <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
              <span>Ordenar:</span>
              <button className="font-medium text-foreground hover:underline">Última atividade</button>
            </div>
          </div>

          {/* Body */}
          {loading ? (
            <LeadListSkeleton />
          ) : filtered.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={InboxIcon}
                title="Nenhum lead encontrado"
                description="Ajuste os filtros ou importe uma nova lista para começar a trabalhar."
                action={
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => { setQuery(""); setStageFilter("Todos"); setSourceFilter("Todas"); }}>
                      Limpar filtros
                    </Button>
                    <Button>
                      <Upload className="h-4 w-4" />
                      Importar leads
                    </Button>
                  </div>
                }
              />
            </div>
          ) : (
            <ul className="divide-y">
              {filtered.map((l) => (
                <LeadRow
                  key={l.id}
                  lead={l}
                  selected={selected?.id === l.id}
                  checked={checked.has(l.id)}
                  onSelect={() => setSelectedId(l.id)}
                  onToggle={() => toggleOne(l.id)}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Detail panel */}
        <aside className="hidden xl:block">
          {selected ? (
            <LeadDetail lead={selected} />
          ) : (
            <div className="rounded-xl border bg-surface p-6">
              <EmptyState
                icon={Users}
                title="Selecione um lead"
                description="Clique em qualquer linha para visualizar o contexto completo."
              />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function KpiCard({
  icon: Icon, label, value, accent,
}: { icon: typeof Users; label: string; value: number; accent?: boolean }) {
  return (
    <div className={cn(
      "flex items-center justify-between rounded-xl border bg-surface px-4 py-3.5",
      accent && "border-brand/30 bg-brand/[0.04]",
    )}>
      <div>
        <div className="label-exec">{label}</div>
        <div className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</div>
      </div>
      <div className={cn(
        "grid h-9 w-9 place-items-center rounded-lg",
        accent ? "bg-brand text-brand-foreground" : "bg-muted text-foreground",
      )}>
        <Icon className="h-4 w-4" />
      </div>
    </div>
  );
}

function FilterPill({
  active, onClick, children,
}: { active?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-medium transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

function LeadRow({
  lead, selected, checked, onSelect, onToggle,
}: {
  lead: Lead; selected: boolean; checked: boolean;
  onSelect: () => void; onToggle: () => void;
}) {
  const stage = STAGE_META[lead.stage];
  const Source = SOURCE_META[lead.source].icon;

  return (
    <li
      onClick={onSelect}
      className={cn(
        "group flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors",
        selected ? "bg-brand/[0.05]" : "hover:bg-surface-muted/60",
      )}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <Checkbox checked={checked} onCheckedChange={onToggle} />
      </div>

      {/* Selected accent bar */}
      <div className={cn(
        "h-9 w-0.5 rounded-full transition-colors",
        selected ? "bg-brand" : "bg-transparent",
      )} />

      {/* Avatar */}
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-foreground text-[11px] font-semibold text-background">
        {initials(lead.name)}
      </div>

      {/* Identity */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-foreground">{lead.name}</span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="truncate text-xs text-muted-foreground">{lead.title}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Building2 className="h-3 w-3" />
          <span className="truncate">{lead.company}</span>
          <span className="text-foreground/30">•</span>
          <span className="truncate">{lead.email}</span>
        </div>
      </div>

      {/* Stage */}
      <div className="hidden md:block">
        <span className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
          stage.chip,
        )}>
          <span className={cn("h-1.5 w-1.5 rounded-full", stage.dot)} />
          {stage.label}
        </span>
      </div>

      {/* Source */}
      <div className="hidden w-24 items-center gap-1.5 text-xs text-muted-foreground lg:flex">
        <Source className="h-3.5 w-3.5" />
        {lead.source}
      </div>

      {/* Score */}
      <div className="hidden w-14 text-right lg:block">
        <ScoreBar value={lead.score} />
      </div>

      {/* Last touch */}
      <div className="hidden w-20 text-right text-xs text-muted-foreground lg:block">
        {lead.lastTouch}
      </div>

      <ChevronRight className="hidden h-4 w-4 text-muted-foreground/60 transition-colors group-hover:text-foreground xl:block" />
    </li>
  );
}

function ScoreBar({ value }: { value: number }) {
  const tone =
    value >= 80 ? "bg-brand" :
    value >= 60 ? "bg-foreground" :
    "bg-muted-foreground/50";
  return (
    <div className="flex items-center justify-end gap-1.5">
      <div className="h-1 w-10 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${value}%` }} />
      </div>
      <span className="w-6 text-right text-[11px] font-medium tabular-nums text-muted-foreground">
        {value}
      </span>
    </div>
  );
}

function LeadDetail({ lead }: { lead: Lead }) {
  const stage = STAGE_META[lead.stage];
  const Source = SOURCE_META[lead.source].icon;

  return (
    <div className="sticky top-6 overflow-hidden rounded-xl border bg-surface">
      {/* Header band */}
      <div className="relative border-b bg-surface-muted/40 px-5 pb-4 pt-5">
        <div className="flex items-start gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-foreground text-sm font-semibold text-background">
            {initials(lead.name)}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-base font-semibold">{lead.name}</h3>
            <p className="truncate text-xs text-muted-foreground">{lead.title} · {lead.company}</p>
          </div>
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <span className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
            stage.chip,
          )}>
            <span className={cn("h-1.5 w-1.5 rounded-full", stage.dot)} />
            {stage.label}
          </span>
          <Badge variant="outline" className="gap-1 border-border font-normal text-muted-foreground">
            <Source className="h-3 w-3" />
            {lead.source}
          </Badge>
          <div className="ml-auto">
            <ScoreBar value={lead.score} />
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-2 border-b p-3">
        <Button size="sm" variant="outline" className="h-9">
          <MessageSquare className="h-4 w-4" />
          Mensagem
        </Button>
        <Button size="sm" variant="outline" className="h-9">
          <Mail className="h-4 w-4" />
          Email
        </Button>
        <Button size="sm" className="h-9">
          <ArrowUpRight className="h-4 w-4" />
          Avançar
        </Button>
      </div>

      <ScrollArea className="max-h-[520px]">
        <div className="space-y-5 p-5">
          {/* Contact info */}
          <section>
            <div className="label-exec mb-2">Contato</div>
            <dl className="space-y-2 text-sm">
              <DetailRow icon={Mail}         label="Email"    value={lead.email} />
              {lead.phone &&    <DetailRow icon={Phone}        label="Telefone" value={lead.phone} />}
              {lead.location && <DetailRow icon={MapPin}       label="Local"    value={lead.location} />}
              <DetailRow icon={CalendarClock} label="Último contato" value={lead.lastTouch} />
              <DetailRow icon={Users}         label="Responsável"    value={lead.owner} />
            </dl>
          </section>

          <Separator />

          {/* Timeline placeholder */}
          <section>
            <div className="label-exec mb-2">Atividade recente</div>
            <ol className="space-y-3">
              <TimelineItem dot="brand"      title="Resposta recebida via LinkedIn"    when="há 2h" />
              <TimelineItem dot="foreground" title="Sequência ‘Outbound Q4’ iniciada"  when="há 1d" />
              <TimelineItem dot="muted"      title="Lead importado de Apollo"          when="há 5d" />
            </ol>
          </section>

          <Separator />

          {/* Notes */}
          <section>
            <div className="label-exec mb-2">Notas</div>
            <p className="rounded-lg border bg-surface-muted/40 p-3 text-sm text-muted-foreground">
              {lead.notes ?? "Sem notas registradas. Adicione contexto, sinais de compra ou próximos passos para alinhar o time."}
            </p>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}

function DetailRow({
  icon: Icon, label, value,
}: { icon: typeof Mail; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="truncate text-sm text-foreground">{value}</div>
      </div>
    </div>
  );
}

function TimelineItem({
  dot, title, when,
}: { dot: "brand" | "foreground" | "muted"; title: string; when: string }) {
  const dotCls =
    dot === "brand" ? "bg-brand" :
    dot === "foreground" ? "bg-foreground" :
    "bg-muted-foreground/40";
  return (
    <li className="flex gap-3">
      <div className="relative flex flex-col items-center">
        <span className={cn("mt-1 h-2 w-2 rounded-full", dotCls)} />
        <span className="mt-1 w-px flex-1 bg-border" />
      </div>
      <div className="flex-1 pb-1">
        <div className="text-sm text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground">{when}</div>
      </div>
    </li>
  );
}

function LeadListSkeleton() {
  return (
    <ul className="divide-y">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-5 w-24 rounded-md" />
          <Skeleton className="h-3 w-16" />
        </li>
      ))}
    </ul>
  );
}
