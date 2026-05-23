import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Send, Save, ShieldCheck, ShieldAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getPlatformSettings, setPlatformResendKey, setPlatformPlain,
  sendTestEmail, listEmailSendLogs, uploadLogoFromDataUrl,
} from "@/lib/platform.functions";
import { useAuthSession } from "@/lib/auth";

export const Route = createFileRoute("/_master/master/platform")({
  component: PlatformPage,
});

function PlatformPage() {
  const qc = useQueryClient();
  const { user } = useAuthSession();
  const fetchSettings = useServerFn(getPlatformSettings);
  const { data: settings, refetch } = useQuery({ queryKey: ["platform-settings"], queryFn: () => fetchSettings() });

  return (
    <div className="space-y-8">
      <div className="border-b pb-5">
        <h1 className="font-display text-2xl font-bold tracking-tight">Plataforma</h1>
        <p className="mt-1 text-sm text-muted-foreground">Configuração global do Leaderei — chave Resend, branding e logs de envio.</p>
      </div>

      <ResendSection settings={settings} onSaved={() => { refetch(); qc.invalidateQueries({ queryKey: ["platform-settings"] }); }} defaultEmail={user?.email ?? ""} />
      <BrandingSection settings={settings} onSaved={() => refetch()} />
      <LogsSection />
    </div>
  );
}

function ResendSection({ settings, onSaved, defaultEmail }: any) {
  const hasKey = !!settings?.resend_global_api_key?.has_secret;
  const save = useServerFn(setPlatformResendKey);
  const test = useServerFn(sendTestEmail);
  const [key, setKey] = useState("");
  const [testTo, setTestTo] = useState(defaultEmail);

  const saveMut = useMutation({
    mutationFn: (apiKey: string) => save({ data: { apiKey } }),
    onSuccess: () => { toast.success("Chave Resend salva e validada."); setKey(""); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  });

  const testMut = useMutation({
    mutationFn: (to: string) => test({ data: { to } }),
    onSuccess: (r: any) => toast.success(`Email de teste enviado. ID: ${r.provider_message_id ?? "—"}`),
    onError: (e: any) => toast.error(`Falha no envio: ${e.message}`),
  });

  return (
    <section className="rounded-xl border bg-surface p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold">Email transacional global</h2>
          <p className="text-sm text-muted-foreground">Usado para convites, boas-vindas e alertas do sistema.</p>
        </div>
        <Badge variant="secondary" className={hasKey ? "bg-emerald-500/10 text-emerald-700" : "bg-destructive/10 text-destructive"}>
          {hasKey ? (<><ShieldCheck className="mr-1 h-3 w-3" />Configurado</>) : (<><ShieldAlert className="mr-1 h-3 w-3" />Não configurado</>)}
        </Badge>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Remetente</Label>
          <Input value={`Leaderei <${settings?.resend_global_from_email?.value_plain ?? "leaderei@s7cloud.com.br"}>`} readOnly />
        </div>
        <div className="space-y-1.5">
          <Label>Chave Resend</Label>
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder={hasKey ? "re_•••••••• (configurada)" : "re_xxxxxxxxxxxx"}
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
            <Button disabled={!key || saveMut.isPending} onClick={() => saveMut.mutate(key)}>
              {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-end gap-2 rounded-lg border bg-background p-4">
        <div className="flex-1 space-y-1.5">
          <Label>Enviar email de teste para</Label>
          <Input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="seu@email.com" />
        </div>
        <Button disabled={!testTo || testMut.isPending || !hasKey} onClick={() => testMut.mutate(testTo)}>
          {testMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          Enviar teste
        </Button>
      </div>
      {!hasKey && <p className="mt-2 text-xs text-muted-foreground">Salve a chave Resend antes de enviar testes.</p>}
    </section>
  );
}

function BrandingSection({ settings, onSaved }: any) {
  const savePlain = useServerFn(setPlatformPlain);
  const upload = useServerFn(uploadLogoFromDataUrl);
  const [logoUrl, setLogoUrl] = useState(settings?.logo_public_url?.value_plain ?? "");
  const [appUrl, setAppUrl] = useState(settings?.app_public_url?.value_plain ?? (typeof window !== "undefined" ? window.location.origin : ""));

  const saveLogo = useMutation({
    mutationFn: (v: string) => savePlain({ data: { key: "logo_public_url", value: v || null } }),
    onSuccess: () => { toast.success("URL do logo salva."); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  });

  const saveApp = useMutation({
    mutationFn: (v: string) => savePlain({ data: { key: "app_public_url", value: v } }),
    onSuccess: () => { toast.success("URL do app salva."); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  });

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 1.5 * 1024 * 1024) { toast.error("Arquivo > 1.5MB."); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const r: any = await upload({ data: { filename: f.name, data_url: String(reader.result) } });
        setLogoUrl(r.url); toast.success("Logo enviado.");
        onSaved();
      } catch (err: any) { toast.error(err.message); }
    };
    reader.readAsDataURL(f);
  }

  return (
    <section className="rounded-xl border bg-surface p-6">
      <h2 className="font-display text-lg font-semibold">Branding em emails</h2>
      <p className="text-sm text-muted-foreground">Logo e URL pública usados nos templates.</p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>URL pública do logo</Label>
          <div className="flex gap-2">
            <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." />
            <Button onClick={() => saveLogo.mutate(logoUrl)} disabled={saveLogo.isPending}>Salvar</Button>
          </div>
          <div className="pt-1">
            <input id="logo-file" type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={handleFile} />
            <Button variant="outline" size="sm" onClick={() => document.getElementById("logo-file")?.click()}>Subir arquivo</Button>
          </div>
          {logoUrl && <img src={logoUrl} alt="logo preview" className="mt-2 h-10 w-auto object-contain" />}
        </div>
        <div className="space-y-1.5">
          <Label>URL pública do app</Label>
          <div className="flex gap-2">
            <Input value={appUrl} onChange={(e) => setAppUrl(e.target.value)} placeholder="https://app.leaderei.com.br" />
            <Button onClick={() => saveApp.mutate(appUrl)} disabled={saveApp.isPending}>Salvar</Button>
          </div>
          <p className="text-xs text-muted-foreground">Usada para gerar links em emails (convites etc).</p>
        </div>
      </div>
    </section>
  );
}

function LogsSection() {
  const fetchLogs = useServerFn(listEmailSendLogs);
  const { data, isLoading } = useQuery({
    queryKey: ["email-logs"],
    queryFn: () => fetchLogs({ data: {} as any }),
  });
  const rows = (data as any)?.rows ?? [];

  return (
    <section className="rounded-xl border bg-surface">
      <div className="border-b p-4">
        <h2 className="font-display text-lg font-semibold">Logs de envio recentes</h2>
        <p className="text-xs text-muted-foreground">Últimos {rows.length} registros.</p>
      </div>
      {isLoading ? <div className="p-6 text-sm text-muted-foreground">Carregando…</div> : rows.length === 0 ? (
        <div className="p-6 text-sm text-muted-foreground">Nenhum envio ainda.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="px-4 py-2">Quando</th><th className="px-4 py-2">Propósito</th><th className="px-4 py-2">Para</th><th className="px-4 py-2">Assunto</th><th className="px-4 py-2">Status</th></tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r: any) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-2"><Badge variant="outline">{r.purpose}</Badge></td>
                  <td className="px-4 py-2 font-mono text-xs">{r.to_email}</td>
                  <td className="px-4 py-2 truncate max-w-xs">{r.subject}</td>
                  <td className="px-4 py-2">
                    <Badge className={
                      r.status === "sent" ? "bg-emerald-500/10 text-emerald-700" :
                      r.status === "failed" ? "bg-destructive/10 text-destructive" :
                      "bg-amber-500/10 text-amber-700"
                    }>{r.status}</Badge>
                    {r.error_message && <div className="mt-1 text-xs text-destructive truncate max-w-xs">{r.error_message}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
