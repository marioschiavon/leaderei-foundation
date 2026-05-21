import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthSession } from "@/lib/auth";

export const Route = createFileRoute("/_app/dashboard/settings")({
  component: SettingsPage,
});

const MEMBERS = [
  { name: "Daniel Souza", email: "daniel@leaderei.com", role: "Owner" },
  { name: "Marina Castro", email: "marina@acme.com", role: "Admin" },
  { name: "Rafael Pinto", email: "rafael@acme.com", role: "Member" },
];

function SettingsPage() {
  const { user } = useAuthSession();
  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" description="Gerencie sua organização e preferências." />

      <Tabs defaultValue="org">
        <TabsList>
          <TabsTrigger value="org">Organização</TabsTrigger>
          <TabsTrigger value="members">Membros</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="prefs">Preferências</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
        </TabsList>

        <TabsContent value="org" className="mt-6">
          <div className="max-w-xl space-y-5 rounded-xl border bg-surface p-6">
            <div className="space-y-1.5">
              <Label htmlFor="oname">Nome da organização</Label>
              <Input id="oname" defaultValue={(user?.user_metadata?.org_name as string) ?? ""} placeholder="Sua organização" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="oslug">Email do dono</Label>
              <Input id="oslug" defaultValue={user?.email ?? ""} disabled />
            </div>
            <p className="text-xs text-muted-foreground">
              UI estrutural. A persistência das configurações de organização entra na Fase 2.
            </p>
            <Button disabled>Salvar alterações</Button>
          </div>
        </TabsContent>


        <TabsContent value="members" className="mt-6">
          <div className="rounded-xl border bg-surface">
            <div className="flex items-center justify-between border-b p-4">
              <span className="font-medium">{MEMBERS.length} membros</span>
              <Button size="sm">Convidar membro</Button>
            </div>
            <ul className="divide-y">
              {MEMBERS.map((m) => (
                <li key={m.email} className="flex items-center justify-between p-4">
                  <div>
                    <div className="font-medium">{m.name}</div>
                    <div className="text-sm text-muted-foreground">{m.email}</div>
                  </div>
                  <Badge variant="secondary" className="bg-muted text-foreground border-transparent">
                    {m.role}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="billing" className="mt-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border bg-surface p-6">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Plano atual</span>
              <div className="mt-2 font-display text-2xl font-bold capitalize">{org.plan}</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Renova automaticamente em 30 dias.
              </p>
              <Button className="mt-4" variant="outline" size="sm">Mudar plano</Button>
            </div>
            <div className="rounded-xl border bg-surface p-6">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Próxima cobrança</span>
              <div className="mt-2 font-display text-2xl font-bold">R$ 0,00</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Adicione um método de pagamento para upgrade.
              </p>
              <Button className="mt-4" size="sm">Adicionar cartão</Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="prefs" className="mt-6">
          <div className="max-w-xl rounded-xl border bg-surface p-6 text-sm text-muted-foreground">
            Preferências de notificação e idioma serão configuráveis aqui.
          </div>
        </TabsContent>

        <TabsContent value="api" className="mt-6">
          <div className="max-w-xl space-y-3 rounded-xl border bg-surface p-6">
            <Label>Sua API key</Label>
            <div className="flex gap-2">
              <Input readOnly value="lvr_••••••••••••••••" className="font-mono" />
              <Button variant="outline">Revelar</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Use a API key para integrar a Leaderei com seus próprios sistemas.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
