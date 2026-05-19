import { createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_master/master/plans")({
  component: PlansPage,
});

const PLANS = [
  { name: "Free", price: "R$ 0", features: ["1 organização", "Até 3 membros", "100 leads"], cta: "Padrão" },
  { name: "Starter", price: "R$ 290", features: ["Até 10 membros", "5.000 leads", "1 canal multicanal"], cta: "Editar" },
  { name: "Growth", price: "R$ 890", features: ["Até 25 membros", "50.000 leads", "Todos canais"], cta: "Editar", highlight: true },
  { name: "Scale", price: "R$ 2.490", features: ["Membros ilimitados", "Leads ilimitados", "SLA & suporte"], cta: "Editar" },
];

function PlansPage() {
  return (
    <div className="space-y-6">
      <div className="border-b pb-5">
        <h1 className="font-display text-2xl font-bold tracking-tight">Planos</h1>
        <p className="mt-1 text-sm text-muted-foreground">Estrutura de pricing e features.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-4">
        {PLANS.map((p) => (
          <div
            key={p.name}
            className={`flex flex-col rounded-xl border bg-surface p-6 ${p.highlight ? "border-brand ring-1 ring-brand" : ""}`}
          >
            <div className="font-display text-base font-semibold">{p.name}</div>
            <div className="mt-2 font-display text-3xl font-bold">{p.price}<span className="text-sm font-normal text-muted-foreground">/mês</span></div>
            <ul className="mt-5 flex-1 space-y-2">
              {p.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-brand" /> {f}
                </li>
              ))}
            </ul>
            <Button className="mt-6" variant={p.highlight ? "default" : "outline"}>{p.cta}</Button>
          </div>
        ))}
      </div>
    </div>
  );
}
