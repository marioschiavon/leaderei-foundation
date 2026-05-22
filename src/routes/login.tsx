import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Eye, EyeOff, Loader2, Mail, Lock, ShieldCheck, Sparkles, Zap, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Logo } from "@/components/brand/Logo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    reason: typeof search.reason === "string" ? (search.reason as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Entrar — Leaderei" },
      { name: "description", content: "Acesse sua organização Leaderei." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { reason } = Route.useSearch();
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1fr_1.05fr]">
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

          <form className="space-y-5" onSubmit={onSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium">Email corporativo</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="voce@empresa.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 pl-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="pw" className="text-xs font-medium">Senha</Label>
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Entrando…</>
              ) : (
                <>Entrar<ArrowRight className="ml-1.5 h-4 w-4" /></>
              )}
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

      <div className="relative hidden overflow-hidden bg-secondary lg:block">
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

          <div>
            <h2 className="font-display text-3xl font-bold leading-tight text-white xl:text-4xl">
              Sua operação comercial,{" "}
              <span className="text-brand">em um só lugar.</span>
            </h2>
            <p className="mt-3 max-w-md text-sm text-white/60">
              Leads, inbox multicanal, cadências e pipeline — um sistema operacional
              comercial feito para times que executam.
            </p>

            <ul className="mt-8 grid gap-3 sm:grid-cols-3">
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
