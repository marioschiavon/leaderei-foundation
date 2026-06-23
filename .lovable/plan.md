## Causa raiz

As tabelas `integration_credentials` e `pipedrive_sync_runs` no schema `public` **não possuem GRANTs** para os roles `authenticated` e `service_role`. Sem GRANT, a Data API do Supabase (PostgREST) retorna `permission denied`, mesmo com policies RLS corretas. Por isso o erro atinge todos os usuários.

A migration anterior recriou as policies RLS, mas não concedeu os privilégios de tabela — passo obrigatório.

## Correção

Migration única adicionando os GRANTs faltantes:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_credentials TO authenticated;
GRANT ALL ON public.integration_credentials TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipedrive_sync_runs TO authenticated;
GRANT ALL ON public.pipedrive_sync_runs TO service_role;
```

Sem GRANT para `anon` — todas as policies dessas tabelas exigem usuário autenticado.

## Fora de escopo

Nenhuma alteração de código, RLS ou outras tabelas.