import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuthSession } from "@/lib/auth";
import { getMyContext, markOnboardingCompleted } from "@/lib/tenant.functions";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";
import { Loader2, Upload, Workflow, BarChart3, Sparkles, CalendarClock, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [{ title: "Boas-vindas — Leaderei" }],
  }),
  component: OnboardingPage,
});

const ACTIVE_CARDS = [
  {
    icon: Upload,
    title: "Importe seus leads",
    desc: "De CSV do Apollo, Pipedrive ou planilha.",
  },
  {
    icon: Workflow,
    title: "Crie fluxos multicanal",
    desc: "Email, WhatsApp e LinkedIn num só lugar.",
  },
  {
    icon: BarChart3,
    title: "Acompanhe no painel",
    desc: "Score, temperatura e respostas unificadas.",
  },
];

const SOON_CARDS = [
  {
    icon: Sparkles,
    title: "IA personaliza abordagem",
    desc: "Mensagens adaptadas a cada lead.",
  },
  {
    icon: CalendarClock,
    title: "Agendamento automático",
    desc: "Reserva reuniões sem fricção.",
  },
];

function OnboardingPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuthSession();
  const fetchCtx = useServerFn(getMyContext);
  const markDone = useServerFn(markOnboardingCompleted);

  const { data: ctx, isLoading } = useQuery({
    enabled: !!user,
    queryKey: ["my-context", user?.id],
    queryFn: () => fetchCtx(),
  });

  const completeMutation = useMutation({
    mutationFn: () => markDone({}),
    onSuccess: () => navigate({ to: "/dashboard" }),
  });

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  const firstName = ctx?.profile?.full_name?.split(" ")[0] ?? "";

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-6 py-10 lg:py-16">
        <Logo />
        <div className="mt-12 text-center">
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
            Bem-vindo ao Leaderei
            {isLoading ? (
              <Skeleton className="ml-2 inline-block h-8 w-32 align-middle" />
            ) : firstName ? (
              <>, {firstName}</>
            ) : null}
            ! <span aria-hidden>👋</span>
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            Sua plataforma de prospecção multicanal está pronta. Veja o que você pode fazer:
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {ACTIVE_CARDS.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-xl border bg-card p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand/10 text-brand">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {SOON_CARDS.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-xl border border-dashed bg-card/40 p-5 opacity-70"
            >
              <div className="flex items-start justify-between">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-muted text-muted-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="rounded-full border bg-background px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Em breve
                </span>
              </div>
              <h3 className="mt-4 font-semibold text-muted-foreground">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground/80">{desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 flex justify-center">
          <Button
            size="lg"
            onClick={() => completeMutation.mutate()}
            disabled={completeMutation.isPending}
            className="min-w-[220px]"
          >
            {completeMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Começar a usar
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
