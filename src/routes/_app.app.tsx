import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, Plus, TrendingUp, Users, Inbox, Send } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { useCurrentOrg, useCurrentUser } from "@/lib/tenant/mock";

export const Route = createFileRoute("/_app/app")({
  component: Dashboard,
});

const KPIS = [
  { label: "Novos leads", value: "1.284", delta: "+12.4%", icon: Users },
  { label: "Conversas abertas", value: "327", delta: "+3.1%", icon: Inbox },
  { label: "Mensagens enviadas", value: "8.912", delta: "+22%", icon: Send },
  { label: "Taxa de resposta", value: "18.7%", delta: "+1.2pp", icon: TrendingUp },
];

function Dashboard() {
  const org = useCurrentOrg();
  const user = useCurrentUser();
  const firstName = user.name.split(" ")[0];

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Olá, ${firstName}`}
        description={`Resumo operacional de ${org.name} nos últimos 7 dias.`}
        actions={
          <Button>
            <Plus className="h-4 w-4" />
            Nova campanha
          </Button>
        }
      />

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
            <div className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand">
              <ArrowUpRight className="h-3 w-3" />
              {k.delta}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-surface p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">Atividade da semana</h2>
            <span className="text-xs text-muted-foreground">Últimos 7 dias</span>
          </div>
          <div className="flex h-56 items-end gap-2">
            {[40, 65, 48, 72, 90, 58, 84].map((v, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <div
                  className="w-full rounded-t bg-secondary/80"
                  style={{ height: `${v}%` }}
                />
                <span className="text-[0.65rem] text-muted-foreground">
                  {["S", "T", "Q", "Q", "S", "S", "D"][i]}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-surface p-6">
          <h2 className="mb-4 font-display text-base font-semibold">Próximos passos</h2>
          <ul className="space-y-3">
            {[
              "Conectar primeira caixa de email",
              "Importar lista de leads",
              "Configurar pipeline padrão",
              "Convidar membros da equipe",
            ].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                <span className="text-sm">{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
