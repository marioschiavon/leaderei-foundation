## Diagnóstico

As políticas RLS de duas tabelas usadas pelas integrações exigem **explicitamente** o papel `company_admin`:

- `integration_credentials` → política "Org admins manage integration credentials"
- `pipedrive_sync_runs` → política "Org admins manage pipedrive_sync_runs"

Verifiquei no banco: usuários **master_admin** (Nico, Mario S7) possuem apenas a role `master_admin` e **não** possuem `company_admin`. Por isso, quando esses usuários (ou qualquer membro convidado com papel `user`) tentam conectar Apollo/Pipedrive, o INSERT em `integration_credentials` é bloqueado com "permission denied / row-level security".

Os fluxos de servidor (`connectApollo`, `connectPipedrive`) já validam que o usuário pertence à organização ativa antes de gravar — então a restrição extra de RLS está sendo dupla e inconsistente com o restante do código (que segue o padrão `master_admin OR (org member AND company_admin)`, como já visto em `hook7_instances`).

## O que mudar

**Apenas uma migration de RLS** — sem alterar código de aplicação.

Atualizar as policies das duas tabelas para permitir:

```text
has_role(auth.uid(), 'master_admin')
  OR (is_org_member(auth.uid(), organization_id)
      AND has_role(auth.uid(), 'company_admin'))
```

Tabelas afetadas:
1. `public.integration_credentials` — recriar a policy "Org admins manage integration credentials" (cmd ALL) com a condição acima em USING e WITH CHECK.
2. `public.pipedrive_sync_runs` — recriar a policy "Org admins manage pipedrive_sync_runs" (cmd ALL) com a mesma condição.

Sem mudanças em `apollo_api_calls`, `apollo_search_cache`, `organization_integrations`, `integration_providers` — já permitem qualquer membro ativo da org.

## Fora do escopo

- Não mexer no fluxo de provisionamento (`provision_user_account`) nem conceder `company_admin` adicional a master_admins.
- Não alterar server functions de Apollo/Pipedrive.
- Não tocar nas integrações Hook7/WhatsApp.
