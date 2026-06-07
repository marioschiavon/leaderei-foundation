import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save, Sparkles, KeyRound, Plus, Trash2, Power } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  getAiPlatformSettings, updateAiPlatformSettings,
  listAiTonePresets, upsertAiTonePreset, deleteAiTonePreset,
  getAiUsageStats,
} from "@/lib/ai.functions";

export const Route = createFileRoute("/_master/master/ai")({
  component: MasterAiPage,
});

const KIND_LABEL: Record<string, string> = {
  mood: "Humor",
  approach: "Abordagem",
  length: "Tamanho",
  language: "Idioma",
};

function MasterAiPage() {
  return (
    <div className="space-y-8">
      <div className="border-b pb-5">
        <h1 className="font-display text-2xl font-bold tracking-tight">IA da plataforma</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Chave OpenAI, prompt mestre, modelos permitidos e catálogo de presets disponíveis para todos os clientes.
        </p>
      </div>
      <PlatformSettingsSection />
      <UsageSection />
      <PresetsSection />
    </div>
  );
}

function PlatformSettingsSection() {
  const qc = useQueryClient();
  const fetchSettings = useServerFn(getAiPlatformSettings);
  const updateFn = useServerFn(updateAiPlatformSettings);
  const { data, isLoading } = useQuery({ queryKey: ["ai-platform-settings"], queryFn: () => fetchSettings() });

  const [form, setForm] = useState<any>(null);
  const [newModel, setNewModel] = useState("");

  useEffect(() => { if (data?.settings) setForm({ ...data.settings }); }, [data]);

  const mut = useMutation({
    mutationFn: (payload: any) => updateFn({ data: payload }),
    onSuccess: () => {
      toast.success("Configuração salva.");
      qc.invalidateQueries({ queryKey: ["ai-platform-settings"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading || !form) {
    return <div className="rounded-xl border bg-surface p-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <section className="rounded-xl border bg-surface p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold">Configurações globais</h2>
          <p className="mt-1 text-sm text-muted-foreground">Aplicadas a TODAS as organizações da plataforma.</p>
        </div>
        <div className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs">
          <KeyRound className="h-3.5 w-3.5" />
          <span className="text-muted-foreground">Chave OpenAI:</span>
          {data?.hasApiKey
            ? <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">Configurada</Badge>
            : <Badge variant="destructive">Faltando</Badge>}
        </div>
      </div>

      <div className="mt-6 grid gap-5">
        <div>
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Prompt mestre</Label>
            <span className="text-[10px] text-muted-foreground">{form.master_system_prompt?.length ?? 0}/20000</span>
          </div>
          <Textarea
            rows={10}
            maxLength={20000}
            className="mt-1 font-mono text-xs leading-relaxed"
            value={form.master_system_prompt ?? ""}
            onChange={(e) => setForm({ ...form, master_system_prompt: e.target.value })}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">É o segredo da plataforma. Nunca trafega para o client das organizações.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Modelo padrão</Label>
            <Select value={form.default_model} onValueChange={(v) => setForm({ ...form, default_model: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(form.allowed_models ?? []).map((m: string) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Temperatura padrão</Label>
            <Input
              type="number" step="0.1" min={0} max={2}
              className="mt-1"
              value={form.default_temperature}
              onChange={(e) => setForm({ ...form, default_temperature: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Max tokens por chamada</Label>
            <Input
              type="number" min={64} max={8000}
              className="mt-1"
              value={form.max_tokens_per_call}
              onChange={(e) => setForm({ ...form, max_tokens_per_call: Number(e.target.value) })}
            />
          </div>
        </div>

        <div>
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Modelos permitidos</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {(form.allowed_models ?? []).map((m: string) => (
              <Badge key={m} variant="secondary" className="gap-1">
                {m}
                <button type="button" onClick={() => setForm({ ...form, allowed_models: form.allowed_models.filter((x: string) => x !== m) })}>
                  <Trash2 className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <div className="flex items-center gap-1">
              <Input
                className="h-7 w-44 text-xs"
                placeholder="gpt-4o-mini…"
                value={newModel}
                onChange={(e) => setNewModel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newModel.trim()) {
                    e.preventDefault();
                    if (!form.allowed_models.includes(newModel.trim())) {
                      setForm({ ...form, allowed_models: [...form.allowed_models, newModel.trim()] });
                    }
                    setNewModel("");
                  }
                }}
              />
              <Button type="button" size="icon" variant="outline" className="h-7 w-7" onClick={() => {
                if (newModel.trim() && !form.allowed_models.includes(newModel.trim())) {
                  setForm({ ...form, allowed_models: [...form.allowed_models, newModel.trim()] });
                }
                setNewModel("");
              }}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-md border p-3">
          <div className="flex items-center gap-2">
            <Power className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">IA habilitada na plataforma</div>
              <div className="text-xs text-muted-foreground">Desligue para parar TODAS as chamadas (manutenção).</div>
            </div>
          </div>
          <Switch checked={!!form.is_enabled} onCheckedChange={(v) => setForm({ ...form, is_enabled: v })} />
        </div>

        <div className="flex justify-end">
          <Button onClick={() => mut.mutate({
            default_model: form.default_model,
            allowed_models: form.allowed_models,
            master_system_prompt: form.master_system_prompt ?? "",
            default_temperature: Number(form.default_temperature),
            max_tokens_per_call: Number(form.max_tokens_per_call),
            is_enabled: !!form.is_enabled,
          })} disabled={mut.isPending}>
            {mut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar
          </Button>
        </div>
      </div>
    </section>
  );
}

function UsageSection() {
  const fetchUsage = useServerFn(getAiUsageStats);
  const { data, isLoading } = useQuery({
    queryKey: ["ai-usage", 24],
    queryFn: () => fetchUsage({ data: { since_hours: 24 } }),
  });

  return (
    <section className="rounded-xl border bg-surface p-6">
      <h2 className="font-display text-lg font-semibold">Uso (últimas 24h)</h2>
      {isLoading ? (
        <Loader2 className="mt-3 h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <Stat label="Chamadas" value={data?.totals.calls ?? 0} />
            <Stat label="Tokens in" value={data?.totals.tokens_in ?? 0} />
            <Stat label="Tokens out" value={data?.totals.tokens_out ?? 0} />
            <Stat label="Custo (US$)" value={`$${(data?.totals.cost_usd ?? 0).toFixed(4)}`} />
          </div>
          <div className="mt-4">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Top orgs por custo</Label>
            <div className="mt-2 divide-y rounded-md border">
              {(data?.top_orgs ?? []).length === 0 && (
                <div className="p-3 text-xs text-muted-foreground">Sem chamadas ainda.</div>
              )}
              {(data?.top_orgs ?? []).map((o: any) => (
                <div key={o.organization_id} className="flex items-center justify-between p-3 text-sm">
                  <span className="font-medium">{o.organization_name}</span>
                  <span className="text-muted-foreground">{o.calls} chamadas · ${o.cost_usd.toFixed(4)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-xl font-bold">{value}</div>
    </div>
  );
}

function PresetsSection() {
  const qc = useQueryClient();
  const fetchPresets = useServerFn(listAiTonePresets);
  const upsertFn = useServerFn(upsertAiTonePreset);
  const deleteFn = useServerFn(deleteAiTonePreset);
  const { data: presets } = useQuery({ queryKey: ["ai-tone-presets"], queryFn: () => fetchPresets() });

  const [editing, setEditing] = useState<any | null>(null);

  const grouped = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const p of presets ?? []) {
      const arr = m.get(p.kind) ?? [];
      arr.push(p);
      m.set(p.kind, arr);
    }
    return m;
  }, [presets]);

  return (
    <section className="rounded-xl border bg-surface p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">Presets dos dropdowns</h2>
          <p className="mt-1 text-sm text-muted-foreground">Opções que aparecem para os usuários ao configurar um step de IA.</p>
        </div>
        <Button size="sm" onClick={() => setEditing({ kind: "mood", slug: "", label: "", prompt_fragment: "", is_active: true, sort_order: 0 })}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Novo preset
        </Button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {Array.from(grouped.entries()).map(([kind, items]) => (
          <div key={kind} className="rounded-md border">
            <div className="border-b bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wider">{KIND_LABEL[kind] ?? kind}</div>
            <div className="divide-y">
              {items.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{p.label}</span>
                      <code className="text-[10px] text-muted-foreground">{p.slug}</code>
                      {!p.is_active && <Badge variant="outline" className="text-[10px]">inativo</Badge>}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">{p.prompt_fragment}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditing({ ...p })}>Editar</Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={async () => {
                      if (!confirm(`Excluir preset "${p.label}"?`)) return;
                      await deleteFn({ data: { id: p.id } });
                      qc.invalidateQueries({ queryKey: ["ai-tone-presets"] });
                    }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Editar preset" : "Novo preset"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <Select value={editing.kind} onValueChange={(v) => setEditing({ ...editing, kind: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mood">Humor</SelectItem>
                      <SelectItem value="approach">Abordagem</SelectItem>
                      <SelectItem value="length">Tamanho</SelectItem>
                      <SelectItem value="language">Idioma</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Slug</Label>
                  <Input className="mt-1" value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} placeholder="ex: consultivo" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Label (o que o usuário vê)</Label>
                <Input className="mt-1" value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Fragmento de prompt</Label>
                <Textarea className="mt-1" rows={3} value={editing.prompt_fragment} onChange={(e) => setEditing({ ...editing, prompt_fragment: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Ordem</Label>
                  <Input type="number" className="mt-1" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} />
                </div>
                <div className="flex items-end gap-2">
                  <Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                  <span className="text-sm">Ativo</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={async () => {
              try {
                await upsertFn({ data: editing });
                toast.success("Preset salvo.");
                setEditing(null);
                qc.invalidateQueries({ queryKey: ["ai-tone-presets"] });
              } catch (e: any) {
                toast.error(e.message);
              }
            }}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
