import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Archive,
  ArrowUpRight,
  Building2,
  CalendarClock,
  CircleDollarSign,
  Inbox as InboxIcon,
  Link2,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  Sparkles,
  Upload,
  X,
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
  archiveLead,
  createLead,
  getLeadDetail,
  listLeads,
  listLeadSources,
  updateLead,
} from "@/lib/tenant.functions";
import { ImportLeadsSheet } from "@/components/app/ImportLeadsSheet";
import { cn } from "@/lib/utils";

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

type LeadDetailData = {
  lead: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    company_name: string | null;
    job_title: string | null;
    status: string;
    temperature: string | null;
    score: number | null;
    city: string | null;
    country: string | null;
    linkedin_url: string | null;
    website_url: string | null;
    tags: string[] | null;
    currency: string;
    estimated_value: number | null;
    next_followup_at: string | null;
    last_contact_at: string | null;
    created_at: string;
    lead_sources: LeadSource | null;
  } | null;
  activities: Array<{
    id: string;
    type: string;
    title: string;
    description: string | null;
    created_at: string;
  }>;
  enrichment: {
    id: string;
    provider: string;
    confidence: number | null;
    fetched_at: string;
    payload: unknown;
  } | null;
};

function LeadsPage() {
  const fetchLeads = useServerFn(listLeads);
  const fetchSources = useServerFn(listLeadSources);
  const fetchLeadDetail = useServerFn(getLeadDetail);

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
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

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

  useEffect(() => {
    if (!filtered.length) {
      setSelectedLeadId(null);
      return;
    }

    const stillSelected = filtered.some((lead) => lead.id === selectedLeadId);
    if (!stillSelected) {
      setSelectedLeadId(filtered[0]?.id ?? null);
    }
  }, [filtered, selectedLeadId]);

  const { data: detail, isLoading: loadingDetail } = useQuery({
    enabled: !!selectedLeadId,
    queryKey: ["leads", "detail", selectedLeadId],
    queryFn: () => fetchLeadDetail({ data: { leadId: selectedLeadId! } }),
  });

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

      <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_360px]">
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
                    <Button variant="outline">
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
                    <li
                      key={lead.id}
                      onClick={() => setSelectedLeadId(lead.id)}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-surface-muted/40",
                        lead.id === selectedLeadId && "bg-surface-muted/30",
                      )}
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
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>

        <aside className="rounded-xl border bg-surface">
          {!selectedLeadId || !detail?.lead ? (
            <div className="flex h-full min-h-[360px] items-center justify-center p-6">
              <EmptyState
                icon={InboxIcon}
                title="Selecione um lead"
                description="O detalhe mostra atividade recente, origem e próximos passos do contato escolhido."
              />
            </div>
          ) : loadingDetail ? (
            <div className="space-y-3 p-5">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-surface-muted/50" />
              ))}
            </div>
          ) : (
            <LeadDetailPanel
              detail={detail}
              sources={sources ?? []}
              onArchived={() => setSelectedLeadId(null)}
            />
          )}
        </aside>
      </div>

      <NewLeadSheet
        open={newLeadOpen}
        onOpenChange={setNewLeadOpen}
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

function LeadDetailPanel({
  detail,
  sources,
  onArchived,
}: {
  detail: LeadDetailData;
  sources: LeadSource[];
  onArchived: () => void;
}) {
  const lead = detail.lead!;
  const statusMeta = STATUS_META[lead.status] ?? STATUS_META.new;
  const queryClient = useQueryClient();
  const updateFn = useServerFn(updateLead);
  const archiveFn = useServerFn(archiveLead);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setEditing(false);
  }, [lead.id]);

  const editSchema = z.object({
    full_name: z.string().trim().min(1, "Obrigatório").max(120),
    email: z.string().trim().email("Email inválido").max(255).or(z.literal("")).optional(),
    phone: z.string().trim().max(40).optional(),
    company_name: z.string().trim().max(160).optional(),
    job_title: z.string().trim().max(160).optional(),
    status: z.enum(LEAD_STATUSES),
  });
  type EditValues = z.infer<typeof editSchema>;

  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    values: {
      full_name: lead.full_name,
      email: lead.email ?? "",
      phone: lead.phone ?? "",
      company_name: lead.company_name ?? "",
      job_title: lead.job_title ?? "",
      status: (LEAD_STATUSES.includes(lead.status as (typeof LEAD_STATUSES)[number])
        ? lead.status
        : "new") as (typeof LEAD_STATUSES)[number],
    },
  });

  const updateMutation = useMutation({
    mutationFn: (values: EditValues) =>
      updateFn({
        data: {
          id: lead.id,
          full_name: values.full_name,
          email: values.email ? values.email : null,
          phone: values.phone ? values.phone : null,
          company_name: values.company_name ? values.company_name : null,
          job_title: values.job_title ? values.job_title : null,
          status: values.status,
        },
      }),
    onSuccess: () => {
      toast.success("Lead atualizado.");
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["leads", "detail", lead.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const archiveMutation = useMutation({
    mutationFn: () => archiveFn({ data: { id: lead.id } }),
    onSuccess: () => {
      toast.success("Lead arquivado.");
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      onArchived();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const enrichmentPayload =
    detail.enrichment?.payload && typeof detail.enrichment.payload === "object" && !Array.isArray(detail.enrichment.payload)
      ? (detail.enrichment.payload as Record<string, unknown>)
      : null;

  const enrichmentHighlights = enrichmentPayload
    ? [
        enrichmentPayload.industry,
        enrichmentPayload.employee_range,
        enrichmentPayload.company_stage,
      ].filter(Boolean)
    : [];

  return (
    <div className="space-y-5 p-5">
      <div className="space-y-3 border-b pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {editing ? (
              <Input
                {...form.register("full_name")}
                className="font-display text-lg font-semibold"
              />
            ) : (
              <h2 className="font-display text-lg font-semibold">{lead.full_name}</h2>
            )}
            {!editing && (
              <p className="mt-1 text-sm text-muted-foreground">
                {[lead.job_title, lead.company_name].filter(Boolean).join(" · ") || "Lead sem cargo ou empresa definidos"}
              </p>
            )}
          </div>
          <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium shrink-0", statusMeta.chip)}>
            <span className={cn("h-1.5 w-1.5 rounded-full", statusMeta.dot)} />
            {statusMeta.label}
          </span>
        </div>

        {editing ? (
          <form
            onSubmit={form.handleSubmit((v) => updateMutation.mutate(v))}
            className="space-y-3"
          >
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="edit-email" className="text-xs">Email</Label>
                <Input id="edit-email" type="email" {...form.register("email")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-phone" className="text-xs">Telefone</Label>
                <Input id="edit-phone" {...form.register("phone")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-company" className="text-xs">Empresa</Label>
                <Input id="edit-company" {...form.register("company_name")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-job" className="text-xs">Cargo</Label>
                <Input id="edit-job" {...form.register("job_title")} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Status</Label>
                <Select
                  value={form.watch("status")}
                  onValueChange={(v) => form.setValue("status", v as (typeof LEAD_STATUSES)[number])}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEAD_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_META[s]?.label ?? s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.formState.errors.full_name && (
              <p className="text-xs text-destructive">{form.formState.errors.full_name.message}</p>
            )}
            {form.formState.errors.email && (
              <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
            )}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Salvar alterações
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => { setEditing(false); form.reset(); }}>
                <X className="h-3.5 w-3.5" />
                Cancelar
              </Button>
            </div>
          </form>
        ) : (
          <>
            <div className="grid gap-2 text-sm text-muted-foreground">
              {lead.email && (
                <div className="inline-flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {lead.email}
                </div>
              )}
              {lead.phone && (
                <div className="inline-flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  {lead.phone}
                </div>
              )}
              {lead.website_url && (
                <div className="inline-flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  {lead.website_url}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" />
                Editar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => archiveMutation.mutate()}
                disabled={archiveMutation.isPending || lead.status === "archived"}
              >
                {archiveMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Archive className="h-3.5 w-3.5" />
                )}
                Arquivar
              </Button>
            </div>
          </>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard label="Score" value={`${lead.score ?? 0}`} />
        <StatCard label="Temperatura" value={lead.temperature ? TEMPERATURE_META[lead.temperature] ?? lead.temperature : "Sem dado"} />
        <StatCard label="Origem" value={lead.lead_sources?.name ?? "Não informada"} />
        <StatCard
          label="Próximo follow-up"
          value={lead.next_followup_at ? new Date(lead.next_followup_at).toLocaleDateString("pt-BR") : "Não agendado"}
        />
      </div>

      <div className="space-y-2">
        <SectionTitle icon={CircleDollarSign} title="Potencial comercial" />
        <div className="rounded-lg border bg-background px-3 py-2 text-sm text-muted-foreground">
          {lead.estimated_value
            ? `${lead.estimated_value.toLocaleString("pt-BR", { style: "currency", currency: lead.currency ?? "BRL" })} estimado`
            : "Valor estimado ainda não definido."}
        </div>
      </div>

      <div className="space-y-2">
        <SectionTitle icon={Sparkles} title="Enrichment mais recente" />
        {detail.enrichment ? (
          <div className="rounded-lg border bg-background p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium">{detail.enrichment.provider}</div>
              <div className="text-xs text-muted-foreground">
                confiança {Math.round((detail.enrichment.confidence ?? 0) * 100)}%
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {enrichmentHighlights.length > 0 ? (
                enrichmentHighlights.map((item) => (
                  <span key={String(item)} className="rounded-full bg-surface-muted/50 px-2 py-1 text-xs text-muted-foreground">
                    {String(item)}
                  </span>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">Payload disponível, sem highlights resumidos ainda.</span>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed bg-background px-3 py-4 text-sm text-muted-foreground">
            Nenhum enrichment salvo para este lead.
          </div>
        )}
      </div>

      <div className="space-y-2">
        <SectionTitle icon={CalendarClock} title="Atividade recente" />
        {detail.activities.length > 0 ? (
          <ul className="space-y-2">
            {detail.activities.map((activity) => (
              <li key={activity.id} className="rounded-lg border bg-background p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">{activity.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {activity.description || "Sem descrição adicional."}
                    </div>
                  </div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {activity.type}
                  </div>
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground">
                  {new Date(activity.created_at).toLocaleString("pt-BR")}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-lg border border-dashed bg-background px-3 py-4 text-sm text-muted-foreground">
            Ainda não há atividades registradas para este lead.
          </div>
        )}
      </div>

      {lead.linkedin_url && (
        <Button asChild variant="outline" className="w-full">
          <a href={lead.linkedin_url} target="_blank" rel="noreferrer">
            Abrir LinkedIn
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </Button>
      )}
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
}: {
  icon: typeof CircleDollarSign;
  title: string;
}) {
  return (
    <div className="inline-flex items-center gap-2 text-sm font-medium">
      <Icon className="h-4 w-4 text-muted-foreground" />
      {title}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background px-3 py-2">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
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
