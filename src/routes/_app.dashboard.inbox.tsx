import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Mail,
  MessageCircle,
  Linkedin,
  Send,
  Search,
  Filter,
  Inbox as InboxIcon,
  Star,
  Archive,
  CheckCheck,
  Clock,
  Sparkles,
  UserCog,
  MoreHorizontal,
  Paperclip,
  Smile,
  Building2,
  Phone,
  MapPin,
  ChevronDown,
  AlertCircle,
  Tag,
  Bot,
  History,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/dashboard/inbox")({
  component: InboxPage,
});

// ---------------------------------------------------------------------------
// Domain
// ---------------------------------------------------------------------------

type Channel = "email" | "linkedin" | "whatsapp";
type ThreadStatus = "open" | "waiting" | "snoozed" | "closed";
type Assignee = "you" | "ai" | "unassigned" | string;

type Thread = {
  id: string;
  name: string;
  company: string;
  title?: string;
  channel: Channel;
  status: ThreadStatus;
  assignee: Assignee;
  preview: string;
  time: string;
  unread: boolean;
  starred?: boolean;
  tags?: string[];
};

type Message = {
  id: string;
  side: "me" | "them" | "ai";
  body: string;
  at: string;
  channel: Channel;
};

// ---------------------------------------------------------------------------
// Mock data (estrutural — será trocado por Cloud queries)
// ---------------------------------------------------------------------------

const CHANNEL_META: Record<Channel, { label: string; icon: LucideIcon; tone: string }> = {
  email: { label: "Email", icon: Mail, tone: "text-secondary" },
  linkedin: { label: "LinkedIn", icon: Linkedin, tone: "text-[#0a66c2]" },
  whatsapp: { label: "WhatsApp", icon: MessageCircle, tone: "text-[#25d366]" },
};

const STATUS_META: Record<ThreadStatus, { label: string; dot: string; badge: string }> = {
  open:    { label: "Aberta",      dot: "bg-brand",            badge: "bg-brand/10 text-brand" },
  waiting: { label: "Aguardando",  dot: "bg-secondary",        badge: "bg-secondary/10 text-secondary" },
  snoozed: { label: "Adiada",      dot: "bg-muted-foreground", badge: "bg-muted text-muted-foreground" },
  closed:  { label: "Resolvida",   dot: "bg-foreground",       badge: "bg-foreground text-background" },
};

const VIEWS: { id: string; label: string; icon: LucideIcon; count: number }[] = [
  { id: "mine",     label: "Minhas",      icon: UserCog,   count: 8 },
  { id: "unassigned", label: "Sem dono",  icon: AlertCircle, count: 3 },
  { id: "ai",       label: "Em IA",       icon: Bot,       count: 5 },
  { id: "starred",  label: "Favoritas",   icon: Star,      count: 2 },
  { id: "all",      label: "Todas",       icon: InboxIcon, count: 18 },
  { id: "closed",   label: "Resolvidas",  icon: CheckCheck, count: 132 },
];

const CHANNEL_FILTERS: { id: "all" | Channel; label: string; count: number }[] = [
  { id: "all",       label: "Todos canais", count: 18 },
  { id: "email",     label: "Email",        count: 9 },
  { id: "linkedin",  label: "LinkedIn",     count: 6 },
  { id: "whatsapp",  label: "WhatsApp",     count: 3 },
];

const THREADS: Thread[] = [
  {
    id: "t1", name: "Carla Mendes", company: "Northwind", title: "Head of Growth",
    channel: "email", status: "open", assignee: "you",
    preview: "Olá! Vi o material que você compartilhou, faz muito sentido pra gente.",
    time: "12:04", unread: true, starred: true, tags: ["enterprise"],
  },
  {
    id: "t2", name: "Pedro Lima", company: "Globex", title: "CRO",
    channel: "linkedin", status: "waiting", assignee: "you",
    preview: "Obrigado pelo material, vou analisar com o time e retorno na sexta.",
    time: "11:42", unread: true, tags: ["mid-market"],
  },
  {
    id: "t3", name: "Sofia Reis", company: "Initech", title: "Sales Director",
    channel: "email", status: "open", assignee: "ai",
    preview: "Confirmando reunião para amanhã às 10h, link enviado.",
    time: "10:18", unread: false, tags: ["meeting-booked"],
  },
  {
    id: "t4", name: "Marcos Tavares", company: "Umbrella", title: "CEO",
    channel: "whatsapp", status: "open", assignee: "unassigned",
    preview: "Perfeito, fechado! Pode mandar a proposta.",
    time: "09:30", unread: true, tags: ["hot"],
  },
  {
    id: "t5", name: "Beatriz Costa", company: "Stark Co", title: "VP Marketing",
    channel: "email", status: "snoozed", assignee: "you",
    preview: "Segue em anexo a proposta solicitada. Aguardo retorno.",
    time: "Ontem", unread: false,
  },
  {
    id: "t6", name: "Rafael Souza", company: "Wayne Ent.", title: "COO",
    channel: "linkedin", status: "closed", assignee: "you",
    preview: "Obrigado, deal fechado pela equipe comercial.",
    time: "Seg", unread: false, tags: ["won"],
  },
];

const MESSAGES: Record<string, Message[]> = {
  t1: [
    { id: "m1", side: "them", at: "11:58", channel: "email",
      body: "Olá! Vi o material que você compartilhou, faz muito sentido pra gente." },
    { id: "m2", side: "me", at: "12:01", channel: "email",
      body: "Que ótimo, Carla. Podemos agendar 20 minutos esta semana?" },
    { id: "m3", side: "them", at: "12:04", channel: "email",
      body: "Pode ser quinta às 14h? Mando convite com o time." },
  ],
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function InboxPage() {
  const [view, setView] = useState("mine");
  const [channel, setChannel] = useState<"all" | Channel>("all");
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string>("t1");

  const filtered = useMemo(() => {
    return THREADS.filter((t) => {
      if (channel !== "all" && t.channel !== channel) return false;
      if (view === "mine" && t.assignee !== "you") return false;
      if (view === "unassigned" && t.assignee !== "unassigned") return false;
      if (view === "ai" && t.assignee !== "ai") return false;
      if (view === "starred" && !t.starred) return false;
      if (view === "closed" && t.status !== "closed") return false;
      if (query && !`${t.name} ${t.company} ${t.preview}`.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [view, channel, query]);

  const active = filtered.find((t) => t.id === activeId) ?? filtered[0] ?? null;

  return (
    <div className="-mx-6 -my-6 grid h-[calc(100vh-3.5rem)] grid-cols-[220px_360px_minmax(0,1fr)_340px] lg:-mx-8">
      <ViewsRail value={view} onChange={setView} />
      <ThreadList
        threads={filtered}
        channel={channel}
        setChannel={setChannel}
        query={query}
        setQuery={setQuery}
        activeId={active?.id ?? ""}
        onSelect={setActiveId}
      />
      {active ? (
        <>
          <ConversationPanel thread={active} />
          <LeadContextPanel thread={active} />
        </>
      ) : (
        <div className="col-span-2 grid place-items-center bg-background text-sm text-muted-foreground">
          Nenhuma conversa selecionada
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pane 1 — Views rail
// ---------------------------------------------------------------------------

function ViewsRail({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <aside className="flex flex-col border-r bg-surface">
      <div className="flex items-center justify-between px-4 py-4">
        <h2 className="font-display text-sm font-semibold tracking-tight">Inbox</h2>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      </div>
      <Separator />
      <nav className="flex-1 space-y-0.5 p-2">
        {VIEWS.map((v) => {
          const Icon = v.icon;
          const active = value === v.id;
          return (
            <button
              key={v.id}
              onClick={() => onChange(v.id)}
              className={cn(
                "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm transition-colors",
                active
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <span className="flex items-center gap-2.5">
                <Icon className="h-3.5 w-3.5" />
                {v.label}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">{v.count}</span>
            </button>
          );
        })}
      </nav>
      <Separator />
      <div className="p-3">
        <p className="label-exec mb-2 text-muted-foreground">Tags</p>
        <div className="flex flex-wrap gap-1.5">
          {["enterprise", "mid-market", "hot", "meeting-booked", "won"].map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="border-transparent bg-muted font-normal text-muted-foreground hover:bg-muted/80"
            >
              <Tag className="h-2.5 w-2.5" />
              {tag}
            </Badge>
          ))}
        </div>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Pane 2 — Thread list
// ---------------------------------------------------------------------------

function ThreadList({
  threads, channel, setChannel, query, setQuery, activeId, onSelect,
}: {
  threads: Thread[];
  channel: "all" | Channel;
  setChannel: (c: "all" | Channel) => void;
  query: string;
  setQuery: (q: string) => void;
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-col border-r bg-surface">
      <div className="space-y-3 border-b p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar conversas…"
            className="h-9 pl-8"
          />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto">
          {CHANNEL_FILTERS.map((c) => {
            const active = channel === c.id;
            const Icon = c.id === "all" ? InboxIcon : CHANNEL_META[c.id].icon;
            return (
              <button
                key={c.id}
                onClick={() => setChannel(c.id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3 w-3" />
                {c.label}
                <span className={cn("ml-0.5 tabular-nums", active ? "opacity-70" : "opacity-50")}>
                  {c.count}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{threads.length} conversas</span>
          <button className="inline-flex items-center gap-1 hover:text-foreground">
            <Filter className="h-3 w-3" /> Mais filtros
          </button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {threads.length === 0 ? (
          <div className="grid place-items-center px-6 py-16 text-center text-sm text-muted-foreground">
            Nenhuma conversa encontrada com esses filtros.
          </div>
        ) : (
          <ul className="divide-y">
            {threads.map((t) => (
              <ThreadRow
                key={t.id}
                thread={t}
                active={t.id === activeId}
                onClick={() => onSelect(t.id)}
              />
            ))}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
}

function ThreadRow({ thread, active, onClick }: { thread: Thread; active: boolean; onClick: () => void }) {
  const ch = CHANNEL_META[thread.channel];
  const st = STATUS_META[thread.status];
  const ChannelIcon = ch.icon;

  return (
    <li>
      <button
        onClick={onClick}
        className={cn(
          "relative flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors",
          active ? "bg-muted" : "hover:bg-muted/40",
        )}
      >
        {active && <span className="absolute inset-y-0 left-0 w-0.5 bg-brand" />}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Avatar name={thread.name} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={cn("truncate text-sm", thread.unread ? "font-semibold" : "font-medium")}>
                  {thread.name}
                </span>
                {thread.starred && <Star className="h-3 w-3 fill-brand text-brand" />}
              </div>
              <div className="truncate text-[0.7rem] text-muted-foreground">{thread.company}</div>
            </div>
          </div>
          <span className="shrink-0 text-[0.7rem] text-muted-foreground">{thread.time}</span>
        </div>
        <p className={cn("line-clamp-2 pl-9 text-xs", thread.unread ? "text-foreground" : "text-muted-foreground")}>
          {thread.preview}
        </p>
        <div className="flex items-center gap-1.5 pl-9 pt-1">
          <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.65rem]", ch.tone, "bg-background border")}>
            <ChannelIcon className="h-2.5 w-2.5" />
            {ch.label}
          </span>
          <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.65rem]", st.badge)}>
            <span className={cn("h-1 w-1 rounded-full", st.dot)} />
            {st.label}
          </span>
          {thread.assignee === "ai" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary/10 px-1.5 py-0.5 text-[0.65rem] text-secondary">
              <Bot className="h-2.5 w-2.5" />
              IA
            </span>
          )}
          {thread.unread && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand" />}
        </div>
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Pane 3 — Conversation
// ---------------------------------------------------------------------------

function ConversationPanel({ thread }: { thread: Thread }) {
  const ch = CHANNEL_META[thread.channel];
  const st = STATUS_META[thread.status];
  const ChannelIcon = ch.icon;
  const messages = MESSAGES[thread.id] ?? [
    { id: "x1", side: "them" as const, at: "—", channel: thread.channel, body: thread.preview },
  ];

  return (
    <section className="flex min-w-0 flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b bg-surface px-6 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={thread.name} size="lg" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-display text-base font-semibold">{thread.name}</h3>
              <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.65rem]", st.badge)}>
                <span className={cn("h-1 w-1 rounded-full", st.dot)} />
                {st.label}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={cn("inline-flex items-center gap-1", ch.tone)}>
                <ChannelIcon className="h-3 w-3" />
                {ch.label}
              </span>
              <span>·</span>
              <span className="truncate">{thread.title} @ {thread.company}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="text-xs">
            <Clock className="h-3.5 w-3.5" /> Adiar
          </Button>
          <Button variant="ghost" size="sm" className="text-xs">
            <Archive className="h-3.5 w-3.5" /> Arquivar
          </Button>
          <Button variant="ghost" size="sm" className="text-xs">
            <CheckCheck className="h-3.5 w-3.5" /> Resolver
          </Button>
          <Separator orientation="vertical" className="mx-1 h-5" />
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* AI / Handoff bar */}
      <div className="flex items-center justify-between gap-3 border-b bg-brand-soft/40 px-6 py-2">
        <div className="flex items-center gap-2 text-xs">
          <Sparkles className="h-3.5 w-3.5 text-brand" />
          <span className="font-medium text-foreground">Assistente IA disponível</span>
          <span className="text-muted-foreground">— sugestões de resposta e resumo da conversa em breve.</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7 text-xs" disabled>
            <Bot className="h-3 w-3" /> Sugerir resposta
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs">
            <UserCog className="h-3 w-3" /> Passar para humano
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="space-y-5 px-6 py-6">
          <DayDivider label="Hoje" />
          {messages.map((m) => (
            <Bubble key={m.id} side={m.side} at={m.at} channel={m.channel}>
              {m.body}
            </Bubble>
          ))}
        </div>
      </ScrollArea>

      {/* Composer */}
      <div className="border-t bg-surface">
        <div className="flex items-center gap-1 border-b px-4 py-1.5 text-xs">
          <button className="rounded-md px-2 py-1 font-medium text-foreground hover:bg-muted">Responder</button>
          <button className="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted">Nota interna</button>
          <div className="ml-auto flex items-center gap-1 text-muted-foreground">
            <span>Enviando como</span>
            <button className="inline-flex items-center gap-1 rounded-md border bg-background px-1.5 py-0.5 text-foreground">
              <ChannelIcon className={cn("h-3 w-3", ch.tone)} />
              {ch.label}
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>
        </div>
        <div className="p-4">
          <textarea
            rows={3}
            placeholder={`Responder ${thread.name} via ${ch.label.toLowerCase()}…`}
            className="min-h-[72px] w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
          />
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Paperclip className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Smile className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled>
                <Sparkles className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="text-xs">Agendar</Button>
              <Button size="sm">
                <Send className="h-3.5 w-3.5" /> Enviar
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DayDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <Separator className="flex-1" />
      <span className="label-exec text-muted-foreground">{label}</span>
      <Separator className="flex-1" />
    </div>
  );
}

function Bubble({
  side, at, channel, children,
}: {
  side: "me" | "them" | "ai";
  at: string;
  channel: Channel;
  children: React.ReactNode;
}) {
  const ch = CHANNEL_META[channel];
  const ChannelIcon = ch.icon;
  const align = side === "me" ? "items-end" : "items-start";
  const bubbleClass =
    side === "me"
      ? "bg-foreground text-background"
      : side === "ai"
      ? "border border-dashed bg-brand-soft/30 text-foreground"
      : "border bg-surface text-foreground";

  return (
    <div className={cn("flex flex-col gap-1", align)}>
      <div className={cn("max-w-[60%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed", bubbleClass)}>
        {side === "ai" && (
          <div className="mb-1 flex items-center gap-1 text-[0.65rem] uppercase tracking-wider text-brand">
            <Bot className="h-3 w-3" /> Sugestão IA
          </div>
        )}
        {children}
      </div>
      <div className="flex items-center gap-1.5 text-[0.65rem] text-muted-foreground">
        <ChannelIcon className="h-2.5 w-2.5" />
        {at}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pane 4 — Lead context
// ---------------------------------------------------------------------------

function LeadContextPanel({ thread }: { thread: Thread }) {
  return (
    <aside className="flex flex-col border-l bg-surface">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="label-exec text-muted-foreground">Contexto do lead</span>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-5 p-4">
          <div className="flex flex-col items-center gap-2 text-center">
            <Avatar name={thread.name} size="xl" />
            <div>
              <div className="font-display text-base font-semibold">{thread.name}</div>
              <div className="text-xs text-muted-foreground">{thread.title}</div>
            </div>
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" className="h-7 text-xs">Abrir lead</Button>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Star className={cn("h-3.5 w-3.5", thread.starred && "fill-brand text-brand")} />
              </Button>
            </div>
          </div>

          <Separator />

          <div className="space-y-2.5">
            <InfoRow icon={Building2} label="Empresa" value={thread.company} />
            <InfoRow icon={Mail} label="Email" value={`${thread.name.toLowerCase().replace(" ", ".")}@${thread.company.toLowerCase().replace(/[^a-z]/g, "")}.com`} />
            <InfoRow icon={Phone} label="Telefone" value="—" muted />
            <InfoRow icon={MapPin} label="Localização" value="São Paulo, BR" />
          </div>

          <Separator />

          <div>
            <p className="label-exec mb-2 text-muted-foreground">Status do funil</p>
            <div className="rounded-md border bg-background p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Em conversa</span>
                <Badge variant="secondary" className="border-transparent bg-brand/10 text-brand">
                  Score 82
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Última atualização: hoje, 12:04
              </p>
            </div>
          </div>

          <div>
            <p className="label-exec mb-2 text-muted-foreground">Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {(thread.tags ?? []).length === 0 ? (
                <span className="text-xs text-muted-foreground">Sem tags</span>
              ) : (
                thread.tags!.map((t) => (
                  <Badge key={t} variant="secondary" className="border-transparent bg-muted font-normal">
                    {t}
                  </Badge>
                ))
              )}
            </div>
          </div>

          <Separator />

          <div>
            <p className="label-exec mb-2 text-muted-foreground">Atividade recente</p>
            <ul className="space-y-2.5">
              <ActivityItem icon={Mail} text="Respondeu ao email de follow-up" when="há 4 min" />
              <ActivityItem icon={Linkedin} text="Aceitou convite no LinkedIn" when="ontem" />
              <ActivityItem icon={History} text="Entrou na campanha Outbound LATAM" when="3 dias" />
            </ul>
          </div>

          <Separator />

          <div className="rounded-md border border-dashed bg-background p-3">
            <div className="flex items-center gap-2 text-xs font-medium">
              <Sparkles className="h-3.5 w-3.5 text-brand" />
              Resumo IA
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Em breve: resumo automático da conversa, próxima ação sugerida e detecção de objeções.
            </p>
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}

function InfoRow({ icon: Icon, label, value, muted }: { icon: LucideIcon; label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-start gap-2.5 text-xs">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="text-muted-foreground">{label}</div>
        <div className={cn("truncate", muted ? "text-muted-foreground" : "text-foreground")}>{value}</div>
      </div>
    </div>
  );
}

function ActivityItem({ icon: Icon, text, when }: { icon: LucideIcon; text: string; when: string }) {
  return (
    <li className="flex items-start gap-2.5 text-xs">
      <div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-muted text-foreground">
        <Icon className="h-3 w-3" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="leading-snug text-foreground">{text}</p>
        <p className="text-[0.65rem] text-muted-foreground">{when}</p>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------

function Avatar({ name, size = "md" }: { name: string; size?: "md" | "lg" | "xl" }) {
  const initials = name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  const dims = size === "xl" ? "h-14 w-14 text-base" : size === "lg" ? "h-9 w-9 text-sm" : "h-7 w-7 text-[0.65rem]";
  return (
    <div className={cn("grid shrink-0 place-items-center rounded-full bg-muted font-semibold text-foreground", dims)}>
      {initials}
    </div>
  );
}
