import { useMemo, useState } from "react";
import Papa from "papaparse";
import {
  Loader2,
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
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

const IGNORE = "__ignore" as const;

type DbField =
  | "full_name"
  | "email"
  | "phone"
  | "company_name"
  | "job_title"
  | "linkedin_url"
  | "website_url"
  | "city"
  | "country"
  | "tags";

type DbFieldDef = { value: DbField; label: string; required?: boolean };
const DB_FIELDS: DbFieldDef[] = [
  { value: "full_name", label: "Nome completo", required: true },
  { value: "email", label: "Email", required: true },
  { value: "phone", label: "Telefone" },
  { value: "company_name", label: "Empresa" },
  { value: "job_title", label: "Cargo" },
  { value: "linkedin_url", label: "LinkedIn" },
  { value: "website_url", label: "Website" },
  { value: "city", label: "Cidade" },
  { value: "country", label: "País" },
  { value: "tags", label: "Tags (separadas por , ou ;)" },
];

const REQUIRED: DbField[] = ["full_name", "email"];

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function suggest(header: string): DbField | typeof IGNORE {
  const n = norm(header);
  if (/\b(nome completo|full name|fullname|nome|name)\b/.test(n)) return "full_name";
  if (/\b(e ?mail|mail)\b/.test(n)) return "email";
  if (/\b(telefone|phone|celular|whatsapp|mobile|tel)\b/.test(n)) return "phone";
  if (/\b(empresa|company|organizacao|organization)\b/.test(n)) return "company_name";
  if (/\b(cargo|job|titulo|position|role)\b/.test(n)) return "job_title";
  if (/linkedin/.test(n)) return "linkedin_url";
  if (/\b(site|website|url|web)\b/.test(n)) return "website_url";
  if (/\b(cidade|city)\b/.test(n)) return "city";
  if (/\b(pais|country)\b/.test(n)) return "country";
  if (/\b(tags?|etiquetas?)\b/.test(n)) return "tags";
  return IGNORE;
}

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

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [headerNotices, setHeaderNotices] = useState<string[]>([]);
  const [encodingError, setEncodingError] = useState(false);
  const [delimiterWarning, setDelimiterWarning] = useState(false);
  const [mapping, setMapping] = useState<Record<string, DbField | typeof IGNORE>>({});
  const [sourceId, setSourceId] = useState<string>("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [parsing, setParsing] = useState(false);

  const reset = () => {
    setStep(1);
    setFileName(null);
    setRows([]);
    setHeaders([]);
    setHeaderNotices([]);
    setEncodingError(false);
    setDelimiterWarning(false);
    setMapping({});
    setSourceId("");
    setResult(null);
  };

  const onFile = (file: File) => {
    setParsing(true);
    setResult(null);
    setHeaderNotices([]);
    setEncodingError(false);
    setDelimiterWarning(false);
    setHeaders([]);
    setRows([]);
    setMapping({});
    setFileName(file.name);

    // Pre-read raw text to detect encoding issues (replacement char) and first-line size.
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const hasEncodingIssue = text.includes("\uFFFD");
      const firstLine = text.split(/\r?\n/, 1)[0] ?? "";

      if (hasEncodingIssue) {
        setEncodingError(true);
        setParsing(false);
        return;
      }

      Papa.parse<string[]>(text, {
        header: false,
        skipEmptyLines: true,
        delimitersToGuess: [",", ";", "\t", "|"],
        complete: (res) => {
          const all = (res.data ?? []) as string[][];
          if (all.length === 0) {
            setParsing(false);
            toast.error("CSV vazio.");
            return;
          }
          const rawHeaders = all[0].map((h) => (h ?? "").toString().trim());

          // Detect bad single-column parse on a fat first line.
          if (rawHeaders.length === 1 && firstLine.length > 100) {
            setDelimiterWarning(true);
          }

          // Normalize: empty → "Coluna N"; duplicates → suffix _2, _3…
          const notices: string[] = [];
          const seen = new Map<string, number>();
          const cleaned: string[] = rawHeaders.map((h, i) => {
            let name = h;
            if (!name) {
              name = `Coluna ${i + 1}`;
              notices.push(`Coluna ${i + 1} estava sem cabeçalho.`);
            }
            const count = seen.get(name) ?? 0;
            seen.set(name, count + 1);
            if (count > 0) {
              const suffixed = `${name}_${count + 1}`;
              notices.push(`Cabeçalho duplicado "${name}" renomeado para "${suffixed}".`);
              return suffixed;
            }
            return name;
          });

          const dataRows: ParsedRow[] = all.slice(1, 2001).map((arr) => {
            const obj: ParsedRow = {};
            cleaned.forEach((k, idx) => {
              obj[k] = arr[idx] ?? null;
            });
            return obj;
          });

          const initial: Record<string, DbField | typeof IGNORE> = {};
          const used = new Set<DbField>();
          for (const h of cleaned) {
            const s = suggest(h);
            if (s !== IGNORE && !used.has(s)) {
              initial[h] = s;
              used.add(s);
            } else {
              initial[h] = IGNORE;
            }
          }

          setHeaders(cleaned);
          setHeaderNotices(notices);
          setRows(dataRows);
          setMapping(initial);
          setParsing(false);
        },
        error: (err: Error) => {
          setParsing(false);
          toast.error(`Falha ao ler CSV: ${err.message}`);
        },
      });
    };
    reader.onerror = () => {
      setParsing(false);
      toast.error("Não foi possível ler o arquivo.");
    };
    reader.readAsText(file, "utf-8");
  };


  const usedFields = useMemo(() => {
    const s = new Set<DbField>();
    Object.values(mapping).forEach((v) => v !== IGNORE && s.add(v));
    return s;
  }, [mapping]);

  const missingRequired = REQUIRED.filter((f) => !usedFields.has(f));

  const normalizedRows = useMemo(() => {
    return rows.map((r) => {
      const out: Record<string, string | string[] | null> = {};
      for (const [csvCol, dbField] of Object.entries(mapping)) {
        if (dbField === IGNORE) continue;
        const raw = r[csvCol];
        const v = raw == null ? "" : String(raw).trim();
        if (!v) continue;
        if (dbField === "tags") {
          out[dbField] = v.split(/[,;]/).map((t) => t.trim()).filter(Boolean);
        } else {
          out[dbField] = v;
        }
      }
      return out;
    });
  }, [rows, mapping]);

  const mutation = useMutation({
    mutationFn: () =>
      importFn({
        data: {
          rows: normalizedRows as never,
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

  const sampleFor = (h: string) =>
    rows
      .slice(0, 2)
      .map((r) => r[h])
      .filter((v) => v != null && String(v).trim() !== "")
      .map((v) => String(v))
      .join(" · ");

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <SheetContent className="flex w-full flex-col overflow-hidden sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Importar leads via CSV</SheetTitle>
          <SheetDescription>
            Passo {step} de 3 ·{" "}
            {step === 1
              ? "Envie o arquivo"
              : step === 2
                ? "Mapeie as colunas do CSV para os campos do Leaderei"
                : "Revise e confirme"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex-1 overflow-y-auto pr-1">
          {step === 1 && (
            <div className="space-y-5">
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
                {fileName && !parsing && !encodingError && (
                  <div className="rounded-lg border bg-surface-muted/40 p-3 text-xs">
                    <div className="inline-flex items-center gap-2 font-medium">
                      <FileText className="h-3.5 w-3.5" />
                      {fileName} — {rows.length} linha(s), {headers.length} coluna(s)
                    </div>
                  </div>
                )}
                {encodingError && (
                  <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      Este arquivo parece estar em um encoding diferente de UTF-8
                      (caracteres especiais aparecem corrompidos). Reabra o arquivo
                      no Excel/Google Sheets e salve como <strong>CSV UTF-8</strong>{" "}
                      antes de subir.
                    </span>
                  </div>
                )}
                {delimiterWarning && !encodingError && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-300/50 bg-amber-50/60 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      Não consegui detectar separador de colunas. Confirme que o
                      arquivo é um CSV válido.
                    </span>
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
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {headerNotices.length > 0 && (
                <div className="flex items-start gap-2 rounded-md border border-amber-300/50 bg-amber-50/60 p-2.5 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <div className="space-y-0.5">
                    <div className="font-medium">
                      Cabeçalhos ajustados automaticamente:
                    </div>
                    <ul className="list-disc pl-4">
                      {headerNotices.map((n, i) => (
                        <li key={i}>{n}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              {missingRequired.length > 0 && (
                <div className="inline-flex items-start gap-2 rounded-md border border-amber-300/50 bg-amber-50/60 p-2.5 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Mapeie obrigatoriamente:{" "}
                    <strong>
                      {missingRequired
                        .map((f) => DB_FIELDS.find((d) => d.value === f)?.label)
                        .join(" e ")}
                    </strong>
                    .
                  </span>
                </div>
              )}

              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-surface-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Coluna do CSV</th>
                      <th className="px-3 py-2 text-left">Amostra</th>
                      <th className="px-3 py-2 text-left">Campo no Leaderei</th>
                    </tr>
                  </thead>
                  <tbody>
                    {headers.map((h) => {
                      const current = mapping[h] ?? IGNORE;
                      return (
                        <tr key={h} className="border-t">
                          <td className="px-3 py-2 align-top font-medium">{h}</td>
                          <td className="px-3 py-2 align-top text-xs text-muted-foreground">
                            {sampleFor(h) || <span className="italic">—</span>}
                          </td>
                          <td className="px-3 py-2 align-top">
                            <Select
                              value={current}
                              onValueChange={(v) =>
                                setMapping((m) => ({ ...m, [h]: v as DbField | typeof IGNORE }))
                              }
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={IGNORE}>Ignorar</SelectItem>
                                {DB_FIELDS.map((f) => {
                                  const taken = usedFields.has(f.value) && current !== f.value;
                                  return (
                                    <SelectItem
                                      key={f.value}
                                      value={f.value}
                                      disabled={taken}
                                    >
                                      {f.label}
                                      {f.required ? " *" : ""}
                                      {taken ? " (em uso)" : ""}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                * Campos obrigatórios. Linhas sem nome ou email válido serão ignoradas.
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-surface p-4 text-sm">
                <div className="font-medium">Pronto para importar</div>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <li>• Arquivo: {fileName}</li>
                  <li>• {rows.length} linha(s) serão enviadas para importação</li>
                  <li>• {usedFields.size} campo(s) mapeados</li>
                  <li>
                    • Origem padrão:{" "}
                    {sourceId
                      ? sources.find((s) => s.id === sourceId)?.name
                      : "nenhuma"}
                  </li>
                </ul>
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
          )}
        </div>

        <SheetFooter className="mt-4 border-t pt-4">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}>
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          {step === 1 && (
            <Button
              disabled={rows.length === 0 || encodingError}
              onClick={() => setStep(2)}
            >
              Avançar <ArrowRight className="h-4 w-4" />
            </Button>
          )}
          {step === 2 && (
            <Button
              disabled={missingRequired.length > 0}
              onClick={() => setStep(3)}
            >
              Avançar <ArrowRight className="h-4 w-4" />
            </Button>
          )}
          {step === 3 && (
            <Button
              disabled={mutation.isPending || !!result}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Importar {rows.length} linha(s)
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
