import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Globe, Loader2, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";

export type WebsiteIndex = {
  status: "success" | "error" | "pending" | null;
  indexedAt: string | null;
  error: string | null;
  contentLength: number | null;
  preview: string | null;
} | undefined | null;

function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora mesmo";
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

export function WebsiteCard({
  websiteUrl, setWebsiteUrl, savedUrl, index,
  onSave, onIndex, isSaving, isIndexing,
}: {
  websiteUrl: string;
  setWebsiteUrl: (v: string) => void;
  savedUrl: string | null;
  index: WebsiteIndex;
  onSave: (v: string) => void;
  onIndex: () => void;
  isSaving: boolean;
  isIndexing: boolean;
}) {
  const TIMEOUT_S = 8;
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isIndexing) { setElapsed(0); return; }
    const start = Date.now();
    const id = setInterval(() => setElapsed((Date.now() - start) / 1000), 100);
    return () => clearInterval(id);
  }, [isIndexing]);

  const progress = Math.min(100, (elapsed / TIMEOUT_S) * 100);
  const status = index?.status ?? null;

  function handleSaveAndIndex() {
    onSave(websiteUrl);
    if (websiteUrl?.trim()) {
      setTimeout(() => onIndex(), 300);
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

        {isIndexing && (
          <div className="rounded-md border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-brand" />
              <span>Indexando o site… {elapsed.toFixed(1)}s / ~{TIMEOUT_S}s</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-brand transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">Buscando título, descrição e conteúdo principal da página.</p>
          </div>
        )}

        {!isIndexing && status === "success" && (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                Indexado {index?.indexedAt ? timeAgo(index.indexedAt) : ""}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{(index?.contentLength ?? 0).toLocaleString("pt-BR")} chars</Badge>
                <Button size="sm" variant="ghost" onClick={onIndex} disabled={!savedUrl}>
                  <RefreshCw className="mr-1 h-3 w-3" /> Reindexar
                </Button>
              </div>
            </div>
            {index?.preview && (
              <p className="text-xs text-muted-foreground italic line-clamp-3">"{index.preview}…"</p>
            )}
          </div>
        )}

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
              <Button size="sm" variant="outline" onClick={onIndex} disabled={!savedUrl}>
                <RefreshCw className="mr-1 h-3 w-3" /> Tentar novamente
              </Button>
            </div>
          </div>
        )}

        {!isIndexing && status === null && savedUrl && (
          <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground">⏳ URL salva, ainda não indexada.</div>
            <Button size="sm" variant="outline" onClick={onIndex}>
              <RefreshCw className="mr-1 h-3 w-3" /> Indexar agora
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
