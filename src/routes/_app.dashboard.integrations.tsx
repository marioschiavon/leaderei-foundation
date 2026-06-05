import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle, ArrowRight, CheckCircle2, Circle, Clock3, Mail, Plug,
  Loader2, Copy, RefreshCw, Eye, EyeOff, KeyRound, type LucideIcon,
} from "lucide-react";
import type { IconType } from "react-icons";
import {
  SiResend, SiWhatsapp, SiHubspot, SiGooglecalendar, SiCalendly,
} from "react-icons/si";
import { FaLinkedin } from "react-icons/fa";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { listIntegrations } from "@/lib/tenant.functions";
import {
  getOrgResendConnection, saveOrgResendConnection, disconnectOrgResend,
} from "@/lib/integrations.functions";
import {
  getCalcomConnection, saveCalcomConnection, disconnectCalcom, syncCalcomEventTypes,
  regenerateCalcomWebhookSecret, testCalcomWebhook,
} from "@/lib/calcom.functions";
import { listHook7Instances } from "@/lib/hook7.functions";
import { WhatsAppManagerDialog } from "@/components/app/WhatsAppManagerDialog";
import { PipedriveConnectDialog } from "@/components/app/PipedriveConnectDialog";

export const Route = createFileRoute("/_app/dashboard/integrations")({
  component: IntegrationsPage,
});



// Inline brand marks for vendors not covered by react-icons.
const PipedriveIcon: IconType = (props: any) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M14.32 0C9.92 0 7.04 2.24 7.04 5.76c0 2.4 1.6 4.16 4.32 4.16 1.12 0 2.08-.32 2.72-.8v.16c0 2.4-1.6 3.84-4.32 3.84-1.6 0-3.04-.48-4-1.12L4.8 15.84C6.08 16.96 8.32 17.76 10.88 17.76c5.12 0 8.16-2.88 8.16-7.52V6.4C19.04 2.4 17.12 0 14.32 0zm-.48 6.72c-.48.32-1.12.48-1.76.48-1.28 0-2.08-.8-2.08-1.92 0-1.28.96-2.08 2.4-2.08 1.28 0 2.08.96 2.08 2.4 0 .48-.16.8-.64 1.12zM4.96 18.24v5.28L9.6 24v-5.12c-1.6-.16-3.2-.32-4.64-.64z"/>
  </svg>
);
const ApolloIcon: IconType = (props: any) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm-1.392 4.704h2.736l5.4 14.592h-2.928l-1.128-3.216H8.928l3.072-2.376h2.832l-2.4-6.84-4.92 12.432H4.656l5.952-14.592z"/>
  </svg>
);

type Brand = { Icon: IconType; tint: string };
const SLUG_BRAND: Record<string, Brand> = {
  resend:            { Icon: SiResend,          tint: "text-foreground" },
  linkedin:          { Icon: FaLinkedin,        tint: "text-[#0A66C2]" },
  whatsapp:          { Icon: SiWhatsapp,        tint: "text-[#25D366]" },
  hubspot:           { Icon: SiHubspot,         tint: "text-[#FF7A59]" },
  pipedrive:         { Icon: PipedriveIcon,     tint: "text-[#1A1A1A] dark:text-foreground" },
  apollo:            { Icon: ApolloIcon,        tint: "text-[#1B116E]" },
  "google-calendar": { Icon: SiGooglecalendar,  tint: "text-[#4285F4]" },
  cal_com:           { Icon: SiCalendly,        tint: "text-[#292929] dark:text-foreground" },
};

const STATUS_META: Record<string, { label: string; icon: LucideIcon; className: string; helper: string }> = {
  connected:    { label: "Conectado",    icon: CheckCircle2,  className: "bg-emerald-500/10 text-emerald-700",  helper: "Integração ativa para este tenant." },
  pending:      { label: "Pendente",     icon: Clock3,        className: "bg-amber-500/10 text-amber-700",       helper: "Setup iniciado, aguardando conclusão." },
  error:        { label: "Erro",         icon: AlertTriangle, className: "bg-destructive/10 text-destructive",   helper: "Última sincronização ou autenticação falhou." },
  disconnected: { label: "Desconectado", icon: Circle,        className: "bg-muted text-muted-foreground",       helper: "Provider disponível, sem conexão ativa." },
};

function relTime(iso?: string | null): string {
  if (!iso) return "Ainda não sincronizado";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} d`;
}

function IntegrationsPage() {
  const fetchList = useServerFn(listIntegrations);
  const fetchHook7 = useServerFn(listHook7Instances);
  const { data, isLoading, error } = useQuery({
    queryKey: ["integrations"],
    queryFn: () => fetchList(),
  });
  const { data: hook7Data } = useQuery({
    queryKey: ["hook7-instances"],
    queryFn: () => fetchHook7(),
  });

  const hook7Instances = (hook7Data?.instances ?? []) as any[];
  const hook7Connected = hook7Instances.filter((i) => i.status === "connected").length;
  const hook7Total = hook7Instances.length;
  const hook7HasError = hook7Instances.some((i) => i.status === "error" || i.status === "banned");
  const hook7LastSync = hook7Instances
    .map((i) => i.last_connected_at)
    .filter(Boolean)
    .sort()
    .reverse()[0] ?? null;

  const integrations = data ?? [];
  const connectedCount = integrations.filter((p) => p.connection?.status === "connected").length;
  const pendingCount = integrations.filter((p) => p.connection?.status === "pending").length;
  const errorCount = integrations.filter((p) => p.connection?.status === "error").length;

  const [resendOpen, setResendOpen] = useState(false);
  const [whatsAppOpen, setWhatsAppOpen] = useState(false);
  const [calcomOpen, setCalcomOpen] = useState(false);
  const [pipedriveOpen, setPipedriveOpen] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrações"
        description="Status reais dos provedores disponíveis para a organização atual."
      />

      <div className="rounded-xl border border-brand/20 bg-brand/5 p-4 text-sm">
        <div className="flex items-start gap-3">
          <Mail className="mt-0.5 h-4 w-4 text-brand" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">Email transacional — modelo híbrido</p>
            <p className="text-muted-foreground">
              Convites, recuperação de senha e alertas do sistema saem pela <strong>chave global</strong> do Leaderei.
              Para enviar <strong>campanhas</strong> e <strong>respostas do Inbox</strong> com seu próprio domínio e reputação, conecte o Resend abaixo.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <SummaryCard label="Disponíveis" value={integrations.length} loading={isLoading} />
        <SummaryCard label="Conectadas" value={connectedCount} loading={isLoading} accent />
        <SummaryCard label="Pendentes" value={pendingCount} loading={isLoading} />
        <SummaryCard label="Com erro" value={errorCount} loading={isLoading} />
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-48 animate-pulse rounded-xl bg-surface-muted/40" />
              ))
            : integrations.map((provider) => {
                const brand = SLUG_BRAND[provider.slug];
                const Icon: IconType | LucideIcon = brand?.Icon ?? Plug;
                const iconTint = brand?.tint ?? "text-muted-foreground";
                let status = provider.connection?.status ?? "disconnected";
                const isResend = provider.slug === "resend";
                const isWhatsApp = provider.slug === "whatsapp";
                const isCalcom = provider.slug === "cal_com";
                const isPipedrive = provider.slug === "pipedrive";
                const isInteractive = isResend || isWhatsApp || isCalcom || isPipedrive;

                // Hook7-aware override for the WhatsApp card.
                let operationalLabel: string;
                let readinessLabel: string;
                let syncLabel: string | null;
                if (isWhatsApp) {
                  if (hook7HasError) status = "error";
                  else if (hook7Connected > 0) status = "connected";
                  else if (hook7Total > 0) status = "pending";
                  else status = "disconnected";

                  if (hook7HasError) {
                    operationalLabel = "Instância com problema";
                    readinessLabel = "Verificar";
                  } else if (hook7Connected > 0) {
                    operationalLabel = `${hook7Connected} de ${hook7Total} ativas`;
                    readinessLabel = "Pronto pra enviar";
                  } else if (hook7Total > 0) {
                    operationalLabel = "Sem conexão ativa";
                    readinessLabel = "Pronto pra reconectar";
                  } else {
                    operationalLabel = "Não configurado";
                    readinessLabel = "Aguardando setup";
                  }
                  syncLabel = hook7LastSync ? relTime(hook7LastSync) : null;
                } else {
                  syncLabel = provider.connection?.last_synced_at
                    ? new Date(provider.connection.last_synced_at).toLocaleString("pt-BR")
                    : null;
                  const m = STATUS_META[status] ?? STATUS_META.disconnected;
                  operationalLabel = m.label;
                  readinessLabel = provider.connection ? "Configuração iniciada" : "Aguardando setup";
                }

                const meta = STATUS_META[status] ?? STATUS_META.disconnected;
                const StatusIcon = meta.icon;

                return (
                  <div key={provider.id} className="flex flex-col rounded-xl border bg-surface p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`grid h-10 w-10 place-items-center rounded-md border bg-background ${iconTint}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-display text-base font-semibold leading-tight">{provider.name}</h3>
                          <p className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">{provider.category}</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className={`${meta.className} gap-1 border-transparent font-normal`}>
                        <StatusIcon className="h-3 w-3" />
                        {meta.label}
                      </Badge>
                    </div>

                    <p className="mt-4 text-sm text-muted-foreground">
                      {provider.connection?.display_name
                        ? `${provider.connection.display_name}. ${meta.helper}`
                        : provider.description || meta.helper}
                    </p>

                    <div className="mt-4 space-y-2 rounded-lg border bg-background p-3 text-xs text-muted-foreground">
                      <div className="flex items-center justify-between gap-3">
                        <span>Status operacional</span>
                        <span className="font-medium text-foreground">{operationalLabel}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Último sync</span>
                        <span>{syncLabel ?? "Ainda não sincronizado"}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Readiness</span>
                        <span>{readinessLabel}</span>
                      </div>
                    </div>


                    {provider.connection?.last_error && (
                      <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                        {provider.connection.last_error}
                      </p>
                    )}

                    <div className="mt-5 flex-1" />

                    <Button
                      variant={status === "connected" ? "outline" : "default"}
                      size="sm"
                      className="w-full"
                      disabled={!isInteractive && status !== "connected"}
                      onClick={() => {
                        if (isResend) setResendOpen(true);
                        else if (isWhatsApp) setWhatsAppOpen(true);
                        else if (isCalcom) setCalcomOpen(true);
                        else if (isPipedrive) setPipedriveOpen(true);
                      }}
                      title={!isInteractive ? "Conexão guiada chega nas próximas fases." : undefined}
                    >
                      {isWhatsApp ? "Gerenciar instâncias" : status === "connected" ? "Gerenciar" : "Configurar"}
                      {!isWhatsApp && status !== "connected" && <ArrowRight className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                );
              })}
        </section>
      )}

      <ResendConnectionDialog open={resendOpen} onOpenChange={setResendOpen} />
      <WhatsAppManagerDialog open={whatsAppOpen} onOpenChange={setWhatsAppOpen} />
      <CalcomConnectionDialog open={calcomOpen} onOpenChange={setCalcomOpen} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resend per-org dialog
// ---------------------------------------------------------------------------

function ResendConnectionDialog({
  open, onOpenChange,
}: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const fetchConn = useServerFn(getOrgResendConnection);
  const save = useServerFn(saveOrgResendConnection);
  const disconnect = useServerFn(disconnectOrgResend);

  const connQuery = useQuery({
    enabled: open,
    queryKey: ["resend-org"],
    queryFn: () => fetchConn(),
  });

  const [apiKey, setApiKey] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");

  useEffect(() => {
    if (connQuery.data && open) {
      setFromEmail(connQuery.data.from_email ?? "");
      setFromName(connQuery.data.from_name ?? "");
      setApiKey("");
    }
  }, [connQuery.data, open]);

  const saveMut = useMutation({
    mutationFn: () => save({ data: { api_key: apiKey, from_email: fromEmail, from_name: fromName } }),
    onSuccess: () => {
      toast.success("Resend conectado com sucesso.");
      qc.invalidateQueries({ queryKey: ["integrations"] });
      qc.invalidateQueries({ queryKey: ["resend-org"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao conectar Resend."),
  });

  const disconnectMut = useMutation({
    mutationFn: () => disconnect(),
    onSuccess: () => {
      toast.success("Resend desconectado.");
      qc.invalidateQueries({ queryKey: ["integrations"] });
      qc.invalidateQueries({ queryKey: ["resend-org"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao desconectar."),
  });

  const hasKey = connQuery.data?.has_key ?? false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Conectar Resend</DialogTitle>
          <DialogDescription>
            Usado para enviar campanhas e respostas do Inbox a partir do seu domínio.
            Convites e alertas do sistema continuam saindo pela chave global do Leaderei.
          </DialogDescription>
        </DialogHeader>

        {connQuery.isLoading ? (
          <div className="grid place-items-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="r-key">
                Chave da API Resend {hasKey && <span className="text-2xs text-muted-foreground">(deixe em branco para manter a atual)</span>}
              </Label>
              <Input
                id="r-key"
                type="password"
                placeholder="re_..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="off"
              />
              <p className="text-2xs text-muted-foreground">
                Obtenha em <span className="font-mono">resend.com/api-keys</span>. Requer domínio verificado.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-from-email">Email remetente</Label>
              <Input
                id="r-from-email"
                type="email"
                placeholder="contato@seudominio.com"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-from-name">Nome de exibição</Label>
              <Input
                id="r-from-name"
                placeholder="Sua Empresa"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {hasKey && (
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              disabled={disconnectMut.isPending}
              onClick={() => {
                if (confirm("Desconectar Resend? Campanhas e respostas pararão de enviar até reconectar.")) {
                  disconnectMut.mutate();
                }
              }}
            >
              {disconnectMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Desconectar
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={
              saveMut.isPending ||
              !fromEmail.trim() ||
              !fromName.trim() ||
              (!hasKey && apiKey.trim().length < 20) ||
              (hasKey && apiKey.length > 0 && apiKey.trim().length < 20)
            }
            onClick={() => {
              // when hasKey and apiKey empty, we still need a key to validate -> require user to paste it again
              if (!apiKey.trim()) {
                toast.error("Cole a chave da API para validar e salvar.");
                return;
              }
              saveMut.mutate();
            }}
          >
            {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar e validar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryCard({
  label, value, loading, accent,
}: { label: string; value: number; loading?: boolean; accent?: boolean }) {
  return (
    <div className="rounded-xl border bg-surface p-5">
      <div className="label-exec text-muted-foreground">{label}</div>
      <div className={`mt-2 font-display text-2xl font-bold tracking-tight tabular-nums ${accent ? "text-brand" : ""}`}>
        {loading ? "..." : value}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cal.com per-org dialog
// ---------------------------------------------------------------------------

function CalcomConnectionDialog({
  open, onOpenChange,
}: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const fetchConn = useServerFn(getCalcomConnection);
  const save = useServerFn(saveCalcomConnection);
  const disconnect = useServerFn(disconnectCalcom);
  const sync = useServerFn(syncCalcomEventTypes);
  const regenSecret = useServerFn(regenerateCalcomWebhookSecret);

  const connQuery = useQuery({
    enabled: open,
    queryKey: ["calcom-org"],
    queryFn: () => fetchConn(),
  });

  const [apiKey, setApiKey] = useState("");
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    if (open) {
      setApiKey("");
      setShowSecret(false);
      setWebhookTest({ state: "idle" });
    }
  }, [open]);

  const saveMut = useMutation({
    mutationFn: () => save({ data: { api_key: apiKey } }),
    onSuccess: () => {
      toast.success("Cal.com conectado.");
      qc.invalidateQueries({ queryKey: ["integrations"] });
      qc.invalidateQueries({ queryKey: ["calcom-org"] });
      setApiKey("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao conectar Cal.com."),
  });

  const disconnectMut = useMutation({
    mutationFn: () => disconnect(),
    onSuccess: () => {
      toast.success("Cal.com desconectado.");
      qc.invalidateQueries({ queryKey: ["integrations"] });
      qc.invalidateQueries({ queryKey: ["calcom-org"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao desconectar."),
  });

  const syncMut = useMutation({
    mutationFn: () => sync(),
    onSuccess: (r: any) => {
      toast.success(`${r?.count ?? 0} event types sincronizados.`);
      qc.invalidateQueries({ queryKey: ["calcom-org"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao sincronizar."),
  });

  const regenMut = useMutation({
    mutationFn: () => regenSecret(),
    onSuccess: () => {
      toast.success("Novo secret gerado. Atualize o webhook no Cal.com.");
      setShowSecret(true);
      qc.invalidateQueries({ queryKey: ["calcom-org"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao gerar novo secret."),
  });

  const testWebhookFn = useServerFn(testCalcomWebhook);
  const [webhookTest, setWebhookTest] = useState<
    { state: "idle" } | { state: "ok"; status: number } | { state: "error"; message: string }
  >({ state: "idle" });
  const testWebhookMut = useMutation({
    mutationFn: () => testWebhookFn(),
    onMutate: () => setWebhookTest({ state: "idle" }),
    onSuccess: (r: any) => {
      setWebhookTest({ state: "ok", status: r?.status ?? 200 });
      toast.success("Webhook verificado com sucesso.");
    },
    onError: (e: any) => {
      const msg = e?.message ?? "Falha ao testar webhook.";
      setWebhookTest({ state: "error", message: msg });
      toast.error(msg);
    },
  });

  const hasKey = connQuery.data?.has_key ?? false;
  const webhookUrl = connQuery.data?.webhook_url ?? "";
  const webhookSecret = connQuery.data?.webhook_secret ?? "";
  const hasSecret = connQuery.data?.has_webhook_secret ?? false;


  function copy(text: string) {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    toast.success("Copiado.");
  }


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Conectar Cal.com</DialogTitle>
          <DialogDescription>
            Conecte sua conta Cal.com (API v2) para criar, consultar, cancelar e reagendar reuniões a partir das campanhas.
          </DialogDescription>
        </DialogHeader>

        {connQuery.isLoading ? (
          <div className="grid place-items-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="cal-key">
                API Key Cal.com {hasKey && <span className="text-2xs text-muted-foreground">(deixe em branco para manter a atual)</span>}
              </Label>
              <Input
                id="cal-key"
                type="password"
                placeholder="cal_live_..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="off"
              />
              <p className="text-2xs text-muted-foreground">
                Crie em <span className="font-mono">cal.com/settings/developer/api-keys</span>.
              </p>
            </div>

            {hasKey && (
              <>
                <div className="space-y-1.5">
                  <Label>Webhook URL para colar no Cal.com</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={webhookUrl} className="font-mono text-xs" />
                    <Button type="button" variant="outline" size="icon" onClick={() => copy(webhookUrl)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <p className="text-2xs text-muted-foreground">
                    Em Cal.com → Settings → Developer → Webhooks. Marque os eventos: <strong>BOOKING_CREATED</strong>, <strong>BOOKING_RESCHEDULED</strong>, <strong>BOOKING_CANCELLED</strong>. Use o secret abaixo no campo "Secret".
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Webhook secret</Label>
                    <span className={hasSecret ? "text-2xs text-emerald-600" : "text-2xs text-amber-600"}>
                      {hasSecret ? "gerado" : "ausente"}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      type={showSecret ? "text" : "password"}
                      value={webhookSecret || (hasSecret ? "" : "—")}
                      className="font-mono text-xs"
                      placeholder={hasSecret ? "" : "Nenhum secret ainda"}
                    />
                    <Button
                      type="button" variant="outline" size="icon"
                      onClick={() => setShowSecret((v) => !v)}
                      disabled={!hasSecret}
                      title={showSecret ? "Ocultar" : "Revelar"}
                    >
                      {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      type="button" variant="outline" size="icon"
                      onClick={() => copy(webhookSecret)}
                      disabled={!hasSecret}
                      title="Copiar"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button" variant="outline" size="icon"
                      onClick={() => {
                        if (hasSecret && !confirm("Gerar novo secret? O atual será invalidado e você terá que atualizar o webhook no Cal.com.")) return;
                        regenMut.mutate();
                      }}
                      disabled={regenMut.isPending}
                      title={hasSecret ? "Gerar novo secret" : "Gerar secret"}
                    >
                      {regenMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                  <p className="text-2xs text-muted-foreground">
                    Cole este valor no campo <strong>Secret</strong> do webhook no Cal.com. Ele é usado para validar a assinatura (HMAC SHA-256) de cada chamada.
                  </p>
                </div>

                <div className="rounded-md border px-3 py-2 text-sm space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div>Testar verificação do webhook</div>
                      <p className="text-2xs text-muted-foreground">
                        Envia um POST assinado para a URL pública para confirmar que a assinatura HMAC é aceita.
                      </p>
                    </div>
                    <Button
                      type="button" variant="outline" size="sm"
                      disabled={testWebhookMut.isPending || !hasSecret}
                      onClick={() => testWebhookMut.mutate()}
                    >
                      {testWebhookMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      Testar
                    </Button>
                  </div>
                  {webhookTest.state === "ok" && (
                    <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 px-2 py-1.5 text-2xs text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Sucesso — webhook respondeu {webhookTest.status}. A assinatura está válida.
                    </div>
                  )}
                  {webhookTest.state === "error" && (
                    <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-2 py-1.5 text-2xs text-destructive">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span className="break-words">{webhookTest.message}</span>
                    </div>
                  )}
                </div>




                <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span>Event types sincronizados</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{connQuery.data?.event_types_count ?? 0}</span>
                    <Button
                      type="button" variant="outline" size="sm"
                      disabled={syncMut.isPending}
                      onClick={() => syncMut.mutate()}
                    >
                      {syncMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      Sincronizar
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {hasKey && (
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              disabled={disconnectMut.isPending}
              onClick={() => {
                if (confirm("Desconectar Cal.com? Os agendamentos automáticos pararão até reconectar.")) {
                  disconnectMut.mutate();
                }
              }}
            >
              {disconnectMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Desconectar
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button
            disabled={saveMut.isPending || (!apiKey.trim() && !hasKey)}
            onClick={() => saveMut.mutate()}
          >
            {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {hasKey ? (apiKey.trim() ? "Atualizar chave" : "OK") : "Conectar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
