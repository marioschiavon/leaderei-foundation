import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";
import { useAuthSession } from "@/lib/auth";
import { getInvitationByToken, acceptInvitation } from "@/lib/settings.functions";

export const Route = createFileRoute("/invite/$token")({
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuthSession();
  const fetchInv = useServerFn(getInvitationByToken);
  const accept = useServerFn(acceptInvitation);

  const { data: inv, isLoading, error } = useQuery({
    queryKey: ["invitation", token],
    queryFn: () => fetchInv({ data: { token } }),
  });

  const mut = useMutation({
    mutationFn: () => accept({ data: { token } }),
    onSuccess: () => {
      toast.success("Bem-vindo!");
      navigate({ to: "/dashboard" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <div className="w-full max-w-md space-y-6 rounded-xl border bg-surface p-8">
        <Logo />
        {isLoading || authLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : error || !inv ? (
          <>
            <h1 className="font-display text-xl font-bold">Convite indisponível</h1>
            <p className="text-sm text-muted-foreground">
              Este convite expirou, foi revogado ou já foi aceito. Peça um novo link ao administrador.
            </p>
            <Link to="/login"><Button variant="outline">Ir para o login</Button></Link>
          </>
        ) : !user ? (
          <>
            <h1 className="font-display text-xl font-bold">Você foi convidado</h1>
            <p className="text-sm text-muted-foreground">
              Crie sua conta com <strong>{inv.email}</strong> para entrar em <strong>{inv.organization_name}</strong>.
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => navigate({ to: "/signup", search: { email: inv.email } as any })}>
                Criar minha conta
              </Button>
              <Button variant="outline" onClick={() => navigate({ to: "/login", search: { email: inv.email } as any })}>
                Já tenho conta
              </Button>
            </div>
          </>
        ) : user.email?.toLowerCase() !== inv.email.toLowerCase() ? (
          <>
            <h1 className="font-display text-xl font-bold">Email diferente</h1>
            <p className="text-sm text-muted-foreground">
              Este convite foi enviado para <strong>{inv.email}</strong>, mas você está logado como{" "}
              <strong>{user.email}</strong>. Saia e entre com o e-mail correto.
            </p>
            <Link to="/login"><Button variant="outline">Trocar de conta</Button></Link>
          </>
        ) : (
          <>
            <h1 className="font-display text-xl font-bold">
              Entrar em {inv.organization_name}
            </h1>
            <p className="text-sm text-muted-foreground">
              Você foi convidado como <strong>{inv.role === "company_admin" ? "Administrador" : "Membro"}</strong>.
            </p>
            <Button className="w-full" disabled={mut.isPending} onClick={() => mut.mutate()}>
              {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Aceitar convite
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
