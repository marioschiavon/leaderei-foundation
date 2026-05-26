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
  type LucideIcon,
} from "lucide-react";
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
};

function CampaignsPage() {
  const fetchFn = useServerFn(listCampaigns);
  const { data, isLoading, error } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => fetchFn(),
  });
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);

  const filtered = useMemo(() => {
    return ((data ?? []) as Campaign[]).filter(
      (c) => !query || c.name.toLowerCase().includes(query.toLowerCase()),
    );
  }, [data, query]);

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

      <div className="flex items-center gap-3 rounded-xl border bg-surface p-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar campanha…"
            className="h-9 pl-9"
          />
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
          icon={Megaphone}
          title={query ? "Nenhuma campanha encontrada" : "Nenhuma campanha ainda"}
          description={query ? "Ajuste a busca." : "Crie a primeira sequência multicanal."}
          action={
            !query && (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" /> Criar campanha
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <CampaignCard key={c.id} campaign={c} onEdit={() => setEditing(c)} />
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
  onEdit,
}: {
  campaign: Campaign;
  onEdit: () => void;
}) {
  const queryClient = useQueryClient();
  const changeStatusFn = useServerFn(changeCampaignStatus);
  const duplicateFn = useServerFn(duplicateCampaign);
  const archiveFn = useServerFn(archiveCampaign);

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

  const canStart = c.status === "draft" || c.status === "paused";
  const canPause = c.status === "running";

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
      </div>
      <div className="grid grid-cols-3 divide-x border-b">
        <Stat label="Inscritos" value={c.total_enrolled} />
        <Stat label="Enviadas" value={c.total_sent} />
        <Stat label="Resposta" value={`${replyRate}%`} accent />
      </div>
      <div className="flex items-center justify-between gap-2 p-3 text-xs text-muted-foreground">
        <EditFlowButton campaignId={c.id} status={c.status} />
        <div className="flex items-center gap-1">
          {canStart && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => statusMutation.mutate("running")}
              disabled={statusMutation.isPending}
            >
              <Play className="h-3.5 w-3.5" /> Iniciar
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
        </div>
      </div>
    </div>
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
