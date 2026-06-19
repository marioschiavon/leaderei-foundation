import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Bot, User as UserIcon, Pencil, Trash2, Plus, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  getLeadDetailsForMaster, getLeadMemory,
  addLeadMemoryItem, updateLeadMemoryItem, archiveLeadMemoryItem,
} from "@/lib/master.functions";

export const Route = createFileRoute("/_master/master/leads/$leadId")({
  component: MasterLeadDetail,
});

const CATEGORY_LABEL: Record<string, string> = {
  contato: "Contato",
  empresa: "Empresa",
  intencao: "Intenção",
  nota_manual: "Notas manuais",
};
const CATEGORY_ORDER = ["contato", "empresa", "intencao", "nota_manual"] as const;

function MasterLeadDetail() {
  const { leadId } = Route.useParams();
  const detailsFn = useServerFn(getLeadDetailsForMaster);
  const { data, isLoading } = useQuery({
    queryKey: ["master-lead-details", leadId],
    queryFn: () => detailsFn({ data: { lead_id: leadId } }),
  });

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!data) return <div className="text-muted-foreground">Lead não encontrado.</div>;

  const { lead, org } = data;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/master/organizations" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Organizações
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight">{lead.full_name ?? "—"}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{org?.name ?? "—"}</span>
          {lead.company_name ? <span>· {lead.company_name}</span> : null}
          {lead.job_title ? <span>· {lead.job_title}</span> : null}
          {lead.status ? <Badge variant="secondary">{lead.status}</Badge> : null}
          {lead.temperature ? <Badge variant="outline">{lead.temperature}</Badge> : null}
        </div>
      </div>

      <Tabs defaultValue="memory">
        <TabsList>
          <TabsTrigger value="data">Dados</TabsTrigger>
          <TabsTrigger value="memory">Memória</TabsTrigger>
        </TabsList>
        <TabsContent value="data" className="mt-5">
          <section className="rounded-xl border bg-surface p-6 space-y-2 text-sm">
            <div><span className="text-muted-foreground">Email:</span> {lead.email ?? "—"}</div>
            <div><span className="text-muted-foreground">Telefone:</span> {lead.phone ?? "—"}</div>
            <div><span className="text-muted-foreground">Empresa:</span> {lead.company_name ?? "—"}</div>
            <div><span className="text-muted-foreground">Cargo:</span> {lead.job_title ?? "—"}</div>
            <div><span className="text-muted-foreground">Criado em:</span> {new Date(lead.created_at).toLocaleString("pt-BR")}</div>
          </section>
        </TabsContent>
        <TabsContent value="memory" className="mt-5">
          <MemorySection leadId={leadId} organizationId={lead.organization_id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type MemoryItem = {
  id: string; organization_id: string; lead_id: string;
  category: "contato" | "empresa" | "intencao" | "nota_manual";
  key: string; value: string;
  source: "agente" | "master_manual";
  confidence: number | null;
  created_at: string; updated_at: string;
};

function MemorySection({ leadId, organizationId }: { leadId: string; organizationId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(getLeadMemory);
  const updateFn = useServerFn(updateLeadMemoryItem);
  const archiveFn = useServerFn(archiveLeadMemoryItem);
  const addFn = useServerFn(addLeadMemoryItem);

  const { data, isLoading } = useQuery({
    queryKey: ["master-lead-memory", leadId],
    queryFn: () => listFn({ data: { lead_id: leadId } }),
  });

  const updateMut = useMutation({
    mutationFn: (vars: { item_id: string; value: string }) => updateFn({ data: vars }),
    onSuccess: () => { toast.success("Item atualizado."); qc.invalidateQueries({ queryKey: ["master-lead-memory", leadId] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const archiveMut = useMutation({
    mutationFn: (vars: { item_id: string }) => archiveFn({ data: vars }),
    onSuccess: () => { toast.success("Item removido."); qc.invalidateQueries({ queryKey: ["master-lead-memory", leadId] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const addMut = useMutation({
    mutationFn: (vars: { category: MemoryItem["category"]; key: string; value: string }) =>
      addFn({ data: { lead_id: leadId, organization_id: organizationId, ...vars } }),
    onSuccess: () => { toast.success("Item adicionado."); qc.invalidateQueries({ queryKey: ["master-lead-memory", leadId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const [showAdd, setShowAdd] = useState(false);
  const [newCat, setNewCat] = useState<MemoryItem["category"]>("nota_manual");
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  if (isLoading) return <div className="rounded-xl border bg-surface p-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  const items = (data ?? []) as MemoryItem[];

  const grouped = new Map<string, MemoryItem[]>();
  for (const it of items) {
    const arr = grouped.get(it.category) ?? [];
    arr.push(it);
    grouped.set(it.category, arr);
  }

  return (
    <div className="space-y-5">
      {items.length === 0 ? (
        <div className="rounded-xl border bg-surface p-8 text-center text-sm text-muted-foreground">
          A IA ainda não coletou informações sobre este lead.
        </div>
      ) : (
        CATEGORY_ORDER.filter((c) => grouped.has(c)).map((cat) => (
          <section key={cat} className="rounded-xl border bg-surface">
            <header className="border-b px-4 py-2 text-sm font-semibold">{CATEGORY_LABEL[cat]}</header>
            <ul className="divide-y">
              {(grouped.get(cat) ?? []).map((it) => (
                <MemoryRow
                  key={it.id}
                  item={it}
                  onSave={(value) => updateMut.mutate({ item_id: it.id, value })}
                  onDelete={() => {
                    if (confirm(`Remover "${it.key}: ${it.value}"?`)) {
                      archiveMut.mutate({ item_id: it.id });
                    }
                  }}
                />
              ))}
            </ul>
          </section>
        ))
      )}

      <div className="rounded-xl border bg-surface p-4">
        {showAdd ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="text-xs text-muted-foreground">Categoria</label>
                <Select value={newCat} onValueChange={(v) => setNewCat(v as MemoryItem["category"])}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORY_ORDER.map((c) => (
                      <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Chave</label>
                <Input className="mt-1" value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="ex: decisor" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Valor</label>
                <Input className="mt-1" value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="ex: Renan (CEO)" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => {
                if (!newKey.trim() || !newValue.trim()) { toast.error("Preencha chave e valor."); return; }
                addMut.mutate({ category: newCat, key: newKey.trim(), value: newValue.trim() });
                setNewKey(""); setNewValue(""); setShowAdd(false);
              }} disabled={addMut.isPending}>
                Adicionar
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>Cancelar</Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
            <Plus className="mr-1 h-4 w-4" /> Adicionar informação manualmente
          </Button>
        )}
      </div>
    </div>
  );
}

function MemoryRow({ item, onSave, onDelete }: {
  item: MemoryItem;
  onSave: (value: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.value);
  const isAgent = item.source === "agente";

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
      <span className="grid h-6 w-6 place-items-center rounded-full bg-muted text-muted-foreground">
        {isAgent ? <Bot className="h-3.5 w-3.5" /> : <UserIcon className="h-3.5 w-3.5" />}
      </span>
      <span className="font-mono text-xs text-muted-foreground min-w-[120px]">{item.key}</span>
      {editing ? (
        <>
          <Input className="h-8 max-w-md" value={value} onChange={(e) => setValue(e.target.value)} />
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { onSave(value); setEditing(false); }}>
            <Check className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setValue(item.value); setEditing(false); }}>
            <X className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <span className="flex-1 truncate">{item.value}</span>
      )}
      <span className="ml-auto flex items-center gap-2">
        {isAgent && item.confidence !== null ? (
          <Badge variant="outline" className="text-[0.7rem]">conf: {Math.round(item.confidence * 100)}%</Badge>
        ) : (
          <Badge variant="outline" className="text-[0.7rem]">manual</Badge>
        )}
        {!editing ? (
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(true)} title="Editar">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        ) : null}
        <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-600 hover:text-rose-700" onClick={onDelete} title="Remover">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </span>
    </li>
  );
}
