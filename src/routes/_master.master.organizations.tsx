import { createFileRoute } from "@tanstack/react-router";
import { MoreHorizontal, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_master/master/organizations")({
  component: OrgsPage,
});

const ROWS = [
  { name: "Acme Inc.", slug: "acme", plan: "growth", members: 12, mrr: "R$ 890", status: "Ativa" },
  { name: "Northwind Labs", slug: "northwind", plan: "starter", members: 4, mrr: "R$ 290", status: "Ativa" },
  { name: "Helix Studio", slug: "helix", plan: "scale", members: 28, mrr: "R$ 2.490", status: "Ativa" },
  { name: "Initech", slug: "initech", plan: "free", members: 2, mrr: "R$ 0", status: "Trial" },
  { name: "Umbrella Corp", slug: "umbrella", plan: "growth", members: 18, mrr: "R$ 890", status: "Ativa" },
];

function OrgsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between border-b pb-5">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Organizações</h1>
          <p className="mt-1 text-sm text-muted-foreground">Todas as organizações da plataforma.</p>
        </div>
        <Button><Plus className="h-4 w-4" /> Nova organização</Button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-surface">
        <Table>
          <TableHeader>
            <TableRow className="bg-surface-muted/60 hover:bg-surface-muted/60">
              <TableHead>Nome</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Membros</TableHead>
              <TableHead>MRR</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ROWS.map((r) => (
              <TableRow key={r.slug}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{r.slug}</TableCell>
                <TableCell><Badge variant="secondary" className="bg-muted border-transparent capitalize font-normal">{r.plan}</Badge></TableCell>
                <TableCell>{r.members}</TableCell>
                <TableCell className="font-medium">{r.mrr}</TableCell>
                <TableCell>
                  <Badge className={`${r.status === "Ativa" ? "bg-brand/10 text-brand" : "bg-secondary/10 text-secondary"} border-transparent font-normal`}>
                    {r.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
