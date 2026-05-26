import { useNavigate, useBlocker } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Handle,
  Position,
  useReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ArrowLeft,
  Save,
  Play,
  Mail,
  Clock,
  GitBranch,
  MessageCircle,
  Linkedin,
  Zap,
  MoreVertical,
  Trash2,
  X,
  RotateCcw,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { cn } from "@/lib/utils";
import {
  getBuilderDocument,
  saveBuilderDocument,
  publishBuilderDocument,
  revertToDraft,
  renameBuilderDocument,
  deleteBuilderDocument,
} from "@/lib/builder.functions";

export default function BuilderEditorPage({ documentId }: { documentId: string }) {
  return (
    <ReactFlowProvider>
      <BuilderEditorInner documentId={documentId} />
    </ReactFlowProvider>
  );
}


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StepType =
  | "message_email"
  | "message_whatsapp"
  | "message_linkedin"
  | "wait"
  | "condition_replied"
  | "action";

type StepData = {
  config: Record<string, any>;
  is_entry: boolean;
  errorMessage?: string;
};

type StepNode = Node<StepData, StepType>;

const COLORS = {
  entry: "#0ea5e9",
  yes: "#10b981",
  no: "#ef4444",
  edge: "#94a3b8",
  card: "#ffffff",
  border: "#e2e8f0",
  borderError: "#ef4444",
  text: "#0f172a",
  muted: "#64748b",
};

const PALETTE: Array<{
  type: StepType;
  label: string;
  icon: any;
  enabled: boolean;
}> = [
  { type: "message_email", label: "Email", icon: Mail, enabled: true },
  { type: "wait", label: "Aguardar", icon: Clock, enabled: true },
  { type: "condition_replied", label: "Condição: respondeu?", icon: GitBranch, enabled: true },
  { type: "message_whatsapp", label: "WhatsApp", icon: MessageCircle, enabled: false },
  { type: "message_linkedin", label: "LinkedIn", icon: Linkedin, enabled: false },
  { type: "action", label: "Ação", icon: Zap, enabled: false },
];

const DEFAULT_CONFIG: Record<StepType, Record<string, any>> = {
  message_email: { subject: "", body_html: "", from_alias: "" },
  message_whatsapp: { body: "" },
  message_linkedin: { message_type: "message", body: "" },
  wait: { duration_value: 1, duration_unit: "days" },
  condition_replied: { scope: "any_channel", timeout_value: 3, timeout_unit: "days" },
  action: { action_type: "set_status", params: {} },
};

function newId() {
  // RFC4122 v4
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ---------------------------------------------------------------------------
// Node Components
// ---------------------------------------------------------------------------

function NodeShell({
  children,
  selected,
  isEntry,
  hasError,
}: {
  children: React.ReactNode;
  selected?: boolean;
  isEntry?: boolean;
  hasError?: boolean;
}) {
  return (
    <div
      style={{
        width: 240,
        background: COLORS.card,
        border: `2px solid ${
          hasError ? COLORS.borderError : selected ? COLORS.entry : COLORS.border
        }`,
        borderRadius: 12,
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        color: COLORS.text,
        position: "relative",
      }}
    >
      {isEntry && (
        <div
          style={{
            position: "absolute",
            top: -10,
            left: 8,
            background: COLORS.entry,
            color: "#fff",
            fontSize: 10,
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: 6,
            letterSpacing: 0.4,
          }}
        >
          INÍCIO
        </div>
      )}
      {children}
    </div>
  );
}

function NodeHeader({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 12px",
        borderBottom: `1px solid ${COLORS.border}`,
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      <Icon size={14} />
      <span>{label}</span>
    </div>
  );
}

function EmailStepNode({ data, selected }: NodeProps<StepNode>) {
  const cfg = data.config as { subject?: string; body_html?: string };
  const isComplete = !!cfg.subject?.trim() && !!cfg.body_html?.trim();
  return (
    <NodeShell selected={selected} isEntry={data.is_entry} hasError={!!data.errorMessage}>
      <Handle type="target" position={Position.Left} style={{ background: COLORS.edge }} />
      <NodeHeader icon={Mail} label="Email" />
      <div style={{ padding: "10px 12px", fontSize: 12, color: COLORS.text }}>
        <div
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: cfg.subject ? COLORS.text : COLORS.muted,
            fontStyle: cfg.subject ? "normal" : "italic",
          }}
        >
          {cfg.subject || "Sem assunto"}
        </div>
        <div
          style={{
            marginTop: 8,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11,
            padding: "2px 6px",
            borderRadius: 4,
            background: isComplete ? "#dcfce7" : "#fef3c7",
            color: isComplete ? "#166534" : "#92400e",
          }}
        >
          {isComplete ? "✓ Pronto" : "⚠ Incompleto"}
        </div>
      </div>
      <Handle type="source" position={Position.Right} style={{ background: COLORS.edge }} />
    </NodeShell>
  );
}

function WaitStepNode({ data, selected }: NodeProps<StepNode>) {
  const cfg = data.config as { duration_value?: number; duration_unit?: string };
  const unitLabel: Record<string, string> = {
    minutes: "minutos",
    hours: "horas",
    days: "dias",
    business_days: "dias úteis",
  };
  return (
    <NodeShell selected={selected} isEntry={data.is_entry} hasError={!!data.errorMessage}>
      <Handle type="target" position={Position.Left} style={{ background: COLORS.edge }} />
      <NodeHeader icon={Clock} label="Aguardar" />
      <div
        style={{
          padding: "16px 12px",
          fontSize: 20,
          fontWeight: 700,
          textAlign: "center",
        }}
      >
        {cfg.duration_value ?? 0} {unitLabel[cfg.duration_unit ?? "days"] ?? ""}
      </div>
      <Handle type="source" position={Position.Right} style={{ background: COLORS.edge }} />
    </NodeShell>
  );
}

function ConditionRepliedNode({ data, selected }: NodeProps<StepNode>) {
  const cfg = data.config as { scope?: string; timeout_value?: number; timeout_unit?: string };
  const scopeLabel: Record<string, string> = {
    any_channel: "qualquer canal",
    email: "email",
    whatsapp: "whatsapp",
    linkedin: "linkedin",
  };
  return (
    <NodeShell selected={selected} isEntry={data.is_entry} hasError={!!data.errorMessage}>
      <Handle type="target" position={Position.Left} style={{ background: COLORS.edge }} />
      <NodeHeader icon={GitBranch} label="Respondeu?" />
      <div style={{ padding: "10px 12px", fontSize: 11, color: COLORS.muted }}>
        Em até {cfg.timeout_value ?? 0} {cfg.timeout_unit ?? "dias"} via{" "}
        {scopeLabel[cfg.scope ?? "any_channel"]}
      </div>
      <div style={{ display: "flex", borderTop: `1px solid ${COLORS.border}` }}>
        <div
          style={{
            flex: 1,
            textAlign: "center",
            padding: "6px 0",
            fontSize: 11,
            fontWeight: 600,
            color: COLORS.yes,
            borderRight: `1px solid ${COLORS.border}`,
            position: "relative",
          }}
        >
          Sim
        </div>
        <div
          style={{
            flex: 1,
            textAlign: "center",
            padding: "6px 0",
            fontSize: 11,
            fontWeight: 600,
            color: COLORS.no,
            position: "relative",
          }}
        >
          Não
        </div>
      </div>
      <Handle
        type="source"
        id="yes"
        position={Position.Right}
        style={{ top: "75%", background: COLORS.yes }}
      />
      <Handle
        type="source"
        id="no"
        position={Position.Right}
        style={{ top: "92%", background: COLORS.no }}
      />
    </NodeShell>
  );
}

const nodeTypes = {
  message_email: EmailStepNode,
  wait: WaitStepNode,
  condition_replied: ConditionRepliedNode,
} as any;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function BuilderEditorPage() {
  return (
    <ReactFlowProvider>
      <BuilderEditorInner />
    </ReactFlowProvider>
  );
}

function BuilderEditorInner() {
  const { documentId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchFn = useServerFn(getBuilderDocument);
  const saveFn = useServerFn(saveBuilderDocument);
  const publishFn = useServerFn(publishBuilderDocument);
  const revertFn = useServerFn(revertToDraft);
  const renameFn = useServerFn(renameBuilderDocument);
  const deleteFn = useServerFn(deleteBuilderDocument);

  const { data, isLoading, error } = useQuery({
    queryKey: ["builder-document", documentId],
    queryFn: () => fetchFn({ data: { id: documentId } }),
  });

  const [nodes, setNodes, onNodesChange] = useNodesState<StepNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [docName, setDocName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  // Hydrate from server
  useEffect(() => {
    if (!data) return;
    const doc = (data as any).document;
    const srvSteps = (data as any).steps as any[];
    const srvTr = (data as any).transitions as any[];
    setDocName(doc.name);
    setStatus(doc.status);
    setLastSavedAt(new Date(doc.updated_at));
    setNodes(
      srvSteps.map((s) => ({
        id: s.id,
        type: s.type,
        position: { x: s.position_x, y: s.position_y },
        data: { config: s.config ?? {}, is_entry: !!s.is_entry },
      })) as StepNode[],
    );
    setEdges(
      srvTr.map((t) => ({
        id: t.id,
        source: t.from_step_id,
        target: t.to_step_id,
        sourceHandle: t.branch === "next" ? null : t.branch,
        type: "smoothstep",
        label: t.branch === "yes" ? "Sim" : t.branch === "no" ? "Não" : undefined,
        style: {
          stroke:
            t.branch === "yes"
              ? COLORS.yes
              : t.branch === "no"
              ? COLORS.no
              : COLORS.edge,
          strokeWidth: 2,
        },
        labelStyle: {
          fill: t.branch === "yes" ? COLORS.yes : t.branch === "no" ? COLORS.no : COLORS.edge,
          fontWeight: 600,
        },
      })),
    );
    setDirty(false);
  }, [data, setNodes, setEdges]);

  // Track changes
  const markDirty = useCallback(() => setDirty(true), []);
  const handleNodesChange = useCallback(
    (changes: any) => {
      onNodesChange(changes);
      if (changes.some((c: any) => c.type === "position" && c.dragging === false)) {
        markDirty();
      } else if (changes.some((c: any) => c.type !== "select" && c.type !== "dimensions")) {
        markDirty();
      }
    },
    [onNodesChange, markDirty],
  );
  const handleEdgesChange = useCallback(
    (changes: any) => {
      onEdgesChange(changes);
      if (changes.some((c: any) => c.type !== "select")) markDirty();
    },
    [onEdgesChange, markDirty],
  );

  const onConnect = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target) return;
      if (conn.source === conn.target) {
        toast.error("Auto-conexão não é permitida.");
        return;
      }
      const sourceNode = nodes.find((n) => n.id === conn.source);
      const isCondition = sourceNode?.type === "condition_replied";
      let branch: "next" | "yes" | "no" = "next";
      if (isCondition) {
        branch = (conn.sourceHandle as "yes" | "no") ?? "yes";
      }
      // Check if branch already used
      const existing = edges.find(
        (e) =>
          e.source === conn.source &&
          ((e.sourceHandle ?? "next") === branch),
      );
      if (existing) {
        if (!confirm(`Já existe uma conexão "${branch}" saindo deste passo. Substituir?`)) return;
        setEdges((eds) => eds.filter((e) => e.id !== existing.id));
      }
      const newEdge: Edge = {
        id: newId(),
        source: conn.source,
        target: conn.target,
        sourceHandle: branch === "next" ? null : branch,
        type: "smoothstep",
        label: branch === "yes" ? "Sim" : branch === "no" ? "Não" : undefined,
        style: {
          stroke:
            branch === "yes" ? COLORS.yes : branch === "no" ? COLORS.no : COLORS.edge,
          strokeWidth: 2,
        },
        labelStyle: {
          fill: branch === "yes" ? COLORS.yes : branch === "no" ? COLORS.no : COLORS.edge,
          fontWeight: 600,
        },
      };
      setEdges((eds) => addEdge(newEdge, eds));
      markDirty();
    },
    [nodes, edges, setEdges, markDirty],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData("application/step-type") as StepType;
      if (!type) return;
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const id = newId();
      const node: StepNode = {
        id,
        type,
        position,
        data: { config: { ...DEFAULT_CONFIG[type] }, is_entry: false },
      };
      setNodes((nds) => [...nds, node]);
      setSelectedId(id);
      markDirty();
    },
    [screenToFlowPosition, setNodes, markDirty],
  );

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedId(node.id);
  }, []);

  const updateSelectedConfig = useCallback(
    (patch: Record<string, any>) => {
      if (!selectedId) return;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === selectedId
            ? { ...n, data: { ...n.data, config: { ...n.data.config, ...patch } } }
            : n,
        ),
      );
      markDirty();
    },
    [selectedId, setNodes, markDirty],
  );

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    const node = nodes.find((n) => n.id === selectedId);
    if (!node) return;
    if (node.data.is_entry && nodes.length === 1) {
      toast.error("Não é possível remover o único passo inicial.");
      return;
    }
    const hasConfig = Object.values(node.data.config ?? {}).some(
      (v) => v !== "" && v != null && v !== 0,
    );
    if (hasConfig && !confirm("Remover este passo? A configuração será perdida.")) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedId));
    setEdges((eds) => eds.filter((e) => e.source !== selectedId && e.target !== selectedId));
    setSelectedId(null);
    markDirty();
  }, [selectedId, nodes, setNodes, setEdges, markDirty]);

  // Convert state to server payload
  const buildPayload = useCallback(() => {
    const steps = nodes.map((n) => ({
      id: n.id,
      type: n.type as StepType,
      position_x: n.position.x,
      position_y: n.position.y,
      config: n.data.config ?? {},
      is_entry: n.data.is_entry,
    }));
    const transitions = edges.map((e) => ({
      id: e.id,
      from_step_id: e.source,
      to_step_id: e.target,
      branch: ((e.sourceHandle as string) ?? "next") as "next" | "yes" | "no",
    }));
    return { steps, transitions };
  }, [nodes, edges]);

  const saveMutation = useMutation({
    mutationFn: () => saveFn({ data: { document_id: documentId, ...buildPayload() } as any }),
    onSuccess: (res: any) => {
      if (res?.ok === false) {
        applyErrors(res.errors);
        toast.error("Corrija os passos destacados antes de salvar.");
        return;
      }
      toast.success("Fluxo salvo.");
      setLastSavedAt(new Date());
      setDirty(false);
      clearErrors();
      queryClient.invalidateQueries({ queryKey: ["builder-document", documentId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (dirty) {
        const res: any = await saveFn({
          data: { document_id: documentId, ...buildPayload() } as any,
        });
        if (res?.ok === false) return res;
        setLastSavedAt(new Date());
        setDirty(false);
      }
      return publishFn({ data: { id: documentId } });
    },
    onSuccess: (res: any) => {
      if (res?.ok === false) {
        applyErrors(res.errors);
        toast.error("Corrija os passos destacados antes de publicar.");
        return;
      }
      setStatus("published");
      clearErrors();
      toast.success("Fluxo publicado.");
      queryClient.invalidateQueries({ queryKey: ["builder-document", documentId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revertMutation = useMutation({
    mutationFn: () => revertFn({ data: { id: documentId } }),
    onSuccess: () => {
      setStatus("draft");
      toast.success("Revertido para rascunho.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const renameMutation = useMutation({
    mutationFn: (name: string) => renameFn({ data: { id: documentId, name } }),
    onSuccess: () => toast.success("Nome atualizado."),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteFn({ data: { id: documentId } }),
    onSuccess: () => {
      toast.success("Fluxo excluído.");
      navigate({ to: "/dashboard/campaigns" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function applyErrors(errs: Array<{ step_id: string | null; message: string }>) {
    const byId = new Map<string, string>();
    for (const e of errs) {
      if (e.step_id) byId.set(e.step_id, e.message);
    }
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, errorMessage: byId.get(n.id) },
      })),
    );
  }
  function clearErrors() {
    setNodes((nds) =>
      nds.map((n) => ({ ...n, data: { ...n.data, errorMessage: undefined } })),
    );
  }

  // Block navigation when dirty
  useBlocker({
    shouldBlockFn: () => {
      if (!dirty) return false;
      return !confirm("Você tem alterações não salvas. Deseja sair?");
    },
  });
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // Keyboard delete
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        const target = e.target as HTMLElement;
        if (["INPUT", "TEXTAREA"].includes(target.tagName)) return;
        deleteSelected();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, deleteSelected]);

  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null;

  if (isLoading) {
    return (
      <div className="grid h-[80vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="grid h-[80vh] place-items-center text-sm text-destructive">
        {(error as Error).message}
      </div>
    );
  }

  const campaignId = (data as any)?.document?.campaign_id as string | null;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Topbar */}
      <div className="flex items-center gap-3 border-b bg-surface px-4 py-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() =>
            navigate({
              to: campaignId ? "/dashboard/campaigns" : "/dashboard/builder",
            })
          }
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        {editingName ? (
          <Input
            autoFocus
            value={docName}
            onChange={(e) => setDocName(e.target.value)}
            onBlur={() => {
              setEditingName(false);
              if (docName.trim()) renameMutation.mutate(docName.trim());
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="h-8 w-72"
          />
        ) : (
          <button
            onClick={() => setEditingName(true)}
            className="font-display text-base font-semibold hover:underline"
          >
            {docName || "Sem nome"}
          </button>
        )}
        <span
          className={cn(
            "rounded-md px-2 py-0.5 text-xs font-medium",
            status === "published"
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "bg-muted text-muted-foreground",
          )}
        >
          {status === "published" ? "Publicado" : "Rascunho"}
        </span>
        <span className="text-xs text-muted-foreground">
          {dirty
            ? "• alterações não salvas"
            : lastSavedAt
            ? `Salvo ${formatRelative(lastSavedAt)}`
            : ""}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={!dirty || saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => publishMutation.mutate()}
            disabled={publishMutation.isPending}
          >
            {publishMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Publicar
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditingName(true)}>
                Renomear
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => revertMutation.mutate()}
                disabled={status !== "published"}
              >
                <RotateCcw className="h-4 w-4" /> Reverter para rascunho
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => {
                  if (confirm("Excluir este fluxo? A ação não pode ser desfeita.")) {
                    deleteMutation.mutate();
                  }
                }}
              >
                <Trash2 className="h-4 w-4" /> Excluir documento
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Body: palette + canvas + panel */}
      <div className="flex min-h-0 flex-1">
        {/* Palette */}
        <aside className="w-[220px] shrink-0 border-r bg-surface p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Adicionar passo
          </h3>
          <div className="space-y-2">
            {PALETTE.map((p) => (
              <div
                key={p.type}
                draggable={p.enabled}
                onDragStart={(e) => {
                  if (!p.enabled) return;
                  e.dataTransfer.setData("application/step-type", p.type);
                  e.dataTransfer.effectAllowed = "move";
                }}
                className={cn(
                  "flex cursor-grab items-center gap-2 rounded-lg border bg-background p-2.5 text-sm",
                  !p.enabled && "cursor-not-allowed opacity-50",
                )}
              >
                <p.icon className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 truncate">{p.label}</span>
                {!p.enabled && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    Em breve
                  </span>
                )}
              </div>
            ))}
          </div>
        </aside>

        {/* Canvas */}
        <div ref={wrapperRef} className="relative flex-1" onDrop={onDrop} onDragOver={onDragOver}>
          {nodes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center text-sm text-muted-foreground">
              Arraste um passo da paleta lateral para começar
            </div>
          )}
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
            onNodeClick={handleNodeClick}
            onPaneClick={() => setSelectedId(null)}
            nodeTypes={nodeTypes}
            minZoom={0.4}
            maxZoom={1.5}
            fitView
            panOnDrag
            zoomOnScroll
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#cbd5e1" />
            <Controls position="bottom-right" />
            <MiniMap position="bottom-left" pannable />
          </ReactFlow>
        </div>

        {/* Right panel */}
        {selectedNode && (
          <aside className="w-[340px] shrink-0 overflow-y-auto border-l bg-surface p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold">Configuração</h3>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={deleteSelected}
                  className="h-7 w-7 text-destructive"
                  title="Remover passo"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedId(null)}
                  className="h-7 w-7"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            {selectedNode.data.errorMessage && (
              <div className="mb-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{selectedNode.data.errorMessage}</span>
              </div>
            )}
            <ConfigPanel
              node={selectedNode}
              onChange={updateSelectedConfig}
            />
          </aside>
        )}
      </div>
    </div>
  );
}

function formatRelative(d: Date) {
  const diff = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diff < 1) return "agora";
  if (diff < 60) return `há ${diff} min`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `há ${h}h`;
  return d.toLocaleDateString("pt-BR");
}

// ---------------------------------------------------------------------------
// Config panels
// ---------------------------------------------------------------------------

const EMAIL_VARS = [
  "{{ lead.full_name }}",
  "{{ lead.first_name }}",
  "{{ lead.company_name }}",
  "{{ org.name }}",
];

function ConfigPanel({
  node,
  onChange,
}: {
  node: StepNode;
  onChange: (patch: Record<string, any>) => void;
}) {
  if (node.type === "message_email") return <EmailPanel node={node} onChange={onChange} />;
  if (node.type === "wait") return <WaitPanel node={node} onChange={onChange} />;
  if (node.type === "condition_replied")
    return <ConditionPanel node={node} onChange={onChange} />;
  return <p className="text-sm text-muted-foreground">Sem editor disponível.</p>;
}

function EmailPanel({
  node,
  onChange,
}: {
  node: StepNode;
  onChange: (patch: Record<string, any>) => void;
}) {
  const cfg = node.data.config as { subject?: string; body_html?: string; from_alias?: string };
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  function insertVar(v: string) {
    const el = bodyRef.current;
    if (!el) {
      onChange({ body_html: (cfg.body_html ?? "") + v });
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = (cfg.body_html ?? "").slice(0, start) + v + (cfg.body_html ?? "").slice(end);
    onChange({ body_html: next });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + v.length, start + v.length);
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="email-subject">Assunto</Label>
        <Input
          id="email-subject"
          value={cfg.subject ?? ""}
          onChange={(e) => onChange({ subject: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email-from">Remetente (alias)</Label>
        <Input
          id="email-from"
          value={cfg.from_alias ?? ""}
          onChange={(e) => onChange({ from_alias: e.target.value })}
          placeholder="padrão da org"
        />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>Corpo (HTML)</Label>
          <div className="flex rounded-md border text-xs">
            <button
              onClick={() => setMode("edit")}
              className={cn(
                "px-2 py-0.5",
                mode === "edit" && "bg-muted font-medium",
              )}
            >
              Editar
            </button>
            <button
              onClick={() => setMode("preview")}
              className={cn(
                "px-2 py-0.5",
                mode === "preview" && "bg-muted font-medium",
              )}
            >
              Preview
            </button>
          </div>
        </div>
        {mode === "edit" ? (
          <Textarea
            ref={bodyRef}
            rows={10}
            value={cfg.body_html ?? ""}
            onChange={(e) => onChange({ body_html: e.target.value })}
            className="font-mono text-xs"
          />
        ) : (
          <iframe
            sandbox=""
            srcDoc={cfg.body_html ?? "<em>vazio</em>"}
            className="h-56 w-full rounded-md border bg-white"
          />
        )}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Variáveis disponíveis</Label>
        <div className="flex flex-wrap gap-1">
          {EMAIL_VARS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => insertVar(v)}
              className="rounded-md border bg-background px-1.5 py-0.5 text-[10px] font-mono hover:bg-muted"
            >
              {v}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function WaitPanel({
  node,
  onChange,
}: {
  node: StepNode;
  onChange: (patch: Record<string, any>) => void;
}) {
  const cfg = node.data.config as { duration_value?: number; duration_unit?: string };
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="wait-dur">Duração</Label>
        <Input
          id="wait-dur"
          type="number"
          min={1}
          value={cfg.duration_value ?? 1}
          onChange={(e) => onChange({ duration_value: Number(e.target.value) })}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Unidade</Label>
        <Select
          value={cfg.duration_unit ?? "days"}
          onValueChange={(v) => onChange({ duration_unit: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="minutes">Minutos</SelectItem>
            <SelectItem value="hours">Horas</SelectItem>
            <SelectItem value="days">Dias</SelectItem>
            <SelectItem value="business_days">Dias úteis</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground">
        Aguardar este tempo antes de seguir para o próximo passo.
      </p>
    </div>
  );
}

function ConditionPanel({
  node,
  onChange,
}: {
  node: StepNode;
  onChange: (patch: Record<string, any>) => void;
}) {
  const cfg = node.data.config as {
    scope?: string;
    timeout_value?: number;
    timeout_unit?: string;
  };
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Canal</Label>
        <Select
          value={cfg.scope ?? "any_channel"}
          onValueChange={(v) => onChange({ scope: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any_channel">Qualquer canal</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="linkedin">LinkedIn</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cond-window">Janela de tempo</Label>
        <Input
          id="cond-window"
          type="number"
          min={1}
          value={cfg.timeout_value ?? 1}
          onChange={(e) => onChange({ timeout_value: Number(e.target.value) })}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Unidade</Label>
        <Select
          value={cfg.timeout_unit ?? "days"}
          onValueChange={(v) => onChange({ timeout_unit: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hours">Horas</SelectItem>
            <SelectItem value="days">Dias</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground">
        Se o lead responder neste canal dentro do tempo, segue por "Sim". Caso contrário,
        "Não".
      </p>
    </div>
  );
}
