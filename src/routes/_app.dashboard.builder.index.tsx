import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Workflow, Plus } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { listBuilderDocuments } from "@/lib/builder.functions";

export const Route = createFileRoute("/_app/dashboard/builder/")({
  component: BuilderListPage,
});

function BuilderListPage() {
  const fetchFn = useServerFn(listBuilderDocuments);
  const { data, isLoading } = useQuery({
    queryKey: ["builder-documents"],
    queryFn: () => fetchFn({ data: undefined as any }),
  });

  const docs = (data ?? []) as Array<{
    id: string;
    name: string;
    status: string;
    campaign_id: string | null;
    updated_at: string;
  }>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Builder de fluxos"
        description="Cada campanha tem seu próprio fluxo. Abra uma campanha para editar."
        actions={
          <Button asChild>
            <Link to="/dashboard/campaigns">
              <Plus className="h-4 w-4" /> Ir para campanhas
            </Link>
          </Button>
        }
      />
      {isLoading ? (
        <div className="h-32 animate-pulse rounded-xl bg-surface-muted/40" />
      ) : docs.length === 0 ? (
        <EmptyState
          icon={Workflow}
          title="Nenhum fluxo ainda"
          description="Crie uma campanha e clique em 'Editar fluxo' para começar."
          action={
            <Button asChild>
              <Link to="/dashboard/campaigns">Ir para campanhas</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {docs.map((d) => (
            <Link
              key={d.id}
              to="/dashboard/builder/$documentId"
              params={{ documentId: d.id }}
              className="rounded-xl border bg-surface p-4 transition hover:border-brand/40"
            >
              <div className="flex items-center justify-between">
                <h3 className="truncate font-display text-base font-semibold">
                  {d.name}
                </h3>
                <span
                  className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                    d.status === "published"
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {d.status === "published" ? "Publicado" : "Rascunho"}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Atualizado em {new Date(d.updated_at).toLocaleString("pt-BR")}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
