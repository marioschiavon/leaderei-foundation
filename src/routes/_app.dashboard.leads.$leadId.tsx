import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowUpRight, Archive, Building2, CalendarClock,
  CircleDollarSign, Loader2, Mail, MapPin, Pencil, Phone, Save, Send,
  Sparkles, Tag as TagIcon, Linkedin, Globe, X, AlertCircle,
} from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { getLeadDetail, listLeadSources, updateLead, archiveLead } from "@/lib/tenant.functions";
import { enrichLeadWithApollo } from "@/lib/apollo.functions";
import { LeadInsightsPanel } from "@/components/app/LeadInsightsPanel";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/dashboard/leads/$leadId")({
  component: LeadDetailPage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm">
        <div className="flex items-center gap-2 font-medium text-destructive">
          <AlertCircle className="h-4 w-4" />
          Erro ao carregar o lead
        </div>
        <p className="mt-2 text-muted-foreground">{(error as Error).message}</p>
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { reset(); router.invalidate(); }}>
            Tentar de novo
          </Button>
          <Button size="sm" asChild>
            <Link to="/dashboard/leads"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
          </Button>
        </div>
      </div>
    );
  },
  notFoundComponent: () => (
    <div className="rounded-xl border bg-surface p-6 text-sm">
      <p className="font-medium">Lead não encontrado.</p>
      <Button size="sm" asChild className="mt-3">
        <Link to="/dashboard/leads"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
      </Button>
    </div>
  ),
});

const LEAD_STATUSES = ["new","contacted","qualified","proposal","won","lost","archived"] as const;
const LEAD_TEMPERATURES = ["cold","warm","hot"] as const;

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
const TEMP_META: Record<string, string> = { cold: "Frio", warm: "Morno", hot: "Quente" };
const ENROLLMENT_META: Record<string, { label: string; chip: string }> = {
  pending: { label: "Pendente", chip: "bg-muted text-foreground" },
  active: { label: "Ativa", chip: "bg-brand/10 text-brand" },
  paused: { label: "Pausada", chip: "bg-amber-500/15 text-amber-700" },
  completed: { label: "Concluída", chip: "bg-emerald-500/15 text-emerald-700" },
  failed: { label: "Falhou", chip: "bg-destructive/10 text-destructive" },
  cancelled: { label: "Cancelada", chip: "bg-muted text-muted-foreground" },
};

const editSchema = z.object({
  full_name: z.string().trim().min(1, "Obrigatório").max(120),
  email: z.string().trim().email("Email inválido").max(255).or(z.literal("")),
  secondary_email: z.string().trim().email("Email inválido").max(255).or(z.literal("")),
  personal_email: z.string().trim().email("Email inválido").max(255).or(z.literal("")),
  phone: z.string().trim().max(40),
  mobile_phone: z.string().trim().max(40),
  corporate_phone: z.string().trim().max(40),
  company_name: z.string().trim().max(160),
  job_title: z.string().trim().max(160),
  seniority: z.string().trim().max(80),
  department: z.string().trim().max(80),
  industry: z.string().trim().max(120),
  employee_count: z.string().trim().regex(/^\d*$/, "Só números").max(10),
  website_url: z.string().trim().max(255),
  linkedin_url: z.string().trim().max(255),
  company_linkedin_url: z.string().trim().max(255),
  city: z.string().trim().max(120),
  state: z.string().trim().max(120),
  country: z.string().trim().max(120),
  status: z.enum(LEAD_STATUSES),
  temperature: z.enum(LEAD_TEMPERATURES),
  score: z.string().trim().regex(/^\d*$/, "Só números").max(3),
  estimated_value: z.string().trim().regex(/^\d*([.,]\d{1,2})?$/, "Número inválido").max(15),
  currency: z.string().trim().length(3).or(z.literal("")),
  next_followup_at: z.string().trim().max(40),
  tags: z.string().trim().max(500),
  source_id: z.string(),
});
type EditValues = z.infer<typeof editSchema>;

function LeadDetailPage() {
  const { leadId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchDetail = useServerFn(getLeadDetail);
  const fetchSources = useServerFn(listLeadSources);
  const updateFn = useServerFn(updateLead);
  const archiveFn = useServerFn(archiveLead);
  const enrichFn = useServerFn(enrichLeadWithApollo);

  const { data: detail, isLoading, error } = useQuery({
    queryKey: ["leads", "detail", leadId],
    queryFn: () => fetchDetail({ data: { leadId } }),
  });
  const { data: sources } = useQuery({
    queryKey: ["leads", "sources"],
    queryFn: () => fetchSources(),
  });

  const [editing, setEditing] = useState(false);

  const lead = detail?.lead as any;

  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    values: lead
      ? {
          full_name: lead.full_name ?? "",
          email: lead.email ?? "",
          secondary_email: lead.secondary_email ?? "",
          personal_email: lead.personal_email ?? "",
          phone: lead.phone ?? "",
          mobile_phone: lead.mobile_phone ?? "",
          corporate_phone: lead.corporate_phone ?? "",
          company_name: lead.company_name ?? "",
          job_title: lead.job_title ?? "",
          seniority: lead.seniority ?? "",
          department: lead.department ?? "",
          industry: lead.industry ?? "",
          employee_count: lead.employee_count != null ? String(lead.employee_count) : "",
          website_url: lead.website_url ?? "",
          linkedin_url: lead.linkedin_url ?? "",
          company_linkedin_url: lead.company_linkedin_url ?? "",
          city: lead.city ?? "",
          state: lead.state ?? "",
          country: lead.country ?? "",
          status: (LEAD_STATUSES.includes(lead.status) ? lead.status : "new") as any,
          temperature: (LEAD_TEMPERATURES.includes(lead.temperature) ? lead.temperature : "cold") as any,
          score: lead.score != null ? String(lead.score) : "0",
          estimated_value: lead.estimated_value != null ? String(lead.estimated_value) : "",
          currency: lead.currency ?? "BRL",
          next_followup_at: lead.next_followup_at ? lead.next_followup_at.slice(0, 16) : "",
          tags: Array.isArray(lead.tags) ? lead.tags.join(", ") : "",
          source_id: lead.source_id ?? "",
        }
      : undefined,
  });

  useEffect(() => { setEditing(false); }, [leadId]);

  const updateMut = useMutation({
    mutationFn: (v: EditValues) =>
      updateFn({
        data: {
          id: leadId,
          full_name: v.full_name,
          email: v.email,
          secondary_email: v.secondary_email,
          personal_email: v.personal_email,
          phone: v.phone,
          mobile_phone: v.mobile_phone,
          corporate_phone: v.corporate_phone,
          company_name: v.company_name,
          job_title: v.job_title,
          seniority: v.seniority,
          department: v.department,
          industry: v.industry,
          employee_count: v.employee_count ? Number(v.employee_count) : null,
          website_url: v.website_url,
          linkedin_url: v.linkedin_url,
          city: v.city,
          state: v.state,
          country: v.country,
          status: v.status,
          temperature: v.temperature,
          score: v.score ? Number(v.score) : 0,
          estimated_value: v.estimated_value ? Number(v.estimated_value.replace(",", ".")) : null,
          currency: v.currency || "BRL",
          next_followup_at: v.next_followup_at ? new Date(v.next_followup_at).toISOString() : null,
          tags: v.tags ? v.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
          source_id: v.source_id || null,
        } as any,
      }),
    onSuccess: () => {
      toast.success("Lead atualizado.");
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["leads", "detail", leadId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const archiveMut = useMutation({
    mutationFn: () => archiveFn({ data: { id: leadId } }),
    onSuccess: () => {
      toast.success("Lead arquivado.");
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      navigate({ to: "/dashboard/leads" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const enrichMut = useMutation({
    mutationFn: () => enrichFn({ data: { lead_id: leadId } }),
    onSuccess: (r: any) => {
      const msg = r?.message as string | undefined;
      if (!r?.matched) {
        toast.warning(msg ?? "Apollo não encontrou correspondência.");
      } else if (r?.locked) {
        toast.warning(msg ?? "Apollo encontrou a pessoa, mas contatos estão bloqueados.");
      } else if ((r?.fields_updated?.length ?? 0) > 0) {
        toast.success(msg ?? `Enriquecido: ${r.fields_updated.length} campos atualizados.`);
      } else {
        toast.info(msg ?? "Enriquecido. Nenhum campo novo.");
      }
      queryClient.invalidateQueries({ queryKey: ["leads", "detail", leadId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-surface-muted/50" />
        <div className="h-64 animate-pulse rounded-xl bg-surface-muted/40" />
      </div>
    );
  }
  if (error) throw error;
  if (!lead) {
    return (
      <div className="rounded-xl border bg-surface p-6 text-sm">
        <p className="font-medium">Lead não encontrado.</p>
        <Button size="sm" asChild className="mt-3">
          <Link to="/dashboard/leads"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
        </Button>
      </div>
    );
  }

  const statusMeta = STATUS_META[lead.status] ?? STATUS_META.new;
  const enrollments = (detail?.enrollments ?? []) as any[];
  const bookings = (detail?.bookings ?? []) as any[];
  const activities = (detail?.activities ?? []) as any[];

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link to="/dashboard/leads"><ArrowLeft className="h-4 w-4" /> Voltar para Leads</Link>
        </Button>
        <PageHeader
          title={lead.full_name}
          description={[lead.job_title, lead.company_name].filter(Boolean).join(" · ") || "Lead sem cargo ou empresa definidos"}
          actions={
            editing ? (
              <>
                <Button variant="outline" size="sm" onClick={() => { setEditing(false); form.reset(); }}>
                  <X className="h-4 w-4" /> Cancelar
                </Button>
                <Button size="sm" onClick={form.handleSubmit((v) => updateMut.mutate(v))} disabled={updateMut.isPending}>
                  {updateMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar
                </Button>
              </>
            ) : (
              <>
                <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium", statusMeta.chip)}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", statusMeta.dot)} /> {statusMeta.label}
                </span>
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Pencil className="h-4 w-4" /> Editar
                </Button>
                <Button
                  variant="outline" size="sm"
                  onClick={() => { if (confirm("Enriquecer este lead com Apollo? Vai consumir crédito da sua conta Apollo.")) enrichMut.mutate(); }}
                  disabled={enrichMut.isPending}
                >
                  {enrichMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Enriquecer com Apollo
                </Button>
                <Button
                  variant="outline" size="sm"
                  onClick={() => { if (confirm("Arquivar este lead?")) archiveMut.mutate(); }}
                  disabled={archiveMut.isPending || lead.status === "archived"}
                >
                  {archiveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                  Arquivar
                </Button>
              </>
            )
          }
        />
      </div>

      <form
        onSubmit={form.handleSubmit((v) => updateMut.mutate(v))}
        className="grid gap-5 lg:grid-cols-[2fr_1fr]"
      >
        {/* MAIN COLUMN */}
        <div className="space-y-5">
          <Section title="Dados de contato" icon={Mail}>
            <Grid2>
              <FieldRow label="Email principal" editing={editing} value={lead.email}>
                <Input type="email" {...form.register("email")} />
              </FieldRow>
              <FieldRow label="Email secundário" editing={editing} value={lead.secondary_email}>
                <Input type="email" {...form.register("secondary_email")} />
              </FieldRow>
              <FieldRow label="Email pessoal" editing={editing} value={lead.personal_email}>
                <Input type="email" {...form.register("personal_email")} />
              </FieldRow>
              <FieldRow label="Telefone" editing={editing} value={lead.phone} icon={Phone}>
                <Input {...form.register("phone")} />
              </FieldRow>
              <FieldRow label="Celular" editing={editing} value={lead.mobile_phone} icon={Phone}>
                <Input {...form.register("mobile_phone")} />
              </FieldRow>
              <FieldRow label="Tel. corporativo" editing={editing} value={lead.corporate_phone} icon={Phone}>
                <Input {...form.register("corporate_phone")} />
              </FieldRow>
            </Grid2>
          </Section>

          <Section title="Empresa e cargo" icon={Building2}>
            <Grid2>
              {editing && (
                <FieldRow label="Nome completo" editing value={lead.full_name}>
                  <Input {...form.register("full_name")} />
                </FieldRow>
              )}
              <FieldRow label="Empresa" editing={editing} value={lead.company_name}>
                <Input {...form.register("company_name")} />
              </FieldRow>
              <FieldRow label="Cargo" editing={editing} value={lead.job_title}>
                <Input {...form.register("job_title")} />
              </FieldRow>
              <FieldRow label="Senioridade" editing={editing} value={lead.seniority}>
                <Input {...form.register("seniority")} />
              </FieldRow>
              <FieldRow label="Departamento" editing={editing} value={lead.department}>
                <Input {...form.register("department")} />
              </FieldRow>
              <FieldRow label="Indústria" editing={editing} value={lead.industry}>
                <Input {...form.register("industry")} />
              </FieldRow>
              <FieldRow label="Nº funcionários" editing={editing} value={lead.employee_count}>
                <Input inputMode="numeric" {...form.register("employee_count")} />
              </FieldRow>
            </Grid2>
          </Section>

          <Section title="Localização" icon={MapPin}>
            <Grid2>
              <FieldRow label="Cidade" editing={editing} value={lead.city}>
                <Input {...form.register("city")} />
              </FieldRow>
              <FieldRow label="Estado" editing={editing} value={lead.state}>
                <Input {...form.register("state")} />
              </FieldRow>
              <FieldRow label="País" editing={editing} value={lead.country}>
                <Input {...form.register("country")} />
              </FieldRow>
            </Grid2>
          </Section>

          <LeadInsightsPanel leadId={leadId} websiteUrl={lead.website_url} />

          <Section title="Campanhas" icon={Send}>
            {enrollments.length === 0 ? (
              <Empty>Este lead ainda não foi inscrito em nenhuma campanha.</Empty>
            ) : (
              <ul className="space-y-2">
                {enrollments.map((e) => {
                  const em = ENROLLMENT_META[e.status] ?? ENROLLMENT_META.pending;
                  return (
                    <li key={e.id} className="rounded-lg border bg-background p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{e.campaigns?.name ?? "Campanha removida"}</div>
                          <div className="text-[11px] text-muted-foreground">
                            inscrito {new Date(e.enrolled_at).toLocaleString("pt-BR")}
                            {e.completed_at && ` · concluído ${new Date(e.completed_at).toLocaleDateString("pt-BR")}`}
                            {e.next_run_at && ` · próximo: ${new Date(e.next_run_at).toLocaleString("pt-BR")}`}
                          </div>
                          {e.last_error && <div className="mt-1 text-[11px] text-destructive">{e.last_error}</div>}
                        </div>
                        <Badge variant="secondary" className={cn("border-transparent", em.chip)}>{em.label}</Badge>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          <Section title="Reuniões agendadas" icon={CalendarClock}>
            {bookings.length === 0 ? (
              <Empty>Sem reuniões agendadas.</Empty>
            ) : (
              <ul className="space-y-2">
                {bookings.map((b) => (
                  <li key={b.id} className="rounded-lg border bg-background p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{b.title ?? b.event_type_slug ?? "Reunião"}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {new Date(b.start_at).toLocaleString("pt-BR")}
                          {b.end_at && ` → ${new Date(b.end_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
                        </div>
                        {b.meeting_url && (
                          <a href={b.meeting_url} target="_blank" rel="noreferrer" className="text-[11px] text-brand hover:underline">
                            Link da reunião
                          </a>
                        )}
                      </div>
                      <Badge variant="outline">{b.status}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Atividade recente" icon={CalendarClock}>
            {activities.length === 0 ? (
              <Empty>Nenhuma atividade registrada ainda.</Empty>
            ) : (
              <ul className="space-y-2">
                {activities.map((a) => (
                  <li key={a.id} className="rounded-lg border bg-background p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{a.title}</div>
                        {a.description && <div className="mt-1 text-xs text-muted-foreground">{a.description}</div>}
                      </div>
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground shrink-0">{a.type}</div>
                    </div>
                    <div className="mt-2 text-[11px] text-muted-foreground">
                      {new Date(a.created_at).toLocaleString("pt-BR")}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        {/* SIDE COLUMN */}
        <div className="space-y-5">
          <Section title="Resumo comercial" icon={CircleDollarSign}>
            <Grid2>
              <FieldRow label="Status" editing={editing} value={STATUS_META[lead.status]?.label ?? lead.status}>
                <Select value={form.watch("status")} onValueChange={(v) => form.setValue("status", v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEAD_STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_META[s]?.label ?? s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label="Temperatura" editing={editing} value={lead.temperature ? TEMP_META[lead.temperature] : null}>
                <Select value={form.watch("temperature")} onValueChange={(v) => form.setValue("temperature", v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEAD_TEMPERATURES.map((t) => <SelectItem key={t} value={t}>{TEMP_META[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label="Score" editing={editing} value={String(lead.score ?? 0)}>
                <Input inputMode="numeric" {...form.register("score")} />
              </FieldRow>
              <FieldRow
                label="Valor estimado"
                editing={editing}
                value={lead.estimated_value
                  ? Number(lead.estimated_value).toLocaleString("pt-BR", { style: "currency", currency: lead.currency ?? "BRL" })
                  : null}
              >
                <div className="grid grid-cols-[1fr_70px] gap-1">
                  <Input inputMode="decimal" {...form.register("estimated_value")} />
                  <Input maxLength={3} {...form.register("currency")} placeholder="BRL" />
                </div>
              </FieldRow>
              <FieldRow
                label="Próximo follow-up"
                editing={editing}
                value={lead.next_followup_at ? new Date(lead.next_followup_at).toLocaleString("pt-BR") : null}
              >
                <Input type="datetime-local" {...form.register("next_followup_at")} />
              </FieldRow>
              <FieldRow
                label="Último contato"
                editing={false}
                value={lead.last_contact_at ? new Date(lead.last_contact_at).toLocaleString("pt-BR") : null}
              >
                <span />
              </FieldRow>
            </Grid2>
          </Section>

          <Section title="Origem">
            {editing ? (
              <Select value={form.watch("source_id") || "__none__"} onValueChange={(v) => form.setValue("source_id", v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar origem" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Sem origem —</SelectItem>
                  {(sources ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <ValueText>{lead.lead_sources?.name ?? "Não informada"}</ValueText>
            )}
          </Section>

          <Section title="Tags" icon={TagIcon}>
            {editing ? (
              <>
                <Input {...form.register("tags")} placeholder="separadas por vírgula" />
                <p className="mt-1 text-[11px] text-muted-foreground">Separe por vírgula.</p>
              </>
            ) : Array.isArray(lead.tags) && lead.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {lead.tags.map((t: string) => (
                  <Badge key={t} variant="secondary" className="bg-muted/60">{t}</Badge>
                ))}
              </div>
            ) : (
              <Empty>Nenhuma tag.</Empty>
            )}
          </Section>

          <Section title="Links">
            <Grid2>
              <FieldRow label="LinkedIn" editing={editing} value={lead.linkedin_url} icon={Linkedin}>
                <Input {...form.register("linkedin_url")} placeholder="https://linkedin.com/in/..." />
              </FieldRow>
              <FieldRow label="Website" editing={editing} value={lead.website_url} icon={Globe}>
                <Input {...form.register("website_url")} placeholder="https://..." />
              </FieldRow>
            </Grid2>
            {!editing && lead.linkedin_url && (
              <Button asChild variant="outline" size="sm" className="mt-2 w-full">
                <a href={lead.linkedin_url} target="_blank" rel="noreferrer">
                  Abrir LinkedIn <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              </Button>
            )}
          </Section>

          <Section title="Enrichment (Apollo)" icon={Sparkles}>
            {detail?.enrichment ? (
              <div className="rounded-lg border bg-background p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{detail.enrichment.provider}</div>
                  <div className="text-xs text-muted-foreground">
                    confiança {Math.round((detail.enrichment.confidence ?? 0) * 100)}%
                  </div>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {new Date(detail.enrichment.fetched_at).toLocaleString("pt-BR")}
                </div>
              </div>
            ) : (
              <Empty>Nenhum enrichment salvo.</Empty>
            )}
          </Section>

          <Section title="IDs externos">
            <KV k="Apollo ID" v={lead.apollo_person_id} />
            <KV k="Pipedrive ID" v={lead.pipedrive_person_id} />
            <KV k="Lead ID" v={lead.id} />
            <KV k="Criado em" v={new Date(lead.created_at).toLocaleString("pt-BR")} />
          </Section>
        </div>
      </form>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon?: any; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-surface p-4">
      <div className="mb-3 inline-flex items-center gap-2 text-sm font-semibold">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />} {title}
      </div>
      {children}
    </section>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

function FieldRow({
  label, value, editing, icon: Icon, children,
}: {
  label: string;
  value?: any;
  editing: boolean;
  icon?: any;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      {editing ? (
        <div>{children}</div>
      ) : (
        <div className="flex items-center gap-1.5 text-sm">
          {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
          <span className={cn("truncate", !value && "text-muted-foreground italic")}>
            {value || value === 0 ? String(value) : "—"}
          </span>
        </div>
      )}
    </div>
  );
}

function ValueText({ children }: { children: React.ReactNode }) {
  return <div className="text-sm">{children}</div>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed bg-background px-3 py-3 text-xs text-muted-foreground">{children}</div>;
}
function KV({ k, v }: { k: string; v: any }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b py-1.5 text-xs last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-mono truncate max-w-[60%] text-right">{v ?? "—"}</span>
    </div>
  );
}
