import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Loader2, Eye, EyeOff, ExternalLink, CheckCircle2, ArrowRight, KeyRound,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  connectApollo,
  disconnectApollo,
  getApolloStatus,
  listApolloRecentCalls,
} from "@/lib/apollo.functions";

type Props = { open: boolean; onOpenChange: (v: boolean) => void };

export function ApolloConnectDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const fetchStatus = useServerFn(getApolloStatus);
  const save = useServerFn(connectApollo);
  const disconnect = useServerFn(disconnectApollo);
  const fetchCalls = useServerFn(listApolloRecentCalls);

  const statusQuery = useQuery({
    enabled: open,
    queryKey: ["apollo-status"],
    queryFn: () => fetchStatus(),
  });

  const callsQuery = useQuery({
    enabled: open,
    queryKey: ["apollo-recent-calls"],
    queryFn: () => fetchCalls(),
  });

  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (open) {
      setApiKey("");
      setShowKey(false);
    }
  }, [open]);

  const saveMut = useMutation({
    mutationFn: () => save({ data: { api_key: apiKey.trim() } }),
    onSuccess: () => {
      toast.success("Apollo conectado.");
      qc.invalidateQueries({ queryKey: ["integrations"] });
      qc.invalidateQueries({ queryKey: ["apollo-status"] });
      setApiKey("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao conectar Apollo."),
  });

  const disconnectMut = useMutation({
    mutationFn: () => disconnect(),
    onSuccess: () => {
      toast.success("Apollo desconectado.");
      qc.invalidateQueries({ queryKey: ["integrations"] });
      qc.invalidateQueries({ queryKey: ["apollo-status"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao desconectar."),
  });

  const data = statusQuery.data;
  const isConnected = !!data?.connected;
  const recent = callsQuery.data?.calls ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Conectar Apollo.io</DialogTitle>
          <DialogDescription>
            Busca de leads, enriquecimento por email/LinkedIn e telemetria de uso da API. A chave fica
            armazenada apenas no backend — nunca volta para o navegador.
          </DialogDescription>
        </DialogHeader>

        {statusQuery.isLoading ? (
          <div className="grid place-items-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {isConnected && (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="font-medium">Conectado</span>
                </div>
                {data?.last_check_at && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Validado em {new Date(data.last_check_at).toLocaleString("pt-BR")}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="apl-key">
                API Key Apollo{" "}
                {isConnected && (
                  <span className="text-2xs text-muted-foreground">(cole novamente para substituir)</span>
                )}
              </Label>
              <div className="relative">
                <KeyRound className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="apl-key"
                  type={showKey ? "text" : "password"}
                  placeholder="cole a chave aqui"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  autoComplete="off"
                  className="pl-8 pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Mostrar chave"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <a
                href="https://apolloio.github.io/apollo-api-docs/?shell#authentication"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-2xs text-brand hover:underline"
              >
                Onde encontro minha chave? <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {isConnected && (
              <>
                <Separator />
                <div className="rounded-md border bg-background p-3">
                  <p className="text-sm font-medium">Ir para a busca</p>
                  <p className="mt-1 text-2xs text-muted-foreground">
                    Encontre pessoas por cargo, senioridade, indústria e país, e importe direto pra base.
                  </p>
                  <Link
                    to="/dashboard/leads/apollo"
                    onClick={() => onOpenChange(false)}
                    className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
                  >
                    Abrir busca Apollo <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

                {recent.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-2xs font-medium uppercase tracking-wider text-muted-foreground">
                      Chamadas recentes
                    </p>
                    <div className="space-y-1 rounded-md border bg-background p-2 text-xs">
                      {recent.slice(0, 5).map((c: any) => (
                        <div key={c.id} className="flex items-center justify-between gap-2">
                          <span className="font-mono text-2xs text-muted-foreground">{c.endpoint}</span>
                          <span className="text-2xs">
                            <span className={c.error ? "text-destructive" : "text-emerald-700"}>
                              {c.status_code ?? "—"}
                            </span>
                            <span className="ml-2 text-muted-foreground">{c.latency_ms ?? 0}ms</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {isConnected && (
            <div className="flex flex-1 items-center">
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={disconnectMut.isPending}
                onClick={() => {
                  if (confirm("Desconectar Apollo? Os leads já importados serão mantidos.")) {
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
            disabled={saveMut.isPending || apiKey.trim().length < 10}
            onClick={() => saveMut.mutate()}
          >
            {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isConnected ? "Atualizar chave" : "Conectar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
