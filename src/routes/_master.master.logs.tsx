import { createFileRoute } from "@tanstack/react-router";
import { ScrollText } from "lucide-react";
import { EmptyState } from "@/components/app/EmptyState";

export const Route = createFileRoute("/_master/master/logs")({
  component: LogsPage,
});

function LogsPage() {
  return (
    <div className="space-y-6">
      <div className="border-b pb-5">
        <h1 className="font-display text-2xl font-bold tracking-tight">Logs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Auditoria de eventos da plataforma.
        </p>
      </div>
      <EmptyState
        icon={ScrollText}
        title="Em breve — Fase 2"
        description="O fluxo de auditoria entra junto com a Fase 2 (eventos reais de login, mudanças de organização, ações administrativas). Não exibimos eventos sintéticos aqui."
      />
    </div>
  );
}
