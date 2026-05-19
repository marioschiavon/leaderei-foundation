import { createFileRoute } from "@tanstack/react-router";
import { Plus, MoreHorizontal } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/app/sales")({
  component: SalesPage,
});

const COLUMNS = [
  {
    title: "Qualificado",
    value: "R$ 124.000",
    cards: [
      { name: "Northwind", owner: "CM", value: "R$ 28k" },
      { name: "Globex", owner: "PL", value: "R$ 42k" },
      { name: "Initech", owner: "SR", value: "R$ 18k" },
    ],
  },
  {
    title: "Em proposta",
    value: "R$ 86.000",
    cards: [
      { name: "Umbrella", owner: "MT", value: "R$ 36k" },
      { name: "Stark Co", owner: "BC", value: "R$ 50k" },
    ],
  },
  {
    title: "Negociação",
    value: "R$ 52.000",
    cards: [{ name: "Hooli", owner: "JA", value: "R$ 52k" }],
  },
  {
    title: "Fechamento",
    value: "R$ 0",
    cards: [] as Array<{ name: string; owner: string; value: string }>,
  },
];

function SalesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline"
        description="Visualização kanban do seu funil de vendas."
        actions={
          <Button>
            <Plus className="h-4 w-4" />
            Novo deal
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => (
          <div key={col.title} className="rounded-xl border bg-surface-muted/40 p-3">
            <div className="mb-3 flex items-center justify-between px-1">
              <div>
                <div className="text-sm font-semibold">{col.title}</div>
                <div className="text-xs text-muted-foreground">{col.value}</div>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {col.cards.map((c) => (
                <div
                  key={c.name}
                  className="rounded-lg border bg-surface p-3 shadow-sm transition-shadow hover:shadow"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{c.name}</span>
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-secondary text-[0.65rem] text-secondary-foreground">
                      {c.owner}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-brand font-semibold">{c.value}</div>
                </div>
              ))}
              {col.cards.length === 0 && (
                <div className="rounded-lg border border-dashed py-8 text-center text-xs text-muted-foreground">
                  Nenhum deal
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
