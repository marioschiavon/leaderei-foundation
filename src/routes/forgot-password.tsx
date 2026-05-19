import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand/Logo";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [{ title: "Recuperar senha — Leaderei" }],
  }),
  component: ForgotPage,
});

function ForgotPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-10 inline-block">
          <Logo />
        </Link>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Recuperar acesso
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enviaremos um link de redefinição para o seu email.
        </p>
        <form className="mt-8 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required />
          </div>
          <Button type="submit" className="w-full" size="lg">
            Enviar link
          </Button>
        </form>
        <Link
          to="/login"
          className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar para login
        </Link>
      </div>
    </div>
  );
}
