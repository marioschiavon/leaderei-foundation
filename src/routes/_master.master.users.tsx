import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/app/EmptyState";

export const Route = createFileRoute("/_master/master/users")({
  component: UsersPage,
});

function UsersPage() {
  return (
    <div className="space-y-6">
      <div className="border-b pb-5">
        <h1 className="font-display text-2xl font-bold tracking-tight">Usuários</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visão consolidada de todos os usuários da plataforma.
        </p>
      </div>
      <EmptyState
        icon={Users}
        title="Em breve — Fase 2"
        description="A listagem global de usuários, com filtros por organização e papel, será liberada junto com a gestão de membros master-side. Por ora, gerencie membros dentro de cada organização."
      />
    </div>
  );
}
