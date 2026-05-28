import { createFileRoute, Outlet, Navigate, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app/AppSidebar";
import { AppTopbar } from "@/components/app/AppTopbar";
import { useAuthSession, signOut } from "@/lib/auth";
import { getMyContext } from "@/lib/tenant.functions";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading } = useAuthSession();
  const location = useLocation();
  const fetchContext = useServerFn(getMyContext);
  const { data: ctx, isLoading: ctxLoading } = useQuery({
    enabled: !!user,
    queryKey: ["my-context", user?.id],
    queryFn: () => fetchContext(),
  });

  const inactive = ctx?.organization?.status === "inactive";

  useEffect(() => {
    if (inactive) {
      void signOut();
    }
  }, [inactive]);

  if (loading || (user && ctxLoading)) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (inactive) {
    return <Navigate to="/login" search={{ reason: "inactive" }} replace />;
  }

  if (ctx && !ctx.onboardingCompleted && !location.pathname.startsWith("/onboarding")) {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex min-w-0 flex-1 flex-col">
          <AppTopbar />
          <main className="flex-1 px-6 py-6 lg:px-8">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

