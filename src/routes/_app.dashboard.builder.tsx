import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Save, Play, Undo2, Redo2, ZoomIn, ZoomOut, Maximize2,
  Mail, MessageCircle, Linkedin, Clock, GitBranch, Tag,
  Webhook, UserCheck, Sparkles, Filter, Plus, Workflow,
  Search, Settings2, Grip, ArrowDown, Bot, Trash2, FileText,
  Loader2, type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  listBuilderDocuments, getBuilderDocument, createBuilderDocument,
  saveBuilderDocument, publishBuilderDocument, deleteBuilderDocument,
} from "@/lib/builder.functions";

export const Route = createFileRoute("/_app/dashboard/builder")({
  component: BuilderPage,
});

// ---------------------------------------------------------------------------
// Domain
// ---------------------------------------------------------------------------

type BlockKind =
  | "trigger" | "email" | "linkedin" | "whatsapp"
  | "wait" | "condition" | "tag" | "webhook" | "handoff" | "ai";

type BlockMeta = { label: string; icon: LucideIcon; accent: string; description: string };

const BLOCK_META: Record<BlockKind, BlockMeta> = {
  trigger:   { label: "Gatilho",         icon: Sparkles,    accent: "text-brand",         description: "Início do fluxo" },
  email:     { label: "Email",           icon: Mail,        accent: "text-sky-600",       description: "Enviar email" },
  linkedin:  { label: "LinkedIn",        icon: Linkedin,    accent: "text-blue-700",      description: "Conexão ou InMail" },
  whatsapp:  { label: "WhatsApp",        icon: MessageCircle, accent: "text-emerald-600", description: "Mensagem via API" },
  wait:      { label: "Esperar",         icon: Clock,       accent: "text-amber-600",     description: "Atraso entre etapas" },
  condition: { label: "Condição",        icon: GitBranch,   accent: "text-violet-600",    description: "Bifurcação por regra" },
  tag:       { label: "Etiqueta",        icon: Tag,         accent: "text-foreground/70", description: "Add ou remove tag" },
  webhook:   { label: "Webhook",         icon: Webhook,     accent: "text-foreground/70", description: "Chamada externa" },
  handoff:   { label: "Passar p/ humano", icon: UserCheck,  accent: "text-rose-600",      description: "Encaminhar ao time" },
  ai:        { label: "Resposta IA",     icon: Bot,         accent: "text-brand",         description: "Resposta gerada por IA" },
};

const BLOCK_GROUPS: { label: string; items: BlockKind[] }[] = [
  { label: "Início", items: ["trigger"] },
  { label: "Canais", items: ["email", "linkedin", "whatsapp"] },
  { label: "Lógica", items: ["wait", "condition", "ai"] },
  { label: "Ações",  items: ["tag", "webhook", "handoff"] },
];

type CanvasNode = {
  id: string;
  kind: BlockKind;
  title: string;
  subtitle?: string | null;
};

type DocSchema = { nodes: CanvasNode[]; edges: { from: string; to: string; branch?: string | null }[] };

const EMPTY_SCHEMA: DocSchema = { nodes: [], edges: [] };

function uid() {
  return `n${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function BuilderPage() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listBuilderDocuments);
  const fetchDoc = useServerFn(getBuilderDocument);
  const createDoc = useServerFn(createBuilderDocument);
  const saveDoc = useServerFn(saveBuilderDocument);
  const publishDoc = useServerFn(publishBuilderDocument);
  const removeDoc = useServerFn(deleteBuilderDocument);

  const listQuery = useQuery({
    queryKey: ["builder", "list"],
    queryFn: () => fetchList(),
  });

  const [activeId, setActiveId] = useState<string | null>(null);
  useEffect(() => {
    if (!activeId && listQuery.data && listQuery.data.length > 0) {
      setActiveId(listQuery.data[0].id);
    }
  }, [listQuery.data, activeId]);

  const docQuery = useQuery({
    enabled: !!activeId,
    queryKey: ["builder", "doc", activeId],
    queryFn: () => fetchDoc({ data: { id: activeId! } }),
  });

  // Local editable copy
  const [name, setName] = useState("");
  const [schema, setSchema] = useState<DocSchema>(EMPTY_SCHEMA);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (docQuery.data) {
      setName(docQuery.data.name);
      const s = (docQuery.data.schema as any) ?? EMPTY_SCHEMA;
      const normalized: DocSchema = {
        nodes: Array.isArray(s.nodes) ? s.nodes : [],
        edges: Array.isArray(s.edges) ? s.edges : [],
      };
      setSchema(normalized);
      setSelectedId(normalized.nodes[0]?.id ?? null);
      setDirty(false);
    }
  }, [docQuery.data]);

  const isPublished = docQuery.data?.is_published ?? false;
  const version = docQuery.data?.version ?? 1;

  const saveMut = useMutation({
    mutationFn: () => saveDoc({ data: { id: activeId!, name, schema } }),
    onSuccess: () => {
      toast.success("Fluxo salvo.");
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["builder"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar."),
  });

  const publishMut = useMutation({
    mutationFn: (publish: boolean) => publishDoc({ data: { id: activeId!, publish } }),
    onSuccess: (_d, publish) => {
      toast.success(publish ? "Fluxo publicado." : "Fluxo despublicado.");
      qc.invalidateQueries({ queryKey: ["builder"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao publicar."),
  });

  const createMut = useMutation({
    mutationFn: (vars: { name: string; description?: string | null }) =>
      createDoc({ data: vars }),
    onSuccess: (row: any) => {
      toast.success("Fluxo criado.");
      qc.invalidateQueries({ queryKey: ["builder", "list"] });
      setActiveId(row.id);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar."),
  });

  const deleteMut = useMutation({
    mutationFn: () => removeDoc({ data: { id: activeId! } }),
    onSuccess: () => {
      toast.success("Fluxo removido.");
      setActiveId(null);
      qc.invalidateQueries({ queryKey: ["builder", "list"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao remover."),
  });

  function addNode(kind: BlockKind) {
    const M = BLOCK_META[kind];
    const node: CanvasNode = { id: uid(), kind, title: M.label, subtitle: M.description };
    setSchema((s) => ({ ...s, nodes: [...s.nodes, node] }));
    setSelectedId(node.id);
    setDirty(true);
  }

  function updateNode(id: string, patch: Partial<CanvasNode>) {
    setSchema((s) => ({
      ...s,
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    }));
    setDirty(true);
  }

  function removeNode(id: string) {
    setSchema((s) => ({ ...s, nodes: s.nodes.filter((n) => n.id !== id) }));
    if (selectedId === id) setSelectedId(null);
    setDirty(true);
  }

  const selected = useMemo(
    () => schema.nodes.find((n) => n.id === selectedId) ?? null,
    [schema, selectedId],
  );

  // ----- empty list state -----
  if (listQuery.isLoading) {
    return (
      <div className="grid h-[60vh] place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!activeId && (listQuery.data?.length ?? 0) === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Builder"
          description="Construa fluxos de automação visuais, multicanal, com lógica condicional."
        />
        <EmptyState
          icon={Workflow}
          title="Nenhum fluxo ainda"
          description="Crie seu primeiro fluxo de automação para começar a engajar leads em escala."
          action={<NewDocDialog onCreate={(p) => createMut.mutate(p)} pending={createMut.isPending} />}
        />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] min-h-[640px] flex-col gap-4">
      <PageHeader
        title="Builder"
        description="Construa fluxos de automação visuais, multicanal, com lógica condicional."
        actions={
          <>
            <div className="min-w-[220px]">
              <Select value={activeId ?? undefined} onValueChange={(v) => setActiveId(v)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecionar fluxo" />
                </SelectTrigger>
                <SelectContent>
                  {(listQuery.data ?? []).map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>
                      <span className="inline-flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        {d.name}
                        {d.is_published && (
                          <span className="text-[0.65rem] uppercase tracking-wider text-emerald-600">publicado</span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <NewDocDialog onCreate={(p) => createMut.mutate(p)} pending={createMut.isPending} />
            <Badge variant="secondary" className={cn(
              "border-transparent font-normal",
              isPublished ? "bg-emerald-500/10 text-emerald-700" : "bg-brand-soft text-brand"
            )}>
              {isPublished ? "Publicado" : "Rascunho"} · v{version}
              {dirty && " · alterações não salvas"}
            </Badge>
            <Button variant="outline" disabled={!dirty || saveMut.isPending} onClick={() => saveMut.mutate()}>
              {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </Button>
            <Button
              disabled={publishMut.isPending || dirty}
              onClick={() => publishMut.mutate(!isPublished)}
              title={dirty ? "Salve antes de publicar" : undefined}
            >
              <Play className="h-4 w-4" />
              {isPublished ? "Despublicar" : "Publicar"}
            </Button>
          </>
        }
      />

      {docQuery.isLoading || !activeId ? (
        <div className="grid flex-1 place-items-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="grid flex-1 min-h-0 gap-4 lg:grid-cols-[260px_minmax(0,1fr)_320px]">
          <BlocksPanel onAdd={addNode} />
          <Canvas
            nodes={schema.nodes}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onAddDefault={() => addNode("email")}
          />
          <Inspector
            node={selected}
            docName={name}
            onDocName={(v) => { setName(v); setDirty(true); }}
            onUpdate={updateNode}
            onRemove={removeNode}
            onDeleteDoc={() => {
              if (confirm("Remover este fluxo? Esta ação não pode ser desfeita.")) deleteMut.mutate();
            }}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// New document dialog
// ---------------------------------------------------------------------------

function NewDocDialog({
  onCreate, pending,
}: { onCreate: (p: { name: string; description?: string | null }) => void; pending: boolean }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="h-4 w-4" />
          Novo fluxo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo fluxo</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="b-name">Nome</Label>
            <Input id="b-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Cadência outbound SaaS" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-desc">Descrição (opcional)</Label>
            <Textarea id="b-desc" value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            disabled={!name.trim() || pending}
            onClick={() => {
              onCreate({ name: name.trim(), description: desc.trim() || null });
              setOpen(false);
              setName(""); setDesc("");
            }}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Left: Blocks palette
// ---------------------------------------------------------------------------

function BlocksPanel({ onAdd }: { onAdd: (k: BlockKind) => void }) {
  return (
    <aside className="flex min-h-0 flex-col rounded-xl border bg-surface">
      <div className="border-b p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar bloco…" className="h-8 pl-8 text-xs" />
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-4 p-3">
          {BLOCK_GROUPS.map((g) => (
            <div key={g.label}>
              <div className="label-exec mb-2 px-1">{g.label}</div>
              <div className="space-y-1">
                {g.items.map((k) => {
                  const M = BLOCK_META[k];
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => onAdd(k)}
                      className="group flex w-full items-center gap-2.5 rounded-md border border-transparent bg-surface p-2 text-left transition-colors hover:border-border hover:bg-surface-muted/60"
                    >
                      <span className={cn("grid h-7 w-7 place-items-center rounded-md border bg-surface-muted/40", M.accent)}>
                        <M.icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium">{M.label}</div>
                        <div className="truncate text-2xs text-muted-foreground">{M.description}</div>
                      </div>
                      <Plus className="h-3.5 w-3.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100" />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------

function Canvas({
  nodes, selectedId, onSelect, onAddDefault,
}: {
  nodes: CanvasNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddDefault: () => void;
}) {
  return (
    <section className="relative flex min-h-0 flex-col overflow-hidden rounded-xl border bg-surface">
      <div className="flex items-center justify-between border-b bg-surface-muted/40 px-3 py-2">
        <div className="flex items-center gap-1">
          <ToolbarBtn icon={Undo2} />
          <ToolbarBtn icon={Redo2} />
          <div className="mx-1 h-5 w-px bg-border" />
          <ToolbarBtn icon={Filter} label="Validar" />
          <ToolbarBtn icon={Workflow} label="Auto-organizar" />
        </div>
        <div className="flex items-center gap-1">
          <ToolbarBtn icon={ZoomOut} />
          <span className="px-1.5 text-xs text-muted-foreground">100%</span>
          <ToolbarBtn icon={ZoomIn} />
          <div className="mx-1 h-5 w-px bg-border" />
          <ToolbarBtn icon={Maximize2} />
        </div>
      </div>

      <div
        className="relative flex-1 overflow-auto"
        style={{
          backgroundImage: "radial-gradient(circle, oklch(0 0 0 / 6%) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      >
        {nodes.length === 0 ? (
          <div className="flex h-full items-center justify-center p-8">
            <div className="max-w-sm text-center">
              <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-md bg-surface-muted text-muted-foreground">
                <Workflow className="h-4 w-4" />
              </div>
              <div className="text-sm font-medium">Canvas vazio</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Adicione blocos pela coluna da esquerda para começar.
              </div>
              <Button size="sm" className="mt-4" onClick={onAddDefault}>
                <Plus className="h-3.5 w-3.5" />
                Adicionar primeiro passo
              </Button>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-md flex-col items-center gap-0 py-12">
            {nodes.map((n, i) => (
              <div key={n.id} className="flex w-full flex-col items-center">
                <FlowNode node={n} selected={n.id === selectedId} onClick={() => onSelect(n.id)} />
                {i < nodes.length - 1 && <Connector />}
              </div>
            ))}
            <Connector />
            <button
              onClick={onAddDefault}
              className="group flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong bg-surface/60 px-4 py-4 text-sm text-muted-foreground transition-colors hover:border-brand hover:bg-brand-soft/30 hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
              Adicionar próximo passo
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function ToolbarBtn({ icon: Icon, label }: { icon: LucideIcon; label?: string }) {
  return (
    <button className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-surface hover:text-foreground">
      <Icon className="h-3.5 w-3.5" />
      {label && <span>{label}</span>}
    </button>
  );
}

function Connector() {
  return (
    <div className="flex h-8 flex-col items-center">
      <div className="h-full w-px bg-border-strong" />
      <ArrowDown className="-mt-1.5 h-3 w-3 text-border-strong" />
    </div>
  );
}

function FlowNode({
  node, selected, onClick,
}: { node: CanvasNode; selected: boolean; onClick: () => void }) {
  const M = BLOCK_META[node.kind];
  const isTrigger = node.kind === "trigger";
  return (
    <button
      onClick={onClick}
      className={cn(
        "group w-full rounded-xl border bg-surface text-left shadow-sm transition-all",
        "hover:shadow-md hover:-translate-y-px",
        selected ? "border-brand ring-2 ring-brand/20" : "border-border",
        isTrigger && "border-brand/40",
      )}
    >
      <div className="flex items-center gap-2.5 border-b px-3 py-2">
        <span className={cn("grid h-7 w-7 place-items-center rounded-md border bg-surface-muted/40", M.accent)}>
          <M.icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-2xs uppercase tracking-wider text-muted-foreground">{M.label}</div>
        </div>
        <Grip className="h-3.5 w-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100" />
      </div>
      <div className="px-3 py-3">
        <div className="text-sm font-medium leading-snug">{node.title}</div>
        {node.subtitle && <div className="mt-1 text-xs text-muted-foreground">{node.subtitle}</div>}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Inspector
// ---------------------------------------------------------------------------

function Inspector({
  node, docName, onDocName, onUpdate, onRemove, onDeleteDoc,
}: {
  node: CanvasNode | null;
  docName: string;
  onDocName: (v: string) => void;
  onUpdate: (id: string, patch: Partial<CanvasNode>) => void;
  onRemove: (id: string) => void;
  onDeleteDoc: () => void;
}) {
  return (
    <aside className="flex min-h-0 flex-col rounded-xl border bg-surface">
      <div className="border-b p-3 space-y-2">
        <Label className="label-exec">Nome do fluxo</Label>
        <Input value={docName} onChange={(e) => onDocName(e.target.value)} className="h-8 text-xs" />
      </div>
      {!node ? (
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-surface-muted text-muted-foreground">
            <Settings2 className="h-4 w-4" />
          </div>
          <div className="mt-3 text-sm font-medium">Nenhum bloco selecionado</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Clique em um nó do fluxo para editar suas propriedades.
          </div>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="space-y-5 p-4">
            <div className="space-y-1.5">
              <Label className="label-exec">Título do passo</Label>
              <Input
                value={node.title}
                onChange={(e) => onUpdate(node.id, { title: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="label-exec">Descrição</Label>
              <Textarea
                value={node.subtitle ?? ""}
                onChange={(e) => onUpdate(node.id, { subtitle: e.target.value })}
                rows={3}
                className="text-xs"
              />
            </div>
            <Button variant="outline" size="sm" className="w-full text-destructive" onClick={() => onRemove(node.id)}>
              <Trash2 className="h-3.5 w-3.5" />
              Remover bloco
            </Button>
            <div className="rounded-md border border-dashed border-border-strong bg-surface-muted/20 p-3 text-xs text-muted-foreground">
              <Sparkles className="mr-1 inline h-3 w-3 text-brand" />
              Configurações avançadas chegam nas próximas fases.
            </div>
          </div>
        </ScrollArea>
      )}
      <div className="border-t p-3">
        <Button variant="ghost" size="sm" className="w-full text-destructive hover:text-destructive" onClick={onDeleteDoc}>
          <Trash2 className="h-3.5 w-3.5" />
          Excluir fluxo
        </Button>
      </div>
    </aside>
  );
}
