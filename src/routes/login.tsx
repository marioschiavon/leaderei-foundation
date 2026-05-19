import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand/Logo";

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
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <Link to="/" className="mb-10 inline-block">
            <Logo />
          </Link>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Entrar na sua conta
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Use o email da sua organização.
          </p>

          <form
            className="mt-8 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              window.location.href = "/app";
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="voce@empresa.com" required />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="pw">Senha</Label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-muted-foreground hover:text-brand"
                >
                  Esqueci a senha
                </Link>
              </div>
              <Input id="pw" type="password" required />
            </div>
            <Button type="submit" className="w-full" size="lg">
              Entrar
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Ainda não tem conta?{" "}
            <Link to="/signup" className="font-medium text-brand hover:underline">
              Criar organização
            </Link>
          </p>
        </div>
      </div>
      <div className="hidden bg-secondary lg:block">
        <div className="flex h-full flex-col justify-between p-12 text-secondary-foreground">
          <Logo tone="light" />
          <div>
            <p className="font-display text-3xl font-bold leading-tight">
              "Migramos toda a operação para a Leaderei em duas semanas.
              <br />
              <span className="text-brand">É o nosso sistema operacional comercial.</span>"
            </p>
            <p className="mt-4 text-sm text-white/60">
              — Times de vendas que valorizam execução
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
