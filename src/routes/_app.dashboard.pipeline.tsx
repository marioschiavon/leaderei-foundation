import { createFileRoute } from "@tanstack/react-router";
import { KanbanSquare } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";

export const Route = createFileRoute("/_app/dashboard/pipeline")({
  head: () => ({
    meta: [{ title: "Pipeline — Leaderei" }],
  }),
  component: PipelinePage,
});

function PipelinePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline de vendas"
        description="Gestão visual do funil de oportunidades por estágio."
      />
      <EmptyState
        icon={KanbanSquare}
        title="Em breve — Fase 1"
        description="O kanban de oportunidades (deals) será habilitado em seguida, com arrastar entre estágios e métricas por coluna. Por enquanto, o módulo está reservado para não quebrar a navegação."
      />
    </div>
  );
}
