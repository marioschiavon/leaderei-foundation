import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Mail, MessageCircle, Linkedin, Inbox as InboxIcon, Bot, Search, type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { Input } from "@/components/ui/input";
import { listConversations } from "@/lib/tenant.functions";
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

function InboxPage() {
  const fetch = useServerFn(listConversations);
  const { data, isLoading, error } = useQuery({ queryKey: ["conversations"], queryFn: () => fetch() });
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

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
        <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
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
            <ul className="divide-y">
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
                          <ChIcon className="h-2.5 w-2.5" />
                          {ch.label}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5">
                          <span className={cn("h-1 w-1 rounded-full", st.dot)} />
                          {st.label}
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

          <div className="rounded-xl border bg-surface p-6">
            {active ? (
              <ConversationDetail conv={active} />
            ) : (
              <EmptyState icon={InboxIcon} title="Selecione uma conversa" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ConversationDetail({ conv }: { conv: { id: string; subject: string | null; channel: string; status: string; last_message_preview: string | null; leads: any } }) {
  const lead = Array.isArray(conv.leads) ? conv.leads[0] : conv.leads;
  const ch = CHANNEL_META[conv.channel] ?? CHANNEL_META.email;
  const ChIcon = ch.icon;
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between border-b pb-4">
        <div>
          <h2 className="font-display text-lg font-semibold">{lead?.full_name ?? "Conversa"}</h2>
          {lead?.company_name && (
            <div className="text-sm text-muted-foreground">{lead.company_name}</div>
          )}
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span className={cn("inline-flex items-center gap-1", ch.tone)}>
              <ChIcon className="h-3 w-3" /> {ch.label}
            </span>
            <span>·</span>
            <span>{STATUS_META[conv.status]?.label ?? conv.status}</span>
          </div>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Visualização completa de mensagens, envio e handoff IA chega na próxima rodada. Aqui já temos
        a conversa real ({conv.id.slice(0, 8)}…) carregada do banco.
      </p>
      {conv.last_message_preview && (
        <div className="rounded-lg border bg-background p-4 text-sm">
          <div className="text-2xs uppercase tracking-wider text-muted-foreground">Último trecho</div>
          <p className="mt-1">{conv.last_message_preview}</p>
        </div>
      )}
    </div>
  );
}
