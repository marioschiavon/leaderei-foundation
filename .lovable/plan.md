## Causa raiz

A página `/dashboard/integrations` lê o status diretamente da coluna `organization_integrations.status`. Existem hoje linhas com `status = 'connected'` mas **sem credencial correspondente** em `integration_credentials` — sobras de tentativas de conexão anteriores (quando o GRANT estava faltando, o upsert de `organization_integrations` chegou a entrar mas o insert de credenciais não). Resultado: Apollo, Pipedrive e Resend aparecem "Conectado" mesmo sem chave válida.

Confirmação no banco:

```text
apollo     | org 48190…  | status=connected | has_cred=false
apollo     | org a7414…  | status=connected | has_cred=false
pipedrive  | org 48190…  | status=connected | has_cred=false
resend     | org a7414…  | status=connected | has_cred=false
```

## Correção

Duas frentes, na mesma rodada:

1. **Limpeza de dados (migração SQL)** — para os providers que exigem credencial (`apollo`, `pipedrive`, `resend`, `cal_com`, `hubspot`, `linkedin`), marcar como `disconnected` toda linha de `organization_integrations` sem credencial em `integration_credentials`. Hook7/WhatsApp segue intocado (status real vem de `hook7_instances`).

2. **Blindagem no servidor** — em `listIntegrations` (`src/lib/tenant.functions.ts`), também buscar `integration_credentials` da organização e, para os providers acima, sobrescrever o status como `disconnected` quando não houver credencial. Garante que futuras inconsistências não voltem a enganar a UI.

## Fora de escopo

- WhatsApp/Hook7 (já trata status próprio na UI).
- Reescrita dos fluxos de connect/disconnect.
- Mudanças visuais.