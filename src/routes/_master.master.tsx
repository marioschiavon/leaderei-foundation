import { createFileRoute } from "@tanstack/react-router";
import { Building2, Users, CreditCard, Activity } from "lucide-react";

export const Route = createFileRoute("/_master/master")({
  component: MasterOverview,
});

const KPIS = [
  { label: "Organizações", value: "184", icon: Building2 },
  { label: "Usuários", value: "1.247", icon: Users },
  { label: "MRR", value: "R$ 92.4k", icon: CreditCard },
  { label: "Eventos (24h)", value: "38.214", icon: Activity },
];

function MasterOverview() {
  return (
    <div className="space-y-8">
      <div className="border-b pb-5">
        <h1 className="font-display text-2xl font-bold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visão consolidada da plataforma Leaderei.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KPIS.map((k) => (
          <div key={k.label} className="rounded-xl border bg-surface p-5">
            <div className="flex items-start justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {k.label}
              </span>
              <k.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-3 font-display text-3xl font-bold tracking-tight">
              {k.value}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-surface p-6">
        <h2 className="font-display text-base font-semibold">Saúde da plataforma</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Métricas operacionais detalhadas estarão disponíveis nas próximas fases.
        </p>
      </div>
    </div>
  );
}
