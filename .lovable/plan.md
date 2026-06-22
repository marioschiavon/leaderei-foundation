
## Objetivo

Fazer **Renomear**, **Apagar** e **Reconectar** funcionarem no menu de cada instância de WhatsApp. As opções continuam exatamente onde estão — nenhuma é removida.

## Diagnóstico

1. **Renomear e Apagar** — os componentes que mostram o input de renomear e a confirmação de apagar estão sendo renderizados *dentro* do modal principal de WhatsApp. Modais aninhados do Radix UI entram em conflito: o item do menu é clicado e dispara a abertura, mas o conteúdo fica preso atrás do overlay do modal pai e parece não responder. Isso bate com o que se vê na gravação da sessão.

2. **Reconectar** — a chamada ao servidor acontece e o status muda no banco, mas o painel com o QR Code (necessário para escanear novamente) nunca aparece. O usuário só vê um toast e nada mais — por isso parece que não fez nada.

## Correções (todas no arquivo `src/components/app/WhatsAppManagerDialog.tsx`)

### 1. Renomear funcionar
Mover apenas a **renderização** do diálogo de renomear (não o item de menu) para o nível do componente pai, como irmão do modal principal — mesmo padrão já usado hoje pelo `ConnectFlowDialog`. O item "Renomear" continua no dropdown; clicar nele continua abrindo o input — só que agora o input aparece de verdade na tela e o botão Salvar grava.

### 2. Apagar funcionar
Mesma reestruturação para o `AlertDialog` de confirmação ("Apagar instância?"). O item "Apagar" continua no dropdown; clicar mostra a confirmação corretamente e o botão Apagar executa a exclusão.

### 3. Reconectar funcionar
O item "Reconectar" continua no dropdown. Comportamento novo ao clicar:
1. Chama `reconnectHook7Instance` (já existe no servidor — sem mudanças).
2. Em caso de sucesso, abre automaticamente o painel de QR Code (`ConnectFlowDialog` com `reuseInstanceId` = id da instância) para o usuário escanear.
3. O toast "Reconectando…" continua aparecendo como feedback.

## Fora de escopo
- Nenhuma server function é alterada.
- Nenhum item de menu é adicionado ou removido.
- Edge function `hook7-webhook` não é tocada.
- Lógica de desconexão (corrigida em iteração anterior) não é tocada.

## Risco
Baixo. Mudança somente de estrutura JSX em um único arquivo de UI. Backend inalterado.
