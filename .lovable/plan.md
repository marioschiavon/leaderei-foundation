## Diagnóstico (causa raiz, confirmada no banco)

Você **não renomeou** "teste" para "teste 2". São duas campanhas distintas, em organizações distintas:

| Campanha | Org | Criada por | Quando |
|---|---|---|---|
| `teste` | **S7** (sua) | Mario | 07/06 |
| `teste 2` | **Rafa Minoru INC** (não é sua) | Rafael Hirata | 11/06 |

Você não conhece o Rafael — ele criou conta separada, com a própria organização. Até aí, tudo certo: contas e orgs estão de fato separadas no banco.

**O bug real:** a "teste 2" aparece na sua tela `/dashboard/campaigns` porque toda tabela de tenant tem uma política RLS extra do tipo:

```
"Master admins manage all <tabela>"  USING (has_role(auth.uid(), 'master_admin'))
```

Existe em ~35 tabelas (campaigns, leads, conversations, messages, deals, lead_activities, builder_documents, flow_*, hook7_instances, etc.). Como você é `master_admin`, essa política te dá acesso a **todas as orgs** mesmo quando você está navegando pelas rotas normais de tenant — que dependem só do RLS para isolar (não filtram por `organization_id` no código).

Resultado: no `/dashboard` você vê campanhas/leads/conversas de qualquer empresa. Foi exatamente o que aconteceu — colisão de nome ("teste" vs "teste 2") amplificou a confusão, mas o vazamento existiria mesmo sem nomes parecidos.

O painel `/master/*` **não depende dessas policies** — `src/lib/master.functions.ts` usa `supabaseAdmin` (service role, bypassa RLS). Ou seja, remover as policies de master nas tabelas de tenant **não quebra** o painel master.

## Decisão

Sua regra: master_admin só vê dados de outras orgs **dentro de `/master/*`**. Nas rotas comuns (`/dashboard/*`) ele é tratado como membro normal — vê só as orgs em que é membro de fato (no seu caso, só S7).

## Mudanças

### 1. Migration — remover policies `Master admins manage all *` das tabelas de tenant

`DROP POLICY` em todas as ~35 tabelas listadas acima. A política `"Org members ..."` (`is_org_member(auth.uid(), organization_id)`) continua sendo a única regra de leitura/escrita no contexto autenticado. Resultado prático:

- `/dashboard/campaigns` → você vê apenas campanhas da S7.
- `/dashboard/leads` → apenas leads da S7 (que continuam sendo os 5.013).
- Inbox, pipeline, builder, integrações → idem.
- `/master/organizations`, `/master/users`, `/master/logs`, etc. → continuam funcionando idênticos, porque usam `supabaseAdmin`.

**Tabelas que ficam fora do drop** (não são tenant data, master precisa mesmo via auth):
- `platform_settings`, `ai_platform_settings`, `integration_providers`, `plans`, `subscriptions`, `audit_logs` — são globais/admin por natureza, mantêm a policy de master.
- `organizations` e `organization_members` — mantêm a policy de master para o painel `/master/organizations` listar/editar.

### 2. Verificação rápida no código (sem mudanças, só confirmação)

- `src/lib/tenant.functions.ts`, `src/lib/campaigns.functions.ts`, `src/lib/inbox.functions.ts`, `src/lib/builder.functions.ts`: já usam `context.supabase` (cliente autenticado do usuário) + filtros por `organization_id` derivados do membership. Vão continuar funcionando — passam a retornar só a org do usuário automaticamente.
- `src/lib/master.functions.ts`: usa `supabaseAdmin`. Não muda nada.

### 3. Nada de UI nesta rodada

Você mencionou uma futura "aba de suporte dentro do /dashboard para master ver dados de uma org específica". Isso fica para depois — não entra agora.

## O que NÃO faço

- Não apago a campanha "teste 2", nem a org "Rafa Minoru INC", nem a conta do Rafael. Ele é um usuário legítimo da plataforma com a própria org.
- Não toco em `/master/*`.
- Não mexo nas rotas/queries do `/dashboard` (a correção é 100% no nível de RLS).

## Critério de aceite

1. Logado como `mariors07@gmail.com` em `/dashboard/campaigns` → "teste 2" **não aparece** (só campanhas da S7).
2. `/dashboard/leads` continua mostrando os 5.013 leads da S7.
3. `/master/organizations` continua listando todas as orgs (S7, Rafa Minoru INC, Demo teste).
4. Logado como Rafael em `/dashboard/campaigns` → ele continua vendo "teste 2" (org dele).
