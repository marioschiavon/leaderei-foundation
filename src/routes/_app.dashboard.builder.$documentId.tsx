import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

const FlowEditor = lazy(() => import("@/components/builder/FlowEditor"));

export const Route = createFileRoute("/_app/dashboard/builder/$documentId")({
  ssr: false,
  component: BuilderRoute,
});

function BuilderRoute() {
  const { documentId } = Route.useParams();
  const fallback = (
    <div className="grid min-h-[60vh] place-items-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
  return (
    <ClientOnly fallback={fallback}>
      <Suspense fallback={fallback}>
        <FlowEditor documentId={documentId} />
      </Suspense>
    </ClientOnly>
  );
}
