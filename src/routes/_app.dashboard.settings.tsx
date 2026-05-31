import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Loader2, MoreHorizontal, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuthSession } from "@/lib/auth";
import { getMyContext } from "@/lib/tenant.functions";
import {
  getMyOrganization, updateMyOrganization,
  listOrgMembers, listOrgInvitations,
  inviteMember, sendInvitationEmail, updateMemberRole, removeMember, revokeInvitation,
  listApiKeys, createApiKey, revokeApiKey,
} from "@/lib/settings.functions";
import { getWhatsAppMode, updateWhatsAppMode } from "@/lib/hook7.functions";

export const Route = createFileRoute("/_app/dashboard/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const fetchCtx = useServerFn(getMyContext);
  const { data: ctx } = useQuery({ queryKey: ["my-context"], queryFn: () => fetchCtx() });
  const isAdmin = ctx?.role === "company_admin" || ctx?.isMaster;

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" description="Gerencie sua organização, membros e chaves." />
      <Tabs defaultValue="org">
        <TabsList>
          <TabsTrigger value="org">Organização</TabsTrigger>
          <TabsTrigger value="members">Membros</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="api">API keys</TabsTrigger>
          <TabsTrigger value="billing">Faturamento</TabsTrigger>
          <TabsTrigger value="prefs">Preferências</TabsTrigger>
        </TabsList>

        <TabsContent value="org" className="mt-6"><OrgTab isAdmin={!!isAdmin} /></TabsContent>
        <TabsContent value="members" className="mt-6"><MembersTab isAdmin={!!isAdmin} /></TabsContent>
        <TabsContent value="whatsapp" className="mt-6"><WhatsAppTab isAdmin={!!isAdmin} /></TabsContent>
        <TabsContent value="api" className="mt-6"><ApiKeysTab isAdmin={!!isAdmin} /></TabsContent>

        <TabsContent value="billing" className="mt-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border bg-surface p-6">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Plano atual</span>
              <div className="mt-2 font-display text-2xl font-bold">Em breve</div>
              <p className="mt-1 text-sm text-muted-foreground">Renova automaticamente em 30 dias.</p>
            </div>
            <div className="rounded-xl border bg-surface p-6">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Próxima cobrança</span>
              <div className="mt-2 font-display text-2xl font-bold">R$ 0,00</div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="prefs" className="mt-6">
          <div className="max-w-xl rounded-xl border bg-surface p-6 text-sm text-muted-foreground">
            Preferências de notificação e idioma serão configuráveis aqui.
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================ ORG TAB ============================
function OrgTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const fetchOrg = useServerFn(getMyOrganization);
  const updateOrg = useServerFn(updateMyOrganization);
  const { data: org, isLoading } = useQuery({ queryKey: ["my-org"], queryFn: () => fetchOrg() });

  const [form, setForm] = useState<any>(null);
  useEffect(() => { if (org) setForm({ ...org }); }, [org]);

  const dirty = !!org && !!form && (
    org.name !== form.name ||
    org.slug !== form.slug ||
    (org.billing_email ?? "") !== (form.billing_email ?? "") ||
    (org.industry ?? "") !== (form.industry ?? "") ||
    (org.country ?? "") !== (form.country ?? "") ||
    (org.timezone ?? "") !== (form.timezone ?? "") ||
    (org.logo_url ?? "") !== (form.logo_url ?? "")
  );

  const mut = useMutation({
    mutationFn: (patch: any) => updateOrg({ data: patch }),
    onSuccess: () => {
      toast.success("Configurações salvas.");
      qc.invalidateQueries({ queryKey: ["my-org"] });
      qc.invalidateQueries({ queryKey: ["my-context"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const tzList = (() => {
    try { return (Intl as any).supportedValuesOf?.("timeZone") as string[] ?? []; }
    catch { return []; }
  })();

  if (isLoading || !form) {
    return <div className="rounded-xl border bg-surface p-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  }

  const disabledMsg = !isAdmin ? "Apenas administradores podem editar." : undefined;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="grid max-w-3xl gap-6">
        <div className="space-y-5 rounded-xl border bg-surface p-6">
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Nome da organização" tooltip={disabledMsg}>
              <Input value={form.name ?? ""} disabled={!isAdmin}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Slug" hint="Mudar o slug pode quebrar links salvos." tooltip={disabledMsg}>
              <Input value={form.slug ?? ""} disabled={!isAdmin}
                onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} />
            </Field>
            <Field label="Email de cobrança" tooltip={disabledMsg}>
              <Input type="email" value={form.billing_email ?? ""} disabled={!isAdmin}
                onChange={(e) => setForm({ ...form, billing_email: e.target.value })} />
            </Field>
            <Field label="Indústria" tooltip={disabledMsg}>
              <Input value={form.industry ?? ""} disabled={!isAdmin}
                onChange={(e) => setForm({ ...form, industry: e.target.value })} />
            </Field>
            <Field label="País" tooltip={disabledMsg}>
              <Input value={form.country ?? ""} disabled={!isAdmin}
                onChange={(e) => setForm({ ...form, country: e.target.value })} />
            </Field>
            <Field label="Fuso horário" tooltip={disabledMsg}>
              {tzList.length > 0 ? (
                <Select value={form.timezone ?? "UTC"} disabled={!isAdmin}
                  onValueChange={(v) => setForm({ ...form, timezone: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {tzList.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={form.timezone ?? ""} disabled={!isAdmin}
                  onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
              )}
            </Field>
          </div>

          <div className="space-y-1.5">
            <Label>Logo (URL)</Label>
            <div className="flex items-center gap-3">
              {form.logo_url ? (
                <img src={form.logo_url} alt="" className="h-12 w-12 rounded-lg border object-cover bg-background"
                  onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = "hidden")} />
              ) : (
                <div className="grid h-12 w-12 place-items-center rounded-lg border bg-background text-xs text-muted-foreground">
                  logo
                </div>
              )}
              <Input value={form.logo_url ?? ""} disabled={!isAdmin}
                placeholder="https://…/logo.png"
                onChange={(e) => setForm({ ...form, logo_url: e.target.value })} />
            </div>
          </div>

          <div className="flex justify-end">
            <Button disabled={!isAdmin || !dirty || mut.isPending}
              onClick={() => mut.mutate({
                name: form.name, slug: form.slug, logo_url: form.logo_url,
                billing_email: form.billing_email, industry: form.industry,
                country: form.country, timezone: form.timezone,
              })}>
              {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar alterações
            </Button>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

function Field({ label, hint, tooltip, children }: { label: string; hint?: string; tooltip?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {tooltip ? (
        <Tooltip><TooltipTrigger asChild><div>{children}</div></TooltipTrigger><TooltipContent>{tooltip}</TooltipContent></Tooltip>
      ) : children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ============================ MEMBERS TAB ============================
function MembersTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const fetchMembers = useServerFn(listOrgMembers);
  const fetchInvites = useServerFn(listOrgInvitations);
  const { data: members = [] } = useQuery({ queryKey: ["org-members"], queryFn: () => fetchMembers() });
  const { data: invites = [] } = useQuery({ queryKey: ["org-invites"], queryFn: () => fetchInvites() });

  const active = members.filter((m: any) => m.status === "active");

  const [open, setOpen] = useState(false);
  const [createdInvite, setCreatedInvite] = useState<{ id: string; url: string } | null>(null);

  function refresh() {
    qc.invalidateQueries({ queryKey: ["org-members"] });
    qc.invalidateQueries({ queryKey: ["org-invites"] });
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        <div className="rounded-xl border bg-surface">
          <div className="flex items-center justify-between border-b p-4">
            <div>
              <div className="font-medium">Membros ativos</div>
              <div className="text-xs text-muted-foreground">{active.length} pessoas</div>
            </div>
            {isAdmin && (
              <Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-1.5 h-4 w-4" />Convidar membro</Button>
            )}
          </div>
          {active.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Nenhum membro ativo.</div>
          ) : (
            <ul className="divide-y">
              {active.map((m: any) => (
                <li key={m.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{m.full_name ?? m.email ?? "Sem nome"}</div>
                    <div className="truncate text-sm text-muted-foreground">{m.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-muted text-foreground border-transparent">
                      {m.role === "company_admin" ? "Admin" : "Membro"}
                    </Badge>
                    {isAdmin && <MemberMenu member={m} onChanged={refresh} />}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border bg-surface">
          <div className="border-b p-4">
            <div className="font-medium">Convites pendentes</div>
            <div className="text-xs text-muted-foreground">{invites.length} aguardando aceite</div>
          </div>
          {invites.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Nenhum convite pendente.</div>
          ) : (
            <ul className="divide-y">
              {invites.map((i: any) => (
                <li key={i.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{i.email}</div>
                    <div className="text-xs text-muted-foreground">
                      Expira em {new Date(i.expires_at).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{i.role === "company_admin" ? "Admin" : "Membro"}</Badge>
                    <Badge variant="outline">Aguardando aceite</Badge>
                    {isAdmin && <InviteMenu invite={i} onChanged={refresh} />}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <InviteDialog open={open} onOpenChange={setOpen}
          onCreated={(data) => { setOpen(false); setCreatedInvite({ id: data.invitation_id, url: data.invite_url }); refresh(); }} />

        {createdInvite && (
          <InviteSuccessDialog invite={createdInvite} onClose={() => setCreatedInvite(null)} />
        )}
      </div>
    </TooltipProvider>
  );
}

function MemberMenu({ member, onChanged }: { member: any; onChanged: () => void }) {
  const updateRole = useServerFn(updateMemberRole);
  const remove = useServerFn(removeMember);
  const [confirmRemove, setConfirmRemove] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {member.role !== "company_admin" && (
            <DropdownMenuItem onClick={async () => {
              try { await updateRole({ data: { member_id: member.id, role: "company_admin" } }); toast.success("Promovido a admin."); onChanged(); }
              catch (e: any) { toast.error(e.message); }
            }}>Promover a admin</DropdownMenuItem>
          )}
          {member.role === "company_admin" && (
            <DropdownMenuItem onClick={async () => {
              try { await updateRole({ data: { member_id: member.id, role: "user" } }); toast.success("Rebaixado a membro."); onChanged(); }
              catch (e: any) { toast.error(e.message); }
            }}>Rebaixar a membro</DropdownMenuItem>
          )}
          <DropdownMenuItem className="text-destructive" onClick={() => setConfirmRemove(true)}>
            <Trash2 className="mr-2 h-4 w-4" />Remover
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover membro?</AlertDialogTitle>
            <AlertDialogDescription>O membro perde acesso imediatamente à organização.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              try { await remove({ data: { member_id: member.id } }); toast.success("Membro removido."); onChanged(); }
              catch (e: any) { toast.error(e.message); }
            }}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function InviteMenu({ invite, onChanged }: { invite: any; onChanged: () => void }) {
  const revoke = useServerFn(revokeInvitation);
  const sendEmail = useServerFn(sendInvitationEmail);
  const link = `${window.location.origin}/invite/${invite.token ?? ""}`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={async () => {
          try { await sendEmail({ data: { invitation_id: invite.id } }); toast.success("E-mail enviado."); }
          catch (e: any) { toast.error(e.message); }
        }}>Reenviar por email</DropdownMenuItem>
        <DropdownMenuItem onClick={async () => {
          if (invite.token) { await navigator.clipboard.writeText(link); toast.success("Link copiado."); }
          else toast.info("Link não disponível para este convite.");
        }}>Copiar link</DropdownMenuItem>
        <DropdownMenuItem className="text-destructive" onClick={async () => {
          try { await revoke({ data: { invitation_id: invite.id } }); toast.success("Convite revogado."); onChanged(); }
          catch (e: any) { toast.error(e.message); }
        }}>Revogar</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function InviteDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: (d: any) => void }) {
  const invite = useServerFn(inviteMember);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"user" | "company_admin">("user");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!open) { setEmail(""); setRole("user"); } }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convidar membro</DialogTitle>
          <DialogDescription>Enviamos um link único para o e-mail informado.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pessoa@empresa.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Papel</Label>
            <Select value={role} onValueChange={(v) => setRole(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Membro</SelectItem>
                <SelectItem value="company_admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={busy || !email} onClick={async () => {
            setBusy(true);
            try {
              const r = await invite({ data: { email, role } });
              onCreated(r);
            } catch (e: any) { toast.error(e.message); }
            finally { setBusy(false); }
          }}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enviar convite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InviteSuccessDialog({ invite, onClose }: { invite: { id: string; url: string }; onClose: () => void }) {
  const sendEmail = useServerFn(sendInvitationEmail);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convite criado</DialogTitle>
          <DialogDescription>Compartilhe o link com a pessoa convidada.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea readOnly value={invite.url} className="font-mono text-xs" rows={2} />
        </div>
        <DialogFooter>
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button variant="outline" onClick={async () => {
                    try { await sendEmail({ data: { invitation_id: invite.id } }); toast.success("Email enviado."); }
                    catch (e: any) { toast.error(e.message); }
                  }}>Enviar por email</Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Conecte o Resend em Integrações para enviar por email. Por enquanto copie o link.</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button onClick={async () => { await navigator.clipboard.writeText(invite.url); toast.success("Link copiado."); }}>
            <Copy className="mr-1.5 h-4 w-4" />Copiar link
          </Button>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================ API KEYS TAB ============================
function ApiKeysTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const fetchKeys = useServerFn(listApiKeys);
  const create = useServerFn(createApiKey);
  const revoke = useServerFn(revokeApiKey);
  const { data: keys = [] } = useQuery({ queryKey: ["api-keys"], queryFn: () => fetchKeys(), enabled: isAdmin });

  const [openCreate, setOpenCreate] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);

  if (!isAdmin) {
    return (
      <div className="max-w-xl rounded-xl border bg-surface p-6 text-sm text-muted-foreground">
        Apenas administradores podem gerenciar chaves de API.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-surface">
        <div className="flex items-center justify-between border-b p-4">
          <div className="font-medium">Chaves de API</div>
          <Button size="sm" onClick={() => { setName(""); setOpenCreate(true); }}>
            <Plus className="mr-1.5 h-4 w-4" />Gerar nova chave
          </Button>
        </div>
        {keys.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">Nenhuma chave gerada ainda.</div>
        ) : (
          <ul className="divide-y">
            {keys.map((k: any) => {
              const revoked = !!k.revoked_at;
              return (
                <li key={k.id} className={"flex items-center justify-between gap-4 p-4 " + (revoked ? "text-muted-foreground" : "")}>
                  <div className="min-w-0">
                    <div className="font-medium">{k.name}</div>
                    <div className="font-mono text-xs">{k.key_prefix}</div>
                    <div className="text-xs text-muted-foreground">
                      Criada em {new Date(k.created_at).toLocaleDateString("pt-BR")}
                      {k.last_used_at && ` · Último uso ${new Date(k.last_used_at).toLocaleDateString("pt-BR")}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {revoked ? <Badge variant="outline">Revogada</Badge> : <Badge>Ativa</Badge>}
                    {!revoked && (
                      <Button variant="ghost" size="sm" onClick={() => setConfirmRevoke(k.id)}>Revogar</Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Dialog open={openCreate} onOpenChange={(o) => { if (!busy) setOpenCreate(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar nova chave</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Integração Zapier prod" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenCreate(false)} disabled={busy}>Cancelar</Button>
            <Button disabled={!name || busy} onClick={async () => {
              setBusy(true);
              try {
                const r = await create({ data: { name } });
                setOpenCreate(false);
                setPlaintext(r.plaintext_key);
                qc.invalidateQueries({ queryKey: ["api-keys"] });
              } catch (e: any) { toast.error(e.message); }
              finally { setBusy(false); }
            }}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Gerar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Blocking one-shot reveal */}
      <Dialog open={!!plaintext} onOpenChange={() => { /* must explicitly confirm */ }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sua nova chave de API</DialogTitle>
            <DialogDescription>
              Esta é a única vez que você verá a chave completa. Guarde em local seguro antes de fechar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border bg-muted p-3 font-mono text-xs break-all">{plaintext}</div>
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Não armazenaremos a chave em texto puro. Após fechar, ela não pode ser recuperada.</span>
            </div>
            <Button className="w-full" onClick={async () => {
              if (plaintext) await navigator.clipboard.writeText(plaintext);
              toast.success("Chave copiada.");
            }}>
              <Copy className="mr-1.5 h-4 w-4" />Copiar chave
            </Button>
          </div>
          <DialogFooter>
            <Button variant="default" onClick={() => setPlaintext(null)}>Já copiei e guardei</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmRevoke} onOpenChange={(o) => !o && setConfirmRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar chave?</AlertDialogTitle>
            <AlertDialogDescription>Aplicações usando esta chave perderão acesso imediatamente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              try {
                await revoke({ data: { id: confirmRevoke! } });
                toast.success("Chave revogada.");
                qc.invalidateQueries({ queryKey: ["api-keys"] });
              } catch (e: any) { toast.error(e.message); }
              finally { setConfirmRevoke(null); }
            }}>Revogar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Suppress unused import warning (keep session import wired for future use)
void useAuthSession;
