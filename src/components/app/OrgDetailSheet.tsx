import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Building2, Sparkles, Star, FileText, Link as LinkIcon, FileUp,
  Pencil, Trash2, Loader2, Users, Megaphone, MessageCircle, UserSquare,
} from "lucide-react";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { WebsiteCard } from "@/components/app/WebsiteCard";
import {
  getMasterOrgDetail,
  getOrgKnowledgeBaseForMaster,
  saveAiInstructionsForMaster,
  saveHighlightsForMaster,
  saveOrgWebsiteUrlForMaster,
  indexOrgWebsiteForMaster,
  createKnowledgeItemForMaster,
  updateKnowledgeItemForMaster,
  deleteKnowledgeItemForMaster,
  extractUrlContentForMaster,
  uploadKnowledgeDocForMaster,
  setCompanyStatus,
} from "@/lib/master.functions";
import { StatusPill, type CompanyStatus } from "@/routes/_master.master.index";

export type OrgSummary = {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
};

export function OrgDetailSheet({
  org, onClose, onStatusChanged,
}: {
  org: OrgSummary | null;
  onClose: () => void;
  onStatusChanged: () => void;
}) {
  return (
    <Sheet open={!!org} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        {org && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand/10">
                  <Building2 className="h-5 w-5 text-brand" />
                </div>
                <div>
                  <SheetTitle className="text-left">{org.name}</SheetTitle>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span className="font-mono">{org.slug}</span>
                    <span>·</span>
                    <StatusPill status={org.status as CompanyStatus} />
                  </div>
                </div>
              </div>
            </SheetHeader>

            <Tabs defaultValue="overview" className="mt-6">
              <TabsList className="w-full">
                <TabsTrigger value="overview" className="flex-1">📋 Visão Geral</TabsTrigger>
                <TabsTrigger value="knowledge" className="flex-1">🧠 Base de Conhecimento</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4">
                <OrgOverviewTab org={org} onStatusChanged={onStatusChanged} />
              </TabsContent>

              <TabsContent value="knowledge" className="mt-4">
                <OrgKnowledgeTab organizationId={org.id} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ---------------- Overview ----------------

function OrgOverviewTab({
  org, onStatusChanged,
}: { org: OrgSummary; onStatusChanged: () => void }) {
  const qc = useQueryClient();
  const getDetailFn = useServerFn(getMasterOrgDetail);
  const setStatusFn = useServerFn(setCompanyStatus);

  const { data, isLoading } = useQuery({
    queryKey: ["master-org-detail", org.id],
    queryFn: () => getDetailFn({ data: { organization_id: org.id } }),
    enabled: !!org.id,
  });

  const mStatus = useMutation({
    mutationFn: (s: CompanyStatus) => setStatusFn({ data: { id: org.id, status: s } }),
    onSuccess: () => {
      toast.success("Status atualizado.");
      onStatusChanged();
      qc.invalidateQueries({ queryKey: ["master-org-detail", org.id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar status."),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Informações</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="Nome" value={org.name} />
          <Row label="Slug" value={<span className="font-mono">{org.slug}</span>} />
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <div className="flex items-center gap-2">
              <StatusPill status={org.status as CompanyStatus} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" disabled={mStatus.isPending}>
                    {mStatus.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Mudar"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {(["active", "trial", "inactive"] as CompanyStatus[])
                    .filter((s) => s !== org.status)
                    .map((s) => (
                      <DropdownMenuItem key={s} onClick={() => mStatus.mutate(s)}>
                        {s === "active" ? "Ativar" : s === "trial" ? "Marcar como Trial" : "Inativar"}
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <Row label="Criada em" value={new Date(org.created_at).toLocaleDateString("pt-BR")} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Métricas</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin" /> Carregando…</div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Metric icon={<UserSquare className="h-4 w-4" />} label="Leads" value={data?.counts.leads ?? 0} />
              <Metric icon={<Megaphone className="h-4 w-4" />} label="Campanhas" value={data?.counts.campaigns ?? 0} />
              <Metric icon={<Users className="h-4 w-4" />} label="Membros" value={data?.counts.members ?? 0} />
              <Metric
                icon={<MessageCircle className="h-4 w-4" />}
                label="WhatsApp"
                value={`${data?.counts.whatsapp_connected ?? 0} / ${data?.counts.whatsapp_total ?? 0}`}
                hint="conectadas / total"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function Metric({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-md border bg-surface-muted/30 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 font-display text-xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-2xs text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

// ---------------- Knowledge ----------------

function OrgKnowledgeTab({ organizationId }: { organizationId: string }) {
  const qc = useQueryClient();
  const queryKey = ["master-org-knowledge", organizationId];

  const fetchKB = useServerFn(getOrgKnowledgeBaseForMaster);
  const saveInstr = useServerFn(saveAiInstructionsForMaster);
  const saveHi = useServerFn(saveHighlightsForMaster);
  const saveSite = useServerFn(saveOrgWebsiteUrlForMaster);
  const indexSite = useServerFn(indexOrgWebsiteForMaster);

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchKB({ data: { organization_id: organizationId } }),
    enabled: !!organizationId,
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

  const invalidate = () => qc.invalidateQueries({ queryKey });

  const mSaveInstr = useMutation({
    mutationFn: (v: string) => saveInstr({ data: { organization_id: organizationId, ai_instructions: v || null } }),
    onSuccess: () => { toast.success("Instruções salvas."); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro."),
  });
  const mSaveHi = useMutation({
    mutationFn: (v: string) => saveHi({ data: { organization_id: organizationId, highlights: v || null } }),
    onSuccess: () => { toast.success("Destaques salvos."); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro."),
  });
  const mSaveSite = useMutation({
    mutationFn: (v: string) => saveSite({ data: { organization_id: organizationId, website_url: v || null } }),
    onSuccess: () => { toast.success("Site salvo."); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro."),
  });
  const mIndex = useMutation({
    mutationFn: () => indexSite({ data: { organization_id: organizationId } }),
    onSuccess: (r: any) => {
      if (r?.ok) toast.success("Site indexado com sucesso.");
      else toast.error(`Falha ao indexar: ${r?.error ?? "desconhecido"}`);
      invalidate();
    },
    onError: (e: any) => { toast.error(e?.message ?? "Erro."); invalidate(); },
  });

  const items = data?.items ?? [];
  const hasInstructions = !!data?.aiInstructions;
  const hasSite = data?.websiteIndex?.status === "success";
  const itemCount = items.length;

  if (isLoading) {
    return <div className="text-sm text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin" /> Carregando…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs p-3 rounded-lg bg-muted/40">
        <span className={hasInstructions ? "text-emerald-600" : "text-muted-foreground"}>
          {hasInstructions ? "✅" : "⭕"} Instruções
        </span>
        <span className="text-border">·</span>
        <span className={hasSite ? "text-emerald-600" : "text-muted-foreground"}>
          {hasSite ? "✅" : "⭕"} Site indexado
        </span>
        <span className="text-border">·</span>
        <span className={itemCount > 0 ? "text-emerald-600" : "text-muted-foreground"}>
          {itemCount > 0 ? "✅" : "⭕"} {itemCount} {itemCount === 1 ? "item" : "itens"} na base
        </span>
      </div>

      <Card className="border-brand/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-brand" /> Instruções de Abordagem da IA
          </CardTitle>
          <CardDescription>Prioridade máxima sobre qualquer outra informação.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea rows={6} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
          <Button size="sm" onClick={() => mSaveInstr.mutate(instructions)} disabled={mSaveInstr.isPending}>
            {mSaveInstr.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar instruções
          </Button>
        </CardContent>
      </Card>

      <WebsiteCard
        websiteUrl={websiteUrl}
        setWebsiteUrl={setWebsiteUrl}
        savedUrl={data?.websiteUrl ?? null}
        index={data?.websiteIndex}
        onSave={(v) => mSaveSite.mutate(v)}
        onIndex={() => mIndex.mutate()}
        isSaving={mSaveSite.isPending}
        isIndexing={mIndex.isPending}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Star className="h-4 w-4 text-amber-500" /> Destaques de Autoridade
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea rows={4} value={highlights} onChange={(e) => setHighlights(e.target.value)} />
          <Button size="sm" onClick={() => mSaveHi.mutate(highlights)} disabled={mSaveHi.isPending}>
            {mSaveHi.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar destaques
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>Base de Conhecimento</span>
            <Badge variant="secondary">{items.length} {items.length === 1 ? "item" : "itens"}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="text">
            <TabsList>
              <TabsTrigger value="text"><FileText className="mr-2 h-4 w-4" /> Textos</TabsTrigger>
              <TabsTrigger value="doc"><FileUp className="mr-2 h-4 w-4" /> Documentos</TabsTrigger>
              <TabsTrigger value="url"><LinkIcon className="mr-2 h-4 w-4" /> URLs</TabsTrigger>
            </TabsList>
            <TabsContent value="text">
              <TextTab organizationId={organizationId} items={items.filter((i: any) => i.kind === "text" || i.kind === "faq")} invalidate={invalidate} />
            </TabsContent>
            <TabsContent value="doc">
              <DocTab organizationId={organizationId} items={items.filter((i: any) => i.kind === "file" || i.kind === "document")} invalidate={invalidate} />
            </TabsContent>
            <TabsContent value="url">
              <UrlTab organizationId={organizationId} items={items.filter((i: any) => i.kind === "url")} invalidate={invalidate} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function ItemRow({ organizationId, item, invalidate }: { organizationId: string; item: any; invalidate: () => void }) {
  const upd = useServerFn(updateKnowledgeItemForMaster);
  const del = useServerFn(deleteKnowledgeItemForMaster);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title ?? item.name ?? "");
  const [content, setContent] = useState(item.content ?? "");
  const [confirmDel, setConfirmDel] = useState(false);

  const mUpd = useMutation({
    mutationFn: () => upd({ data: { organization_id: organizationId, id: item.id, title, content } }),
    onSuccess: () => { toast.success("Atualizado."); setEditing(false); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro."),
  });
  const mDel = useMutation({
    mutationFn: () => del({ data: { organization_id: organizationId, id: item.id } }),
    onSuccess: () => { toast.success("Removido."); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro."),
  });

  return (
    <div className="rounded-md border p-3 space-y-2">
      {editing ? (
        <>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea rows={5} value={content} onChange={(e) => setContent(e.target.value)} />
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
              {confirmDel ? (
                <>
                  <Button size="sm" variant="destructive" onClick={() => mDel.mutate()} disabled={mDel.isPending}>Confirmar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDel(false)}>×</Button>
                </>
              ) : (
                <Button size="icon" variant="ghost" onClick={() => setConfirmDel(true)}><Trash2 className="h-4 w-4" /></Button>
              )}
            </div>
          </div>
          <div className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">
            {item.content || <em className="text-amber-600">Sem conteúdo extraído.</em>}
          </div>
        </>
      )}
    </div>
  );
}

function TextTab({ organizationId, items, invalidate }: { organizationId: string; items: any[]; invalidate: () => void }) {
  const create = useServerFn(createKnowledgeItemForMaster);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const m = useMutation({
    mutationFn: () => create({ data: { organization_id: organizationId, title, content, kind: "text" } }),
    onSuccess: () => { toast.success("Adicionado."); setTitle(""); setContent(""); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro."),
  });
  return (
    <div className="space-y-3 pt-3">
      <div className="space-y-2 rounded-md border p-3">
        <Label>Título</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        <Label>Conteúdo</Label>
        <Textarea rows={4} value={content} onChange={(e) => setContent(e.target.value)} />
        <Button size="sm" onClick={() => m.mutate()} disabled={m.isPending || !title.trim() || !content.trim()}>
          {m.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Adicionar
        </Button>
      </div>
      {items.map((i) => <ItemRow key={i.id} organizationId={organizationId} item={i} invalidate={invalidate} />)}
      {!items.length && <div className="text-sm text-muted-foreground">Nenhum texto cadastrado.</div>}
    </div>
  );
}

function UrlTab({ organizationId, items, invalidate }: { organizationId: string; items: any[]; invalidate: () => void }) {
  const extract = useServerFn(extractUrlContentForMaster);
  const create = useServerFn(createKnowledgeItemForMaster);
  const [url, setUrl] = useState("");
  const m = useMutation({
    mutationFn: async () => {
      const r = await extract({ data: { url } });
      await create({ data: { organization_id: organizationId, title: r.title, content: r.content, kind: "url", source_url: url } });
    },
    onSuccess: () => { toast.success("URL adicionada."); setUrl(""); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro."),
  });
  return (
    <div className="space-y-3 pt-3">
      <div className="flex gap-2">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
        <Button size="sm" onClick={() => m.mutate()} disabled={m.isPending || !url.trim()}>
          {m.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Acessando…</> : "Extrair"}
        </Button>
      </div>
      {items.map((i) => <ItemRow key={i.id} organizationId={organizationId} item={i} invalidate={invalidate} />)}
      {!items.length && <div className="text-sm text-muted-foreground">Nenhuma URL cadastrada.</div>}
    </div>
  );
}

function DocTab({ organizationId, items, invalidate }: { organizationId: string; items: any[]; invalidate: () => void }) {
  const upload = useServerFn(uploadKnowledgeDocForMaster);
  const create = useServerFn(createKnowledgeItemForMaster);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const lower = f.name.toLowerCase();
    if (!lower.endsWith(".pdf") && !lower.endsWith(".txt")) {
      toast.error("Apenas arquivos .pdf e .txt.");
      return;
    }
    setBusy(true);
    try {
      const buf = new Uint8Array(await f.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      const file_base64 = btoa(bin);
      const r = await upload({ data: { organization_id: organizationId, file_name: f.name, file_base64, file_type: f.type || "application/octet-stream" } });
      await create({
        data: {
          organization_id: organizationId,
          title: r.title,
          content: r.content || "(conteúdo não extraído — edite manualmente)",
          kind: "file",
          file_path: r.file_path,
        },
      });
      if (r.warning) toast.warning(r.warning);
      else toast.success("Documento adicionado.");
      invalidate();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro no upload.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3 pt-3">
      <input ref={inputRef} type="file" accept=".pdf,.txt" onChange={onFile} className="hidden" />
      <Button size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
        {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Extraindo…</> : <><FileUp className="mr-2 h-4 w-4" />Selecionar (.pdf, .txt)</>}
      </Button>
      {items.map((i) => <ItemRow key={i.id} organizationId={organizationId} item={i} invalidate={invalidate} />)}
      {!items.length && <div className="text-sm text-muted-foreground">Nenhum documento.</div>}
    </div>
  );
}
