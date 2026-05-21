import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, MessageCircle, Linkedin, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/dashboard/inbox")({
  component: InboxPage,
});

const CHANNELS = [
  { id: "all", label: "Todas", count: 12 },
  { id: "email", label: "Email", count: 6, icon: Mail },
  { id: "linkedin", label: "LinkedIn", count: 4, icon: Linkedin },
  { id: "wpp", label: "WhatsApp", count: 2, icon: MessageCircle },
];

const THREADS = [
  { id: "1", name: "Carla Mendes", channel: "email", preview: "Olá, podemos marcar uma conversa rápida?", time: "12:04", unread: true },
  { id: "2", name: "Pedro Lima", channel: "linkedin", preview: "Obrigado pelo material enviado, vou analisar com o time.", time: "11:42", unread: true },
  { id: "3", name: "Sofia Reis", channel: "email", preview: "Confirmando reunião para amanhã às 10h.", time: "10:18", unread: false },
  { id: "4", name: "Marcos Tavares", channel: "wpp", preview: "Perfeito, fechado!", time: "09:30", unread: false },
  { id: "5", name: "Beatriz Costa", channel: "email", preview: "Segue em anexo a proposta solicitada.", time: "Ontem", unread: false },
];

function channelIcon(c: string) {
  if (c === "email") return Mail;
  if (c === "linkedin") return Linkedin;
  return MessageCircle;
}

function InboxPage() {
  const [active, setActive] = useState("1");
  const [filter, setFilter] = useState("all");
  const selected = THREADS.find((t) => t.id === active)!;

  return (
    <div className="-mx-6 -my-6 grid h-[calc(100vh-3.5rem)] grid-cols-[220px_320px_1fr] lg:-mx-8">
      <aside className="border-r bg-surface px-3 py-4">
        <h2 className="mb-3 px-2 font-display text-sm font-semibold">Inbox</h2>
        <ul className="space-y-0.5">
          {CHANNELS.map((c) => {
            const Icon = c.icon;
            return (
              <li key={c.id}>
                <button
                  onClick={() => setFilter(c.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors",
                    filter === c.id
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  <span className="flex items-center gap-2">
                    {Icon && <Icon className="h-3.5 w-3.5" />}
                    {c.label}
                  </span>
                  <span className="text-xs">{c.count}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <div className="border-r bg-surface">
        <div className="border-b p-3">
          <Input placeholder="Buscar conversas…" className="h-9" />
        </div>
        <ul className="divide-y">
          {THREADS.map((t) => {
            const Icon = channelIcon(t.channel);
            return (
              <li key={t.id}>
                <button
                  onClick={() => setActive(t.id)}
                  className={cn(
                    "flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors",
                    active === t.id ? "bg-muted" : "hover:bg-muted/40",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 truncate font-medium">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      {t.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{t.time}</span>
                  </div>
                  <p className={cn("truncate text-sm", t.unread ? "text-foreground" : "text-muted-foreground")}>
                    {t.preview}
                  </p>
                  {t.unread && <span className="h-1.5 w-1.5 rounded-full bg-brand" />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <section className="flex flex-col bg-background">
        <header className="flex items-center justify-between border-b bg-surface px-6 py-3">
          <div>
            <div className="font-display text-base font-semibold">{selected.name}</div>
            <div className="text-xs text-muted-foreground capitalize">{selected.channel}</div>
          </div>
          <Button variant="outline" size="sm">Ver lead</Button>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          <Bubble side="them">Olá! Vi o material que você compartilhou, faz muito sentido pra gente.</Bubble>
          <Bubble side="me">Que ótimo, Carla. Podemos agendar 20 minutos esta semana?</Bubble>
          <Bubble side="them">{selected.preview}</Bubble>
        </div>
        <div className="border-t bg-surface p-4">
          <div className="flex items-end gap-2">
            <textarea
              rows={2}
              placeholder="Escreva uma mensagem…"
              className="min-h-[44px] flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            />
            <Button>
              <Send className="h-4 w-4" />
              Enviar
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function Bubble({ side, children }: { side: "me" | "them"; children: React.ReactNode }) {
  return (
    <div className={cn("flex", side === "me" ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[60%] rounded-xl px-4 py-2.5 text-sm",
          side === "me"
            ? "bg-secondary text-secondary-foreground"
            : "bg-surface border",
        )}
      >
        {children}
      </div>
    </div>
  );
}
