import { createFileRoute } from "@tanstack/react-router";
import { Plus, Filter, Download, Search } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_app/app/leads")({
  component: LeadsPage,
});

const LEADS = [
  { name: "Carla Mendes", company: "Northwind", email: "carla@northwind.io", stage: "Novo", source: "LinkedIn" },
  { name: "Pedro Lima", company: "Globex", email: "pedro@globex.com", stage: "Qualificado", source: "Email" },
  { name: "Sofia Reis", company: "Initech", email: "sofia@initech.dev", stage: "Em conversa", source: "Inbound" },
  { name: "Marcos Tavares", company: "Umbrella", email: "marcos@umbrella.co", stage: "Proposta", source: "LinkedIn" },
  { name: "Beatriz Costa", company: "Stark Co", email: "bia@stark.co", stage: "Novo", source: "Importado" },
  { name: "João Almeida", company: "Hooli", email: "joao@hooli.com", stage: "Qualificado", source: "Email" },
];

const stageStyle: Record<string, string> = {
  Novo: "bg-muted text-foreground",
  Qualificado: "bg-secondary/10 text-secondary",
  "Em conversa": "bg-brand/10 text-brand",
  Proposta: "bg-foreground text-background",
};

function LeadsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description="Base centralizada de leads e contatos da sua organização."
        actions={
          <>
            <Button variant="outline">
              <Download className="h-4 w-4" />
              Exportar
            </Button>
            <Button>
              <Plus className="h-4 w-4" />
              Novo lead
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar leads…" className="pl-9" />
        </div>
        <Button variant="outline" size="sm">
          <Filter className="h-3.5 w-3.5" />
          Filtros
        </Button>
        <Button variant="ghost" size="sm">Estágio</Button>
        <Button variant="ghost" size="sm">Origem</Button>
        <Button variant="ghost" size="sm">Responsável</Button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-surface">
        <Table>
          <TableHeader>
            <TableRow className="bg-surface-muted/60 hover:bg-surface-muted/60">
              <TableHead className="w-10"><Checkbox /></TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Estágio</TableHead>
              <TableHead>Origem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {LEADS.map((l) => (
              <TableRow key={l.email} className="cursor-pointer">
                <TableCell><Checkbox /></TableCell>
                <TableCell className="font-medium">{l.name}</TableCell>
                <TableCell className="text-muted-foreground">{l.company}</TableCell>
                <TableCell className="text-muted-foreground">{l.email}</TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={`${stageStyle[l.stage]} border-transparent font-normal`}
                  >
                    {l.stage}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{l.source}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
