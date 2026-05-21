import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Eye, EyeOff, Loader2, Mail, Lock, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Logo, LogoMark } from "@/components/brand/Logo";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Leaderei" },
      { name: "description", content: "Acesse sua organização Leaderei." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1fr_1.05fr]">
      {/* Left: form */}
      <div className="relative flex items-center justify-center px-6 py-10 sm:px-12">
        <div className="absolute left-6 top-6 sm:left-10 sm:top-10">
          <Link to="/login" aria-label="Leaderei">
            <Logo />
          </Link>
        </div>

        <div className="w-full max-w-[400px]">
          <div className="mb-8">
            <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border bg-surface px-2.5 py-1 text-[0.7rem] font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              Bem-vindo de volta
            </span>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
              Entrar na sua conta
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Acesse seu workspace e continue de onde parou.
            </p>
          </div>

          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              setLoading(true);
              setTimeout(() => {
                window.location.href = "/dashboard";
              }, 600);
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium">
                Email corporativo
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="voce@empresa.com"
                  required
                  className="h-11 pl-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="pw" className="text-xs font-medium">
                  Senha
                </Label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-muted-foreground transition-colors hover:text-brand"
                >
                  Esqueci a senha
                </Link>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="pw"
                  type={showPw ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  className="h-11 pl-9 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <Checkbox id="remember" />
              <span>Lembrar deste dispositivo</span>
            </label>

            <Button type="submit" size="lg" className="h-11 w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando…
                </>
              ) : (
                <>
                  Entrar
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </>
              )}
            </Button>

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-[0.7rem] uppercase tracking-wider">
                <span className="bg-background px-2 text-muted-foreground">ou</span>
              </div>
            </div>

            <Button type="button" variant="outline" size="lg" className="h-11 w-full">
              <GoogleIcon className="mr-2 h-4 w-4" />
              Continuar com Google
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Ainda não tem conta?{" "}
            <Link to="/signup" className="font-semibold text-brand hover:underline">
              Criar organização
            </Link>
          </p>
        </div>

        <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[0.7rem] text-muted-foreground">
          © {new Date().getFullYear()} Leaderei · Todos os direitos reservados
        </p>
      </div>

      {/* Right: visual showcase */}
      <div className="relative hidden overflow-hidden bg-secondary lg:block">
        {/* Decorative gradients */}
        <div className="pointer-events-none absolute -top-32 -right-32 h-[480px] w-[480px] rounded-full bg-brand/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-20 h-[420px] w-[420px] rounded-full bg-brand/10 blur-3xl" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />

        <div className="relative z-10 flex h-full flex-col justify-between p-12 text-secondary-foreground xl:p-16">
          <div className="flex justify-start">
            <Logo tone="light" size="h-10" />
          </div>

          <div className="space-y-10">
            {/* Floating mock card */}
            <div className="relative">
              <div className="absolute -inset-3 rounded-2xl bg-brand/10 blur-xl" />
              <div className="relative rounded-xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm">
                <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
                  <Logo tone="light" size="h-4" />
                  <div>
                    <div className="text-[0.7rem] font-medium text-white/90">
                      Leaderei Workspace
                    </div>
                    <div className="text-[0.65rem] text-white/50">
                      app.leaderei.com
                    </div>
                  </div>
                  <div className="ml-auto inline-flex items-center gap-1 rounded-full bg-brand/20 px-2 py-0.5 text-[0.65rem] font-medium text-brand">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                    ao vivo
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[
                    { label: "Leads", value: "1.284" },
                    { label: "Conversas", value: "342" },
                    { label: "Pipeline", value: "R$ 89k" },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="rounded-md border border-white/10 bg-white/[0.03] p-2.5"
                    >
                      <div className="text-[0.6rem] uppercase tracking-wider text-white/40">
                        {s.label}
                      </div>
                      <div className="mt-1 font-display text-base font-bold text-white">
                        {s.value}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 space-y-1.5">
                  {[
                    { name: "Mariana Costa", tag: "Quente" },
                    { name: "Pedro Almeida", tag: "Em cadência" },
                    { name: "Ana Ribeiro", tag: "Resposta nova" },
                  ].map((row) => (
                    <div
                      key={row.name}
                      className="flex items-center justify-between rounded-md border border-white/5 bg-white/[0.02] px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <div className="grid h-6 w-6 place-items-center rounded-full bg-brand/20 text-[0.65rem] font-semibold text-brand">
                          {row.name.split(" ").map((s) => s[0]).join("")}
                        </div>
                        <span className="text-xs text-white/85">{row.name}</span>
                      </div>
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[0.6rem] text-white/70">
                        {row.tag}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <h2 className="font-display text-3xl font-bold leading-tight text-white xl:text-4xl">
                Sua operação comercial,{" "}
                <span className="text-brand">em um só lugar.</span>
              </h2>
              <p className="mt-3 max-w-md text-sm text-white/60">
                Leads, inbox multicanal, cadências e pipeline — um sistema operacional
                comercial feito para times que executam.
              </p>
            </div>

            <ul className="grid gap-3 sm:grid-cols-3">
              {[
                { icon: Zap, label: "Setup em minutos" },
                { icon: ShieldCheck, label: "Multi-tenant seguro" },
                { icon: Sparkles, label: "IA integrada" },
              ].map((f) => (
                <li
                  key={f.label}
                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/80"
                >
                  <f.icon className="h-3.5 w-3.5 text-brand" />
                  {f.label}
                </li>
              ))}
            </ul>
          </div>

          <div className="text-[0.7rem] text-white/40">
            Usado por times de vendas que valorizam execução.
          </div>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.12A6.98 6.98 0 0 1 5.47 12c0-.74.13-1.45.36-2.12V7.04H2.18A10.99 10.99 0 0 0 1 12c0 1.78.43 3.46 1.18 4.96l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.07.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
