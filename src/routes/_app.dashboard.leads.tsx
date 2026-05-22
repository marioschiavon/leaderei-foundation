import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Search, Users, Building2, Upload, Inbox as InboxIcon } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listLeads } from "@/lib/tenant.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/dashboard/leads")({
  component: LeadsPage,
});

const STATUS_META: Record<string, { label: string; chip: string; dot: string }> = {
  new:           { label: "Novo",          chip: "bg-muted text-foreground", dot: "bg-foreground/60" },
  contacted:     { label: "Contatado",     chip: "bg-foreground/10 text-foreground", dot: "bg-foreground" },
  qualified:     { label: "Qualificado",   chip: "bg-brand/10 text-brand", dot: "bg-brand" },
  in_conversation:{ label: "Em conversa",  chip: "bg-brand/10 text-brand", dot: "bg-brand" },
  proposal:      { label: "Proposta",      chip: "bg-amber-500/15 text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  won:           { label: "Ganho",         chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  lost:          { label: "Perdido",       chip: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
  archived:      { label: "Arquivado",     chip: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/60" },
};

function LeadsPage() {
  const fetch = useServerFn(listLeads);
  const { data, isLoading, error } = useQuery({ queryKey: ["leads"], queryFn: () => fetch() });
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    return (data ?? []).filter((l) => {
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        l.full_name?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q) ||
        l.company_name?.toLowerCase().includes(q) ||
        l.job_title?.toLowerCase().includes(q)
      );
    });
  }, [data, query]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description="Pipeline comercial e contexto por contato."
        actions={
          <>
            <Button variant="outline"><Upload className="h-4 w-4" /> Importar</Button>
            <Button><Plus className="h-4 w-4" /> Novo lead</Button>
          </>
        }
      />

      <div className="flex flex-col gap-3 rounded-xl border bg-surface p-3 lg:flex-row lg:items-center">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, empresa, email ou cargo…"
            className="h-9 pl-9"
          />
        </div>
        <div className="ml-auto text-xs text-muted-foreground">
          {isLoading ? "Carregando…" : `${filtered.length} lead${filtered.length !== 1 ? "s" : ""}`}
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : isLoading ? (
        <div className="space-y-2 rounded-xl border bg-surface p-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-surface-muted/50" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={InboxIcon}
          title={query ? "Nenhum lead encontrado" : "Ainda sem leads"}
          description={query ? "Ajuste a busca." : "Comece importando uma lista ou adicionando o primeiro contato."}
          action={
            !query && (
              <div className="flex gap-2">
                <Button><Plus className="h-4 w-4" /> Adicionar lead</Button>
                <Button variant="outline"><Upload className="h-4 w-4" /> Importar CSV</Button>
              </div>
            )
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-surface">
          <ul className="divide-y">
            {filtered.map((l) => {
              const meta = STATUS_META[l.status] ?? STATUS_META.new;
              return (
                <li key={l.id} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-muted/40">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-foreground text-[11px] font-semibold text-background">
                    {(l.full_name ?? "?").split(" ").slice(0, 2).map((s) => s[0]).join("").toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">{l.full_name}</span>
                      {l.job_title && (
                        <>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="truncate text-xs text-muted-foreground">{l.job_title}</span>
                        </>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      {l.company_name && (<><Building2 className="h-3 w-3" /><span className="truncate">{l.company_name}</span></>)}
                      {l.email && (<><span className="text-foreground/30">•</span><span className="truncate">{l.email}</span></>)}
                    </div>
                  </div>
                  <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium", meta.chip)}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                    {meta.label}
                  </span>
                  <span className="hidden w-12 text-right text-xs text-muted-foreground tabular-nums lg:block">
                    {l.score}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
