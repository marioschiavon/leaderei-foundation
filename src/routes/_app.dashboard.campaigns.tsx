import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getBuilderDocumentByCampaign } from "@/lib/builder.functions";
import { Workflow } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Megaphone,
  Mail,
  Linkedin,
  MessageCircle,
  MoreVertical,
  Play,
  Pause,
  Copy,
  Archive,
  Pencil,
  Loader2,
  Activity,
  PlayCircle,
  PauseCircle,
  RefreshCw,
  Users,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Trash2,
  ArchiveRestore,
  UserMinus,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  listCampaignEnrollments,
  pauseEnrollment,
  resumeEnrollment,
  resetEnrollment,
  resetEnrollmentsBulk,
  activateCampaign,
  getCampaignExecutorStats,
  listEligibleLeadsForCampaign,
  listEligibleLeadsPage,

  forceFlowTick,
  getEnrollmentRuns,
  cancelEnrollment,
} from "@/lib/campaigns.functions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { stepLabel, stepLabelShort } from "@/lib/flow-step-label";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  listCampaigns,
  createCampaign,
  updateCampaign,
  changeCampaignStatus,
  duplicateCampaign,
  archiveCampaign,
  restoreCampaign,
  deleteCampaign,
} from "@/lib/tenant.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/dashboard/campaigns")({
  component: CampaignsPage,
});

const STATUS_META: Record<string, { label: string; chip: string; dot: string }> = {
  draft: { label: "Rascunho", chip: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/60" },
  scheduled: { label: "Agendada", chip: "bg-sky-500/10 text-sky-700 dark:text-sky-300", dot: "bg-sky-500" },
  running: { label: "Em execução", chip: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  paused: { label: "Pausada", chip: "bg-amber-500/10 text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  completed: { label: "Concluída", chip: "bg-foreground/5 text-foreground/70", dot: "bg-foreground/60" },
  archived: { label: "Arquivada", chip: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/60" },
};

const CHANNEL_ICON: Record<string, LucideIcon> = {
  email: Mail,
  linkedin: Linkedin,
  whatsapp: MessageCircle,
  sms: MessageCircle,
  multi: Megaphone,
};

const CHANNELS = ["email", "whatsapp", "linkedin", "sms", "multi"] as const;
const CHANNEL_LABEL: Record<(typeof CHANNELS)[number], string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  linkedin: "LinkedIn",
  sms: "SMS",
  multi: "Multicanal",
};

type CurrentNode = {
  step_id: string;
  type: string;
  config: any;
  count: number;
};

type Campaign = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  channel: string;
  total_enrolled: number;
  total_sent: number;
  total_replied: number;
  created_at: string;
  scheduled_at: string | null;
  flow_step_count: number | null;
  flow_status: string | null;
  current_nodes: CurrentNode[];
};

type ListCampaignsResponse = {
  items: Campaign[];
  archived_count: number;
};

function CampaignsPage() {
  const fetchFn = useServerFn(listCampaigns);
  const [scope, setScope] = useState<"active" | "archived">("active");
  const { data, isLoading, error } = useQuery({
    queryKey: ["campaigns", scope],
    queryFn: () => fetchFn({ data: { scope } }) as Promise<ListCampaignsResponse>,
  });
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);

  const items = data?.items ?? [];
  const archivedCount = data?.archived_count ?? 0;

  const filtered = useMemo(() => {
    return items.filter(
      (c) => !query || c.name.toLowerCase().includes(query.toLowerCase()),
    );
  }, [items, query]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campanhas"
        description="Sequências multicanal automatizadas."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Nova campanha
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-surface p-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar campanha…"
            className="h-9 pl-9"
          />
        </div>
        <div className="inline-flex rounded-md border bg-surface p-0.5 text-xs font-medium">
          <button
            type="button"
            onClick={() => setScope("active")}
            className={cn(
              "rounded px-3 py-1 transition-colors",
              scope === "active"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Ativas
          </button>
          <button
            type="button"
            onClick={() => setScope("archived")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded px-3 py-1 transition-colors",
              scope === "archived"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Archive className="h-3.5 w-3.5" />
            Arquivadas
            {archivedCount > 0 && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-2xs font-semibold",
                  scope === "archived"
                    ? "bg-background/20 text-background"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {archivedCount}
              </span>
            )}
          </button>
        </div>
        <div className="ml-auto text-xs text-muted-foreground">
          {isLoading
            ? "Carregando…"
            : `${filtered.length} campanha${filtered.length !== 1 ? "s" : ""}`}
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl bg-surface-muted/40" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={scope === "archived" ? Archive : Megaphone}
          title={
            query
              ? "Nenhuma campanha encontrada"
              : scope === "archived"
                ? "Nenhuma campanha arquivada"
                : "Nenhuma campanha ainda"
          }
          description={
            query
              ? "Ajuste a busca."
              : scope === "archived"
                ? "Campanhas arquivadas aparecerão aqui."
                : "Crie a primeira sequência multicanal."
          }
          action={
            !query && scope === "active" && (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" /> Criar campanha
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              scope={scope}
              onEdit={() => setEditing(c)}
            />
          ))}
        </div>
      )}


      <CampaignFormSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        campaign={null}
      />
      <CampaignFormSheet
        open={editing !== null}
        onOpenChange={(v) => !v && setEditing(null)}
        campaign={editing}
      />
    </div>
  );
}

function EditFlowButton({ campaignId, status }: { campaignId: string; status: string }) {
  const navigate = useNavigate();
  const openFn = useServerFn(getBuilderDocumentByCampaign);
  const [loading, setLoading] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={loading}
      title={
        status === "running" || status === "paused"
          ? "Edições só se aplicam a novos leads enrolados"
          : undefined
      }
      onClick={async () => {
        try {
          setLoading(true);
          const res: any = await openFn({ data: { campaign_id: campaignId } });
          navigate({
            to: "/dashboard/builder/$documentId",
            params: { documentId: res.document.id },
          });
        } catch (e) {
          toast.error((e as Error).message);
        } finally {
          setLoading(false);
        }
      }}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Workflow className="h-3.5 w-3.5" />}
      Editar fluxo
    </Button>
  );
}

function CampaignCard({
  campaign: c,
  scope,
  onEdit,
}: {
  campaign: Campaign;
  scope: "active" | "archived";
  onEdit: () => void;
}) {
  const queryClient = useQueryClient();
  const changeStatusFn = useServerFn(changeCampaignStatus);
  const duplicateFn = useServerFn(duplicateCampaign);
  const archiveFn = useServerFn(archiveCampaign);
  const restoreFn = useServerFn(restoreCampaign);
  const deleteFn = useServerFn(deleteCampaign);

  const meta = STATUS_META[c.status] ?? STATUS_META.draft;
  const Icon = CHANNEL_ICON[c.channel] ?? Megaphone;
  const replyRate = c.total_sent
    ? Math.round((c.total_replied / c.total_sent) * 1000) / 10
    : 0;

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["campaigns"] });

  const statusMutation = useMutation({
    mutationFn: (status: string) =>
      changeStatusFn({ data: { id: c.id, status: status as never } }),
    onSuccess: () => {
      toast.success("Status atualizado.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicateMutation = useMutation({
    mutationFn: () => duplicateFn({ data: { id: c.id } }),
    onSuccess: () => {
      toast.success("Campanha duplicada.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const archiveMutation = useMutation({
    mutationFn: () => archiveFn({ data: { id: c.id } }),
    onSuccess: () => {
      toast.success("Campanha arquivada.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const restoreMutation = useMutation({
    mutationFn: () => restoreFn({ data: { id: c.id } }),
    onSuccess: () => {
      toast.success("Campanha restaurada como rascunho.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteFn({ data: { id: c.id } }),
    onSuccess: () => {
      toast.success("Campanha excluída definitivamente.");
      invalidate();
      setDeleteOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [execOpen, setExecOpen] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);
  const [leadsOpen, setLeadsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isArchived = scope === "archived";
  const canStart = !isArchived && (c.status === "draft" || c.status === "paused");
  const canPause = !isArchived && c.status === "running";
  const isLive = c.status === "running" || c.status === "paused";

  return (
    <div className="flex flex-col rounded-xl border bg-surface">
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
              meta.chip,
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
            {meta.label}
          </span>
          <span className="grid h-7 w-7 place-items-center rounded-md border bg-surface-muted/40 text-muted-foreground">
            <Icon className="h-3.5 w-3.5" />
          </span>
        </div>
        <h3 className="mt-2 truncate font-display text-base font-semibold">
          {c.name}
        </h3>
        {c.description && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {c.description}
          </p>
        )}
        <div className="mt-2 text-xs text-muted-foreground">
          {c.flow_step_count === null || c.flow_step_count === 0 ? (
            <span className="inline-flex items-center gap-1">
              <Workflow className="h-3 w-3" />
              {c.flow_step_count === null ? "Sem fluxo" : "0 passos"}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <Workflow className="h-3 w-3" />
              <span className="font-medium text-foreground">
                {c.flow_step_count} {c.flow_step_count === 1 ? "passo" : "passos"}
              </span>
              <span>·</span>
              <span
                className={
                  c.flow_status === "published"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : ""
                }
              >
                {c.flow_status === "published" ? "Publicado" : "Rascunho"}
              </span>
            </span>
          )}
        </div>
        {isLive && (
          <CurrentNodesStrip nodes={c.current_nodes} />
        )}
      </div>
      <div className="grid grid-cols-3 divide-x border-b">
        <Stat label="Inscritos" value={c.total_enrolled} />
        <Stat label="Enviadas" value={c.total_sent} />
        <Stat label="Resposta" value={`${replyRate}%`} accent />
      </div>
      <div className="flex items-center justify-between gap-2 p-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <EditFlowButton campaignId={c.id} status={c.status} />
          {!isArchived && (
            <>
              <Button size="sm" variant="ghost" onClick={() => setExecOpen(true)}>
                <Activity className="h-3.5 w-3.5" /> Execuções
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setLeadsOpen(true)}>
                <Users className="h-3.5 w-3.5" /> Leads
              </Button>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isArchived ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => restoreMutation.mutate()}
                disabled={restoreMutation.isPending}
              >
                {restoreMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ArchiveRestore className="h-3.5 w-3.5" />
                )}
                Restaurar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir
              </Button>
            </>
          ) : (
            <>
              {canStart && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    c.status === "draft"
                      ? setActivateOpen(true)
                      : statusMutation.mutate("running")
                  }
                  disabled={statusMutation.isPending}
                >
                  <Play className="h-3.5 w-3.5" />
                  {c.status === "draft" ? "Ativar" : "Retomar"}
                </Button>
              )}
              {canPause && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => statusMutation.mutate("paused")}
                  disabled={statusMutation.isPending}
                >
                  <Pause className="h-3.5 w-3.5" /> Pausar
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onEdit}>
                    <Pencil className="h-4 w-4" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => duplicateMutation.mutate()}>
                    <Copy className="h-4 w-4" /> Duplicar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => archiveMutation.mutate()}
                    disabled={c.status === "archived"}
                    className="text-destructive focus:text-destructive"
                  >
                    <Archive className="h-4 w-4" /> Arquivar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>
      <ExecutionsDialog
        campaignId={c.id}
        campaignName={c.name}
        open={execOpen}
        onOpenChange={setExecOpen}
      />
      <ActivateCampaignDialog
        campaignId={c.id}
        campaignName={c.name}
        channel={c.channel}
        open={activateOpen}
        onOpenChange={setActivateOpen}
        onSuccess={invalidate}
      />
      <ManageLeadsDialog
        campaignId={c.id}
        campaignName={c.name}
        channel={c.channel}
        open={leadsOpen}
        onOpenChange={setLeadsOpen}
      />
      <DeleteCampaignDialog
        campaignName={c.name}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => deleteMutation.mutate()}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}

function CurrentNodesStrip({ nodes }: { nodes: CurrentNode[] }) {
  if (!nodes || nodes.length === 0) {
    return (
      <div className="mt-2 text-2xs text-muted-foreground">
        Nó atual:{" "}
        <span className="rounded bg-surface-muted px-1.5 py-0.5">
          Sem leads em execução
        </span>
      </div>
    );
  }
  const visible = nodes.slice(0, 3);
  const rest = nodes.length - visible.length;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1 text-2xs">
      <span className="text-muted-foreground">Nó atual:</span>
      {visible.map((n) => (
        <span
          key={n.step_id}
          className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 font-medium text-emerald-700 dark:text-emerald-300"
          title={stepLabel({ type: n.type, config: n.config })}
        >
          {stepLabelShort({ type: n.type, config: n.config })}
          <span className="rounded bg-emerald-500/20 px-1 text-emerald-800 dark:text-emerald-200">
            {n.count}
          </span>
        </span>
      ))}
      {rest > 0 && (
        <span className="rounded bg-surface-muted px-1.5 py-0.5 text-muted-foreground">
          +{rest}
        </span>
      )}
    </div>
  );
}

function DeleteCampaignDialog({
  campaignName,
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: {
  campaignName: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  const [typed, setTyped] = useState("");
  useEffect(() => {
    if (!open) setTyped("");
  }, [open]);
  const matches = typed.trim() === campaignName.trim();
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir campanha definitivamente?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação <strong>não pode ser desfeita</strong>. A campanha
            <strong> {campaignName}</strong>, todos os enrollments e histórico
            de execução serão removidos. O fluxo do builder será arquivado.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="confirm-name" className="text-xs">
            Digite o nome da campanha para confirmar:
          </Label>
          <Input
            id="confirm-name"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={campaignName}
            autoFocus
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              if (matches) onConfirm();
            }}
            disabled={!matches || isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Excluir definitivamente
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ManageLeadsDialog({
  campaignId,
  campaignName,
  channel,
  open,
  onOpenChange,
}: {
  campaignId: string;
  campaignName: string;
  channel: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const enrollmentsFn = useServerFn(listCampaignEnrollments);
  const eligiblePageFn = useServerFn(listEligibleLeadsPage);
  const cancelFn = useServerFn(cancelEnrollment);
  const activateFn = useServerFn(activateCampaign);

  const enrollmentsQ = useQuery({
    enabled: open,
    queryKey: ["campaign-enrollments", campaignId, "all"],
    queryFn: () =>
      enrollmentsFn({ data: { campaign_id: campaignId, status: "all", limit: 500 } }),
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    if (!open) {
      setSelected(new Set());
      setSearch("");
      setDebouncedSearch("");
      setPage(1);
    }
  }, [open]);

  const eligibleQ = useQuery({
    enabled: open,
    queryKey: ["eligible-leads-page", campaignId, debouncedSearch, page, pageSize],
    queryFn: () =>
      eligiblePageFn({
        data: {
          campaign_id: campaignId,
          page,
          page_size: pageSize,
          search: debouncedSearch,
          only_new: true,
        },
      }),
    placeholderData: (prev) => prev,
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => cancelFn({ data: { enrollment_id: id } }),
    onSuccess: () => {
      toast.success("Lead removido da campanha.");
      enrollmentsQ.refetch();
      eligibleQ.refetch();
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pageRows = (eligibleQ.data?.rows ?? []) as Array<{
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    company_name: string | null;
  }>;
  const counts = eligibleQ.data?.counts;
  const total = eligibleQ.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const channelLabel =
    channel === "whatsapp" || channel === "sms"
      ? "WhatsApp"
      : channel === "email"
        ? "email"
        : channel === "linkedin"
          ? "LinkedIn"
          : channel;
  const missingChannelHref =
    channel === "email"
      ? "/dashboard/leads?channel=email"
      : channel === "whatsapp" || channel === "sms"
        ? "/dashboard/leads?channel=whatsapp"
        : "/dashboard/leads";

  const addMut = useMutation({
    mutationFn: (ids: string[]) =>
      activateFn({ data: { campaign_id: campaignId, lead_ids: ids } }),
    onSuccess: (res: any) => {
      toast.success(`${res?.enrolled ?? 0} lead(s) adicionado(s).`);
      setSelected(new Set());
      enrollmentsQ.refetch();
      eligibleQ.refetch();
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const enrollments = (enrollmentsQ.data ?? []) as Array<any>;
  const liveEnrollments = enrollments.filter((r) => r.status !== "cancelled");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Leads — {campaignName}</DialogTitle>
          <DialogDescription>
            Gerencie quem está inscrito e adicione novos leads sem reiniciar
            os já em execução.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="enrolled">
          <TabsList>
            <TabsTrigger value="enrolled">
              Inscritos · {liveEnrollments.length}
            </TabsTrigger>
            <TabsTrigger value="add">
              Adicionar · {availableLeads.length}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="enrolled" className="mt-3">
            {enrollmentsQ.isLoading ? (
              <div className="grid place-items-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : liveEnrollments.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Nenhum lead inscrito ainda.
              </div>
            ) : (
              <ul className="max-h-[55vh] divide-y overflow-y-auto rounded-md border">
                {liveEnrollments.map((r) => (
                  <li key={r.id} className="flex items-start gap-3 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 truncate text-sm font-medium">
                        <span className="truncate">
                          {r.leads?.full_name ?? "Lead sem nome"}
                        </span>
                        <span className="rounded bg-surface-muted px-1.5 py-0.5 text-2xs font-medium text-muted-foreground">
                          {r.status}
                        </span>
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {r.leads?.email ?? r.leads?.phone ?? "—"}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        Nó atual:{" "}
                        <span className="text-foreground">
                          {r.current_step ? stepLabel(r.current_step) : "—"}
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        if (
                          confirm(
                            `Remover ${r.leads?.full_name ?? "este lead"} da campanha? O histórico de execução será mantido.`,
                          )
                        ) {
                          cancelMut.mutate(r.id);
                        }
                      }}
                      disabled={cancelMut.isPending}
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                      Remover
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="add" className="mt-3 space-y-3">
            {eligibleQ.isLoading ? (
              <div className="grid place-items-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar lead…"
                      className="h-9 pl-9"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setSelected(
                        selected.size === filteredAvailable.length
                          ? new Set()
                          : new Set(filteredAvailable.map((l) => l.id)),
                      )
                    }
                    disabled={filteredAvailable.length === 0}
                  >
                    {selected.size === filteredAvailable.length && filteredAvailable.length > 0
                      ? "Limpar"
                      : "Selecionar todos"}
                  </Button>
                </div>

                <div className="max-h-[45vh] overflow-y-auto rounded-md border">
                  {filteredAvailable.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      {availableLeads.length === 0
                        ? "Todos os leads elegíveis já estão inscritos."
                        : "Nenhum lead corresponde à busca."}
                    </div>
                  ) : (
                    <ul className="divide-y">
                      {filteredAvailable.map((l) => {
                        const checked = selected.has(l.id);
                        return (
                          <li
                            key={l.id}
                            className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-surface-muted/40"
                            onClick={() => {
                              const next = new Set(selected);
                              if (checked) next.delete(l.id);
                              else next.add(l.id);
                              setSelected(next);
                            }}
                          >
                            <Checkbox checked={checked} />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium">
                                {l.full_name ?? "Sem nome"}
                              </div>
                              <div className="truncate text-xs text-muted-foreground">
                                {channel === "email"
                                  ? l.email
                                  : channel === "whatsapp" || channel === "sms"
                                    ? l.phone
                                    : (l.email ?? l.phone ?? "—")}
                                {l.company_name && ` · ${l.company_name}`}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    {selected.size} de {filteredAvailable.length} selecionado
                    {selected.size !== 1 ? "s" : ""}.
                  </div>
                  <Button
                    onClick={() => addMut.mutate(Array.from(selected))}
                    disabled={addMut.isPending || selected.size === 0}
                  >
                    {addMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    <UserPlus className="h-4 w-4" />
                    Adicionar {selected.size > 0 ? `${selected.size} ` : ""}lead
                    {selected.size !== 1 ? "s" : ""}
                  </Button>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function ActivateCampaignDialog({
  campaignId,
  campaignName,
  channel,
  open,
  onOpenChange,
  onSuccess,
}: {
  campaignId: string;
  campaignName: string;
  channel: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const listFn = useServerFn(listEligibleLeadsForCampaign);
  const activateFn = useServerFn(activateCampaign);
  const [mode, setMode] = useState<"all" | "manual">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    enabled: open,
    queryKey: ["eligible-leads", campaignId],
    queryFn: () => listFn({ data: { campaign_id: campaignId } }),
  });

  useEffect(() => {
    if (!open) {
      setSelected(new Set());
      setSearch("");
      setMode("all");
    }
  }, [open]);

  const channelLabel = CHANNEL_LABEL[channel as (typeof CHANNELS)[number]] ?? channel;
  const eligible = (data?.eligible ?? []) as Array<{ id: string; full_name: string | null; email: string | null; phone: string | null; company_name: string | null }>;
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return eligible;
    return eligible.filter(
      (l) =>
        (l.full_name ?? "").toLowerCase().includes(q) ||
        (l.email ?? "").toLowerCase().includes(q) ||
        (l.phone ?? "").toLowerCase().includes(q) ||
        (l.company_name ?? "").toLowerCase().includes(q),
    );
  }, [eligible, search]);

  const activateMut = useMutation({
    mutationFn: (ids: string[] | undefined) =>
      activateFn({ data: { campaign_id: campaignId, lead_ids: ids } }),
    onSuccess: (res: any) => {
      toast.success(`Campanha ativada — ${res?.enrolled ?? 0} leads enrolados.`);
      onSuccess();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleActivate = () => {
    if (mode === "all") {
      activateMut.mutate(undefined);
    } else {
      const ids = Array.from(selected);
      if (ids.length === 0) {
        toast.error("Selecione ao menos um lead.");
        return;
      }
      activateMut.mutate(ids);
    }
  };

  const willEnroll = mode === "all" ? (data?.eligible_count ?? 0) : selected.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ativar campanha — {campaignName}</DialogTitle>
          <DialogDescription>
            Canal: <strong>{channelLabel}</strong>. Apenas leads com{" "}
            {channel === "email"
              ? "e-mail válido"
              : channel === "whatsapp" || channel === "sms"
                ? "telefone válido (10-15 dígitos com DDI/DDD)"
                : channel === "multi"
                  ? "e-mail OU telefone válido"
                  : "dados de contato"}{" "}
            entram no fluxo.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="grid place-items-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              <Stat label="Total na org" value={data?.total ?? 0} />
              <Stat label="Elegíveis" value={data?.eligible_count ?? 0} accent />
              <Stat label="Já em execução" value={data?.active_enrollment_count ?? 0} />
              <Stat label="Sem dado válido" value={data?.ineligible_count ?? 0} />
            </div>

            {(data?.active_enrollment_count ?? 0) > 0 && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-300">
                {data?.active_enrollment_count} lead(s) já têm enrollment ativo/pausado nesta campanha — ativar novamente apenas reinicia esses fluxos do passo inicial.
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("all")}
                className={cn(
                  "flex-1 rounded-md border p-3 text-left text-sm transition-colors",
                  mode === "all" ? "border-foreground bg-surface-muted/40" : "hover:bg-surface-muted/30",
                )}
              >
                <div className="flex items-center gap-2 font-medium">
                  <Users className="h-4 w-4" /> Todos os elegíveis
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Enrolla os {data?.eligible_count ?? 0} leads ({data?.new_eligible_count ?? 0} novos).
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMode("manual")}
                className={cn(
                  "flex-1 rounded-md border p-3 text-left text-sm transition-colors",
                  mode === "manual" ? "border-foreground bg-surface-muted/40" : "hover:bg-surface-muted/30",
                )}
              >
                <div className="flex items-center gap-2 font-medium">
                  <Pencil className="h-4 w-4" /> Selecionar manualmente
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Escolhe um a um na lista.
                </div>
              </button>
            </div>

            {mode === "manual" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar por nome, e-mail, telefone…"
                      className="h-9 pl-9"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setSelected(
                        selected.size === filtered.length
                          ? new Set()
                          : new Set(filtered.map((l) => l.id)),
                      )
                    }
                  >
                    {selected.size === filtered.length && filtered.length > 0
                      ? "Limpar"
                      : "Selecionar todos"}
                  </Button>
                </div>
                <div className="max-h-64 overflow-y-auto rounded-md border">
                  {filtered.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      Nenhum lead elegível.
                    </div>
                  ) : (
                    <ul className="divide-y">
                      {filtered.map((l) => {
                        const checked = selected.has(l.id);
                        return (
                          <li
                            key={l.id}
                            className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-surface-muted/40"
                            onClick={() => {
                              const next = new Set(selected);
                              if (checked) next.delete(l.id);
                              else next.add(l.id);
                              setSelected(next);
                            }}
                          >
                            <Checkbox checked={checked} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 truncate text-sm font-medium">
                                <span className="truncate">{l.full_name ?? "Sem nome"}</span>
                                {data?.active_lead_ids?.includes(l.id) && (
                                  <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-normal text-amber-700 dark:text-amber-300">
                                    já em execução
                                  </span>
                                )}
                              </div>
                              <div className="truncate text-xs text-muted-foreground">
                                {channel === "email"
                                  ? l.email
                                  : channel === "whatsapp" || channel === "sms"
                                    ? l.phone
                                    : (l.email ?? l.phone ?? "—")}
                                {l.company_name && ` · ${l.company_name}`}
                              </div>
                            </div>
                          </li>
                        );
                      })}

                    </ul>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {selected.size} de {filtered.length} selecionado
                  {selected.size !== 1 ? "s" : ""}.
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleActivate}
            disabled={activateMut.isPending || isLoading || willEnroll === 0}
          >
            {activateMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Ativar para {willEnroll} lead{willEnroll !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExecutionsDialog({
  campaignId,
  campaignName,
  open,
  onOpenChange,
}: {
  campaignId: string;
  campaignName: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listCampaignEnrollments);
  const statsFn = useServerFn(getCampaignExecutorStats);
  const pauseFn = useServerFn(pauseEnrollment);
  const resumeFn = useServerFn(resumeEnrollment);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "paused" | "completed" | "failed" | "pending"
  >("all");

  const { data: rows, isLoading, refetch } = useQuery({
    enabled: open,
    queryKey: ["campaign-enrollments", campaignId, statusFilter],
    queryFn: () =>
      listFn({ data: { campaign_id: campaignId, status: statusFilter, limit: 200 } }),
    refetchInterval: open ? 5_000 : false,
  });
  const { data: stats } = useQuery({
    enabled: open,
    queryKey: ["campaign-exec-stats", campaignId],
    queryFn: () => statsFn({ data: { campaign_id: campaignId } }),
    refetchInterval: open ? 5_000 : false,
  });

  const pauseMut = useMutation({
    mutationFn: (id: string) => pauseFn({ data: { enrollment_id: id } }),
    onSuccess: () => {
      toast.success("Pausado.");
      refetch();
      queryClient.invalidateQueries({ queryKey: ["campaign-exec-stats", campaignId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const resumeMut = useMutation({
    mutationFn: (id: string) => resumeFn({ data: { enrollment_id: id } }),
    onSuccess: () => {
      toast.success("Retomado.");
      refetch();
      queryClient.invalidateQueries({ queryKey: ["campaign-exec-stats", campaignId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetFn = useServerFn(resetEnrollment);
  const resetBulkFn = useServerFn(resetEnrollmentsBulk);
  const resetMut = useMutation({
    mutationFn: (id: string) => resetFn({ data: { enrollment_id: id } }),
    onSuccess: () => {
      toast.success("Lead reiniciado no fluxo.");
      refetch();
      queryClient.invalidateQueries({ queryKey: ["campaign-exec-stats", campaignId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const resetBulkMut = useMutation({
    mutationFn: (scope: "completed" | "failed" | "all_finished") =>
      resetBulkFn({ data: { campaign_id: campaignId, scope } }),
    onSuccess: (res: any) => {
      toast.success(`${res?.reset ?? 0} leads reiniciados${res?.failed ? ` (${res.failed} falharam)` : ""}.`);
      refetch();
      queryClient.invalidateQueries({ queryKey: ["campaign-exec-stats", campaignId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const tickFn = useServerFn(forceFlowTick);
  const tickMut = useMutation({
    mutationFn: () => tickFn(),
    onSuccess: (res: any) => {
      toast.success(`Tick rodou — ${res?.processed ?? 0} jobs processados.`);
      refetch();
      queryClient.invalidateQueries({ queryKey: ["campaign-exec-stats", campaignId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const STATUS_LABEL: Record<string, string> = {
    pending: "Pendente",
    active: "Ativo",
    paused: "Pausado",
    completed: "Concluído",
    failed: "Falhou",
    cancelled: "Cancelado",
  };

  const [expanded, setExpanded] = useState<string | null>(null);


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle>Execuções — {campaignName}</DialogTitle>
              <DialogDescription>
                Lista de leads enrolados no fluxo. Atualiza a cada 5s.
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              {((stats as any)?.completed ?? 0) > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (confirm(`Reiniciar todos os ${(stats as any).completed} leads concluídos a partir do passo inicial?`)) {
                      resetBulkMut.mutate("completed");
                    }
                  }}
                  disabled={resetBulkMut.isPending}
                  title="Reinicia todos os leads concluídos a partir do nó inicial do fluxo."
                >
                  {resetBulkMut.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3.5 w-3.5" />
                  )}
                  Reiniciar concluídos
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => tickMut.mutate()}
                disabled={tickMut.isPending}
                title="Roda o worker manualmente — útil para testar sem esperar o cron."
              >
                {tickMut.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Forçar tick
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 border-b pb-3">
          {(["all", "active", "paused", "completed", "failed", "pending"] as const).map((s) => {
            const count =
              s === "all"
                ? Object.values(stats ?? {}).reduce((a: number, b: any) => a + (b ?? 0), 0)
                : (stats as any)?.[s] ?? 0;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                  statusFilter === s
                    ? "bg-foreground text-background border-foreground"
                    : "bg-surface hover:bg-surface-muted",
                )}
              >
                {s === "all" ? "Todos" : STATUS_LABEL[s]} · {count}
              </button>
            );
          })}
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="grid place-items-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : !rows || rows.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma execução {statusFilter !== "all" && `com status "${STATUS_LABEL[statusFilter]}"`}.
            </div>
          ) : (
            <ul className="divide-y">
              {rows.map((r: any) => {
                const isOpen = expanded === r.id;
                const blockerLabel = computeBlocker(r);
                return (
                  <li key={r.id} className="py-2">
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        className="mt-0.5 rounded p-0.5 hover:bg-surface-muted"
                        onClick={() => setExpanded(isOpen ? null : r.id)}
                        title={isOpen ? "Recolher" : "Ver histórico"}
                      >
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="truncate text-sm font-medium">
                            {r.leads?.full_name ?? "Lead sem nome"}
                          </div>
                          <span className="rounded bg-surface-muted px-1.5 py-0.5 text-2xs font-medium text-muted-foreground">
                            {STATUS_LABEL[r.status] ?? r.status}
                          </span>
                          {blockerLabel && (
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.5 text-2xs font-medium",
                                blockerLabel.tone === "warn" &&
                                  "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
                                blockerLabel.tone === "danger" &&
                                  "bg-destructive/10 text-destructive",
                                blockerLabel.tone === "muted" &&
                                  "bg-surface-muted text-muted-foreground",
                                blockerLabel.tone === "success" &&
                                  "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
                              )}
                              title={blockerLabel.title}
                            >
                              {blockerLabel.text}
                            </span>
                          )}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {r.leads?.email ?? r.leads?.phone ?? "—"}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                          <span className="text-muted-foreground">
                            Nó atual:{" "}
                            <span className="text-foreground">
                              {r.current_step ? stepLabel(r.current_step) : "—"}
                            </span>
                          </span>
                          {r.next_steps && r.next_steps.length > 0 && (
                            <span className="text-muted-foreground">
                              → Próximo:{" "}
                              <span className="text-foreground">
                                {r.next_steps
                                  .map((n: any) =>
                                    n.branch && n.branch !== "next"
                                      ? `[${n.branch}] ${stepLabel(n)}`
                                      : stepLabel(n),
                                  )
                                  .join(" | ")}
                              </span>
                            </span>
                          )}
                          <span className="text-muted-foreground">
                            next_run: <span className="text-foreground">{formatNextRun(r.next_run_at)}</span>
                          </span>
                        </div>
                        {r.last_error && (
                          <div className="mt-1 break-words text-xs text-destructive" title={r.last_error}>
                            ⚠ {r.last_error}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {r.status === "active" && (
                          <Button
                            size="icon" variant="ghost" className="h-7 w-7" title="Pausar"
                            onClick={() => pauseMut.mutate(r.id)} disabled={pauseMut.isPending}
                          >
                            <PauseCircle className="h-4 w-4" />
                          </Button>
                        )}
                        {(r.status === "paused" || r.status === "failed") && (
                          <Button
                            size="icon" variant="ghost" className="h-7 w-7" title="Retomar do passo atual"
                            onClick={() => resumeMut.mutate(r.id)} disabled={resumeMut.isPending}
                          >
                            <PlayCircle className="h-4 w-4" />
                          </Button>
                        )}
                        {(r.status === "completed" || r.status === "failed" || r.status === "paused") && (
                          <Button
                            size="icon" variant="ghost" className="h-7 w-7" title="Reiniciar fluxo do começo"
                            onClick={() => {
                              if (confirm("Reiniciar este lead a partir do passo inicial do fluxo? O histórico será mantido.")) {
                                resetMut.mutate(r.id);
                              }
                            }}
                            disabled={resetMut.isPending}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {isOpen && <EnrollmentTimeline enrollmentId={r.id} />}
                  </li>
                );
              })}
            </ul>

          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// stepLabel was extracted to src/lib/flow-step-label.ts

function formatNextRun(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = d.getTime() - Date.now();
  if (Math.abs(diff) < 60_000) return "agora";
  return formatDistanceToNow(d, { locale: ptBR, addSuffix: true });
}

function computeBlocker(r: any): { text: string; tone: "warn" | "danger" | "muted" | "success"; title?: string } | null {
  if (r.status === "failed") return { text: "Falhou", tone: "danger", title: r.last_error ?? undefined };
  if (r.status === "paused") return { text: "Pausado manualmente", tone: "muted" };
  if (r.status === "completed") {
    if (r.ended_on_end_node) {
      return { text: r.end_reason ? `Concluído · ${r.end_reason}` : "Concluído", tone: "success" };
    }
    if (r.last_error && /sem nó Fim/i.test(r.last_error)) {
      return { text: "Encerrado sem nó Fim", tone: "warn", title: "O fluxo terminou porque o passo atual não tem próximo nó. Adicione um nó Fim no Builder." };
    }
    return { text: "Concluído", tone: "success" };
  }
  if (r.status === "active") {
    if (!r.current_step_id) return { text: "Sem passo atual", tone: "danger" };
    if (r.is_overdue) return { text: "Aguardando worker", tone: "warn", title: "next_run_at vencido — cron não processou ainda" };
  }
  return null;
}

function EnrollmentTimeline({ enrollmentId }: { enrollmentId: string }) {
  const runsFn = useServerFn(getEnrollmentRuns);
  const { data, isLoading } = useQuery({
    queryKey: ["enrollment-runs", enrollmentId],
    queryFn: () => runsFn({ data: { enrollment_id: enrollmentId } }),
  });
  if (isLoading) {
    return (
      <div className="ml-6 mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> carregando histórico…
      </div>
    );
  }
  if (!data || data.length === 0) {
    return <div className="ml-6 mt-2 text-xs text-muted-foreground">Sem execuções registradas ainda.</div>;
  }
  return (
    <ol className="ml-6 mt-2 space-y-1 border-l pl-3 text-xs">
      {(data as any[]).map((run) => (
        <li key={run.id} className="relative">
          <span className="text-muted-foreground">
            {new Date(run.started_at).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
          </span>{" "}
          <span className="font-medium">{stepLabel(run.step)}</span>{" "}
          <span
            className={cn(
              "rounded px-1 py-0.5 text-2xs",
              run.status === "completed" && "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
              run.status === "failed" && "bg-destructive/10 text-destructive",
              run.status === "running" && "bg-amber-100 text-amber-800",
              run.status === "pending" && "bg-surface-muted text-muted-foreground",
            )}
          >
            {run.status}
          </span>
          {run.branch_taken && <span className="ml-1 text-muted-foreground">→ {run.branch_taken}</span>}
          {run.error && <div className="mt-0.5 text-destructive">⚠ {run.error}</div>}
        </li>
      ))}
    </ol>
  );
}


function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <div className="p-3 text-center">
      <div className={cn("font-display text-base font-bold", accent && "text-brand")}>
        {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
      </div>
      <div className="text-2xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

const campaignSchema = z.object({
  name: z.string().trim().min(1, "Obrigatório").max(160),
  description: z.string().trim().max(1000).optional(),
  channel: z.enum(CHANNELS),
  objective: z.string().trim().max(255).optional(),
  daily_send_limit: z
    .string()
    .optional()
    .refine((v) => !v || /^\d+$/.test(v), "Apenas números"),
});
type CampaignFormValues = z.infer<typeof campaignSchema>;

function CampaignFormSheet({
  open,
  onOpenChange,
  campaign,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  campaign: Campaign | null;
}) {
  const queryClient = useQueryClient();
  const createFn = useServerFn(createCampaign);
  const updateFn = useServerFn(updateCampaign);
  const isEdit = !!campaign;

  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      name: "",
      description: "",
      channel: "email",
      objective: "",
      daily_send_limit: "",
    },
  });

  useEffect(() => {
    if (open && campaign) {
      form.reset({
        name: campaign.name,
        description: campaign.description ?? "",
        channel: (CHANNELS.includes(campaign.channel as (typeof CHANNELS)[number])
          ? campaign.channel
          : "email") as (typeof CHANNELS)[number],
        objective: "",
        daily_send_limit: "",
      });
    } else if (open && !campaign) {
      form.reset({
        name: "",
        description: "",
        channel: "email",
        objective: "",
        daily_send_limit: "",
      });
    }
  }, [open, campaign, form]);

  const mutation = useMutation({
    mutationFn: (v: CampaignFormValues) => {
      const payload = {
        name: v.name,
        description: v.description || null,
        channel: v.channel,
        objective: v.objective || null,
        daily_send_limit: v.daily_send_limit ? Number(v.daily_send_limit) : null,
      };
      return isEdit
        ? updateFn({ data: { id: campaign!.id, ...payload } })
        : createFn({ data: payload });
    },
    onSuccess: () => {
      toast.success(isEdit ? "Campanha atualizada." : "Campanha criada.");
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Editar campanha" : "Nova campanha"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Atualize os detalhes da sequência."
              : "Defina nome e canal. Você ajusta a sequência depois."}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
          className="mt-6 space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="c-name">Nome *</Label>
            <Input id="c-name" {...form.register("name")} />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="c-desc">Descrição</Label>
            <Textarea id="c-desc" rows={3} {...form.register("description")} />
          </div>

          <div className="space-y-1.5">
            <Label>Canal *</Label>
            <Select
              value={form.watch("channel")}
              onValueChange={(v) =>
                form.setValue("channel", v as (typeof CHANNELS)[number])
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHANNELS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CHANNEL_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="c-obj">Objetivo</Label>
            <Input
              id="c-obj"
              {...form.register("objective")}
              placeholder="Ex: Agendar reunião com decisores"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="c-limit">Limite diário de envio</Label>
            <Input
              id="c-limit"
              type="number"
              min={1}
              {...form.register("daily_send_limit")}
              placeholder="Opcional"
            />
            {form.formState.errors.daily_send_limit && (
              <p className="text-xs text-destructive">
                {form.formState.errors.daily_send_limit.message}
              </p>
            )}
          </div>

          <SheetFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Salvar" : "Criar"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
