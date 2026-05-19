import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand/Logo";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Criar organização — Leaderei" },
      {
        name: "description",
        content: "Crie sua organização Leaderei e comece a operar em minutos.",
      },
    ],
  }),
  component: SignupPage,
});

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function SignupPage() {
  const [orgName, setOrgName] = useState("");
  const slug = slugify(orgName);

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <Link to="/" className="mb-10 inline-block">
            <Logo />
          </Link>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Crie sua organização
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Em alguns segundos sua operação está pronta.
          </p>

          <form
            className="mt-8 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              window.location.href = "/app";
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="org">Nome da organização</Label>
              <Input
                id="org"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Acme Inc."
                required
              />
              {slug && (
                <p className="text-xs text-muted-foreground">
                  Sua URL: <span className="font-mono text-foreground">leaderei.com/{slug}</span>
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">Seu nome</Label>
              <Input id="name" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email corporativo</Label>
              <Input id="email" type="email" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw">Senha</Label>
              <Input id="pw" type="password" required minLength={8} />
            </div>
            <Button type="submit" className="w-full" size="lg">
              Criar organização
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Ao continuar você aceita nossos Termos e Política de Privacidade.
            </p>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Já tem conta?{" "}
            <Link to="/login" className="font-medium text-brand hover:underline">
              Entrar
            </Link>
          </p>
        </div>
      </div>
      <div className="hidden bg-secondary lg:block">
        <div className="flex h-full flex-col justify-between p-12 text-secondary-foreground">
          <Logo tone="light" />
          <div className="space-y-6">
            {[
              "Leads, inbox, campanhas e pipeline em uma só interface.",
              "Multi-tenant nativo: organização, membros e permissões prontos.",
              "Visual sóbrio, denso e rápido. Feito para operar.",
            ].map((line) => (
              <div key={line} className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                <p className="text-base text-white/80">{line}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
