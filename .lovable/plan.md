## Problema

No `supabase/functions/hook7-webhook/index.ts`, `handleMessage` hoje:

1. Pula apenas `info.IsGroup === true`. JIDs de grupo / broadcast / newsletter sem essa flag passam direto.
2. Quando uma mensagem chega de telefone desconhecido, ele cria o lead com `needs_review=true` **e em seguida** agenda a resposta da IA. Resultado: a IA responde qualquer um que mandar mensagem.
3. Não checa `needs_review` nem `status='archived'` antes de chamar `schedule_agent_response`.

## O que vou fazer

Edição única em `supabase/functions/hook7-webhook/index.ts`, função `handleMessage`:

### 1. Bloquear grupos / broadcasts / newsletters
Logo após obter `info`, descartar e retornar `'ignored'` quando:
- `info.IsGroup === true`, ou
- `info.Chat` / `info.Sender` termina em `@g.us`, `@broadcast`, `@newsletter` ou é `status@broadcast`.

### 2. Lead desconhecido → criar, salvar no inbox, NÃO responder
Mantém a criação automática do lead com `needs_review=true` e `review_reason='inbound_from_unknown_whatsapp'` (como já faz hoje). A mensagem inbound continua sendo gravada normalmente na `conversations` + `messages` (vai aparecer no inbox).

### 3. Gate da IA por `needs_review` / `status`
Substituir o bloco atual:
```ts
if (!isOutbound) {
  const { data: convCheck } = await supabase
    .from('conversations').select('agent_paused, ai_enabled')...
  if (convCheck && !convCheck.agent_paused && convCheck.ai_enabled !== false) {
    await supabase.rpc('schedule_agent_response', {...})
  }
}
```
por uma versão que **só** chama `schedule_agent_response` quando, simultaneamente:
- `isOutbound === false`
- conversa: `agent_paused === false` e `ai_enabled !== false`
- lead: `needs_review === false` **e** `status <> 'archived'` **e** `archived_at IS NULL`

Para isso vou reler o lead com `select('needs_review, status, archived_at')` (ou já trazer esses campos no `select` inicial do lookup) e usar no `if`. Quando o gate barrar, logar:
`[hook7-webhook] AI skipped — lead needs review / archived` com `lead_id` e motivo.

### 4. Marcar eventos como `ignored` quando aplicável
`handleMessage` passa a retornar `'processed' | 'ignored'`. No `switch` do `serve`, se vier `'ignored'`, gravo `processStatus = 'ignored'` em `webhook_events` (hoje qualquer non-throw vira `processed`). Motivos possíveis: `group_or_broadcast`, `no_text_body`.

> Mensagem inbound de lead `needs_review=true` conta como `processed` (a mensagem foi salva no inbox), só a IA é que não responde — esse caso **não** vira `ignored`.

## Fora de escopo
- UI de revisão de leads / inbox (não pedido).
- Mudanças no `conversation-agent` em si.
- Outras integrações (Apollo, Pipedrive, Cal.com, Resend, email).
- Auto-promover lead para "confirmado" — continua sendo ação manual do usuário (desmarcar `needs_review`).

## Arquivos
- `supabase/functions/hook7-webhook/index.ts` — única alteração funcional.

## Risco / rollback
- Risco baixo: mudança mais restritiva. Para a IA voltar a responder um número, basta o usuário abrir o lead no inbox e marcar como revisado (`needs_review=false`).
- Conversas com leads já confirmados continuam exatamente como hoje.
