import { createFileRoute } from "@tanstack/react-router";
import { Plus, Play, Pause, MoreHorizontal } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_app/dashboard/campaigns")({
  component: CampaignsPage,
});

const CAMPAIGNS = [
  { name: "Outbound — SaaS LATAM", status: "Ativa", leads: 412, sent: 1240, reply: 18, progress: 64 },
  { name: "Reativação Q4", status: "Pausada", leads: 220, sent: 880, reply: 11, progress: 100 },
  { name: "Webinar follow-up", status: "Ativa", leads: 96, sent: 192, reply: 24, progress: 42 },
  { name: "Cold LinkedIn — Diretores", status: "Rascunho", leads: 0, sent: 0, reply: 0, progress: 0 },
];

const statusStyle: Record<string, string> = {
  Ativa: "bg-brand/10 text-brand",
  Pausada: "bg-muted text-muted-foreground",
  Rascunho: "bg-secondary/10 text-secondary",
};

function CampaignsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Campanhas"
        description="Sequências de mensagens automatizadas multicanal."
        actions={
          <Button>
            <Plus className="h-4 w-4" />
            Nova campanha
          </Button>
        }
      />

      <div className="space-y-3">
        {CAMPAIGNS.map((c) => (
          <div
            key={c.name}
            className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-6 rounded-xl border bg-surface p-5"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-base font-semibold">{c.name}</h3>
                <Badge variant="secondary" className={`${statusStyle[c.status]} border-transparent font-normal`}>
                  {c.status}
                </Badge>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Progress value={c.progress} className="h-1.5 max-w-[260px]" />
                <span className="text-xs text-muted-foreground">{c.progress}%</span>
              </div>
            </div>
            <Stat label="Leads" value={c.leads} />
            <Stat label="Enviadas" value={c.sent} />
            <Stat label="Respostas" value={c.reply} accent />
            <Button variant="outline" size="sm">
              {c.status === "Ativa" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {c.status === "Ativa" ? "Pausar" : "Iniciar"}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="text-right">
      <div className={`font-display text-lg font-bold ${accent ? "text-brand" : ""}`}>{value}</div>
      <div className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
