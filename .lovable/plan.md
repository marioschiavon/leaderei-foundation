## O que está acontecendo

Ao clicar em "Desconectar" um WhatsApp:

1. `disconnectHook7Instance` chama `POST /instance/disconnect` no Hook7 e grava `status='disconnected'` no banco.
2. **O endpoint `/instance/disconnect` do Hook7 só fecha o socket — não encerra a sessão do WhatsApp.** O Hook7 então reabre a conexão automaticamente usando as credenciais salvas e dispara um webhook `Connected`.
3. `handleConnected` no edge function `hook7-webhook` faz `update hook7_instances set status='connected'` cegamente — sobrescrevendo a desconexão que o usuário acabou de pedir.

Resultado: a instância "reconecta sozinha" segundos depois.

As outras integrações (Apollo, Pipedrive, Cal.com, Resend) só apagam/marcam `integration_credentials` localmente — não têm esse problema. Vou só revisar mensagens de erro e idempotência, sem mudanças funcionais.

## O que vou fazer

### 1. Logout real no WhatsApp (Hook7)

Em `disconnectHook7Instance` (`src/lib/hook7.functions.ts`):

- Chamar `POST /instance/logout` primeiro (encerra a sessão WhatsApp de verdade, força novo QR na próxima conexão).
- Se o Hook7 não tiver `/instance/logout` nessa versão, cair para `/instance/disconnect`.
- Marcar a instância localmente com `status='disconnected'` e gravar um novo campo `user_disconnected_at = now()` (ver passo 2).

### 2. Ignorar eventos `Connected` obsoletos

- Migração: adicionar coluna `user_disconnected_at timestamptz` em `public.hook7_instances`.
- `handleConnected` no webhook passa a ignorar o evento quando:
  - `user_disconnected_at IS NOT NULL` **e** `user_disconnected_at >= last_connected_at` (ou nos últimos 60s).
  - Registra `webhook_events.status = 'ignored'` com motivo `stale_connected_after_user_disconnect`.
- Quando o usuário clica "Reconectar" (ou inicia novo connect/QR), zeramos `user_disconnected_at` para permitir que um próximo `Connected` real volte a marcar como conectado.

### 3. UI

- Em `WhatsAppManagerDialog` (`disconnectMut.onSuccess`): além de invalidar `["hook7-instances"]`, mostrar toast "Desconectado. Será preciso ler o QR de novo para reconectar." para deixar claro que o logout é definitivo.
- Sem mudanças no fluxo de polling de status.

### 4. Verificação das outras integrações

Apenas leitura/verificação (sem código novo):
- Apollo / Pipedrive / Cal.com / Resend: confirmar que `disconnect*` desativa `integration_credentials` e que `status='disconnected'` é refletido na listagem. Documentar resultado na resposta — sem alterações se estiverem ok.

## Detalhes técnicos

**Arquivos alterados**
- `src/lib/hook7.functions.ts` — `disconnectHook7Instance`, `reconnectHook7Instance`, `connectHook7Instance` (reset de `user_disconnected_at`).
- `supabase/functions/hook7-webhook/index.ts` — `handleConnected` passa a verificar `user_disconnected_at`.
- `src/components/app/WhatsAppManagerDialog.tsx` — texto do toast de desconexão.
- Migração: `ALTER TABLE public.hook7_instances ADD COLUMN user_disconnected_at timestamptz`.

**Risco / rollback**
- Se `/instance/logout` não existir no Hook7, o fallback para `/instance/disconnect` mantém o comportamento atual + a proteção do `user_disconnected_at` no webhook já resolve o "reconectar sozinho".
- Compatível com instâncias antigas (coluna nullable).

**Fora de escopo**
- Mudanças no fluxo de conexão inicial / QR.
- Renomear / arquivar instância.
- Outras integrações além de WhatsApp (apenas verificação).
