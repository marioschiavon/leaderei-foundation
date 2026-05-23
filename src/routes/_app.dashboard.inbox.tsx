import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  Mail, MessageCircle, Linkedin, Inbox as InboxIcon, Bot, Search, Send,
  PanelRightClose, PanelRightOpen, MoreHorizontal, X, ExternalLink,
  CheckCheck, Check, Clock, AlertCircle, type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { listConversations } from "@/lib/tenant.functions";
import { getConversationMessages } from "@/lib/inbox.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/dashboard/inbox")({
  component: InboxPage,
});

const CHANNEL_META: Record<string, { label: string; icon: LucideIcon; tone: string }> = {
  email:    { label: "Email",    icon: Mail,         tone: "text-foreground" },
  linkedin: { label: "LinkedIn", icon: Linkedin,     tone: "text-[#0a66c2]" },
  whatsapp: { label: "WhatsApp", icon: MessageCircle, tone: "text-[#25d366]" },
  sms:      { label: "SMS",      icon: MessageCircle, tone: "text-muted-foreground" },
};

const STATUS_META: Record<string, { label: string; dot: string }> = {
  open:    { label: "Aberta",    dot: "bg-brand" },
  pending: { label: "Pendente",  dot: "bg-amber-500" },
  snoozed: { label: "Adiada",    dot: "bg-muted-foreground" },
  closed:  { label: "Resolvida", dot: "bg-foreground" },
};

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `há ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function InboxPage() {
  const fetch = useServerFn(listConversations);
  const { data, isLoading, error } = useQuery({ queryKey: ["conversations"], queryFn: () => fetch() });
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(true);

  const items = (data ?? []).filter((c) => {
    if (!query) return true;
    const q = query.toLowerCase();
    const lead = Array.isArray(c.leads) ? c.leads[0] : c.leads;
    return (
      c.subject?.toLowerCase().includes(q) ||
      c.last_message_preview?.toLowerCase().includes(q) ||
      lead?.full_name?.toLowerCase().includes(q) ||
      lead?.company_name?.toLowerCase().includes(q)
    );
  });

  const active = items.find((i) => i.id === activeId) ?? items[0] ?? null;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6">
        <PageHeader title="Inbox" description="Conversas centralizadas por canal." />

        {error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {(error as Error).message}
          </div>
        ) : isLoading ? (
          <div className="space-y-2 rounded-xl border bg-surface p-4">
            {[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded bg-surface-muted/50" />)}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={InboxIcon}
            title="Inbox vazia"
            description="Conversas aparecerão aqui assim que houver mensagens entrando ou saindo pelos canais conectados."
          />
        ) : (
          <div className={cn(
            "grid gap-4",
            detailsOpen
              ? "lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_320px]"
              : "lg:grid-cols-[320px_minmax(0,1fr)]"
          )}>
            {/* Column 1: List */}
            <div className="overflow-hidden rounded-xl border bg-surface">
              <div className="border-b p-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar conversas…"
                    className="h-9 pl-8"
                  />
                </div>
              </div>
              <ul className="divide-y max-h-[calc(100vh-220px)] overflow-y-auto">
                {items.map((c) => {
                  const lead = Array.isArray(c.leads) ? c.leads[0] : c.leads;
                  const ch = CHANNEL_META[c.channel] ?? CHANNEL_META.email;
                  const st = STATUS_META[c.status] ?? STATUS_META.open;
                  const isActive = active?.id === c.id;
                  const ChIcon = ch.icon;
                  return (
                    <li key={c.id}>
                      <button
                        onClick={() => setActiveId(c.id)}
                        className={cn(
                          "relative flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors",
                          isActive ? "bg-muted" : "hover:bg-muted/40",
                        )}
                      >
                        {isActive && <span className="absolute inset-y-0 left-0 w-0.5 bg-brand" />}
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold">
                            {lead?.full_name ?? c.subject ?? "Conversa sem assunto"}
                          </span>
                          {c.last_message_at && (
                            <span className="shrink-0 text-[0.7rem] text-muted-foreground">
                              {new Date(c.last_message_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                            </span>
                          )}
                        </div>
                        {lead?.company_name && (
                          <div className="text-[0.7rem] text-muted-foreground">{lead.company_name}</div>
                        )}
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {c.last_message_preview ?? "Sem mensagens"}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5 text-[0.65rem] text-muted-foreground">
                          <span className={cn("inline-flex items-center gap-1 rounded-full border bg-background px-1.5 py-0.5", ch.tone)}>
                            <ChIcon className="h-2.5 w-2.5" />{ch.label}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5">
                            <span className={cn("h-1 w-1 rounded-full", st.dot)} />{st.label}
                          </span>
                          {c.ai_enabled && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-1.5 py-0.5 text-brand">
                              <Bot className="h-2.5 w-2.5" /> IA
                            </span>
                          )}
                          {c.unread_count > 0 && (
                            <span className="ml-auto rounded-full bg-brand px-1.5 py-0.5 text-[0.6rem] font-semibold text-brand-foreground">
                              {c.unread_count}
                            </span>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Column 2: Thread */}
            <div className="rounded-xl border bg-surface flex flex-col min-h-[400px]">
              {active ? (
                <ConversationThread
                  convId={active.id}
                  fallbackChannel={active.channel}
                  detailsOpen={detailsOpen}
                  onToggleDetails={() => setDetailsOpen((v) => !v)}
                />
              ) : (
                <div className="flex-1 grid place-items-center">
                  <EmptyState icon={InboxIcon} title="Selecione uma conversa" />
                </div>
              )}
            </div>

            {/* Column 3: Lead details */}
            {detailsOpen && active && (
              <LeadDetails
                convId={active.id}
                onClose={() => setDetailsOpen(false)}
              />
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

function ConversationThread({
  convId, fallbackChannel, detailsOpen, onToggleDetails,
}: {
  convId: string; fallbackChannel: string;
  detailsOpen: boolean; onToggleDetails: () => void;
}) {
  const fetch = useServerFn(getConversationMessages);
  const { data, isLoading } = useQuery({
    queryKey: ["conv-messages", convId],
    queryFn: () => fetch({ data: { conversation_id: convId } }),
  });
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "auto" }); }, [data?.messages?.length]);

  const conv: any = data?.conversation;
  const lead = conv && (Array.isArray(conv.leads) ? conv.leads[0] : conv.leads);
  const channel = conv?.channel ?? fallbackChannel;
  const ch = CHANNEL_META[channel] ?? CHANNEL_META.email;
  const ChIcon = ch.icon;
  const composerHint =
    channel === "email" ? "Conecte um canal de e-mail em Integrações para enviar mensagens."
    : channel === "whatsapp" ? "Conecte o WhatsApp em Integrações para enviar mensagens."
    : "Conecte um canal em Integrações para enviar mensagens.";

  return (
    <>
      <div className="flex items-start justify-between gap-2 border-b p-4">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold truncate">{lead?.full_name ?? conv?.subject ?? "Conversa"}</h2>
          {lead?.company_name && <div className="text-sm text-muted-foreground truncate">{lead.company_name}</div>}
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span className={cn("inline-flex items-center gap-1", ch.tone)}>
              <ChIcon className="h-3 w-3" /> {ch.label}
            </span>
            <span>·</span>
            <span>{STATUS_META[conv?.status ?? "open"]?.label ?? conv?.status}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled>Adiar (em breve)</DropdownMenuItem>
              <DropdownMenuItem disabled>Fechar conversa (em breve)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={onToggleDetails}>
            {detailsOpen ? <PanelRightClose className="mr-1.5 h-4 w-4" /> : <PanelRightOpen className="mr-1.5 h-4 w-4" />}
            Detalhes do lead
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[calc(100vh-360px)]">
        {isLoading ? (
          <div className="space-y-2">
            {[0,1,2].map(i => <div key={i} className="h-12 animate-pulse rounded bg-surface-muted/50" />)}
          </div>
        ) : !data?.messages?.length ? (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">
            Esta conversa ainda não tem mensagens registradas.
          </div>
        ) : (
          data.messages.map((m: any) => <MessageBubble key={m.id} m={m} />)
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t p-3 space-y-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Textarea disabled rows={2} placeholder="Escreva uma resposta…" className="resize-none" />
            </div>
          </TooltipTrigger>
          <TooltipContent>{composerHint}</TooltipContent>
        </Tooltip>
        <div className="flex justify-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button disabled size="sm"><Send className="mr-1.5 h-4 w-4" />Enviar</Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{composerHint}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </>
  );
}

function MessageBubble({ m }: { m: any }) {
  const outbound = m.direction === "outbound";
  const StatusIcon =
    m.status === "read" ? CheckCheck :
    m.status === "delivered" ? CheckCheck :
    m.status === "sent" ? Check :
    m.status === "failed" ? AlertCircle : Clock;
  return (
    <div className={cn("flex", outbound ? "justify-end" : "justify-start")}>
      <div className={cn(
        "max-w-[78%] rounded-lg px-3 py-2 text-sm",
        outbound ? "bg-brand/10" : "bg-surface-muted",
      )}>
        <div className="whitespace-pre-wrap">{m.body ?? <span className="italic text-muted-foreground">(sem corpo)</span>}</div>
        <div className="mt-1 flex items-center gap-1.5 text-[0.65rem] text-muted-foreground">
          {m.sent_by_ai && <span className="rounded bg-brand/10 px-1 text-brand">IA</span>}
          <span>{timeAgo(m.created_at)}</span>
          <StatusIcon className={cn("h-3 w-3", m.status === "read" && "text-brand", m.status === "failed" && "text-destructive")} />
        </div>
      </div>
    </div>
  );
}

function LeadDetails({ convId, onClose }: { convId: string; onClose: () => void }) {
  const fetch = useServerFn(getConversationMessages);
  const { data } = useQuery({
    queryKey: ["conv-messages", convId],
    queryFn: () => fetch({ data: { conversation_id: convId } }),
  });
  const conv: any = data?.conversation;
  const lead = conv && (Array.isArray(conv.leads) ? conv.leads[0] : conv.leads);
  const initials = lead?.full_name?.split(" ").slice(0, 2).map((s: string) => s[0]).join("") ?? "?";
  const src = lead?.lead_sources && (Array.isArray(lead.lead_sources) ? lead.lead_sources[0] : lead.lead_sources);

  return (
    <aside className="rounded-xl border bg-surface">
      <div className="flex items-center justify-between border-b p-3">
        <div className="font-medium text-sm">Detalhes do lead</div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>
      {!lead ? (
        <div className="p-6 space-y-3 text-sm">
          <div className="text-muted-foreground">Esta conversa não está vinculada a um lead.</div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild><span><Button disabled size="sm" variant="outline">Vincular lead</Button></span></TooltipTrigger>
              <TooltipContent>Em breve</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      ) : (
        <div className="p-4 space-y-4 text-sm">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-brand/10 text-brand font-semibold">
              {initials.toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="font-semibold truncate">{lead.full_name}</div>
              {lead.job_title && <div className="text-xs text-muted-foreground truncate">{lead.job_title}</div>}
              {lead.company_name && <div className="text-xs text-muted-foreground truncate">{lead.company_name}</div>}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {lead.status && <Badge variant="secondary">{lead.status}</Badge>}
            {lead.temperature && <Badge variant="outline">{lead.temperature}</Badge>}
            {src && (
              <Badge variant="outline" style={src.color ? { borderColor: src.color, color: src.color } : undefined}>
                {src.name}
              </Badge>
            )}
            {typeof lead.score === "number" && <Badge variant="secondary">Score {lead.score}</Badge>}
          </div>

          <div className="space-y-1.5 text-xs">
            {lead.email && <div><span className="text-muted-foreground">Email: </span><a className="text-brand hover:underline" href={`mailto:${lead.email}`}>{lead.email}</a></div>}
            {lead.phone && <div><span className="text-muted-foreground">Telefone: </span>{lead.phone}</div>}
            {lead.linkedin_url && <div><span className="text-muted-foreground">LinkedIn: </span><a className="text-brand hover:underline" href={lead.linkedin_url} target="_blank" rel="noreferrer">Abrir</a></div>}
            {lead.next_followup_at && (
              <div><span className="text-muted-foreground">Próximo follow-up: </span>{new Date(lead.next_followup_at).toLocaleDateString("pt-BR")}</div>
            )}
          </div>

          <a href={`/dashboard/leads?id=${lead.id}`} className="inline-flex items-center gap-1 text-xs text-brand hover:underline">
            Abrir lead <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </aside>
  );
}
