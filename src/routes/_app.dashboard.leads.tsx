import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Building2,
  Inbox as InboxIcon,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Upload,
} from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  acceptLead,
  archiveLead,
  createLead,
  getLeadsNeedingReviewCount,
  listLeads,
  listLeadsNeedingReview,
  listLeadSources,
} from "@/lib/tenant.functions";

import { ImportLeadsSheet } from "@/components/app/ImportLeadsSheet";
import { cn } from "@/lib/utils";
import { AlertTriangle, Check } from "lucide-react";

export const Route = createFileRoute("/_app/dashboard/leads")({
  component: LeadsPage,
});

const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "proposal",
  "won",
  "lost",
  "archived",
] as const;

const STATUS_META: Record<string, { label: string; chip: string; dot: string }> = {
  new: { label: "Novo", chip: "bg-muted text-foreground", dot: "bg-foreground/60" },
  contacted: { label: "Contatado", chip: "bg-foreground/10 text-foreground", dot: "bg-foreground" },
  qualified: { label: "Qualificado", chip: "bg-brand/10 text-brand", dot: "bg-brand" },
  in_conversation: { label: "Em conversa", chip: "bg-brand/10 text-brand", dot: "bg-brand" },
  proposal: { label: "Proposta", chip: "bg-amber-500/15 text-amber-700", dot: "bg-amber-500" },
  won: { label: "Ganho", chip: "bg-emerald-500/15 text-emerald-700", dot: "bg-emerald-500" },
  lost: { label: "Perdido", chip: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
  archived: { label: "Arquivado", chip: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/60" },
};

const TEMPERATURE_META: Record<string, string> = {
  cold: "Frio",
  warm: "Morno",
  hot: "Quente",
};

type LeadSource = {
  id: string;
  name: string;
  slug: string;
  color: string | null;
};


function LeadsPage() {
  const fetchLeads = useServerFn(listLeads);
  const fetchSources = useServerFn(listLeadSources);

  const { data: leads, isLoading, error } = useQuery({
    queryKey: ["leads"],
    queryFn: () => fetchLeads(),
  });
  const { data: sources } = useQuery({
    queryKey: ["leads", "sources"],
    queryFn: () => fetchSources(),
  });

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [tab, setTab] = useState<"all" | "review">("all");

  const fetchReview = useServerFn(listLeadsNeedingReview);
  const fetchReviewCount = useServerFn(getLeadsNeedingReviewCount);
  const acceptFn = useServerFn(acceptLead);
  const archiveFnReview = useServerFn(archiveLead);
  const queryClient = useQueryClient();
  const { data: reviewLeads } = useQuery({
    queryKey: ["leads-needing-review"],
    queryFn: () => fetchReview(),
  });
  const { data: reviewCount } = useQuery({
    queryKey: ["leads-needing-review-count"],
    queryFn: () => fetchReviewCount(),
  });

  const acceptMut = useMutation({
    mutationFn: (id: string) => acceptFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Lead aceito.");
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["leads-needing-review"] });
      queryClient.invalidateQueries({ queryKey: ["leads-needing-review-count"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const discardMut = useMutation({
    mutationFn: (id: string) => archiveFnReview({ data: { id } }),
    onSuccess: () => {
      toast.success("Lead descartado.");
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["leads-needing-review"] });
      queryClient.invalidateQueries({ queryKey: ["leads-needing-review-count"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    return (leads ?? []).filter((lead) => {
      if (statusFilter !== "all" && lead.status !== statusFilter) return false;
      if (sourceFilter !== "all" && lead.lead_sources?.slug !== sourceFilter) return false;
      if (!query) return true;

      const q = query.toLowerCase();
      return [
        lead.full_name,
        lead.email,
        lead.company_name,
        lead.job_title,
        lead.lead_sources?.name,
      ]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(q));
    });
  }, [leads, query, sourceFilter, statusFilter]);

  const statuses = useMemo(
    () =>
      Array.from(
        new Set((leads ?? []).map((lead) => lead.status).filter(Boolean)),
      ),
    [leads],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description="Pipeline comercial com origem, contexto e atividade real por contato."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/dashboard/leads/apollo">
                <Sparkles className="h-4 w-4" />
                Buscar no Apollo
              </Link>
            </Button>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" />
              Importar
            </Button>
            <Button onClick={() => setNewLeadOpen(true)}>
              <Plus className="h-4 w-4" />
              Novo lead
            </Button>
          </>
        }
      />

      <div className="flex gap-1 border-b">
        <button
          onClick={() => setTab("all")}
          className={cn(
            "px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            tab === "all" ? "border-brand text-brand" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          Todos
        </button>
        <button
          onClick={() => setTab("review")}
          className={cn(
            "px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors inline-flex items-center gap-2",
            tab === "review" ? "border-amber-500 text-amber-700" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Pra revisar
          {reviewCount?.count ? (
            <span className="rounded-full bg-amber-500/15 text-amber-700 px-1.5 py-0.5 text-[0.65rem] font-semibold">
              {reviewCount.count}
            </span>
          ) : null}
        </button>
      </div>

      {tab === "review" ? (
        <div className="space-y-2">
          {!reviewLeads?.length ? (
            <EmptyState
              icon={Check}
              title="Nada pra revisar"
              description="Leads criados automaticamente via WhatsApp aparecerão aqui."
            />
          ) : (
            <ul className="space-y-2">
              {reviewLeads.map((l: any) => (
                <li key={l.id} className="rounded-xl border bg-surface p-4 flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-500/15 text-amber-700 text-xs font-semibold">
                    {(l.full_name ?? "?").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{l.full_name ?? l.phone}</span>
                      {l.phone && <span className="text-xs text-muted-foreground">{l.phone}</span>}
                      {l.review_reason && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[0.65rem] text-muted-foreground">
                          {l.review_reason === "inbound_from_unknown_whatsapp"
                            ? "Respondeu via WhatsApp sem campanha ativa"
                            : l.review_reason}
                        </span>
                      )}
                    </div>
                    {l.preview && <p className="text-xs text-muted-foreground line-clamp-2">{l.preview}</p>}
                    <div className="text-[11px] text-muted-foreground">
                      criado {new Date(l.created_at).toLocaleString("pt-BR")}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <Button size="sm" onClick={() => acceptMut.mutate(l.id)} disabled={acceptMut.isPending}>
                      Aceitar
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link to="/dashboard/leads/$leadId" params={{ leadId: l.id }}>
                        Editar
                      </Link>
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => discardMut.mutate(l.id)} disabled={discardMut.isPending}>
                      Descartar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
      <section className="space-y-4">
        <div className="flex flex-col gap-3 rounded-xl border bg-surface p-3 lg:flex-row lg:items-center">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome, empresa, email ou origem..."
              className="h-9 pl-9"
            />
          </div>

          <div className="flex flex-1 flex-wrap items-center gap-2">
            <FilterPills
              label="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              items={[{ value: "all", label: "Todos" }, ...statuses.map((status) => ({
                value: status,
                label: STATUS_META[status]?.label ?? status,
              }))]}
            />
            <FilterPills
              label="Origem"
              value={sourceFilter}
              onChange={setSourceFilter}
              items={[{ value: "all", label: "Todas" }, ...(sources ?? []).map((source) => ({
                value: source.slug,
                label: source.name,
              }))]}
            />
          </div>

          <div className="ml-auto text-xs text-muted-foreground">
            {isLoading ? "Carregando..." : `${filtered.length} lead${filtered.length !== 1 ? "s" : ""}`}
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {(error as Error).message}
          </div>
        ) : isLoading ? (
          <div className="space-y-2 rounded-xl border bg-surface p-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded bg-surface-muted/50" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={InboxIcon}
            title={query || statusFilter !== "all" || sourceFilter !== "all" ? "Nenhum lead encontrado" : "Ainda sem leads"}
            description={
              query || statusFilter !== "all" || sourceFilter !== "all"
                ? "Ajuste os filtros ou a busca para encontrar outros contatos."
                : "Comece importando uma lista ou adicionando o primeiro contato."
            }
            action={
              !query && statusFilter === "all" && sourceFilter === "all" && (
                <div className="flex gap-2">
                  <Button onClick={() => setNewLeadOpen(true)}>
                    <Plus className="h-4 w-4" />
                    Adicionar lead
                  </Button>
                  <Button variant="outline" onClick={() => setImportOpen(true)}>
                    <Upload className="h-4 w-4" />
                    Importar CSV
                  </Button>
                </div>
              )
            }
          />
        ) : (
          <div className="overflow-hidden rounded-xl border bg-surface">
            <ul className="divide-y">
              {filtered.map((lead) => {
                const meta = STATUS_META[lead.status] ?? STATUS_META.new;
                return (
                  <li key={lead.id}>
                    <Link
                      to="/dashboard/leads/$leadId"
                      params={{ leadId: lead.id }}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-surface-muted/40"
                    >
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-foreground text-xs font-semibold text-background">
                        {lead.full_name
                          .split(" ")
                          .slice(0, 2)
                          .map((segment) => segment[0])
                          .join("")
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold">{lead.full_name}</span>
                          {lead.job_title && (
                            <span className="truncate text-xs text-muted-foreground">{lead.job_title}</span>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {lead.company_name && (
                            <span className="inline-flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {lead.company_name}
                            </span>
                          )}
                          {lead.email && (
                            <span className="truncate">{lead.email}</span>
                          )}
                          {lead.lead_sources?.name && (
                            <span className="rounded-full border px-2 py-0.5">
                              {lead.lead_sources.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="hidden text-right lg:block">
                        <div className="text-sm font-medium tabular-nums">{lead.score ?? 0}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {lead.temperature ? TEMPERATURE_META[lead.temperature] ?? lead.temperature : "Sem temperatura"}
                        </div>
                      </div>
                      <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium", meta.chip)}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                        {meta.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
      )}



      <NewLeadSheet
        open={newLeadOpen}
        onOpenChange={setNewLeadOpen}
        sources={sources ?? []}
      />
      <ImportLeadsSheet
        open={importOpen}
        onOpenChange={setImportOpen}
        sources={sources ?? []}
      />
    </div>
  );
}

function FilterPills({
  label,
  value,
  onChange,
  items,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  items: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="flex flex-wrap items-center gap-1">
        {items.map((item) => (
          <button
            key={item.value}
            onClick={() => onChange(item.value)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs transition-colors",
              value === item.value
                ? "border-brand bg-brand/10 text-brand"
                : "border-transparent bg-surface-muted/40 text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}


const newLeadSchema = z.object({
  full_name: z.string().trim().min(1, "Nome obrigatório").max(120),
  email: z.string().trim().email("Email inválido").max(255),
  phone: z.string().trim().max(40).optional(),
  company_name: z.string().trim().max(160).optional(),
  job_title: z.string().trim().max(160).optional(),
  source_id: z.string().uuid().optional().or(z.literal("")),
});
type NewLeadValues = z.infer<typeof newLeadSchema>;

function NewLeadSheet({
  open,
  onOpenChange,
  sources,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sources: LeadSource[];
}) {
  const queryClient = useQueryClient();
  const createFn = useServerFn(createLead);
  const form = useForm<NewLeadValues>({
    resolver: zodResolver(newLeadSchema),
    defaultValues: { full_name: "", email: "", phone: "", company_name: "", job_title: "", source_id: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: NewLeadValues) =>
      createFn({
        data: {
          full_name: values.full_name,
          email: values.email,
          phone: values.phone || null,
          company_name: values.company_name || null,
          job_title: values.job_title || null,
          source_id: values.source_id ? values.source_id : null,
        },
      }),
    onSuccess: () => {
      toast.success("Lead criado.");
      form.reset();
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) form.reset();
      }}
    >
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Novo lead</SheetTitle>
          <SheetDescription>Cadastre um novo contato no pipeline.</SheetDescription>
        </SheetHeader>

        <form
          onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
          className="mt-6 space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="nl-name">Nome completo *</Label>
            <Input id="nl-name" {...form.register("full_name")} />
            {form.formState.errors.full_name && (
              <p className="text-xs text-destructive">{form.formState.errors.full_name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nl-email">E-mail *</Label>
            <Input id="nl-email" type="email" {...form.register("email")} />
            {form.formState.errors.email && (
              <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nl-phone">Telefone</Label>
            <Input id="nl-phone" {...form.register("phone")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nl-company">Empresa</Label>
            <Input id="nl-company" {...form.register("company_name")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nl-job">Cargo</Label>
            <Input id="nl-job" {...form.register("job_title")} />
          </div>
          <div className="space-y-1.5">
            <Label>Origem</Label>
            <Select
              value={form.watch("source_id") || ""}
              onValueChange={(v) => form.setValue("source_id", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a origem (opcional)" />
              </SelectTrigger>
              <SelectContent>
                {sources.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <SheetFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
