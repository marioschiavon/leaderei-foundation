
# Plano — Builder UI para `ai_generate_text` + modo IA nos envios

Escopo 100% frontend, apenas `src/components/builder/FlowEditor.tsx`.

## 1. Registrar `ai_generate_text` no Builder

- Adicionar `"ai_generate_text"` à union `StepType` (linha ~103).
- Inserir na paleta `STEP_TYPES` após `ai_message`: `{ type: "ai_generate_text", label: "Gerar texto (IA)", icon: Sparkles, enabled: true }`.
- Em `DEFAULT_CONFIG` (linha 154), adicionar:
  ```ts
  ai_generate_text: {
    output_label: "",
    channel_hint: "whatsapp",
    task_instruction: "",
    mood_slug: null, approach_slug: null, length_slug: null, language_slug: null,
    extra_context: null, must_include: null,
  }
  ```
- Criar `AiGenerateTextNode` (baseado em `AiMessageNode`, ícone Sparkles em violeta): linha 1 "Gerar texto (IA)"; badge `💾 {output_label}` ou amarelo "⚠️ Sem rótulo"; ícone do canal (`💬`/`📧`).
- Registrar no map de `nodeTypes` (linha ~629): `ai_generate_text: AiGenerateTextNode`.

## 2. Helper `slugifyLabel` + BFS reverso

Adicionar no topo do arquivo (escopo de módulo, fora dos componentes):
- `slugifyLabel(s)` — NFD + remove diacríticos + `\s→_` + lower + strip non `[a-z0-9_]`.
- `getUpstreamAiTexts(currentId, allNodes, edges, channelFilter)` — BFS reverso por `edge.target===id`, filtra ancestrais `type==="ai_generate_text"` com `output_label` e `channel_hint===channelFilter`, retorna `{nodeId, label, slug}`.

## 3. Propagar `allNodes`/`edges` ao `ConfigPanel`

- Linha ~1370: passar `allNodes={nodes}` e `edges={edges}` ao `<ConfigPanel/>`.
- Linha 1411: estender assinatura de `ConfigPanel` com `allNodes`, `edges`.
- Repassar para `EmailPanel`, `WhatsAppPanel`, e novo `AiGenerateTextPanel`.

## 4. Novo `AiGenerateTextPanel`

Componente baseado em `AiMessagePanel`. Seções:
- **Saída**: input `output_label` (required, borda vermelha onBlur vazio, helper + preview `Slug: {slugifyLabel(output_label)}`); Select `channel_hint` (`whatsapp`/`email`) com helper.
- **Conteúdo**: `task_instruction` (textarea); `mood_slug`/`approach_slug`/`length_slug`/`language_slug` via `listAiTonePresets` (mesma fetch e padrão de `AiMessagePanel`); `extra_context` e `must_include` (textareas opcionais).
- **Prévia**: botão "Pré-visualizar texto" → `previewAiMessage` passando `channel_hint`; abre dialog com aviso "preview — texto real gerado em execução".

Adicionar branch em `ConfigPanel`:
```tsx
if (node.type === "ai_generate_text")
  return <AiGenerateTextPanel node={node} onChange={onChange} allNodes={allNodes} edges={edges} />;
```

## 5. `WhatsAppPanel` e `EmailPanel` — toggle fixo/IA

Ambos passam a receber `allNodes`/`edges`. No topo do form:
- Calcular `aiTexts = getUpstreamAiTexts(node.id, allNodes, edges, "whatsapp"|"email")`.
- `bodySource = config.body_source ?? "fixed"`.
- Select **Origem do texto**: `fixed` (✏️ Texto fixo) / `ai` (✨ Gerado por IA).
- Se `ai`:
  - `aiTexts.length===0` → banner amarelo ("Adicione um step 'Gerar texto (IA)' com canal {WhatsApp|Email} antes deste no fluxo.").
  - Senão → Select `ai_text_label` com `value=item.label` mostrando label + `slug: {item.slug}`.
- Se `fixed` → manter campos atuais (`body` para WhatsApp; `subject`+`body_html` para Email). Comportamento default inalterado.

Nos nós visuais `WhatsAppStepNode` e `EmailStepNode`, quando `cfg.body_source==="ai" && cfg.ai_text_label`:
```tsx
<div className="mt-1 flex items-center gap-1 text-[10px] text-violet-600">
  <Sparkles className="h-2.5 w-2.5" /><span>IA: {cfg.ai_text_label}</span>
</div>
```

## Restrições respeitadas

- Apenas `FlowEditor.tsx`.
- Não tocar `AiMessagePanel`/`AiMessageNode` nem executor/server/banco.
- `body_source` ausente = `"fixed"` (back-compat total).
- BFS inline (sem libs de grafo) garante que steps em branches paralelos não aparecem no dropdown.
- `previewAiMessage` reaproveitado sem alteração.

## Saída final

Após implementação: lista dos 12 critérios com ✅/❌, confirmação da regra de filtro por canal + BFS, arquivos modificados (`FlowEditor.tsx`), seção "O que toquei fora do escopo: nada".
