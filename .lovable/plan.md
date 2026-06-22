## Alteração proposta

Substituir o texto de ajuda do status "Conectado" na tela de integrações (`src/routes/_app.dashboard.integrations.tsx`).

**Texto atual:**
> Integração ativa para este tenant.

**Novo texto:**
> Integração ativa para esta conta.

Caso prefira ênfase no time/organização, alternativa: "Integração ativa para esta empresa."

## Escopo

- Arquivo: `src/routes/_app.dashboard.integrations.tsx`, linha 68 (helper do status `connected`).
- Nenhuma outra alteração em lógica, backend ou demais componentes.
- Não altera a nomenclatura interna de variáveis/funções (ex.: `tenant.functions.ts`), apenas o texto exibido ao usuário.