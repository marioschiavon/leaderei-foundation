import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_master/master/users")({
  component: UsersPage,
});

const USERS = [
  { name: "Daniel Souza", email: "daniel@leaderei.com", org: "Leaderei", role: "Master" },
  { name: "Marina Castro", email: "marina@acme.com", org: "Acme Inc.", role: "Admin" },
  { name: "Rafael Pinto", email: "rafael@acme.com", org: "Acme Inc.", role: "Member" },
  { name: "Lúcia Reis", email: "lucia@helix.io", org: "Helix Studio", role: "Owner" },
];

function UsersPage() {
  return (
    <div className="space-y-6">
      <div className="border-b pb-5">
        <h1 className="font-display text-2xl font-bold tracking-tight">Usuários</h1>
        <p className="mt-1 text-sm text-muted-foreground">Todos os usuários da plataforma.</p>
      </div>
      <div className="overflow-hidden rounded-xl border bg-surface">
        <Table>
          <TableHeader>
            <TableRow className="bg-surface-muted/60 hover:bg-surface-muted/60">
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Organização</TableHead>
              <TableHead>Papel</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {USERS.map((u) => (
              <TableRow key={u.email}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell>{u.org}</TableCell>
                <TableCell>
                  <Badge className={`${u.role === "Master" ? "bg-brand/10 text-brand" : "bg-muted text-foreground"} border-transparent font-normal`}>
                    {u.role}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
