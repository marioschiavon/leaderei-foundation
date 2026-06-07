import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save, Sparkles, X, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  getAiOrgProfile, updateAiOrgProfile, listAiTonePresets, previewAiMessage,
} from "@/lib/ai.functions";

type Preset = { id: string; kind: string; slug: string; label: string; is_active: boolean };
type Profile = {
  brand_name: string | null;
  brand_voice: string | null;
  product_description: string | null;
  icp_description: string | null;
  value_proposition: string | null;
  default_cta: string | null;
  forbidden_words: string[];
  default_mood_slug: string | null;
  default_approach_slug: string | null;
  default_length_slug: string | null;
  default_language_slug: string;
};

const EMPTY: Profile = {
  brand_name: "",
  brand_voice: "",
  product_description: "",
  icp_description: "",
  value_proposition: "",
  default_cta: "",
  forbidden_words: [],
  default_mood_slug: null,
  default_approach_slug: null,
  default_length_slug: null,
  default_language_slug: "pt-BR",
};

export function AiBrandTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getAiOrgProfile);
  const fetchPresets = useServerFn(listAiTonePresets);
  const updateFn = useServerFn(updateAiOrgProfile);
  const previewFn = useServerFn(previewAiMessage);

  const { data: profRes, isLoading } = useQuery({ queryKey: ["ai-org-profile"], queryFn: () => fetchProfile() });
  const { data: presets } = useQuery({ queryKey: ["ai-tone-presets"], queryFn: () => fetchPresets() });

  const [form, setForm] = useState<Profile>(EMPTY);
  const [newWord, setNewWord] = useState("");
  const [preview, setPreview] = useState<{ text: string; tokens_in: number; tokens_out: number; cost_usd: number; model: string } | null>(null);

  useEffect(() => {
    if (profRes?.profile) {
      setForm({
        ...EMPTY,
        ...profRes.profile,
        forbidden_words: profRes.profile.forbidden_words ?? [],
      } as Profile);
    }
  }, [profRes]);

  const mut = useMutation({
    mutationFn: () => updateFn({ data: form }),
    onSuccess: () => {
      toast.success("Perfil de IA salvo.");
      qc.invalidateQueries({ queryKey: ["ai-org-profile"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const previewMut = useMutation({
    mutationFn: () => previewFn({
      data: {
        stepConfig: {
          mood_slug: form.default_mood_slug,
          approach_slug: form.default_approach_slug,
          length_slug: form.default_length_slug,
          language_slug: form.default_language_slug,
        },
        channel: "whatsapp",
      },
    }),
    onSuccess: (r) => setPreview(r),
    onError: (e: any) => toast.error(e.message),
  });

  const byKind = (kind: string) => (presets ?? []).filter((p: Preset) => p.kind === kind && p.is_active);

  if (isLoading) {
    return <div className="rounded-xl border bg-surface p-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  }

  const disabled = !isAdmin;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div className="rounded-xl border bg-surface p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand" />
            <h2 className="font-display text-lg font-semibold">Voz da marca</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            O prompt mestre da plataforma é aplicado automaticamente. Aqui você ajusta o que torna a sua marca única.
          </p>

          <div className="mt-5 grid gap-4">
            <Field label="Nome da marca" maxLength={120}>
              <Input value={form.brand_name ?? ""} onChange={(e) => setForm({ ...form, brand_name: e.target.value })} disabled={disabled} />
            </Field>
            <Field label="Voz da marca" hint="Até 500 caracteres" maxLength={500} count={form.brand_voice?.length ?? 0}>
              <Textarea rows={3} maxLength={500} value={form.brand_voice ?? ""} onChange={(e) => setForm({ ...form, brand_voice: e.target.value })} disabled={disabled} placeholder="Ex.: profissional mas próxima, direta, sem jargão corporativo." />
            </Field>
            <Field label="O que o produto faz" hint="Até 500 caracteres" maxLength={500} count={form.product_description?.length ?? 0}>
              <Textarea rows={3} maxLength={500} value={form.product_description ?? ""} onChange={(e) => setForm({ ...form, product_description: e.target.value })} disabled={disabled} />
            </Field>
            <Field label="Cliente ideal (ICP)" hint="Até 500 caracteres" maxLength={500} count={form.icp_description?.length ?? 0}>
              <Textarea rows={2} maxLength={500} value={form.icp_description ?? ""} onChange={(e) => setForm({ ...form, icp_description: e.target.value })} disabled={disabled} placeholder="Ex.: Head of Growth em SaaS B2B com 50-500 funcionários no Brasil." />
            </Field>
            <Field label="Proposta de valor" hint="Até 280 caracteres" maxLength={280} count={form.value_proposition?.length ?? 0}>
              <Textarea rows={2} maxLength={280} value={form.value_proposition ?? ""} onChange={(e) => setForm({ ...form, value_proposition: e.target.value })} disabled={disabled} />
            </Field>
            <Field label="CTA padrão" hint="Até 140 caracteres" maxLength={140} count={form.default_cta?.length ?? 0}>
              <Input maxLength={140} value={form.default_cta ?? ""} onChange={(e) => setForm({ ...form, default_cta: e.target.value })} disabled={disabled} placeholder="Ex.: vale uma conversa de 15 min na próxima semana?" />
            </Field>

            <div>
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Palavras a evitar</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {form.forbidden_words.map((w) => (
                  <Badge key={w} variant="secondary" className="gap-1">
                    {w}
                    {!disabled && (
                      <button type="button" onClick={() => setForm({ ...form, forbidden_words: form.forbidden_words.filter((x) => x !== w) })}>
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </Badge>
                ))}
                {!disabled && (
                  <div className="flex items-center gap-1">
                    <Input
                      className="h-7 w-40 text-xs"
                      value={newWord}
                      placeholder="adicionar…"
                      maxLength={40}
                      onChange={(e) => setNewWord(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newWord.trim()) {
                          e.preventDefault();
                          if (!form.forbidden_words.includes(newWord.trim())) {
                            setForm({ ...form, forbidden_words: [...form.forbidden_words, newWord.trim()].slice(0, 40) });
                          }
                          setNewWord("");
                        }
                      }}
                    />
                    <Button type="button" size="icon" variant="outline" className="h-7 w-7" onClick={() => {
                      if (newWord.trim() && !form.forbidden_words.includes(newWord.trim())) {
                        setForm({ ...form, forbidden_words: [...form.forbidden_words, newWord.trim()].slice(0, 40) });
                      }
                      setNewWord("");
                    }}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-surface p-6">
          <h2 className="font-display text-lg font-semibold">Defaults dos steps de IA</h2>
          <p className="mt-1 text-sm text-muted-foreground">Aparecem pré-selecionados nos dropdowns do Builder. Usuários podem trocar em cada step.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <PresetSelect label="Humor" value={form.default_mood_slug} options={byKind("mood")} onChange={(v) => setForm({ ...form, default_mood_slug: v })} disabled={disabled} />
            <PresetSelect label="Abordagem" value={form.default_approach_slug} options={byKind("approach")} onChange={(v) => setForm({ ...form, default_approach_slug: v })} disabled={disabled} />
            <PresetSelect label="Tamanho" value={form.default_length_slug} options={byKind("length")} onChange={(v) => setForm({ ...form, default_length_slug: v })} disabled={disabled} />
            <PresetSelect label="Idioma" value={form.default_language_slug} options={byKind("language")} onChange={(v) => setForm({ ...form, default_language_slug: v ?? "pt-BR" })} disabled={disabled} />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => mut.mutate()} disabled={disabled || mut.isPending}>
            {mut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar perfil
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border bg-surface p-6">
          <h3 className="font-display text-base font-semibold">Pré-visualização</h3>
          <p className="mt-1 text-xs text-muted-foreground">Gera uma mensagem WhatsApp de exemplo com um lead fictício, usando seus defaults.</p>
          <Button className="mt-3 w-full" variant="outline" onClick={() => previewMut.mutate()} disabled={previewMut.isPending}>
            {previewMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Gerar exemplo
          </Button>
          {preview && (
            <div className="mt-4 space-y-2">
              <div className="whitespace-pre-wrap rounded-md border bg-background p-3 text-sm">{preview.text}</div>
              <div className="text-[11px] text-muted-foreground">
                {preview.model} · {preview.tokens_in}/{preview.tokens_out} tokens · ${preview.cost_usd.toFixed(5)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, count, maxLength, children }: { label: string; hint?: string; count?: number; maxLength?: number; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-end justify-between">
        <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</Label>
        {(hint || (typeof count === "number" && maxLength)) && (
          <span className="text-[10px] text-muted-foreground">
            {typeof count === "number" && maxLength ? `${count}/${maxLength}` : hint}
          </span>
        )}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function PresetSelect({ label, value, options, onChange, disabled }: { label: string; value: string | null; options: Preset[]; onChange: (v: string | null) => void; disabled?: boolean }) {
  return (
    <div>
      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Select value={value ?? "__none"} onValueChange={(v) => onChange(v === "__none" ? null : v)} disabled={disabled}>
        <SelectTrigger className="mt-1"><SelectValue placeholder="—" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none">— (sem preferência)</SelectItem>
          {options.map((o) => <SelectItem key={o.id} value={o.slug}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
