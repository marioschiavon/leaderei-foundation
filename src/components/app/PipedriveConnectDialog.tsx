import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, RefreshCw, ExternalLink, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  getPipedriveConnection,
  savePipedriveConnection,
  disconnectPipedrive,
  syncPipedriveNow,
  listPipedriveSyncRuns,
} from "@/lib/pipedrive.functions";

type Props = { open: boolean; onOpenChange: (v: boolean) => void };

export function PipedriveConnectDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const fetchConn = useServerFn(getPipedriveConnection);
  const save = useServerFn(savePipedriveConnection);
  const disconnect = useServerFn(disconnectPipedrive);
  const sync = useServerFn(syncPipedriveNow);
  const listRuns = useServerFn(listPipedriveSyncRuns);

  const connQuery = useQuery({
    enabled: open,
    queryKey: ["pipedrive-conn"],
    queryFn: () => fetchConn(),
  });
  const runsQuery = useQuery({
    enabled: open,
    queryKey: ["pipedrive-runs"],
    queryFn: () => listRuns(),
  });

  const [companyDomain, setCompanyDomain] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [clearCursors, setClearCursors] = useState(false);

  useEffect(() => {
    if (connQuery.data && open) {
      setCompanyDomain(connQuery.data.company_domain ?? "");
      setApiToken("");
      setShowToken(false);
      setClearCursors(false);
    }
  }, [connQuery.data, open]);

  const saveMut = useMutation({
    mutationFn: () => save({ data: { api_token: apiToken.trim(), company_domain: companyDomain.trim() } }),
    onSuccess: () => {
      toast.success("Pipedrive conectado.");
      qc.invalidateQueries({ queryKey: ["integrations"] });
      qc.invalidateQueries({ queryKey: ["pipedrive-conn"] });
      setApiToken("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao conectar Pipedrive."),
  });

  const disconnectMut = useMutation({
    mutationFn: () => disconnect({ data: { clear_cursors: clearCursors } }),
    onSuccess: () => {
      toast.success("Pipedrive desconectado.");
      qc.invalidateQueries({ queryKey: ["integrations"] });
      qc.invalidateQueries({ queryKey: ["pipedrive-conn"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao desconectar."),
  });

  const syncMut = useMutation({
    mutationFn: (full: boolean) => sync({ data: { full } }),
    onSuccess: (r: any) => {
      const s = r?.stats ?? {};
      const total = ["persons", "deals", "activities"].reduce(
        (acc, k) => acc + (s[k]?.created ?? 0) + (s[k]?.updated ?? 0),
        0,
      );
      const label = r?.status === "partial" ? "Sync parcial" : "Sync concluído";
      toast.success(`${label}: ${total} registros processados.`);
      qc.invalidateQueries({ queryKey: ["pipedrive-conn"] });
      qc.invalidateQueries({ queryKey: ["pipedrive-runs"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["deals"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao sincronizar."),
  });

  const data = connQuery.data;
  const isConnected = !!data?.connected && !!data?.has_token;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Conectar Pipedrive</DialogTitle>
          <DialogDescription>
            Importa Persons, Deals, Organizations e Activities do seu Pipedrive como leads, deals e atividades.
            A importação por CSV continua disponível em paralelo.
          </DialogDescription>
        </DialogHeader>

        {connQuery.isLoading ? (
          <div className="grid place-items-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {isConnected && (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="font-medium">Conectado a {data?.display_name ?? data?.company_domain}</span>
                </div>
                {data?.last_sync_at && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Última sync: {new Date(data.last_sync_at).toLocaleString("pt-BR")}
                    {data.last_status && (
                      <Badge variant="secondary" className="ml-2 text-2xs">
                        {data.last_status}
                      </Badge>
                    )}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="pd-domain">Domínio da empresa no Pipedrive</Label>
              <Input
                id="pd-domain"
                placeholder="suaempresa.pipedrive.com"
                value={companyDomain}
                onChange={(e) => setCompanyDomain(e.target.value)}
                autoComplete="off"
              />
              <p className="text-2xs text-muted-foreground">
                É a URL que você usa para acessar o Pipedrive (sem https://).
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pd-token">
                API Token{" "}
                {isConnected && (
                  <span className="text-2xs text-muted-foreground">(deixe em branco para manter o atual)</span>
                )}
              </Label>
              <div className="relative">
                <Input
                  id="pd-token"
                  type={showToken ? "text" : "password"}
                  placeholder="cole o token aqui"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  autoComplete="off"
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowToken((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Mostrar token"
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <a
                href="https://support.pipedrive.com/en/article/how-can-i-find-my-personal-api-key"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-2xs text-brand hover:underline"
              >
                Onde encontro meu token? <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {isConnected && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium">Sincronização manual</p>
                    <p className="text-2xs text-muted-foreground">
                      Puxa apenas o que mudou desde a última sync. Use "Sync completo" para forçar tudo.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => syncMut.mutate(false)}
                      disabled={syncMut.isPending}
                    >
                      {syncMut.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      Sincronizar agora
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => syncMut.mutate(true)}
                      disabled={syncMut.isPending}
                    >
                      Sync completo
                    </Button>
                  </div>

                  {data?.last_stats && (
                    <StatsGrid stats={data.last_stats} />
                  )}

                  {runsQuery.data?.runs && runsQuery.data.runs.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-2xs font-medium uppercase tracking-wider text-muted-foreground">
                        Histórico recente
                      </p>
                      <div className="space-y-1 rounded-md border bg-background p-2 text-xs">
                        {runsQuery.data.runs.slice(0, 5).map((r: any) => (
                          <div key={r.id} className="flex items-center justify-between gap-2">
                            <span className="text-muted-foreground">
                              {new Date(r.started_at).toLocaleString("pt-BR")}
                            </span>
                            <Badge
                              variant="secondary"
                              className={
                                r.status === "success"
                                  ? "bg-emerald-500/10 text-emerald-700 border-transparent"
                                  : r.status === "failed"
                                    ? "bg-destructive/10 text-destructive border-transparent"
                                    : r.status === "partial"
                                      ? "bg-amber-500/10 text-amber-700 border-transparent"
                                      : "border-transparent"
                              }
                            >
                              {r.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {isConnected && (
            <div className="flex flex-1 items-center gap-2">
              <label className="flex items-center gap-1.5 text-2xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={clearCursors}
                  onChange={(e) => setClearCursors(e.target.checked)}
                />
                Limpar cursores
              </label>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={disconnectMut.isPending}
                onClick={() => {
                  if (confirm("Desconectar Pipedrive? Os dados já importados serão mantidos.")) {
                    disconnectMut.mutate();
                  }
                }}
              >
                {disconnectMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Desconectar
              </Button>
            </div>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button
            disabled={
              saveMut.isPending ||
              companyDomain.trim().length < 3 ||
              (!isConnected && apiToken.trim().length < 10) ||
              (isConnected && apiToken.length > 0 && apiToken.trim().length < 10)
            }
            onClick={() => {
              if (!apiToken.trim()) {
                if (isConnected) {
                  toast.error("Cole o token novamente para revalidar.");
                  return;
                }
              }
              saveMut.mutate();
            }}
          >
            {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isConnected ? "Atualizar credenciais" : "Conectar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatsGrid({ stats }: { stats: any }) {
  const entries: Array<[string, string]> = [
    ["Persons", "persons"],
    ["Deals", "deals"],
    ["Activities", "activities"],
    ["Organizations", "organizations"],
  ];
  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      {entries.map(([label, key]) => {
        const s = stats?.[key];
        if (!s) return null;
        const hasError = !!s.error;
        return (
          <div key={key} className="rounded-md border bg-background p-2">
            <div className="flex items-center justify-between">
              <span className="font-medium">{label}</span>
              {hasError && <AlertTriangle className="h-3 w-3 text-destructive" />}
            </div>
            <div className="mt-1 text-2xs text-muted-foreground">
              {(s.created ?? 0)} novos · {(s.updated ?? 0)} atualizados · {(s.skipped ?? 0)} pulados
            </div>
          </div>
        );
      })}
    </div>
  );
}
