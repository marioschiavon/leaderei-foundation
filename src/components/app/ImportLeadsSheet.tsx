import { useState } from "react";
import Papa from "papaparse";
import { Loader2, Upload, FileText, CheckCircle2, AlertTriangle } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { importLeads } from "@/lib/tenant.functions";

type LeadSource = { id: string; name: string; slug: string; color: string | null };
type ParsedRow = Record<string, string | null | undefined>;

type ImportResult = {
  received: number;
  created: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
};

export function ImportLeadsSheet({
  open,
  onOpenChange,
  sources,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sources: LeadSource[];
}) {
  const queryClient = useQueryClient();
  const importFn = useServerFn(importLeads);

  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [sourceId, setSourceId] = useState<string>("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [parsing, setParsing] = useState(false);

  const reset = () => {
    setFileName(null);
    setRows([]);
    setHeaders([]);
    setSourceId("");
    setResult(null);
  };

  const onFile = (file: File) => {
    setParsing(true);
    setResult(null);
    Papa.parse<ParsedRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (res) => {
        setFileName(file.name);
        setHeaders(res.meta.fields ?? []);
        setRows((res.data ?? []).slice(0, 2000));
        setParsing(false);
      },
      error: (err) => {
        setParsing(false);
        toast.error(`Falha ao ler CSV: ${err.message}`);
      },
    });
  };

  const mutation = useMutation({
    mutationFn: () =>
      importFn({
        data: {
          rows: rows.map((r) =>
            Object.fromEntries(
              Object.entries(r).map(([k, v]) => [k, v == null ? null : String(v)]),
            ),
          ),
          source_id: sourceId || null,
        },
      }),
    onSuccess: (r) => {
      setResult(r as ImportResult);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      const msg = `${r.created} criados · ${r.skipped} ignorados`;
      r.skipped > 0 ? toast.warning(msg) : toast.success(msg);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Importar leads via CSV</SheetTitle>
          <SheetDescription>
            Cabeçalhos aceitos: <code>full_name</code> (ou <code>nome</code>),{" "}
            <code>email</code>, <code>phone</code>, <code>company_name</code>,{" "}
            <code>job_title</code>. Linhas sem nome ou email válido são ignoradas.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="csv">Arquivo CSV</Label>
            <Input
              id="csv"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
            />
            {parsing && (
              <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Lendo arquivo…
              </p>
            )}
            {fileName && !parsing && (
              <div className="rounded-lg border bg-surface-muted/40 p-3 text-xs">
                <div className="inline-flex items-center gap-2 font-medium">
                  <FileText className="h-3.5 w-3.5" />
                  {fileName} — {rows.length} linha(s)
                </div>
                {headers.length > 0 && (
                  <div className="mt-1 text-muted-foreground">
                    Colunas: {headers.join(", ")}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Origem padrão (opcional)</Label>
            <Select value={sourceId} onValueChange={setSourceId}>
              <SelectTrigger>
                <SelectValue placeholder="Sem origem definida" />
              </SelectTrigger>
              <SelectContent>
                {sources.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {result && (
            <div className="space-y-2 rounded-lg border bg-surface p-3 text-sm">
              <div className="inline-flex items-center gap-2 font-medium">
                {result.skipped === 0 ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                )}
                {result.created} criado(s), {result.skipped} ignorado(s) de{" "}
                {result.received} linha(s).
              </div>
              {result.errors.length > 0 && (
                <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                  {result.errors.map((e, i) => (
                    <li key={i}>
                      Linha {e.row}: {e.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button
            disabled={rows.length === 0 || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Importar {rows.length > 0 ? `${rows.length} linha(s)` : ""}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
