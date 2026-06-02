## Objetivo
Deixar o nó de WhatsApp no canvas com o mesmo padrão visual dos outros (Email, Aguardar, Respondeu?), em vez do fallback genérico do React Flow.

## Mudanças (todas em `src/components/builder/FlowEditor.tsx`)

1. **Criar `WhatsAppStepNode`** (logo após `EmailStepNode`, espelhando sua estrutura):
   - `NodeShell` + `Handle` target à esquerda + `Handle` source à direita.
   - `NodeHeader` com ícone `MessageCircle` e label `"WhatsApp"`.
   - Corpo: preview das primeiras ~2 linhas de `cfg.body` (truncado, itálico/cinza quando vazio: "Sem mensagem").
   - Badge de status `✓ Pronto` / `⚠ Incompleto` baseado em `!!cfg.body?.trim()`, mesmo estilo do email (verde `#dcfce7`/`#166534` vs âmbar `#fef3c7`/`#92400e`).

2. **Registrar no `nodeTypes`** (linha ~362):
   ```ts
   const nodeTypes = {
     message_email: EmailStepNode,
     message_whatsapp: WhatsAppStepNode,
     wait: WaitStepNode,
     condition_replied: ConditionRepliedNode,
   } as any;
   ```

## Fora de escopo
- Painel de inspetor (`WhatsAppPanel`) — já existe e continua igual.
- Paleta lateral — já está `enabled: true`.
- Mudanças no executor / Hook7 / schema.

## Pronto quando
Arrastar "WhatsApp" cria um nó com o mesmo card branco/borda/handles dos outros, mostrando preview da mensagem e badge de status que vira "✓ Pronto" assim que o texto é preenchido no painel à direita.