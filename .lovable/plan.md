## Objetivo

Substituir o import atual de CSV (que exige cabeçalhos fixos `full_name`, `email`, etc.) por um fluxo de **mapeamento de colunas** no estilo Bubble/HubSpot: o usuário sobe qualquer CSV, vê as colunas detectadas, escolhe para qual campo do banco cada uma vai, e só então confirma a importação.

## Fluxo novo (3 passos dentro do mesmo Sheet)

```text
[1 Upload]  →  [2 Mapear colunas]  →  [3 Revisar e importar]
```

**Passo 1 — Upload**
- Drop / file picker (mantém o atual).
- Papaparse lê headers + primeiras 5 linhas para preview.
- Opcional: origem padrão (igual hoje).

**Passo 2 — Mapeamento**
- Tabela com 3 colunas:
  - **Coluna do CSV** (ex.: `Nome completo`)
  - **Amostra** (primeiros 2 valores da coluna, em cinza)
  - **Campo no Leaderei** (Select com opções fixas + "Ignorar")
- Auto-sugestão inicial por heurística de nome (case-insensitive, acentos removidos):
  - `nome|name|full_name|nome completo` → `full_name`
  - `email|e-mail|mail` → `email`
  - `telefone|phone|celular|whatsapp` → `phone`
  - `empresa|company|company_name|organização` → `company_name`
  - `cargo|job|job_title|posição` → `job_title`
  - `linkedin|linkedin_url` → `linkedin_url`
  - `site|website|website_url` → `website_url`
  - `cidade|city` → `city`
  - `país|pais|country` → `country`
  - `tags` → `tags` (split por `;` ou `,`)
  - Demais → "Ignorar" por padrão.
- Validação inline: `full_name` e `email` são obrigatórios — botão "Avançar" desativado até ambos serem mapeados. Mensagem clara explicando o porquê.
- Um mesmo campo do banco só pode ser usado uma vez (Select desabilita opções já escolhidas).

**Passo 3 — Revisar e importar**
- Resumo: "X linhas serão importadas, Y campos mapeados, origem: Z".
- Botão "Importar" dispara `importLeads` com payload **já normalizado no cliente** (chaves já são os nomes canônicos do banco), reutilizando 100% a server function existente.
- Após sucesso: mesmo painel de resultado de hoje (criados / ignorados / erros por linha).

## Campos do banco oferecidos no Select

Lidos diretamente da tabela `leads`, apenas os que fazem sentido em import: `full_name*`, `email*`, `phone`, `company_name`, `job_title`, `linkedin_url`, `website_url`, `city`, `country`, `tags`. (`*` = obrigatório.)

`status`, `temperature`, `score`, `owner`, `custom_fields` ficam fora desta versão — entram em uma rodada futura se você quiser.

## Mudanças técnicas

| Camada | Mudança |
|---|---|
| `src/components/app/ImportLeadsSheet.tsx` | Reescrita para wizard de 3 passos com estado `step`, `mapping: Record<csvHeader, dbField \| "__ignore">`, auto-sugestão, validação. |
| `src/lib/tenant.functions.ts` `importLeads` | **Sem mudança de schema.** Continua aceitando `rows` com chaves canônicas. O cliente passa a enviar as linhas já remapeadas, então o backend fica mais simples (podemos até remover o fallback `nome → full_name` numa limpeza futura, mas não nesta rodada para não quebrar nada). |
| Documentação | Atualizar `docs/user/README.md` da seção "Importar CSV" para descrever o novo fluxo de mapeamento. |

Nenhuma migration. Nenhuma alteração em outras telas. RLS e permissões intocadas.

## Critérios de aceite

1. Subir um CSV com cabeçalhos arbitrários (ex.: `Nome,Mail,Telefone,Empresa`) abre a tela de mapeamento já com sugestões corretas.
2. Não é possível avançar sem mapear `full_name` e `email`.
3. Mesmo campo do banco não pode ser escolhido em duas colunas.
4. Importação final reaproveita `importLeads` e mostra criados/ignorados/erros como hoje.
5. Cancelar/fechar reseta o wizard.

Quer que eu siga assim, ou prefere ajustar a lista de campos oferecidos (ex.: incluir `status`/`tags`/`custom_fields`) antes de eu implementar?
