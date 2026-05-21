import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Save,
  Play,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Mail,
  MessageCircle,
  Linkedin,
  Clock,
  GitBranch,
  Tag,
  Webhook,
  UserCheck,
  Sparkles,
  Filter,
  Plus,
  Workflow,
  Search,
  Settings2,
  Grip,
  ArrowDown,
  Bot,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/dashboard/builder")({
  component: BuilderPage,
});

// ---------------------------------------------------------------------------
// Domain
// ---------------------------------------------------------------------------

type BlockKind =
  | "trigger" | "email" | "linkedin" | "whatsapp"
  | "wait" | "condition" | "tag" | "webhook" | "handoff" | "ai";

type BlockMeta = {
  label: string;
  icon: LucideIcon;
  accent: string;        // dot / icon color class
  description: string;
};

const BLOCK_META: Record<BlockKind, BlockMeta> = {
  trigger:   { label: "Gatilho",         icon: Sparkles,    accent: "text-brand",                   description: "Início do fluxo · novo lead, importação, webhook" },
  email:     { label: "Email",           icon: Mail,        accent: "text-sky-600",                 description: "Enviar mensagem por email" },
  linkedin:  { label: "LinkedIn",        icon: Linkedin,    accent: "text-blue-700",                description: "Conexão ou InMail" },
  whatsapp:  { label: "WhatsApp",        icon: MessageCircle, accent: "text-emerald-600",           description: "Mensagem via API oficial" },
  wait:      { label: "Esperar",         icon: Clock,       accent: "text-amber-600",               description: "Atraso entre etapas" },
  condition: { label: "Condição",        icon: GitBranch,   accent: "text-violet-600",              description: "Bifurcação por regra · respondeu, abriu, clicou" },
  tag:       { label: "Etiqueta",        icon: Tag,         accent: "text-foreground/70",           description: "Adicionar ou remover tag do lead" },
  webhook:   { label: "Webhook",         icon: Webhook,     accent: "text-foreground/70",           description: "Disparar chamada externa" },
  handoff:   { label: "Passar p/ humano", icon: UserCheck,  accent: "text-rose-600",                description: "Encaminhar conversa para atendente" },
  ai:        { label: "Resposta IA",     icon: Bot,         accent: "text-brand",                   description: "Resposta gerada por IA com contexto" },
};

const BLOCK_GROUPS: { label: string; items: BlockKind[] }[] = [
  { label: "Início",        items: ["trigger"] },
  { label: "Canais",        items: ["email", "linkedin", "whatsapp"] },
  { label: "Lógica",        items: ["wait", "condition", "ai"] },
  { label: "Ações",         items: ["tag", "webhook", "handoff"] },
];

type CanvasNode = {
  id: string;
  kind: BlockKind;
  title: string;
  subtitle?: string;
};

const INITIAL_NODES: CanvasNode[] = [
  { id: "n1", kind: "trigger", title: "Novo lead em Outbound — SaaS LATAM", subtitle: "Origem: importação CSV · Apollo" },
  { id: "n2", kind: "email",   title: "Email · Apresentação inicial",       subtitle: "Template: Intro-01 · 0 dias" },
  { id: "n3", kind: "wait",    title: "Esperar 2 dias úteis",               subtitle: "Pula fins de semana" },
  { id: "n4", kind: "condition", title: "Respondeu?",                       subtitle: "Sim → handoff · Não → LinkedIn" },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function BuilderPage() {
  const [selectedId, setSelectedId] = useState<string | null>("n2");
  const selected = INITIAL_NODES.find((n) => n.id === selectedId) ?? null;

  return (
    <div className="flex h-[calc(100vh-7rem)] min-h-[640px] flex-col gap-4">
      <PageHeader
        title="Builder"
        description="Construa fluxos de automação visuais, multicanal, com lógica condicional."
        actions={
          <>
            <Badge variant="secondary" className="bg-brand-soft text-brand border-transparent font-normal">
              Rascunho
            </Badge>
            <Button variant="outline">
              <Save className="h-4 w-4" />
              Salvar
            </Button>
            <Button>
              <Play className="h-4 w-4" />
              Publicar fluxo
            </Button>
          </>
        }
      />

      <div className="grid flex-1 min-h-0 gap-4 lg:grid-cols-[260px_minmax(0,1fr)_320px]">
        <BlocksPanel />
        <Canvas nodes={INITIAL_NODES} selectedId={selectedId} onSelect={setSelectedId} />
        <Inspector node={selected} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Left: Blocks palette
// ---------------------------------------------------------------------------

function BlocksPanel() {
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
                    <div
                      key={k}
                      draggable
                      className="group flex cursor-grab items-center gap-2.5 rounded-md border border-transparent bg-surface p-2 transition-colors hover:border-border hover:bg-surface-muted/60 active:cursor-grabbing"
                    >
                      <span className={cn("grid h-7 w-7 place-items-center rounded-md border bg-surface-muted/40", M.accent)}>
                        <M.icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium">{M.label}</div>
                        <div className="truncate text-2xs text-muted-foreground">{M.description}</div>
                      </div>
                      <Grip className="h-3.5 w-3.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100" />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      <div className="border-t p-3">
        <Button variant="outline" size="sm" className="w-full">
          <Plus className="h-3.5 w-3.5" />
          Bloco personalizado
        </Button>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Center: Canvas
// ---------------------------------------------------------------------------

function Canvas({
  nodes, selectedId, onSelect,
}: { nodes: CanvasNode[]; selectedId: string | null; onSelect: (id: string) => void }) {
  return (
    <section className="relative flex min-h-0 flex-col overflow-hidden rounded-xl border bg-surface">
      {/* Toolbar */}
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

      {/* Canvas surface with dot grid */}
      <div
        className="relative flex-1 overflow-auto"
        style={{
          backgroundImage:
            "radial-gradient(circle, oklch(0 0 0 / 6%) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
          backgroundPosition: "0 0",
        }}
      >
        <div className="mx-auto flex max-w-md flex-col items-center gap-0 py-12">
          {nodes.map((n, i) => (
            <div key={n.id} className="flex w-full flex-col items-center">
              <FlowNode node={n} selected={n.id === selectedId} onClick={() => onSelect(n.id)} />
              {i < nodes.length - 1 && <Connector />}
            </div>
          ))}

          {/* Add next */}
          <Connector />
          <button className="group flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong bg-surface/60 px-4 py-4 text-sm text-muted-foreground transition-colors hover:border-brand hover:bg-brand-soft/30 hover:text-foreground">
            <Plus className="h-4 w-4" />
            Adicionar próximo passo
          </button>
        </div>

        {/* Mini legend */}
        <div className="pointer-events-none absolute bottom-3 right-3 rounded-md border bg-surface/90 px-2.5 py-1.5 text-2xs text-muted-foreground backdrop-blur">
          Arraste blocos da lateral · clique para editar
        </div>
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
        isTrigger && "border-brand/40"
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
        {node.subtitle && (
          <div className="mt-1 text-xs text-muted-foreground">{node.subtitle}</div>
        )}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Right: Inspector
// ---------------------------------------------------------------------------

function Inspector({ node }: { node: CanvasNode | null }) {
  if (!node) {
    return (
      <aside className="flex min-h-0 flex-col items-center justify-center rounded-xl border bg-surface p-6 text-center">
        <div className="grid h-10 w-10 place-items-center rounded-md bg-surface-muted text-muted-foreground">
          <Settings2 className="h-4 w-4" />
        </div>
        <div className="mt-3 text-sm font-medium">Nenhum bloco selecionado</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Clique em um nó do fluxo para editar suas propriedades.
        </div>
      </aside>
    );
  }

  const M = BLOCK_META[node.kind];

  return (
    <aside className="flex min-h-0 flex-col rounded-xl border bg-surface">
      <div className="flex items-center gap-2 border-b p-3">
        <span className={cn("grid h-7 w-7 place-items-center rounded-md border bg-surface-muted/40", M.accent)}>
          <M.icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-2xs uppercase tracking-wider text-muted-foreground">{M.label}</div>
          <div className="truncate text-sm font-semibold">{node.title}</div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-5 p-4">
          <Field label="Nome do passo">
            <Input defaultValue={node.title} className="h-8 text-xs" />
          </Field>

          {node.kind === "email" && (
            <>
              <Field label="Assunto">
                <Input placeholder="Vamos conversar?" className="h-8 text-xs" />
              </Field>
              <Field label="Template">
                <div className="rounded-md border bg-surface-muted/30 p-2.5 text-xs">
                  Intro-01 · Apresentação inicial
                </div>
              </Field>
            </>
          )}

          {node.kind === "wait" && (
            <Field label="Duração">
              <div className="flex items-center gap-2">
                <Input defaultValue="2" className="h-8 w-20 text-xs" />
                <select className="h-8 flex-1 rounded-md border bg-surface px-2 text-xs">
                  <option>dias úteis</option>
                  <option>horas</option>
                  <option>dias corridos</option>
                </select>
              </div>
            </Field>
          )}

          {node.kind === "condition" && (
            <Field label="Regra">
              <select className="h-8 w-full rounded-md border bg-surface px-2 text-xs">
                <option>Lead respondeu</option>
                <option>Email foi aberto</option>
                <option>Link foi clicado</option>
              </select>
            </Field>
          )}

          <Field label="Descrição interna">
            <textarea
              className="min-h-[72px] w-full resize-none rounded-md border bg-surface p-2 text-xs"
              placeholder="Anotação visível apenas para a equipe…"
            />
          </Field>

          <div className="rounded-md border border-dashed border-border-strong bg-surface-muted/20 p-3 text-xs text-muted-foreground">
            <Sparkles className="mr-1 inline h-3 w-3 text-brand" />
            Configurações avançadas chegam nas próximas fases.
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="label-exec">{label}</div>
      {children}
    </div>
  );
}
