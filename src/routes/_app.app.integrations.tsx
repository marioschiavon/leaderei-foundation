import { createFileRoute } from "@tanstack/react-router";
import { Mail, Linkedin, MessageCircle, Calendar, Slack, FileText, Zap } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/app/integrations")({
  component: IntegrationsPage,
});

const INTEGRATIONS = [
  { name: "Email (IMAP/SMTP)", desc: "Conecte sua caixa de email corporativa.", icon: Mail, connected: true },
  { name: "LinkedIn", desc: "Envie mensagens e convites pelo LinkedIn.", icon: Linkedin, connected: false },
  { name: "WhatsApp Business", desc: "Conversas via WhatsApp Cloud API.", icon: MessageCircle, connected: false },
  { name: "Google Calendar", desc: "Sincronize agendamentos e reuniões.", icon: Calendar, connected: true },
  { name: "Slack", desc: "Receba notificações no seu workspace.", icon: Slack, connected: false },
  { name: "Notion", desc: "Exporte resumos e notas.", icon: FileText, connected: false },
  { name: "Zapier", desc: "Conecte com mais de 5.000 apps.", icon: Zap, connected: false },
];

function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrações"
        description="Conecte canais e ferramentas externas à sua organização."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {INTEGRATIONS.map((i) => (
          <div key={i.name} className="rounded-xl border bg-surface p-5">
            <div className="flex items-start justify-between">
              <div className="grid h-10 w-10 place-items-center rounded-md bg-muted text-foreground">
                <i.icon className="h-4 w-4" />
              </div>
              {i.connected && (
                <Badge className="bg-brand/10 text-brand border-transparent font-normal">
                  Conectado
                </Badge>
              )}
            </div>
            <h3 className="mt-4 font-display text-base font-semibold">{i.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{i.desc}</p>
            <Button
              variant={i.connected ? "outline" : "default"}
              size="sm"
              className="mt-4 w-full"
            >
              {i.connected ? "Configurar" : "Conectar"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
