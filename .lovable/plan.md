# Ajustes no Builder

Dois ajustes pontuais, ambos sem mexer em regras de negócio:

## 1. Exclusão e religação de conexões entre nós

Hoje o canvas não oferece uma forma visível de remover ou redirecionar uma seta — o usuário fica preso à conexão original.

Vamos habilitar três caminhos complementares, todos no `FlowEditor.tsx`:

- **Clique na conexão → botão de excluir**: ao clicar numa seta, ela fica selecionada (destacada com cor mais forte e traço mais grosso) e aparece um pequeno botão "✕" flutuante no meio da linha. Clicar no botão remove a conexão (com `confirm` simples) e marca o documento como sujo.
- **Tecla Delete/Backspace**: com a conexão selecionada, apertar Delete também remove (configurando `deleteKeyCode={["Delete","Backspace"]}` no `<ReactFlow>` e tratando no `handleEdgesChange`, que já existe).
- **Religar arrastando a ponta**: habilitar `onReconnect` do React Flow. O usuário pega a ponta da seta (origem ou destino) e arrasta para outro nó — a conexão é atualizada, respeitando as regras já validadas (sem auto-conexão, sem duplicar ramo "yes/no", etc.). Se a nova ligação violar uma regra, exibe `toast.error` e mantém a original.

Sem mudanças no backend: o `saveBuilderDocument` já recebe a lista de transições atual e remove as ausentes.

## 2. Nó inicial padrão = "Mensagem com IA"

Quando uma campanha é aberta pela primeira vez no builder e nenhum documento existe ainda, `getBuilderDocumentByCampaign` (em `src/lib/builder.functions.ts`) semeia um nó inicial do tipo `message_email`. Vamos trocar para `ai_message` com a configuração padrão equivalente à do builder:

```ts
type: "ai_message",
config: {
  channel: "whatsapp",
  task_instruction: "",
  mood_slug: null,
  approach_slug: null,
  length_slug: null,
  language_slug: null,
  extra_context: "",
  must_include: "",
},
```

Documentos já existentes não são afetados — a troca só vale para novos fluxos criados a partir daí.

## Detalhes técnicos

- `FlowEditor.tsx`:
  - Adicionar estado `selectedEdgeId` e handler `onEdgeClick` que define seleção e limpa `selectedId` de nó.
  - Estilizar edge selecionada (strokeWidth maior, animated opcional).
  - Renderizar um `EdgeLabelRenderer` custom (ou um botão posicionado via `getBezierPath`/`getSmoothStepPath`) só na edge selecionada, com botão "✕" que chama `deleteEdge(id)`.
  - `deleteEdge`: `setEdges(eds => eds.filter(e => e.id !== id))` + `markDirty()`.
  - Adicionar `onReconnect={onReconnect}` validando: sem self-loop, e — se mudar a origem — sem ramo duplicado para condition_replied. Em caso de erro: `toast.error` e retorna a edge original.
  - Passar `deleteKeyCode={["Delete","Backspace"]}` e `edgesReconnectable` no `<ReactFlow>`.
  - Limpar `selectedEdgeId` no `onPaneClick`.
- `src/lib/builder.functions.ts`: alterar o `insert` do step semente em `getBuilderDocumentByCampaign` para `type: "ai_message"` com o config acima.

Sem migrações de banco, sem mudanças no executor de fluxos.
