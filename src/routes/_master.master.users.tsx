import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Users, Search, AlertCircle, Shield, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { listAllMembers } from "@/lib/master.functions";
import { StatusPill, type CompanyStatus } from "./_master.master";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_master/master/users")({
  component: UsersPage,
});

type RoleFilter = "all" | "master_admin" | "company_admin" | "user";

const ROLE_META: Record<string, { label: string; chip: string }> = {
  master_admin:  { label: "Master",  chip: "bg-brand/10 text-brand" },
  company_admin: { label: "Admin",   chip: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" },
  user:          { label: "Usuário", chip: "bg-muted text-muted-foreground" },
};

function UsersPage() {
  const fetch = useServerFn(listAllMembers);
  const { data, isLoading, error } = useQuery({
    queryKey: ["master", "members"],
    queryFn: () => fetch(),
  });

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  const filtered = useMemo(() => {
    return (data ?? []).filter((m) => {
      if (roleFilter !== "all" && m.role !== roleFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        const name = (m.profile?.full_name ?? "").toLowerCase();
        const org = (m.organization?.name ?? "").toLowerCase();
        const slug = (m.organization?.slug ?? "").toLowerCase();
        if (!name.includes(q) && !org.includes(q) && !slug.includes(q)) return false;
      }
      return true;
    });
  }, [data, roleFilter, query]);

  const uniqueUsers = new Set((data ?? []).map((m) => m.user_id)).size;
  const uniqueOrgs = new Set((data ?? []).map((m) => m.organization_id)).size;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Usuários</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Todos os membros ativos em organizações da plataforma.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-md border bg-surface px-2.5 py-1">
            <Users className="h-3.5 w-3.5" /> {uniqueUsers} usuários
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border bg-surface px-2.5 py-1">
            <Building2 className="h-3.5 w-3.5" /> {uniqueOrgs} organizações
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border bg-surface p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou organização…"
            className="h-9 pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {([
            { v: "all", l: "Todos" },
            { v: "master_admin", l: "Master" },
            { v: "company_admin", l: "Admin" },
            { v: "user", l: "Usuário" },
          ] as { v: RoleFilter; l: string }[]).map((f) => (
            <button
              key={f.v}
              onClick={() => setRoleFilter(f.v)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                roleFilter === f.v
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
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
            <div className="font-medium text-destructive">Não foi possível carregar os usuários</div>
            <div className="mt-0.5 text-muted-foreground">{(error as Error).message}</div>
          </div>
        </div>
      )}

      {!error && (
        <div className="overflow-hidden rounded-xl border bg-surface">
          <Table>
            <TableHeader>
              <TableRow className="bg-surface-muted/60 hover:bg-surface-muted/60">
                <TableHead>Usuário</TableHead>
                <TableHead>Organização</TableHead>
                <TableHead>Papel na org</TableHead>
                <TableHead>Papéis globais</TableHead>
                <TableHead>Status da org</TableHead>
                <TableHead>Entrou em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <div className="h-6 animate-pulse rounded bg-surface-muted/50" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <div className="flex flex-col items-center gap-2 py-12 text-center">
                      <div className="grid h-12 w-12 place-items-center rounded-xl border bg-surface-muted/40 text-muted-foreground">
                        <Users className="h-5 w-5" />
                      </div>
                      <div className="font-display text-base font-semibold">
                        {query || roleFilter !== "all" ? "Nenhum usuário para esses filtros" : "Nenhum usuário ainda"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {query || roleFilter !== "all" ? "Ajuste a busca." : "Crie uma organização e convide membros."}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((m) => {
                  const meta = ROLE_META[m.role] ?? ROLE_META.user;
                  const name = m.profile?.full_name ?? "Sem nome";
                  const initials = name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase() || "·";
                  return (
                    <TableRow key={m.id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="grid h-8 w-8 place-items-center rounded-full border bg-surface-muted/50 text-2xs font-medium uppercase tracking-wider text-muted-foreground">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{name}</div>
                            <div className="font-mono text-2xs text-muted-foreground">{m.user_id.slice(0, 8)}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {m.organization ? (
                          <div className="min-w-0">
                            <div className="truncate text-sm">{m.organization.name}</div>
                            <div className="font-mono text-2xs text-muted-foreground">{m.organization.slug}</div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={cn("inline-flex rounded-md px-2 py-0.5 text-xs font-medium", meta.chip)}>
                          {meta.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {m.global_roles.length === 0 && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                          {m.global_roles.includes("master_admin") && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                              <Shield className="h-3 w-3" /> Master
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {m.organization && (
                          <StatusPill status={m.organization.status as CompanyStatus} />
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(m.joined_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
