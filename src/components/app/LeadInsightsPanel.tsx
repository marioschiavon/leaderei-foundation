import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Lightbulb, Loader2, RefreshCw, Target, Package, Star,
  AlertTriangle, MessageSquare, Copy, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  analyzeLeadWebsite, getLeadInsights, type LeadInsightsPayload,
} from "@/lib/lead-insights.functions";
import { useState } from "react";

const FIT_META: Record<string, { label: string; chip: string }> = {
  high: { label: "Alto", chip: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
  medium: { label: "Médio", chip: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  low: { label: "Baixo", chip: "bg-muted text-muted-foreground border-muted-foreground/20" },
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Mensagem copiada.");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }
  return (
    <Button size="sm" variant="outline" onClick={onCopy} className="h-7 gap-1.5">
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copiado" : "Copiar"}
    </Button>
  );
}

export function LeadInsightsPanel({
  leadId, websiteUrl,
}: {
  leadId: string;
  websiteUrl: string | null | undefined;
}) {
  const fetchFn = useServerFn(getLeadInsights);
  const analyzeFn = useServerFn(analyzeLeadWebsite);
  const queryClient = useQueryClient();
  const autoTriggered = useRef(false);

  const hasWebsite = !!websiteUrl?.trim();

  const { data, isLoading } = useQuery({
    enabled: hasWebsite,
    queryKey: ["lead-insights", leadId],
    queryFn: () => fetchFn({ data: { lead_id: leadId } }),
  });

  const mutation = useMutation({
    mutationFn: () => analyzeFn({ data: { lead_id: leadId } }),
    onSuccess: (r: any) => {
      if (r?.ok === false) toast.warning(r?.error ?? "Não foi possível analisar.");
      else toast.success("Insights atualizados.");
      queryClient.invalidateQueries({ queryKey: ["lead-insights", leadId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Auto-trigger on mount when no insights exist yet
  useEffect(() => {
    if (!hasWebsite) return;
    if (isLoading) return;
    if (data) return;
    if (autoTriggered.current) return;
    if (mutation.isPending) return;
    autoTriggered.current = true;
    mutation.mutate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasWebsite, isLoading, data]);

  const ins = data?.insights as LeadInsightsPayload | undefined;
  const analyzing = mutation.isPending || (hasWebsite && !data && isLoading);

  return (
    <section className="rounded-xl border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 text-sm font-semibold">
          <Lightbulb className="h-4 w-4 text-amber-500" /> Insights do Prospect
        </div>
        {hasWebsite && (
          <Button
            variant="outline" size="sm"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="h-7 gap-1.5"
          >
            {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {data ? "Reanalisar" : "Analisar"}
          </Button>
        )}
      </div>

      {!hasWebsite ? (
        <div className="rounded-lg border border-dashed bg-background p-4 text-sm text-muted-foreground">
          Preencha o <span className="font-medium text-foreground">website</span> do lead para gerar insights automáticos.
        </div>
      ) : analyzing ? (
        <div className="flex items-center gap-2 rounded-lg border bg-background p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Analisando website... pode levar até 15s.
        </div>
      ) : !ins ? (
        <div className="rounded-lg border border-dashed bg-background p-4 text-sm text-muted-foreground">
          Ainda sem análise. Clique em "Analisar" para gerar.
        </div>
      ) : (
        <div className="space-y-4">
          {ins.resumo && (
            <div className="rounded-lg bg-surface-muted/50 p-3 text-sm leading-relaxed">
              {ins.resumo}
            </div>
          )}

          {ins.proposta_valor && (
            <InsightBlock icon={Target} title="Proposta de Valor">
              <p className="text-sm">{ins.proposta_valor}</p>
            </InsightBlock>
          )}

          {Array.isArray(ins.produtos) && ins.produtos.length > 0 && (
            <InsightBlock icon={Package} title="Produtos / Serviços">
              <div className="flex flex-wrap gap-1.5">
                {ins.produtos.map((p, i) => (
                  <Badge key={i} variant="secondary" className="bg-muted/60">{p}</Badge>
                ))}
              </div>
            </InsightBlock>
          )}

          {Array.isArray(ins.diferenciais) && ins.diferenciais.length > 0 && (
            <InsightBlock icon={Star} title="Diferenciais">
              <ul className="space-y-1 text-sm">
                {ins.diferenciais.map((d, i) => (
                  <li key={i} className="flex gap-2"><span className="text-muted-foreground">•</span><span>{d}</span></li>
                ))}
              </ul>
            </InsightBlock>
          )}

          {Array.isArray(ins.pain_points) && ins.pain_points.length > 0 && (
            <InsightBlock icon={AlertTriangle} title="Possíveis Dores">
              <ul className="space-y-1 text-sm">
                {ins.pain_points.map((d, i) => (
                  <li key={i} className="flex gap-2"><span className="text-muted-foreground">•</span><span>{d}</span></li>
                ))}
              </ul>
            </InsightBlock>
          )}

          {ins.fit_score && (
            <div className="flex flex-wrap items-start gap-2 rounded-lg border bg-background p-3">
              <span className="text-xs font-medium text-muted-foreground">Fit:</span>
              <Badge
                variant="outline"
                className={cn("border", FIT_META[String(ins.fit_score).toLowerCase()]?.chip ?? FIT_META.low.chip)}
              >
                {FIT_META[String(ins.fit_score).toLowerCase()]?.label ?? String(ins.fit_score)}
              </Badge>
              {ins.fit_reason && <span className="flex-1 min-w-0 text-sm">{ins.fit_reason}</span>}
            </div>
          )}

          {Array.isArray(ins.oportunidades_abordagem) && ins.oportunidades_abordagem.length > 0 && (
            <InsightBlock icon={MessageSquare} title="Sugestões de Abordagem">
              <div className="space-y-3">
                {ins.oportunidades_abordagem.map((op, i) => (
                  <div key={i} className="rounded-lg border bg-background p-3 space-y-2">
                    {op.angulo && (
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-brand">
                        {op.angulo}
                      </div>
                    )}
                    {op.gancho && (
                      <div className="text-xs"><span className="font-medium">Gancho: </span>{op.gancho}</div>
                    )}
                    {op.conexao && (
                      <div className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Conexão: </span>{op.conexao}</div>
                    )}
                    {op.mensagem_sugerida && (
                      <>
                        <div className="rounded-md bg-surface-muted/60 p-2.5 text-sm leading-relaxed whitespace-pre-wrap">
                          {op.mensagem_sugerida}
                        </div>
                        <div className="flex justify-end">
                          <CopyButton text={op.mensagem_sugerida} />
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </InsightBlock>
          )}

          {data?.analyzed_at && (
            <div className="text-[11px] text-muted-foreground">
              Analisado em {new Date(data.analyzed_at).toLocaleString("pt-BR")}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function InsightBlock({
  icon: Icon, title, children,
}: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {title}
      </div>
      {children}
    </div>
  );
}

export function LeadInsightsCompact({
  leadId, websiteUrl,
}: {
  leadId: string;
  websiteUrl: string | null | undefined;
}) {
  const fetchFn = useServerFn(getLeadInsights);
  const analyzeFn = useServerFn(analyzeLeadWebsite);
  const queryClient = useQueryClient();
  const autoTriggered = useRef(false);
  const hasWebsite = !!websiteUrl?.trim();

  const { data, isLoading } = useQuery({
    enabled: hasWebsite,
    queryKey: ["lead-insights", leadId],
    queryFn: () => fetchFn({ data: { lead_id: leadId } }),
  });

  const mutation = useMutation({
    mutationFn: () => analyzeFn({ data: { lead_id: leadId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lead-insights", leadId] }),
  });

  useEffect(() => {
    if (!hasWebsite || isLoading || data || autoTriggered.current || mutation.isPending) return;
    autoTriggered.current = true;
    mutation.mutate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasWebsite, isLoading, data]);

  const ins = data?.insights as LeadInsightsPayload | undefined;
  const analyzing = mutation.isPending || (hasWebsite && !data && isLoading);
  const firstOp = ins?.oportunidades_abordagem?.[0];

  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold">
        <Lightbulb className="h-3.5 w-3.5 text-amber-500" /> Insights do Lead
      </div>
      {!hasWebsite ? (
        <div className="text-xs text-muted-foreground">Sem website cadastrado.</div>
      ) : analyzing ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Analisando…
        </div>
      ) : !ins ? (
        <div className="text-xs text-muted-foreground">Sem análise.</div>
      ) : (
        <div className="space-y-2 text-xs">
          {ins.resumo && <p className="line-clamp-2 text-foreground">{ins.resumo}</p>}
          {ins.fit_score && (
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Fit:</span>
              <Badge
                variant="outline"
                className={cn("h-5 border text-[10px]", FIT_META[String(ins.fit_score).toLowerCase()]?.chip ?? FIT_META.low.chip)}
              >
                {FIT_META[String(ins.fit_score).toLowerCase()]?.label ?? String(ins.fit_score)}
              </Badge>
            </div>
          )}
          {Array.isArray(ins.pain_points) && ins.pain_points.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Dores</div>
              <ul className="mt-0.5 space-y-0.5">
                {ins.pain_points.slice(0, 3).map((p, i) => (
                  <li key={i}>• {p}</li>
                ))}
              </ul>
            </div>
          )}
          {firstOp?.mensagem_sugerida && (
            <div className="rounded-md border bg-background p-2 space-y-1.5">
              {firstOp.angulo && (
                <div className="text-[10px] font-semibold uppercase tracking-wider text-brand">
                  {firstOp.angulo}
                </div>
              )}
              <div className="whitespace-pre-wrap text-foreground">{firstOp.mensagem_sugerida}</div>
              <div className="flex justify-end">
                <CopyButton text={firstOp.mensagem_sugerida} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
