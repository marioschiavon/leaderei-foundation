import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Loader2, Check, X, AlertCircle, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { listPlans, createPlan, setPlanActive } from "@/lib/master.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_master/master/plans")({
  component: PlansPage,
});

function PlansPage() {
  const fetchPlans = useServerFn(listPlans);
  const togglePlan = useServerFn(setPlanActive);
  const qc = useQueryClient();
  const [openCreate, setOpenCreate] = useState(false);

  const { data: plans, isLoading, error } = useQuery({
    queryKey: ["master", "plans"],
    queryFn: () => fetchPlans(),
  });

  const toggleMut = useMutation({
    mutationFn: (v: { id: string; is_active: boolean }) => togglePlan({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["master", "plans"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Planos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Catálogo de planos disponíveis para organizações.
          </p>
        </div>
        <Button onClick={() => setOpenCreate(true)}>
          <Plus className="h-4 w-4" /> Novo plano
        </Button>
      </div>

      {error && (
        <ErrorBox message={(error as Error).message} />
      )}

      {!error && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-56 animate-pulse rounded-xl bg-surface-muted/40" />
              ))
            : (plans ?? []).length === 0
              ? <EmptyPlans onCreate={() => setOpenCreate(true)} />
              : (plans ?? []).map((p) => (
                  <PlanCard
                    key={p.id}
                    plan={p}
                    onToggle={(v) => toggleMut.mutate({ id: p.id, is_active: v })}
                    pending={toggleMut.isPending && toggleMut.variables?.id === p.id}
                  />
                ))}
        </div>
      )}

      <CreatePlanDialog
        open={openCreate}
        onOpenChange={setOpenCreate}
        onCreated={() => qc.invalidateQueries({ queryKey: ["master", "plans"] })}
      />
    </div>
  );
}

type PlanCardProps = {
  plan: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    price_cents: number;
    currency: string;
    billing_period: string;
    max_users: number;
    max_leads: number;
    max_messages_per_month: number;
    is_active: boolean;
    is_public: boolean;
    active_subscriptions: number;
  };
  onToggle: (v: boolean) => void;
  pending?: boolean;
};

function PlanCard({ plan, onToggle, pending }: PlanCardProps) {
  const price = (plan.price_cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: plan.currency || "BRL",
  });
  const periodLabel =
    plan.billing_period === "monthly" ? "mês" : plan.billing_period === "quarterly" ? "tri" : "ano";

  return (
    <div className={cn("flex flex-col rounded-xl border bg-surface p-5", !plan.is_active && "opacity-70")}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold">{plan.name}</h3>
          <div className="font-mono text-xs text-muted-foreground">{plan.slug}</div>
        </div>
        <Switch
          checked={plan.is_active}
          onCheckedChange={onToggle}
          disabled={pending}
          aria-label="Ativar plano"
        />
      </div>

      <div className="mt-4 flex items-baseline gap-1">
        <span className="font-display text-2xl font-bold tracking-tight">{price}</span>
        <span className="text-xs text-muted-foreground">/{periodLabel}</span>
      </div>

      {plan.description && (
        <p className="mt-3 text-xs text-muted-foreground">{plan.description}</p>
      )}

      <ul className="mt-4 space-y-1.5 text-xs">
        <Limit label="Usuários" value={plan.max_users.toLocaleString("pt-BR")} />
        <Limit label="Leads" value={plan.max_leads.toLocaleString("pt-BR")} />
        <Limit label="Mensagens / mês" value={plan.max_messages_per_month.toLocaleString("pt-BR")} />
      </ul>

      <div className="mt-5 flex items-center justify-between border-t pt-3 text-2xs uppercase tracking-wider text-muted-foreground">
        <span>{plan.is_public ? "Público" : "Privado"}</span>
        <span>{plan.active_subscriptions} assinatura(s)</span>
      </div>
    </div>
  );
}

function Limit({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center gap-2">
      <Check className="h-3 w-3 text-emerald-500" />
      <span className="text-muted-foreground">{label}:</span>
      <span className="ml-auto font-medium tabular-nums">{value}</span>
    </li>
  );
}

function EmptyPlans({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="col-span-full flex flex-col items-center gap-3 rounded-xl border border-dashed bg-surface px-6 py-16 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-lg bg-muted text-muted-foreground">
        <CreditCard className="h-5 w-5" />
      </div>
      <div>
        <div className="font-display text-base font-semibold">Nenhum plano cadastrado</div>
        <div className="mt-1 text-sm text-muted-foreground">Crie o primeiro plano para liberar o catálogo de billing.</div>
      </div>
      <Button onClick={onCreate}><Plus className="h-4 w-4" /> Novo plano</Button>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
      <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
      <div>
        <div className="font-medium text-destructive">Não foi possível carregar os planos</div>
        <div className="mt-0.5 text-muted-foreground">{message}</div>
      </div>
    </div>
  );
}

function CreatePlanDialog({
  open, onOpenChange, onCreated,
}: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const create = useServerFn(createPlan);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [priceBRL, setPriceBRL] = useState("0");
  const [period, setPeriod] = useState<"monthly" | "quarterly" | "yearly">("monthly");
  const [maxUsers, setMaxUsers] = useState(5);
  const [maxLeads, setMaxLeads] = useState(1000);
  const [maxMsgs, setMaxMsgs] = useState(5000);
  const [isPublic, setIsPublic] = useState(true);
  const [description, setDescription] = useState("");

  const autoSlug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 48);

  const mut = useMutation({
    mutationFn: () => create({
      data: {
        slug: (slug || autoSlug),
        name: name.trim(),
        description: description.trim() || undefined,
        price_cents: Math.round(Number(priceBRL.replace(",", ".")) * 100) || 0,
        currency: "BRL",
        billing_period: period,
        max_users: maxUsers,
        max_leads: maxLeads,
        max_messages_per_month: maxMsgs,
        is_public: isPublic,
      },
    }),
    onSuccess: () => {
      onCreated(); onOpenChange(false);
      setName(""); setSlug(""); setPriceBRL("0"); setDescription("");
      setMaxUsers(5); setMaxLeads(1000); setMaxMsgs(5000); setIsPublic(true); setPeriod("monthly");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo plano</DialogTitle>
          <DialogDescription>Define preço, ciclo e limites de uso por organização.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Starter" autoFocus />
            </Field>
            <Field label="Slug">
              <Input
                value={slug || autoSlug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="starter"
                className="font-mono"
              />
            </Field>
          </div>
          <Field label="Descrição">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Para times pequenos começando…" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Preço (R$)">
              <Input value={priceBRL} onChange={(e) => setPriceBRL(e.target.value)} inputMode="decimal" />
            </Field>
            <Field label="Ciclo">
              <div className="flex gap-1 rounded-md border bg-surface-muted/40 p-0.5">
                {([
                  { v: "monthly", l: "Mês" },
                  { v: "quarterly", l: "Tri" },
                  { v: "yearly", l: "Ano" },
                ] as const).map((p) => (
                  <button key={p.v} type="button" onClick={() => setPeriod(p.v)}
                    className={cn("flex-1 rounded px-2 py-1.5 text-xs transition-colors",
                      period === p.v ? "bg-surface text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground")}
                  >{p.l}</button>
                ))}
              </div>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Usuários">
              <Input type="number" value={maxUsers} onChange={(e) => setMaxUsers(Number(e.target.value))} />
            </Field>
            <Field label="Leads">
              <Input type="number" value={maxLeads} onChange={(e) => setMaxLeads(Number(e.target.value))} />
            </Field>
            <Field label="Msgs/mês">
              <Input type="number" value={maxMsgs} onChange={(e) => setMaxMsgs(Number(e.target.value))} />
            </Field>
          </div>
          <label className="flex items-center justify-between rounded-md border bg-surface-muted/30 px-3 py-2">
            <div>
              <div className="text-sm font-medium">Plano público</div>
              <div className="text-xs text-muted-foreground">Aparece no catálogo de billing.</div>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </label>

          {mut.error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
              {(mut.error as Error).message}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}><X className="h-3.5 w-3.5" />Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={!name.trim() || mut.isPending}>
            {mut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Criar plano
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-2xs uppercase tracking-wider text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}
