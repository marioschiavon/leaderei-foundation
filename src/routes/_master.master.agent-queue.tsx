import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, Bot, AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  listAgentActionQueue, reviewAgentAction,
  listAgentActionRules, upsertAgentActionRule, listAllOrganizationsForRules,
} from "@/lib/master.functions";

export const Route = createFileRoute("/_master/master/agent-queue")({
  component: AgentQueuePage,
});

const ACTION_TYPES = [
  "responder","oferecer_horarios","confirmar_agendamento",
  "marcar_quente_humano","encerrar_cadencia","ignorar",
] as const;
type ActionType = typeof ACTION_TYPES[number];

const ACTION_LABEL: Record<ActionType, string> = {
  responder: "Responder",
  oferecer_horarios: "Oferecer horários",
  confirmar_agendamento: "Confirmar agendamento",
  marcar_quente_humano: "Marcar quente / humano",
  encerrar_cadencia: "Encerrar cadência",
  ignorar: "Ignorar",
};

function AgentQueuePage() {
  return (
    <div className="space-y-6">
      <div className="border-b pb-5">
        <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
          <Bot className="h-6 w-6 text-brand" /> Fila do Agente
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Revise ações decididas pelo agente de conversa e configure quais ações exigem aprovação antes de serem executadas.
        </p>
      </div>
      <Tabs defaultValue="queue">
        <TabsList>
          <TabsTrigger value="queue">Fila de aprovações</TabsTrigger>
          <TabsTrigger value="rules">Configurar regras</TabsTrigger>
        </TabsList>
        <TabsContent value="queue" className="mt-5">
          <QueueTab />
        </TabsContent>
        <TabsContent value="rules" className="mt-5">
          <RulesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Queue tab
// ---------------------------------------------------------------------------

function QueueTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAgentActionQueue);
  const reviewFn = useServerFn(reviewAgentAction);
  const orgsFn = useServerFn(listAllOrganizationsForRules);

  const [orgFilter, setOrgFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("pending");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["agent-queue", orgFilter, statusFilter],
    queryFn: () => listFn({ data: {
      organization_id: orgFilter === "all" ? null : orgFilter,
      status: statusFilter as any,
    } }),
    refetchInterval: 30_000,
  });

  const { data: orgs } = useQuery({
    queryKey: ["agent-queue-orgs"],
    queryFn: () => orgsFn(),
  });

  const reviewMut = useMutation({
    mutationFn: (vars: { queue_id: string; approve: boolean }) => reviewFn({ data: vars }),
    onSuccess: (_r, vars) => {
      toast.success(vars.approve ? "Ação aprovada e executada." : "Ação cancelada.");
      qc.invalidateQueries({ queryKey: ["agent-queue"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Falha"),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Org</Label>
          <Select value={orgFilter} onValueChange={setOrgFilter}>
            <SelectTrigger className="h-9 w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as organizações</SelectItem>
              {(orgs ?? []).map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="executed">Executadas</SelectItem>
              <SelectItem value="cancelled">Canceladas</SelectItem>
              <SelectItem value="failed">Falhas</SelectItem>
              <SelectItem value="all">Todas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="ml-auto">
          Atualizar
        </Button>
      </div>

      {isLoading ? (
        <div className="rounded-xl border bg-surface p-12 text-center">
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !data?.items.length ? (
        <div className="rounded-xl border bg-surface p-12 text-center text-sm text-muted-foreground">
          {statusFilter === "pending"
            ? "Nenhuma ação aguardando aprovação. O agente está operando em modo automático."
            : "Nenhum item para esse filtro."}
        </div>
      ) : (
        <div className="space-y-3">
          {data.items.map((item) => (
            <QueueCard
              key={item.id}
              item={item as any}
              busy={reviewMut.isPending}
              onApprove={() => reviewMut.mutate({ queue_id: item.id, approve: true })}
              onCancel={() => reviewMut.mutate({ queue_id: item.id, approve: false })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type QueueItem = {
  id: string;
  organization_id: string;
  conversation_id: string;
  lead_id: string;
  action_type: ActionType;
  action_params: any;
  status: "pending" | "approved" | "cancelled" | "executed" | "failed";
  error: string | null;
  created_at: string;
  org_name: string;
  lead_name: string;
  lead_company: string | null;
  channel: string | null;
};

function statusBadge(status: QueueItem["status"]) {
  if (status === "pending")   return <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"><Clock className="mr-1 h-3 w-3" /> Pendente</Badge>;
  if (status === "executed")  return <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="mr-1 h-3 w-3" /> Executada</Badge>;
  if (status === "cancelled") return <Badge variant="outline" className="text-muted-foreground"><XCircle className="mr-1 h-3 w-3" /> Cancelada</Badge>;
  if (status === "failed")    return <Badge variant="outline" className="border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300"><AlertTriangle className="mr-1 h-3 w-3" /> Falhou</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;
  return new Date(iso).toLocaleString("pt-BR");
}

function QueueCard({ item, busy, onApprove, onCancel }: {
  item: QueueItem; busy: boolean; onApprove: () => void; onCancel: () => void;
}) {
  const params = item.action_params ?? {};
  const preview = useMemo(() => {
    if (item.action_type === "responder") return params.message_text ?? "(sem mensagem)";
    if (item.action_type === "oferecer_horarios") {
      const count = params.slots_count ?? 3;
      return `${params.message_text ?? "Vou oferecer horários disponíveis"}\n(até ${count} horários da agenda)`;
    }
    if (item.action_type === "confirmar_agendamento") {
      return `Horário escolhido: ${params.chosen_slot_iso ?? "?"}\n${params.message_text ?? ""}`.trim();
    }
    if (item.action_type === "marcar_quente_humano") return `Motivo: ${params.reason ?? "—"}`;
    if (item.action_type === "encerrar_cadencia") return `Motivo: ${params.reason ?? "—"}\n${params.message_text ?? ""}`.trim();
    if (item.action_type === "ignorar") return "Mensagem inbound considerada irrelevante.";
    return JSON.stringify(params);
  }, [item]);

  return (
    <div className="rounded-xl border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="font-mono text-[0.7rem]">{ACTION_LABEL[item.action_type]}</Badge>
        {statusBadge(item.status)}
        <span className="text-xs text-muted-foreground">{timeAgo(item.created_at)}</span>
        <span className="ml-auto text-xs text-muted-foreground">{item.org_name}</span>
      </div>
      <div className="mt-2 text-sm font-medium">
        {item.lead_name}
        {item.lead_company ? <span className="text-muted-foreground"> · {item.lead_company}</span> : null}
        {item.channel ? <span className="text-muted-foreground"> · via {item.channel}</span> : null}
      </div>
      <pre className="mt-3 whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-xs text-foreground/90">
        {preview}
      </pre>
      {item.error ? (
        <div className="mt-2 text-xs text-rose-600 dark:text-rose-400">Erro: {item.error}</div>
      ) : null}
      {item.status === "pending" ? (
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={onApprove} disabled={busy}>
            <CheckCircle2 className="mr-1 h-4 w-4" /> Aprovar e executar
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel} disabled={busy}>
            <XCircle className="mr-1 h-4 w-4" /> Cancelar
          </Button>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rules tab
// ---------------------------------------------------------------------------

function RulesTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAgentActionRules);
  const upsertFn = useServerFn(upsertAgentActionRule);
  const orgsFn = useServerFn(listAllOrganizationsForRules);

  const { data, isLoading } = useQuery({
    queryKey: ["agent-action-rules"], queryFn: () => listFn(),
  });
  const { data: orgs } = useQuery({
    queryKey: ["agent-action-rules-orgs"], queryFn: () => orgsFn(),
  });

  const [selectedOrg, setSelectedOrg] = useState<string>("");

  const mut = useMutation({
    mutationFn: (vars: { organization_id: string | null; action_type: ActionType; auto_execute: boolean; enabled: boolean }) =>
      upsertFn({ data: vars }),
    onSuccess: () => {
      toast.success("Regras atualizadas — novas decisões do agente seguirão estas configurações.");
      qc.invalidateQueries({ queryKey: ["agent-action-rules"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Falha"),
  });

  if (isLoading || !data) {
    return <div className="rounded-xl border bg-surface p-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  }

  const globalMap = new Map<string, any>(data.global.map((r: any) => [r.action_type, r]));
  const orgRules = data.by_org.find((o) => o.org_id === selectedOrg);
  const orgMap = new Map<string, any>((orgRules?.rules ?? []).map((r: any) => [r.action_type, r]));

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-surface p-6">
        <h2 className="font-display text-lg font-semibold">Regras globais</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Aplicam a todas as organizações que não tenham configuração própria.
        </p>
        <div className="mt-4 divide-y">
          {ACTION_TYPES.map((at) => {
            const rule = globalMap.get(at);
            const auto = rule ? !!rule.auto_execute : true;
            const enabled = rule ? !!rule.enabled : true;
            return (
              <RuleRow key={at}
                action={at}
                auto={auto}
                enabled={enabled}
                onAutoChange={(v) => mut.mutate({ organization_id: null, action_type: at, auto_execute: v, enabled })}
                onEnabledChange={(v) => mut.mutate({ organization_id: null, action_type: at, auto_execute: auto, enabled: v })}
              />
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border bg-surface p-6">
        <h2 className="font-display text-lg font-semibold">Por organização</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sobrescreve as regras globais para uma organização específica. Ações já na fila não são afetadas.
        </p>
        <div className="mt-4 max-w-sm">
          <Select value={selectedOrg} onValueChange={setSelectedOrg}>
            <SelectTrigger><SelectValue placeholder="Selecionar organização…" /></SelectTrigger>
            <SelectContent>
              {(orgs ?? []).map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedOrg ? (
          <div className="mt-4 divide-y">
            {ACTION_TYPES.map((at) => {
              const rule = orgMap.get(at);
              const auto = rule ? !!rule.auto_execute : (globalMap.get(at) ? !!globalMap.get(at).auto_execute : true);
              const enabled = rule ? !!rule.enabled : true;
              return (
                <RuleRow key={at}
                  action={at}
                  auto={auto}
                  enabled={enabled}
                  inherited={!rule}
                  onAutoChange={(v) => mut.mutate({ organization_id: selectedOrg, action_type: at, auto_execute: v, enabled })}
                  onEnabledChange={(v) => mut.mutate({ organization_id: selectedOrg, action_type: at, auto_execute: auto, enabled: v })}
                />
              );
            })}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function RuleRow({ action, auto, enabled, inherited, onAutoChange, onEnabledChange }: {
  action: ActionType;
  auto: boolean;
  enabled: boolean;
  inherited?: boolean;
  onAutoChange: (v: boolean) => void;
  onEnabledChange: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 py-3">
      <div className="min-w-[200px]">
        <div className="text-sm font-medium">{ACTION_LABEL[action]}</div>
        {inherited ? <div className="text-[0.7rem] text-muted-foreground">(herdado da regra global)</div> : null}
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={enabled} onCheckedChange={onEnabledChange} />
        <Label className="text-xs text-muted-foreground">Ativa</Label>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Switch checked={auto} onCheckedChange={onAutoChange} disabled={!enabled} />
        <Label className="text-sm">{auto ? "Automático" : "Aguardar aprovação"}</Label>
      </div>
    </div>
  );
}
