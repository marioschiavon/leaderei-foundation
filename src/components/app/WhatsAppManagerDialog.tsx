import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckCircle2, Loader2, MoreVertical, Plus, QrCode, RefreshCw, Trash2, PowerOff, Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  listHook7Instances, createHook7Instance, connectHook7Instance,
  getHook7InstanceQR, getHook7InstanceStatus,
  disconnectHook7Instance, reconnectHook7Instance, deleteHook7Instance, renameHook7Instance,
} from "@/lib/hook7.functions";
import { listOrgMembers } from "@/lib/settings.functions";
import { getMyContext } from "@/lib/tenant.functions";

const STATUS_META: Record<string, { label: string; cls: string; dot: string }> = {
  connected:    { label: "Conectado",      cls: "bg-emerald-500/10 text-emerald-700", dot: "🟢" },
  qr_ready:     { label: "Aguardando QR",  cls: "bg-amber-500/10 text-amber-700",     dot: "🟡" },
  pending_qr:   { label: "Aguardando QR",  cls: "bg-amber-500/10 text-amber-700",     dot: "🟡" },
  pairing:      { label: "Pareando",       cls: "bg-orange-500/10 text-orange-700",   dot: "🟠" },
  disconnected: { label: "Desconectado",   cls: "bg-muted text-muted-foreground",      dot: "⚪" },
  error:        { label: "Erro",           cls: "bg-destructive/10 text-destructive", dot: "🔴" },
  banned:       { label: "Banido",         cls: "bg-destructive/10 text-destructive", dot: "🔴" },
};

function relTime(iso?: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} d`;
}

export function WhatsAppManagerDialog({
  open, onOpenChange,
}: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const fetchList = useServerFn(listHook7Instances);
  const { data, isLoading, refetch } = useQuery({
    enabled: open,
    queryKey: ["hook7-instances"],
    queryFn: () => fetchList(),
    refetchInterval: open ? 15000 : false,
  });

  const instances = data?.instances ?? [];
  const mode = data?.whatsapp_mode ?? "shared";

  const [connectOpen, setConnectOpen] = useState(false);
  const [reuseId, setReuseId] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>WhatsApp via Hook7</DialogTitle>
          <DialogDescription>
            Conecte um ou mais números de WhatsApp para usar em campanhas.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="grid place-items-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : instances.length === 0 ? (
          <div className="rounded-xl border bg-surface-muted/30 p-8 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand/10">
              <QrCode className="h-5 w-5 text-brand" />
            </div>
            <p className="mt-3 font-medium">Nenhuma instância conectada</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Conecte um número para enviar mensagens em campanhas.
            </p>
            <Button className="mt-4" onClick={() => setConnectOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> Conectar WhatsApp
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {instances.map((inst: any) => {
              const meta = STATUS_META[inst.status] ?? STATUS_META.disconnected;
              return (
                <div key={inst.id} className="rounded-lg border bg-surface p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{inst.display_name}</span>
                        <Badge className={`${meta.cls} border-transparent font-normal`}>
                          {meta.dot} {meta.label}
                        </Badge>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {inst.phone_number
                          ? `+${inst.phone_number}`
                          : inst.status === "connected"
                            ? (inst.connected_profile_name ? `WhatsApp: ${inst.connected_profile_name}` : "Conectado")
                            : "Aguardando pareamento"}
                        {" · "}
                        Última conexão: {relTime(inst.last_connected_at)}
                      </div>
                    </div>
                    <InstanceActionsMenu
                      key={inst.id}
                      instance={inst}
                      onShowQr={() => { setReuseId(inst.id); setConnectOpen(true); }}
                      onChanged={refetch}
                    />
                  </div>
                </div>
              );
            })}

            <Button variant="outline" className="w-full" onClick={() => { setReuseId(null); setConnectOpen(true); }}>
              <Plus className="mr-1 h-4 w-4" /> Adicionar outra instância
            </Button>
          </div>
        )}
      </DialogContent>

      <ConnectFlowDialog
        open={connectOpen}
        onOpenChange={(v) => { setConnectOpen(v); if (!v) { setReuseId(null); refetch(); } }}
        mode={mode}
        reuseInstanceId={reuseId}
      />
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Per-instance actions menu — one component per instance so all hooks
// (useServerFn, useMutation, useState) live at the TOP of a real component
// body, never inside callbacks or .map iterations.
// ---------------------------------------------------------------------------

function InstanceActionsMenu({
  instance, onShowQr, onChanged,
}: {
  instance: any;
  onShowQr: () => void;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const reconnectFn = useServerFn(reconnectHook7Instance);
  const disconnectFn = useServerFn(disconnectHook7Instance);
  const deleteFn = useServerFn(deleteHook7Instance);
  const renameFn = useServerFn(renameHook7Instance);

  const invalidateAll = () => {
    onChanged();
    qc.invalidateQueries({ queryKey: ["hook7-instances"] });
    qc.invalidateQueries({ queryKey: ["integrations"] });
  };

  const reconnectMut = useMutation({
    mutationFn: () => reconnectFn({ data: { instance_id: instance.id } }),
    onSuccess: () => { toast.success("Reconectando…"); invalidateAll(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao reconectar."),
  });
  const disconnectMut = useMutation({
    mutationFn: () => disconnectFn({ data: { instance_id: instance.id } }),
    onSuccess: () => { toast.success("Desconectado."); invalidateAll(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao desconectar."),
  });
  const deleteMut = useMutation({
    mutationFn: () => deleteFn({ data: { instance_id: instance.id, reason: "user_delete" } }),
    onSuccess: () => { toast.success("Instância apagada."); invalidateAll(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao apagar."),
  });
  const renameMut = useMutation({
    mutationFn: (display_name: string) =>
      renameFn({ data: { instance_id: instance.id, display_name } }),
    onSuccess: () => { toast.success("Renomeada."); invalidateAll(); setRenameOpen(false); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao renomear."),
  });

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(instance.display_name ?? "");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const status = instance.status as string;
  const canReconnect = status === "disconnected" || status === "error" || status === "banned";
  const canDisconnect = status === "connected";
  const canShowQr = status === "qr_ready" || status === "pending_qr" || status === "pairing";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canShowQr && (
            <DropdownMenuItem onClick={onShowQr}>
              <QrCode className="mr-2 h-4 w-4" /> Ver QR
            </DropdownMenuItem>
          )}
          {canReconnect && (
            <DropdownMenuItem onClick={() => reconnectMut.mutate()}>
              <RefreshCw className="mr-2 h-4 w-4" /> Reconectar
            </DropdownMenuItem>
          )}
          {canDisconnect && (
            <DropdownMenuItem onClick={() => disconnectMut.mutate()}>
              <PowerOff className="mr-2 h-4 w-4" /> Desconectar
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={() => { setRenameValue(instance.display_name ?? ""); setRenameOpen(true); }}
          >
            <Pencil className="mr-2 h-4 w-4" /> Renomear
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => setConfirmDeleteOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Apagar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Renomear instância</DialogTitle>
            <DialogDescription>O nome ajuda a identificar a instância na lista.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label htmlFor="rename-input">Novo nome</Label>
            <Input
              id="rename-input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              maxLength={60}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameOpen(false)}>Cancelar</Button>
            <Button
              disabled={
                renameMut.isPending ||
                !renameValue.trim() ||
                renameValue.trim() === instance.display_name
              }
              onClick={() => renameMut.mutate(renameValue.trim())}
            >
              {renameMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar instância "{instance.display_name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza? Esta ação não pode ser desfeita. A instância será removida do Hook7 e arquivada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { setConfirmDeleteOpen(false); deleteMut.mutate(); }}
            >
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Connect flow (2-step) dialog
// ---------------------------------------------------------------------------

function ConnectFlowDialog({
  open, onOpenChange, mode, reuseInstanceId,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  mode: "shared" | "per_user"; reuseInstanceId: string | null;
}) {
  const fetchCtx = useServerFn(getMyContext);
  const fetchMembers = useServerFn(listOrgMembers);
  const create = useServerFn(createHook7Instance);
  const connect = useServerFn(connectHook7Instance);
  const getQR = useServerFn(getHook7InstanceQR);
  const getStatus = useServerFn(getHook7InstanceStatus);
  const reconnect = useServerFn(reconnectHook7Instance);
  const del = useServerFn(deleteHook7Instance);

  const { data: ctx } = useQuery({ enabled: open, queryKey: ["my-context"], queryFn: () => fetchCtx() });
  const { data: membersData } = useQuery({
    enabled: open && mode === "per_user",
    queryKey: ["org-members"],
    queryFn: () => fetchMembers(),
  });

  const [step, setStep] = useState<1 | 2>(1);
  const [displayName, setDisplayName] = useState("");
  const [ownerId, setOwnerId] = useState<string | "">("");
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("pending_qr");
  const [profileName, setProfileName] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  // Guards against the polling interval firing after the user cancels (which
  // archives the instance) — without this, the next status poll resolves to
  // "Instância arquivada" and surfaces as a runtime error.
  const cancelledRef = useRef(false);

  // Reset on open close
  useEffect(() => {
    if (open) {
      const reuse = reuseInstanceId;
      cancelledRef.current = false;
      setDisplayName("");
      setOwnerId("");
      setQrBase64(null);
      setProfileName(null);
      setStatus("pending_qr");
      setStartedAt(0);
      if (reuse) {
        setInstanceId(reuse);
        setStep(2);
      } else {
        setInstanceId(null);
        setStep(1);
      }
    }
  }, [open, reuseInstanceId]);

  // Auto-load QR for reuse
  useEffect(() => {
    if (open && step === 2 && instanceId && !qrBase64 && !busy) {
      void loadQR(instanceId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step, instanceId]);

  // Poll status every 3s on step 2
  useEffect(() => {
    if (!open || step !== 2 || !instanceId) return;
    const t = setInterval(async () => {
      if (cancelledRef.current) { clearInterval(t); return; }
      try {
        const r: any = await getStatus({ data: { instance_id: instanceId } });
        if (cancelledRef.current) { clearInterval(t); return; }
        setStatus(r.status);
        if (r.connected_profile_name) setProfileName(r.connected_profile_name);
        if (r.status === "connected") clearInterval(t);
      } catch { /* ignore — instance may have been archived during cancel */ }
    }, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step, instanceId]);


  const elapsedSec = startedAt > 0 ? Math.floor((Date.now() - startedAt) / 1000) : 0;
  const timedOut = startedAt > 0 && elapsedSec > 120 && status !== "connected";

  // Auto-archive on timeout (2min, qr_ready) — close modal + rollback (Opção A).
  useEffect(() => {
    if (timedOut && !cancelledRef.current && !reuseInstanceId) {
      void handleCancel("timeout");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timedOut]);


  async function handleNext() {
    if (!displayName.trim()) { toast.error("Informe um nome."); return; }
    setBusy(true);
    let id: string | null = null;
    try {
      const created: any = await create({
        data: {
          display_name: displayName.trim(),
          owner_user_id: mode === "per_user" ? (ownerId || ctx?.userId || null) : null,
        },
      });
      id = created?.instance?.id ?? null;
      if (!id || typeof id !== "string") {
        throw new Error("Servidor não retornou ID da instância.");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao criar instância.");
      setBusy(false);
      return; // do not advance to step 2 / do not start polling
    }
    // Only now: id is guaranteed valid — store it, advance, start polling.
    setInstanceId(id);
    setStep(2);
    try {
      await connect({ data: { instance_id: id } });
      setStartedAt(Date.now());
      await loadQR(id);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao conectar instância.");
    } finally {
      setBusy(false);
    }
  }

  async function loadQR(id: string) {
    setBusy(true);
    try {
      // try a few times — QR may take a moment after connect
      for (let i = 0; i < 8; i++) {
        if (cancelledRef.current) return;
        const r: any = await getQR({ data: { instance_id: id } });
        if (r.qrcode_base64) { setQrBase64(r.qrcode_base64); break; }
        await new Promise((res) => setTimeout(res, 1500));
      }
      if (startedAt === 0) setStartedAt(Date.now());
    } catch (e: any) {
      if (!cancelledRef.current) toast.error(e?.message ?? "Falha ao obter QR.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRegenerate() {
    if (!instanceId) return;
    setBusy(true);
    try {
      await reconnect({ data: { instance_id: instanceId } });
      setQrBase64(null);
      setStartedAt(Date.now());
      await loadQR(instanceId);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro.");
    } finally { setBusy(false); }
  }

  async function handleCancel(reason: "cancel" | "timeout" = "cancel") {
    // Stop polling FIRST so the next interval tick doesn't race the archive
    // and end up calling getStatus on a row that's already gone/archived.
    cancelledRef.current = true;
    // Only rollback fresh (non-reused) instances that never reached connected.
    const idToRollback = instanceId && status !== "connected" && !reuseInstanceId ? instanceId : null;
    onOpenChange(false);
    if (idToRollback) {
      try { await del({ data: { instance_id: idToRollback, reason } }); } catch { /* ignore */ }
    }
  }


  const members = (membersData as any)?.members ?? membersData ?? [];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) void handleCancel(); else onOpenChange(true); }}>
      <DialogContent className="max-w-md">
        {step === 1 ? (
          <>
            <DialogHeader>
              <DialogTitle>Conectar WhatsApp</DialogTitle>
              <DialogDescription>Configure a instância antes de gerar o QR code.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="wa-name">Nome da instância</Label>
                <Input
                  id="wa-name"
                  placeholder="Ex: Vendedor João"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoFocus
                />
              </div>
              {mode === "per_user" && Array.isArray(members) && members.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Atribuir a vendedor</Label>
                  <Select value={ownerId} onValueChange={setOwnerId}>
                    <SelectTrigger><SelectValue placeholder="Eu mesmo" /></SelectTrigger>
                    <SelectContent>
                      {members.map((m: any) => (
                        <SelectItem key={m.user_id} value={m.user_id}>
                          {m.full_name ?? m.email ?? m.user_id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={handleNext} disabled={busy || !displayName.trim()}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Próximo
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Escaneie o QR code</DialogTitle>
              <DialogDescription>
                Abra o WhatsApp no celular → Aparelhos conectados → Conectar um aparelho.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              {status === "connected" ? (
                <div className="grid place-items-center gap-3 py-8 text-center">
                  <div className="grid h-16 w-16 place-items-center rounded-full bg-emerald-500/10">
                    <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                  </div>
                  <p className="font-medium">
                    {profileName ? `Conectado como ${profileName}` : "Conectado"}
                  </p>
                  <p className="text-xs text-muted-foreground">O número será detectado em breve.</p>
                </div>

              ) : timedOut ? (
                <div className="grid place-items-center gap-3 py-8 text-center">
                  <p className="text-sm text-muted-foreground">Tempo esgotado sem conexão.</p>
                  <Button onClick={handleRegenerate} disabled={busy}>
                    {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Gerar novo QR
                  </Button>
                </div>
              ) : qrBase64 ? (
                <div className="grid place-items-center gap-3">
                  <div className="rounded-lg border bg-white p-3">
                    <img
                      alt="QR code do WhatsApp"
                      src={qrBase64.startsWith("data:") ? qrBase64 : `data:image/png;base64,${qrBase64}`}
                      className="h-64 w-64"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Aguardando pareamento… ({Math.max(0, 120 - elapsedSec)}s)
                  </p>
                </div>
              ) : (
                <div className="grid place-items-center gap-3 py-8 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <p className="text-sm">Gerando QR…</p>
                </div>
              )}
            </div>

            <DialogFooter>
              {status === "connected" ? (
                <Button onClick={() => onOpenChange(false)}>Concluir</Button>
              ) : (
                <Button variant="ghost" onClick={() => void handleCancel("cancel")}>Cancelar</Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
