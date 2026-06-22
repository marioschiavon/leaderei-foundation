## Problema

Quando o usuário lê o QR Code no celular, o Hook7 envia o evento **`PairSuccess`** para o webhook. Hoje esse evento é classificado como "unknown" e descartado — por isso a UI continua mostrando "pendente de conexão" mesmo com o WhatsApp já pareado no telefone.

Logs do webhook confirmam:
```
[hook7-webhook] unknown event { event: "PairSuccess", instanceId: "af4b7117-..." }
```

O evento `Connected` (que hoje atualiza `status = 'connected'`) só chega depois — em algumas instâncias do Hook7 ele atrasa ou nem vem após o pareamento inicial, deixando a instância travada como `pending`/`qr_pending`.

## Solução

Tratar `PairSuccess` no `supabase/functions/hook7-webhook/index.ts` como um evento de conexão bem-sucedida, atualizando o registro em `hook7_instances` para `status = 'connected'`.

### Alterações

**1. `supabase/functions/hook7-webhook/index.ts`**

- Adicionar `case "PairSuccess":` no `switch` chamando um novo `handlePairSuccess`.
- `handlePairSuccess` faz update do `hook7_instances`:
  - `status = 'connected'`
  - `last_connected_at = now()`
  - `phone_number` = extraído de `data.jid` / `data.JID` / `data.ID` quando presente (usando `stripJid`)
  - `connected_profile_name` = `data.pushName` / `data.PushName` quando presente
  - respeita a mesma janela de 5 minutos de `user_disconnected_at` que `handleConnected` já usa (extrair lógica em helper compartilhado ou duplicar de forma enxuta)
- Reutiliza o `instance` já carregado (que inclui `user_disconnected_at`).

**2. Nenhuma mudança de schema, RLS, server functions ou UI.**

A UI já faz polling/refetch da lista de instâncias — assim que o status virar `connected` no banco, o card sai de "pendente".

## Fora de escopo

- Não mexer no fluxo de `Connected` / `LoggedOut`.
- Não alterar o nome padrão "Google Chrome (Evolution Go)" que aparece no celular — isso é o user-agent fixo que o Hook7/Evolution envia ao WhatsApp; mudá-lo exige configuração no servidor Hook7, fora deste app.
- Não tocar em `renameHook7Instance` / `deleteHook7Instance` / `createHook7Instance`.
