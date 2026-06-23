// Parses uploaded .txt or .pdf from knowledge-docs storage bucket and returns text.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function cleanText(s: string): string {
  return s
    .replace(/\r\n/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 8000);
}

function extractPdfText(buf: Uint8Array): string {
  // Naive extractor for text-based PDFs: pull strings inside (...) within BT..ET blocks.
  const text = new TextDecoder("latin1").decode(buf);
  const parts: string[] = [];
  const blockRe = /BT([\s\S]*?)ET/g;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(text))) {
    const block = m[1];
    const strRe = /\(((?:\\.|[^\\()])*)\)/g;
    let s: RegExpExecArray | null;
    while ((s = strRe.exec(block))) {
      const piece = s[1]
        .replace(/\\\(/g, "(")
        .replace(/\\\)/g, ")")
        .replace(/\\\\/g, "\\")
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\n")
        .replace(/\\t/g, " ");
      if (piece.trim()) parts.push(piece);
    }
    parts.push("\n");
  }
  return parts.join(" ");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { file_path, file_name } = await req.json();
    if (!file_path || !file_name) {
      return new Response(JSON.stringify({ error: "missing file_path/file_name" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: blob, error } = await supabase.storage
      .from("knowledge-docs")
      .download(file_path);
    if (error || !blob) {
      return new Response(JSON.stringify({ error: `download: ${error?.message ?? "no blob"}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const buf = new Uint8Array(await blob.arrayBuffer());
    const lower = String(file_name).toLowerCase();
    const title = String(file_name).replace(/\.(pdf|txt)$/i, "");

    let content: string | null = null;
    let warning: string | undefined;

    if (lower.endsWith(".txt")) {
      content = cleanText(new TextDecoder("utf-8").decode(buf));
    } else if (lower.endsWith(".pdf")) {
      const raw = extractPdfText(buf);
      const cleaned = cleanText(raw);
      if (cleaned.length < 30) {
        content = null;
        warning = "PDF sem texto extraível — adicione o conteúdo manualmente.";
      } else {
        content = cleaned;
      }
    } else {
      warning = "Formato não suportado.";
    }

    return new Response(JSON.stringify({ title, content, warning }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
