import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, Inbox, Users, BarChart3, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Leaderei — Sales workspace multicanal" },
      {
        name: "description",
        content:
          "Leaderei unifica leads, conversas multicanal e campanhas em uma só plataforma operacional para times de vendas.",
      },
      { property: "og:title", content: "Leaderei — Sales workspace multicanal" },
      {
        property: "og:description",
        content:
          "A fundação do seu time comercial: leads, inbox, sequências e pipeline em um só lugar.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-6">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">Recursos</a>
            <a href="#modules" className="hover:text-foreground">Módulos</a>
            <a href="#pricing" className="hover:text-foreground">Planos</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">Entrar</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/signup">Começar grátis</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="border-b">
        <div className="mx-auto grid max-w-[1200px] gap-12 px-6 py-20 lg:grid-cols-[1.1fr_1fr] lg:py-28">
          <div className="flex flex-col justify-center">
            <span className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              Sales workspace operacional
            </span>
            <h1 className="font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-foreground lg:text-6xl">
              Sua operação comercial,{" "}
              <span className="text-brand">em um só lugar.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground">
              Leaderei reúne leads, conversas multicanal, sequências e pipeline em um
              ambiente sóbrio, rápido e feito para times que precisam executar — não
              configurar.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/signup">
                  Criar minha organização <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/login">Já tenho conta</Link>
              </Button>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {["Sem cartão de crédito", "Setup em minutos", "Multi-tenant nativo"].map(
                (item) => (
                  <li key={item} className="inline-flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-brand" />
                    {item}
                  </li>
                ),
              )}
            </ul>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 rounded-2xl bg-secondary/5" />
            <div className="relative overflow-hidden rounded-xl border bg-surface shadow-lg">
              <div className="flex items-center gap-1.5 border-b bg-surface-muted px-3 py-2">
                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
                <span className="ml-2 text-[0.7rem] text-muted-foreground">
                  app.leaderei.com
                </span>
              </div>
              <div className="grid grid-cols-[160px_1fr]">
                <div className="bg-sidebar p-3 text-sidebar-foreground">
                  <div className="mb-4 h-2 w-16 rounded bg-white/15" />
                  {["Dashboard", "Leads", "Inbox", "Campanhas", "Sales"].map(
                    (i, idx) => (
                      <div
                        key={i}
                        className={`mb-1 rounded px-2 py-1.5 text-[0.7rem] ${
                          idx === 1
                            ? "bg-brand text-brand-foreground"
                            : "text-white/70"
                        }`}
                      >
                        {i}
                      </div>
                    ),
                  )}
                </div>
                <div className="p-4">
                  <div className="mb-3 h-3 w-32 rounded bg-foreground/10" />
                  <div className="mb-4 h-2 w-48 rounded bg-foreground/5" />
                  <div className="grid grid-cols-3 gap-2">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="rounded-md border p-2">
                        <div className="h-1.5 w-10 rounded bg-foreground/10" />
                        <div className="mt-2 h-3 w-12 rounded bg-foreground/30" />
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded border bg-surface-muted/40 px-2 py-1.5"
                      >
                        <div className="h-2 w-20 rounded bg-foreground/15" />
                        <div className="h-2 w-12 rounded bg-foreground/10" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="modules" className="border-b py-20">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="mb-12 max-w-2xl">
            <h2 className="font-display text-3xl font-bold tracking-tight">
              Quatro módulos. Uma operação.
            </h2>
            <p className="mt-2 text-muted-foreground">
              Tudo conversa entre si — sem integrações frágeis, sem trocar de aba.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Users, title: "Leads / CRM", desc: "Base centralizada, filtros e segmentação." },
              { icon: Inbox, title: "Inbox multicanal", desc: "Email, LinkedIn e WhatsApp num só lugar." },
              { icon: Send, title: "Campanhas", desc: "Sequências e cadências com controle total." },
              { icon: BarChart3, title: "Sales pipeline", desc: "Kanban operacional com visibilidade real." },
            ].map((m) => (
              <div key={m.title} className="rounded-xl border bg-surface p-5">
                <div className="grid h-9 w-9 place-items-center rounded-md bg-secondary text-secondary-foreground">
                  <m.icon className="h-4 w-4" />
                </div>
                <h3 className="mt-4 font-display text-base font-semibold">{m.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-3 px-6 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <Logo />
            <span>© {new Date().getFullYear()}</span>
          </div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-foreground">Termos</a>
            <a href="#" className="hover:text-foreground">Privacidade</a>
            <a href="#" className="hover:text-foreground">Contato</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
