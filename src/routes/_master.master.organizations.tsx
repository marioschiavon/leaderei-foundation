import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { MoreHorizontal, Plus, Search, Building2, Play, Pause, AlertCircle, Loader2, Users, Database, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { listCompanies, createCompany, setCompanyStatus } from "@/lib/master.functions";
import { StatusPill, type CompanyStatus } from "./_master.master.index";
import { OrgDetailSheet, type OrgSummary } from "@/components/app/OrgDetailSheet";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_master/master/organizations")({
  component: OrgsPage,
});

type StatusFilter = "all" | CompanyStatus;

function OrgsPage() {
  const fetchList = useServerFn(listCompanies);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["master", "companies"],
    queryFn: () => fetchList(),
  });

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [openCreate, setOpenCreate] = useState(false);

  const filtered = useMemo(() => {
    return (data ?? []).filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (query && !`${c.name} ${c.slug}`.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [data, statusFilter, query]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["master", "companies"] });
    queryClient.invalidateQueries({ queryKey: ["master", "overview"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Organizações</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie todas as empresas multi-tenant da plataforma.
          </p>
        </div>
        <Button onClick={() => setOpenCreate(true)}>
          <Plus className="h-4 w-4" />
          Nova organização
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border bg-surface p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou slug…"
            className="h-9 pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {([
            { v: "all", l: "Todas" },
            { v: "active", l: "Ativas" },
            { v: "trial", l: "Trial" },
            { v: "inactive", l: "Inativas" },
          ] as { v: StatusFilter; l: string }[]).map((f) => (
            <button
              key={f.v}
              onClick={() => setStatusFilter(f.v)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                statusFilter === f.v
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
              )}
            >
              {f.l}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
          <div>
            <div className="font-medium text-destructive">Não foi possível carregar as organizações</div>
            <div className="mt-0.5 text-muted-foreground">{(error as Error).message}</div>
          </div>
        </div>
      )}

      {!error && (
        <div className="overflow-hidden rounded-xl border bg-surface">
          <Table>
            <TableHeader>
              <TableRow className="bg-surface-muted/60 hover:bg-surface-muted/60">
                <TableHead>Organização</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Membros</TableHead>
                <TableHead className="text-right">Limites</TableHead>
                <TableHead>Criada em</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <div className="h-6 animate-pulse rounded bg-surface-muted/50" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <EmptyOrgs onCreate={() => setOpenCreate(true)} hasFilters={query !== "" || statusFilter !== "all"} />
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="grid h-8 w-8 place-items-center rounded-md border bg-surface-muted/50 text-muted-foreground">
                          <Building2 className="h-3.5 w-3.5" />
                        </div>
                        <div className="font-medium">{c.name}</div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{c.slug}</TableCell>
                    <TableCell><StatusPill status={c.status as CompanyStatus} /></TableCell>
                    <TableCell className="text-right tabular-nums">{c.member_count}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      <div className="inline-flex items-center gap-1.5"><Users className="h-3 w-3" />{c.max_users}</div>
                      <span className="mx-1.5 text-border-strong">·</span>
                      <div className="inline-flex items-center gap-1.5"><Database className="h-3 w-3" />{c.max_leads.toLocaleString("pt-BR")}</div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <RowActions
                        id={c.id}
                        status={c.status as CompanyStatus}
                        onChanged={invalidate}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateOrgDialog open={openCreate} onOpenChange={setOpenCreate} onCreated={invalidate} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row actions
// ---------------------------------------------------------------------------

function RowActions({
  id, status, onChanged,
}: { id: string; status: CompanyStatus; onChanged: () => void }) {
  const setStatus = useServerFn(setCompanyStatus);
  const mut = useMutation({
    mutationFn: (s: CompanyStatus) => setStatus({ data: { id, status: s } }),
    onSuccess: onChanged,
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={mut.isPending}>
          {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {status !== "active" && (
          <DropdownMenuItem onClick={() => mut.mutate("active")}>
            <Play className="h-3.5 w-3.5" /> Ativar
          </DropdownMenuItem>
        )}
        {status !== "trial" && (
          <DropdownMenuItem onClick={() => mut.mutate("trial")}>
            <Play className="h-3.5 w-3.5" /> Marcar como Trial
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {status !== "inactive" && (
          <DropdownMenuItem
            onClick={() => mut.mutate("inactive")}
            className="text-destructive focus:text-destructive"
          >
            <Pause className="h-3.5 w-3.5" /> Inativar
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// Create dialog
// ---------------------------------------------------------------------------

function CreateOrgDialog({
  open, onOpenChange, onCreated,
}: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const create = useServerFn(createCompany);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState<CompanyStatus>("trial");
  const [maxUsers, setMaxUsers] = useState(5);
  const [maxLeads, setMaxLeads] = useState(1000);

  const autoSlug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);

  const mut = useMutation({
    mutationFn: () =>
      create({
        data: {
          name: name.trim(),
          slug: (slug || autoSlug) || undefined,
          status,
          max_users: maxUsers,
          max_leads: maxLeads,
        },
      }),
    onSuccess: () => {
      onCreated();
      onOpenChange(false);
      setName(""); setSlug(""); setStatus("trial"); setMaxUsers(5); setMaxLeads(1000);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova organização</DialogTitle>
          <DialogDescription>
            Cria um novo tenant. Os membros podem ser adicionados depois.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="Nome">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Inc." autoFocus />
          </Field>
          <Field label="Slug" hint="Identificador único, minúsculo. Gerado automaticamente.">
            <Input
              value={slug || autoSlug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              placeholder="acme"
              className="font-mono"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Limite de usuários">
              <Input type="number" min={1} value={maxUsers} onChange={(e) => setMaxUsers(Number(e.target.value))} />
            </Field>
            <Field label="Limite de leads">
              <Input type="number" min={0} value={maxLeads} onChange={(e) => setMaxLeads(Number(e.target.value))} />
            </Field>
          </div>
          <Field label="Status inicial">
            <div className="flex gap-1 rounded-md border bg-surface-muted/40 p-0.5">
              {(["trial", "active", "inactive"] as CompanyStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={cn(
                    "flex-1 rounded px-2 py-1.5 text-xs capitalize transition-colors",
                    status === s ? "bg-surface text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {s === "trial" ? "Trial" : s === "active" ? "Ativa" : "Inativa"}
                </button>
              ))}
            </div>
          </Field>

          {mut.error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
              {(mut.error as Error).message}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={!name.trim() || mut.isPending}>
            {mut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Criar organização
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-2xs uppercase tracking-wider text-muted-foreground">{label}</div>
      {children}
      {hint && <div className="text-2xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function EmptyOrgs({ onCreate, hasFilters }: { onCreate: () => void; hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-xl border bg-surface-muted/40 text-muted-foreground">
        <Building2 className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <div className="font-display text-base font-semibold">
          {hasFilters ? "Nenhuma organização para esses filtros" : "Nenhuma organização ainda"}
        </div>
        <div className="text-sm text-muted-foreground">
          {hasFilters ? "Ajuste a busca ou os filtros." : "Crie a primeira para começar."}
        </div>
      </div>
      {!hasFilters && (
        <Button onClick={onCreate}><Plus className="h-4 w-4" /> Nova organização</Button>
      )}
    </div>
  );
}
