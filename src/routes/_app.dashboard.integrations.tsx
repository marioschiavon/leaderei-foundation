import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle, ArrowRight, Briefcase, Building2, Calendar,
  CheckCircle2, Circle, Clock3, Mail, MessageCircle, Plug,
  Loader2, type LucideIcon, Users,
} from "lucide-react";
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
import { listHook7Instances } from "@/lib/hook7.functions";
import { WhatsAppManagerDialog } from "@/components/app/WhatsAppManagerDialog";

export const Route = createFileRoute("/_app/dashboard/integrations")({
  component: IntegrationsPage,
});

const SLUG_ICON: Record<string, LucideIcon> = {
  resend: Mail,
  linkedin: MessageCircle,
  whatsapp: MessageCircle,
  hubspot: Building2,
  pipedrive: Briefcase,
  apollo: Users,
  "google-calendar": Calendar,
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
                const Icon = SLUG_ICON[provider.slug] ?? Plug;
                let status = provider.connection?.status ?? "disconnected";
                const isResend = provider.slug === "resend";
                const isWhatsApp = provider.slug === "whatsapp";
                const isInteractive = isResend || isWhatsApp;

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
                        <div className="grid h-10 w-10 place-items-center rounded-md border bg-background text-foreground">
                          <Icon className="h-4 w-4" />
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
