import { createFileRoute } from "@tanstack/react-router";
import { CreditCard } from "lucide-react";
import { EmptyState } from "@/components/app/EmptyState";

export const Route = createFileRoute("/_master/master/plans")({
  component: PlansPage,
});

function PlansPage() {
  return (
    <div className="space-y-6">
      <div className="border-b pb-5">
        <h1 className="font-display text-2xl font-bold tracking-tight">Planos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Estrutura de pricing, limites e features por plano.
        </p>
      </div>
      <EmptyState
        icon={CreditCard}
        title="Em breve — Fase 2"
        description="Os planos serão configuráveis junto com o módulo de billing. Hoje os limites de uso (max_users, max_leads) são definidos por organização no painel de Organizações."
      />
    </div>
  );
}
