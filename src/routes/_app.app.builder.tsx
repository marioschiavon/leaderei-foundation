import { createFileRoute } from "@tanstack/react-router";
import { Blocks, Type, Image as ImageIcon, MousePointerClick, Minus, Save } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/app/builder")({
  component: BuilderPage,
});

const BLOCKS = [
  { name: "Texto", icon: Type },
  { name: "Imagem", icon: ImageIcon },
  { name: "Botão", icon: MousePointerClick },
  { name: "Espaçador", icon: Minus },
];

function BuilderPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Builder"
        description="Construtor visual drag-and-drop para páginas e mensagens."
        actions={
          <>
            <Badge variant="secondary" className="bg-brand-soft text-brand border-transparent font-normal">
              Beta
            </Badge>
            <Button variant="outline">
              <Save className="h-4 w-4" />
              Salvar rascunho
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <aside className="rounded-xl border bg-surface p-3">
          <div className="label-exec mb-3 px-1">Blocos</div>
          <div className="space-y-1">
            {BLOCKS.map((b) => (
              <button
                key={b.name}
                className="flex w-full items-center gap-2 rounded-md border border-transparent px-2.5 py-2 text-sm hover:border-border hover:bg-surface-muted transition-colors"
              >
                <b.icon className="h-4 w-4 text-muted-foreground" />
                <span>{b.name}</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="rounded-xl border bg-surface-muted/40 p-4">
          <div className="grid min-h-[480px] place-items-center rounded-lg border border-dashed border-border-strong bg-surface">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="grid h-10 w-10 place-items-center rounded-md bg-muted text-muted-foreground">
                <Blocks className="h-4 w-4" />
              </div>
              <div className="text-sm font-medium">Canvas vazio</div>
              <div className="max-w-xs text-xs text-muted-foreground">
                Arraste blocos da lateral para começar. Layouts são salvos por campanha.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
