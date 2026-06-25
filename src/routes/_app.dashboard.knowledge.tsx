import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BookOpen, Sparkles, Star, FileText, Link as LinkIcon, FileUp, Pencil, Trash2, Loader2 } from "lucide-react";
import {
  getOrgKnowledgeBase,
  saveAiInstructions,
  saveHighlights,
  saveOrgWebsiteUrl,
  indexOrgWebsite,
  createKnowledgeItem,
  updateKnowledgeItem,
  deleteKnowledgeItem,
  extractUrlContent,
  uploadKnowledgeDoc,
} from "@/lib/knowledge.functions";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { WebsiteCard } from "@/components/app/WebsiteCard";

export const Route = createFileRoute("/_app/dashboard/knowledge")({
  component: KnowledgePage,
});

function KnowledgePage() {
  const qc = useQueryClient();
  const fetchKB = useServerFn(getOrgKnowledgeBase);
  const saveInstr = useServerFn(saveAiInstructions);
  const saveHi = useServerFn(saveHighlights);
  const saveSite = useServerFn(saveOrgWebsiteUrl);

  const { data, isLoading } = useQuery({
    queryKey: ["org-knowledge-base"],
    queryFn: () => fetchKB(),
  });

  const [instructions, setInstructions] = useState("");
  const [highlights, setHighlights] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");

  useEffect(() => {
    if (!data) return;
    setInstructions(data.aiInstructions ?? "");
    setHighlights(data.highlights ?? "");
    setWebsiteUrl(data.websiteUrl ?? "");
  }, [data]);

  const mSaveInstr = useMutation({
    mutationFn: (v: string) => saveInstr({ data: { ai_instructions: v || null } }),
    onSuccess: () => { toast.success("Instruções salvas."); qc.invalidateQueries({ queryKey: ["org-knowledge-base"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar."),
  });
  const mSaveHi = useMutation({
    mutationFn: (v: string) => saveHi({ data: { highlights: v || null } }),
    onSuccess: () => { toast.success("Destaques salvos."); qc.invalidateQueries({ queryKey: ["org-knowledge-base"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar."),
  });
  const mSaveSite = useMutation({
    mutationFn: (v: string) => saveSite({ data: { website_url: v || null } }),
    onSuccess: () => { toast.success("Site salvo."); qc.invalidateQueries({ queryKey: ["org-knowledge-base"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar."),
  });
  const indexFn = useServerFn(indexOrgWebsite);
  const mIndex = useMutation({
    mutationFn: () => indexFn(),
    onSuccess: (r: any) => {
      if (r?.ok) toast.success("Site indexado com sucesso.");
      else toast.error(`Falha ao indexar: ${r?.error ?? "desconhecido"}`);
      qc.invalidateQueries({ queryKey: ["org-knowledge-base"] });
    },
    onError: (e: any) => {
      toast.error(e?.message ?? "Erro ao indexar.");
      qc.invalidateQueries({ queryKey: ["org-knowledge-base"] });
    },
  });

  const items = data?.items ?? [];
  const totalChars = items.reduce((acc: number, i: any) => acc + (i.content?.length ?? 0), 0);
  const tokensApprox = Math.round(totalChars / 4);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <BookOpen className="h-6 w-6 text-brand" />
        <div>
          <h1 className="text-2xl font-semibold">Base de Conhecimento</h1>
          <p className="text-sm text-muted-foreground">
            Treine a IA com instruções, destaques e conteúdo sobre a sua empresa.
          </p>
        </div>
      </div>

      {/* Card 1 — Instruções */}
      <Card className="border-brand/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-brand" />
            Instruções de Abordagem da IA
          </CardTitle>
          <CardDescription>
            Diga como a IA deve se comportar. Estas instruções têm prioridade máxima sobre qualquer outra informação.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            rows={8}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder={`Exemplos do que colocar aqui:
- Vendemos [produto] para [público-alvo].
- Ao prospectar, sempre foque nas dores do lead, não em apresentar a empresa.
- NUNCA faça conexão forçada entre nosso produto e problemas não relacionados.
- Tom: [formal/descontraído]. Pode usar emoji? [sim, com moderação / não].
- Sempre se referir ao produto como '...', nunca como '...'.
- Quando o lead perguntar sobre preço, responda: '...'`}
          />
          <Button onClick={() => mSaveInstr.mutate(instructions)} disabled={mSaveInstr.isPending}>
            {mSaveInstr.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar instruções
          </Button>
        </CardContent>
      </Card>

      {/* Card 2 — Site */}
      <WebsiteCard
        websiteUrl={websiteUrl}
        setWebsiteUrl={setWebsiteUrl}
        savedUrl={data?.websiteUrl ?? null}
        index={data?.websiteIndex}
        onSave={(v) => mSaveSite.mutate(v)}
        isSaving={mSaveSite.isPending}
      />


      {/* Card 3 — Destaques */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Star className="h-5 w-5 text-amber-500" /> Destaques e Argumentos de Autoridade</CardTitle>
          <CardDescription>Prêmios, marcos, mídia, cases — usados como reforço de credibilidade.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            rows={4}
            value={highlights}
            onChange={(e) => setHighlights(e.target.value)}
            placeholder={`Ex: Empresa fundada em 2018, presente em 5 estados.
Prêmio X recebido em 2024.
Matéria no Jornal Y: https://link.com`}
          />
          <Button onClick={() => mSaveHi.mutate(highlights)} disabled={mSaveHi.isPending}>
            {mSaveHi.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar destaques
          </Button>
        </CardContent>
      </Card>

      {/* Card 4 — Base */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Base de Conhecimento</span>
            <Badge variant="secondary">{items.length} {items.length === 1 ? "item" : "itens"} · ~{tokensApprox.toLocaleString("pt-BR")} tokens</Badge>
          </CardTitle>
          <CardDescription>Adicione textos, documentos ou URLs com informações específicas da sua empresa.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin" /> Carregando…</div>
          ) : (
            <Tabs defaultValue="text">
              <TabsList>
                <TabsTrigger value="text"><FileText className="mr-2 h-4 w-4" /> Textos</TabsTrigger>
                <TabsTrigger value="doc"><FileUp className="mr-2 h-4 w-4" /> Documentos</TabsTrigger>
                <TabsTrigger value="url"><LinkIcon className="mr-2 h-4 w-4" /> URLs</TabsTrigger>
              </TabsList>
              <TabsContent value="text"><TextTab items={items.filter((i: any) => i.kind === "text" || i.kind === "faq")} /></TabsContent>
              <TabsContent value="doc"><DocTab items={items.filter((i: any) => i.kind === "file" || i.kind === "document")} /></TabsContent>
              <TabsContent value="url"><UrlTab items={items.filter((i: any) => i.kind === "url")} /></TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
        ℹ️ Estas informações são utilizadas pela IA em todas as mensagens geradas. Quanto mais contexto você fornecer, mais personalizadas ficam as abordagens.
        <br />
        <strong>Prioridade:</strong> Instruções de Abordagem &gt; Destaques &gt; Base de Conhecimento &gt; Site.
      </div>
    </div>
  );
}

// ---------------- Sub-components ----------------

type WebsiteIndex = {
  status: "success" | "error" | "pending" | null;
  indexedAt: string | null;
  error: string | null;
  contentLength: number | null;
  preview: string | null;
} | undefined;

function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora mesmo";
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

function WebsiteCard({
  websiteUrl, setWebsiteUrl, savedUrl, index, onSave, isSaving,
}: {
  websiteUrl: string;
  setWebsiteUrl: (v: string) => void;
  savedUrl: string | null;
  index: WebsiteIndex;
  onSave: (v: string) => void;
  isSaving: boolean;
}) {
  const qc = useQueryClient();
  const indexFn = useServerFn(indexOrgWebsite);
  const [elapsed, setElapsed] = useState(0);
  const TIMEOUT_S = 8;

  const mIndex = useMutation({
    mutationFn: () => indexFn(),
    onSuccess: (r: any) => {
      if (r?.ok) toast.success("Site indexado com sucesso.");
      else toast.error(`Falha ao indexar: ${r?.error ?? "desconhecido"}`);
      qc.invalidateQueries({ queryKey: ["org-knowledge-base"] });
    },
    onError: (e: any) => {
      toast.error(e?.message ?? "Erro ao indexar.");
      qc.invalidateQueries({ queryKey: ["org-knowledge-base"] });
    },
  });

  useEffect(() => {
    if (!mIndex.isPending) { setElapsed(0); return; }
    const start = Date.now();
    const id = setInterval(() => setElapsed((Date.now() - start) / 1000), 100);
    return () => clearInterval(id);
  }, [mIndex.isPending]);

  const isIndexing = mIndex.isPending;
  const progress = Math.min(100, (elapsed / TIMEOUT_S) * 100);
  const status = index?.status ?? null;

  async function handleSaveAndIndex() {
    onSave(websiteUrl);
    // dispara indexação automática se houver URL
    if (websiteUrl?.trim()) {
      // espera o save invalidar — usamos pequeno delay; a mutation de indexação
      // já lê o URL persistido no servidor.
      setTimeout(() => mIndex.mutate(), 300);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" /> Site da empresa</CardTitle>
        <CardDescription>A IA usará o conteúdo do site como contexto complementar.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://suaempresa.com.br"
            disabled={isIndexing}
          />
          <Button onClick={handleSaveAndIndex} disabled={isSaving || isIndexing}>
            {(isSaving || isIndexing) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar e indexar
          </Button>
        </div>

        {/* Estado: indexando */}
        {isIndexing && (
          <div className="rounded-md border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-brand" />
              <span>Indexando o site… {elapsed.toFixed(1)}s / ~{TIMEOUT_S}s</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-brand transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Buscando título, descrição e conteúdo principal da página.
            </p>
          </div>
        )}

        {/* Estado: sucesso */}
        {!isIndexing && status === "success" && (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                Indexado {index?.indexedAt ? timeAgo(index.indexedAt) : ""}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{(index?.contentLength ?? 0).toLocaleString("pt-BR")} chars</Badge>
                <Button size="sm" variant="ghost" onClick={() => mIndex.mutate()} disabled={!savedUrl}>
                  <RefreshCw className="mr-1 h-3 w-3" /> Reindexar
                </Button>
              </div>
            </div>
            {index?.preview && (
              <p className="text-xs text-muted-foreground italic line-clamp-3">
                "{index.preview}…"
              </p>
            )}
          </div>
        )}

        {/* Estado: erro */}
        {!isIndexing && status === "error" && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium">Falha ao indexar</div>
                  <div className="text-xs opacity-90">{index?.error ?? "Erro desconhecido."}</div>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => mIndex.mutate()} disabled={!savedUrl}>
                <RefreshCw className="mr-1 h-3 w-3" /> Tentar novamente
              </Button>
            </div>
          </div>
        )}

        {/* Estado: salvo mas nunca indexado */}
        {!isIndexing && status === null && savedUrl && (
          <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground">⏳ URL salva, ainda não indexada.</div>
            <Button size="sm" variant="outline" onClick={() => mIndex.mutate()}>
              <RefreshCw className="mr-1 h-3 w-3" /> Indexar agora
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}



function ItemRow({ item, onEdited }: { item: any; onEdited: () => void }) {
  const qc = useQueryClient();
  const upd = useServerFn(updateKnowledgeItem);
  const del = useServerFn(deleteKnowledgeItem);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title ?? item.name ?? "");
  const [content, setContent] = useState(item.content ?? "");

  const mUpd = useMutation({
    mutationFn: () => upd({ data: { id: item.id, title, content } }),
    onSuccess: () => { toast.success("Atualizado."); setEditing(false); qc.invalidateQueries({ queryKey: ["org-knowledge-base"] }); onEdited(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro."),
  });
  const mDel = useMutation({
    mutationFn: () => del({ data: { id: item.id } }),
    onSuccess: () => { toast.success("Removido."); qc.invalidateQueries({ queryKey: ["org-knowledge-base"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Erro."),
  });

  return (
    <div className="rounded-md border p-3 space-y-2">
      {editing ? (
        <>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea rows={6} value={content} onChange={(e) => setContent(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => mUpd.mutate()} disabled={mUpd.isPending}>Salvar</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium truncate">{item.title ?? item.name}</div>
              {item.source_url && <div className="text-xs text-muted-foreground truncate">{item.source_url}</div>}
            </div>
            <div className="flex gap-1 shrink-0">
              <Button size="icon" variant="ghost" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => mDel.mutate()} disabled={mDel.isPending}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">
            {item.content || <em className="text-amber-600">Sem conteúdo extraído — edite para adicionar manualmente.</em>}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {new Date(item.created_at).toLocaleString("pt-BR")}
          </div>
        </>
      )}
    </div>
  );
}

function TextTab({ items }: { items: any[] }) {
  const qc = useQueryClient();
  const create = useServerFn(createKnowledgeItem);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const m = useMutation({
    mutationFn: () => create({ data: { title, content, kind: "text" } }),
    onSuccess: () => { toast.success("Adicionado."); setTitle(""); setContent(""); qc.invalidateQueries({ queryKey: ["org-knowledge-base"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Erro."),
  });
  return (
    <div className="space-y-4 pt-4">
      <div className="space-y-2 rounded-md border p-3">
        <Label>Título</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: FAQ — preços" />
        <Label>Conteúdo</Label>
        <Textarea rows={5} value={content} onChange={(e) => setContent(e.target.value)} />
        <Button onClick={() => m.mutate()} disabled={m.isPending || !title.trim() || !content.trim()}>
          {m.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Adicionar
        </Button>
      </div>
      {items.map((i) => <ItemRow key={i.id} item={i} onEdited={() => {}} />)}
      {!items.length && <div className="text-sm text-muted-foreground">Nenhum texto cadastrado ainda.</div>}
    </div>
  );
}

function UrlTab({ items }: { items: any[] }) {
  const qc = useQueryClient();
  const extract = useServerFn(extractUrlContent);
  const create = useServerFn(createKnowledgeItem);
  const [url, setUrl] = useState("");
  const m = useMutation({
    mutationFn: async () => {
      const r = await extract({ data: { url } });
      await create({ data: { title: r.title, content: r.content, kind: "url", source_url: url } });
    },
    onSuccess: () => { toast.success("URL extraída e adicionada."); setUrl(""); qc.invalidateQueries({ queryKey: ["org-knowledge-base"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Erro."),
  });
  return (
    <div className="space-y-4 pt-4">
      <div className="flex gap-2">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
        <Button onClick={() => m.mutate()} disabled={m.isPending || !url.trim()}>
          {m.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Acessando…</> : "Extrair conteúdo"}
        </Button>
      </div>
      {items.map((i) => <ItemRow key={i.id} item={i} onEdited={() => {}} />)}
      {!items.length && <div className="text-sm text-muted-foreground">Nenhuma URL cadastrada ainda.</div>}
    </div>
  );
}

function DocTab({ items }: { items: any[] }) {
  const qc = useQueryClient();
  const upload = useServerFn(uploadKnowledgeDoc);
  const create = useServerFn(createKnowledgeItem);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const lower = f.name.toLowerCase();
    if (!lower.endsWith(".pdf") && !lower.endsWith(".txt")) {
      toast.error("Apenas arquivos .pdf e .txt são aceitos.");
      return;
    }
    setBusy(true);
    try {
      const buf = new Uint8Array(await f.arrayBuffer());
      // chunked btoa to avoid stack overflow
      let bin = "";
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      const file_base64 = btoa(bin);
      const r = await upload({ data: { file_name: f.name, file_base64, file_type: f.type || "application/octet-stream" } });
      await create({
        data: {
          title: r.title,
          content: r.content || "(conteúdo não extraído — edite manualmente)",
          kind: "file",
          file_path: r.file_path,
        },
      });
      if (r.warning) toast.warning(r.warning);
      else toast.success("Documento adicionado.");
      qc.invalidateQueries({ queryKey: ["org-knowledge-base"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro no upload.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center gap-2">
        <input ref={inputRef} type="file" accept=".pdf,.txt" onChange={onFile} className="hidden" />
        <Button onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Extraindo conteúdo…</> : <><FileUp className="mr-2 h-4 w-4" />Selecionar arquivo (.pdf, .txt)</>}
        </Button>
      </div>
      {items.map((i) => <ItemRow key={i.id} item={i} onEdited={() => {}} />)}
      {!items.length && <div className="text-sm text-muted-foreground">Nenhum documento enviado ainda.</div>}
    </div>
  );
}
