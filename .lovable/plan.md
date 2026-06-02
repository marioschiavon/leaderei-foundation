## Diagnóstico

O cron está rodando a cada minuto **com sucesso do lado do Postgres**, mas todas as chamadas HTTP estão retornando **404**:

- URL chamada: `https://project--ab6c70f9-…lovable.app/api/public/hooks/run-flow-tick`
- Resposta: `404` + HTML do SPA (5 últimas execuções, 03:34→03:38)

Causa: a rota `src/routes/api/public/hooks/run-flow-tick.ts` **existe no preview, mas ainda não foi publicada**. O `pg_cron` aponta para a URL de produção (`project--<id>.lovable.app` = published deployment) e essa versão publicada não contém a rota nova. Por isso o tick nunca executa, o enrollment ativo `afafbb44…` fica travado com `next_run_at = 03:34:14` (vencido) sem ninguém para processá-lo.

Sintoma colateral: quando você re-ativou a campanha com o lead selecionado, o lead escolhido (`c7f4dbfc…`) já tinha um enrollment ativo desde 01:35 (que enviou 1 mensagem WhatsApp e parou aguardando o `wait`). O re-activate apenas marcou `started_at` de novo; o enrollment continua o mesmo e segue parado pelo mesmo motivo do 404.

## Plano

**Passo 1 — Publicar o app**
- Você abre Publish e republica. Isso leva `run-flow-tick.ts` para produção e o cron volta a receber 200.
- Não tem mudança de código necessária para destravar.

**Passo 2 — Validação automática pós-publish**
- Após publicar, eu chamo `curl` na rota de produção para confirmar `200`.
- Consulto `net._http_response` para confirmar que o próximo tick retornou `200`.
- Consulto `campaign_enrollments` para confirmar que `afafbb44…` avançou de step e `flow_step_runs` ganhou um novo registro.

**Passo 3 — Ajuste defensivo no ActivateCampaignDialog (frontend)**
- Hoje, quando o lead já tem enrollment ativo, "Ativar" não cria nada novo nem avisa. Vou:
  - Mostrar no diálogo um contador "X leads já em execução (serão ignorados)" ao lado de "Y novos serão enrollados".
  - Se 0 novos enrollments serão criados, exibir aviso explicando que nada novo será disparado.
- Mudança apenas de UI/contagem, sem alterar regra de enrollment.

**Passo 4 — Fallback de URL no cron (proteção futura)**
- Atualizar o comando do `cron.job` para chamar a URL `-dev` (preview) **somente** se você quiser testar antes de publicar. Por padrão mantemos produção. Documento isso no `.lovable/plan.md` para facilitar troubleshooting.
- Não vou trocar a URL agora — produção é o destino correto; só registro a opção.

## Fora de escopo
- Mexer no executor, no scheduler, ou na lógica de wait/branch.
- Mexer no schema de `campaign_enrollments` ou `flow_step_runs`.

## Pronto quando
- `curl POST` na rota publicada retorna `200`.
- `net._http_response` mostra `200` nas chamadas recentes do cron.
- O enrollment `afafbb44…` avança para o próximo nó (novo registro em `flow_step_runs` após o wait expirar).
- Diálogo de ativar mostra contagem de "já em execução" vs "novos".

## Detalhes técnicos
- Arquivo a editar: `src/routes/_app.dashboard.campaigns.tsx` (somente a UI do `ActivateCampaignDialog`).
- Server fn `listEligibleLeadsForCampaign` precisa retornar também os IDs de leads já com enrollment ativo (ou criar `countActiveEnrollmentsForLeads`).
- Nenhuma migração SQL.
