import { createFileRoute, Link, Navigate, Outlet, useRouterState } from "@tanstack/react-router";
import { Shield, ArrowLeft, Loader2 } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";
import { useAuthSession, useIsMaster } from "@/lib/auth";

export const Route = createFileRoute("/_master")({
  component: MasterLayout,
});

const NAV = [
  { label: "Overview", to: "/master" },
  { label: "Organizações", to: "/master/organizations" },
  { label: "Usuários", to: "/master/users" },
  { label: "Planos", to: "/master/plans" },
  { label: "Plataforma", to: "/master/platform" },
  { label: "Logs", to: "/master/logs" },
];

function MasterLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, loading } = useAuthSession();
  const { data: isMaster, isLoading: roleLoading } = useIsMaster(user?.id);

  if (loading || (user && roleLoading)) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!isMaster) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-lg bg-muted text-muted-foreground">
            <Shield className="h-5 w-5" />
          </div>
          <h1 className="font-display text-xl font-bold tracking-tight">Acesso restrito</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta área é exclusiva para administradores Leaderei (papel <code>master_admin</code>).
          </p>
          <Link
            to="/dashboard"
            className="mt-5 inline-flex items-center gap-1.5 rounded-md border bg-surface px-3 py-1.5 text-sm font-medium hover:bg-accent"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar ao app
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-secondary text-secondary-foreground">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-6 px-6">
          <div className="flex items-center gap-3">
            <Logo tone="light" />
            <span className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-2 py-0.5 text-[0.7rem] font-medium uppercase tracking-wider">
              <Shield className="h-3 w-3 text-brand" />
              Master
            </span>
          </div>
          <nav className="ml-6 flex items-center gap-1">
            {NAV.map((n) => {
              const active =
                n.to === "/master" ? pathname === "/master" : pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-white/10 text-white"
                      : "text-white/70 hover:bg-white/5 hover:text-white",
                  )}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <Link
            to="/dashboard"
            className="ml-auto inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar ao app
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
