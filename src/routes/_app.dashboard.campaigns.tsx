import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Plus, Search, Megaphone, Mail, Linkedin, MessageCircle, type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listCampaigns } from "@/lib/tenant.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/dashboard/campaigns")({
  component: CampaignsPage,
});

const STATUS_META: Record<string, { label: string; chip: string; dot: string }> = {
  draft:     { label: "Rascunho",  chip: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/60" },
  scheduled: { label: "Agendada",  chip: "bg-sky-500/10 text-sky-700 dark:text-sky-300", dot: "bg-sky-500" },
  running:   { label: "Em execução", chip: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  paused:    { label: "Pausada",   chip: "bg-amber-500/10 text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  completed: { label: "Concluída", chip: "bg-foreground/5 text-foreground/70", dot: "bg-foreground/60" },
  archived:  { label: "Arquivada", chip: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/60" },
};

const CHANNEL_ICON: Record<string, LucideIcon> = {
  email: Mail, linkedin: Linkedin, whatsapp: MessageCircle, sms: MessageCircle, multi: Megaphone,
};

function CampaignsPage() {
  const fetch = useServerFn(listCampaigns);
  const { data, isLoading, error } = useQuery({ queryKey: ["campaigns"], queryFn: () => fetch() });
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    return (data ?? []).filter((c) => !query || c.name.toLowerCase().includes(query.toLowerCase()));
  }, [data, query]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campanhas"
        description="Sequências multicanal automatizadas."
        actions={<Button><Plus className="h-4 w-4" /> Nova campanha</Button>}
      />

      <div className="flex items-center gap-3 rounded-xl border bg-surface p-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar campanha…" className="h-9 pl-9" />
        </div>
        <div className="ml-auto text-xs text-muted-foreground">
          {isLoading ? "Carregando…" : `${filtered.length} campanha${filtered.length !== 1 ? "s" : ""}`}
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-44 animate-pulse rounded-xl bg-surface-muted/40" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title={query ? "Nenhuma campanha encontrada" : "Nenhuma campanha ainda"}
          description={query ? "Ajuste a busca." : "Crie a primeira sequência multicanal."}
          action={!query && <Button><Plus className="h-4 w-4" /> Criar campanha</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => {
            const meta = STATUS_META[c.status] ?? STATUS_META.draft;
            const Icon = CHANNEL_ICON[c.channel] ?? Megaphone;
            const replyRate = c.total_sent ? Math.round((c.total_replied / c.total_sent) * 1000) / 10 : 0;
            return (
              <div key={c.id} className="flex flex-col rounded-xl border bg-surface">
                <div className="border-b p-4">
                  <div className="flex items-center justify-between">
                    <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium", meta.chip)}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                      {meta.label}
                    </span>
                    <span className="grid h-7 w-7 place-items-center rounded-md border bg-surface-muted/40 text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                  </div>
                  <h3 className="mt-2 truncate font-display text-base font-semibold">{c.name}</h3>
                  {c.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.description}</p>}
                </div>
                <div className="grid grid-cols-3 divide-x border-b">
                  <Stat label="Inscritos" value={c.total_enrolled} />
                  <Stat label="Enviadas" value={c.total_sent} />
                  <Stat label="Resposta" value={`${replyRate}%`} accent />
                </div>
                <div className="flex items-center justify-between p-3 text-xs text-muted-foreground">
                  <span>{new Date(c.created_at).toLocaleDateString("pt-BR")}</span>
                  <Button variant="ghost" size="sm">Abrir</Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className="p-3 text-center">
      <div className={cn("font-display text-base font-bold", accent && "text-brand")}>
        {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
      </div>
      <div className="text-2xs uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
