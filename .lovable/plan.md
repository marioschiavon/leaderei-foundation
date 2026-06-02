## Objetivo

Liberar o passo **WhatsApp** no Builder para que possamos publicar um fluxo simples e testar o executor de ponta a ponta enviando uma mensagem real via Hook7.

## Estado atual

- Executor (`flow-executor.server.ts`) **já implementa** `message_whatsapp`: lê `config.body`, escolhe instância Hook7 conectada, dispara `POST /send/text`, grava `conversation` + `messages` (outbound).
- `FlowEditor.tsx` tem `message_whatsapp` no tipo, no `DEFAULT_CONFIG` (`{ body: "" }`) e na PALETTE, mas marcado como **`enabled: false`** → não aparece arrastável.
- Não existe painel de edição (Inspector) para WhatsApp — `ConfigPanel` cai no fallback "Sem editor disponível".

## Mudanças

**Arquivo único:** `src/components/builder/FlowEditor.tsx`

1. **Habilitar na palette**  
   Trocar `enabled: false` → `enabled: true` no item `message_whatsapp`.

2. **Criar `WhatsAppPanel`** (mesmo arquivo, espelhando o `EmailPanel` só que mais enxuto):
   - `Textarea` controlando `config.body` (label "Mensagem", placeholder com exemplo).
   - Barra de variáveis reutilizando a mesma lista `VARS` do EmailPanel (`{{ lead.first_name }}`, etc.) com botão "Inserir" que injeta no cursor.
   - Aviso curto em `text-muted-foreground`: "Requer instância WhatsApp conectada em Integrações. Lead sem telefone é ignorado."

3. **Plugar no `ConfigPanel`**  
   Adicionar `if (node.type === "message_whatsapp") return <WhatsAppPanel … />` antes do fallback.

Nada de schema, nada de executor, nada de backend — só destravar UI.

## Critérios de pronto

- Arrastar "WhatsApp" no canvas cria um nó com `config.body = ""`.
- Selecionando o nó, o painel direito mostra o editor de mensagem com inserção de variáveis.
- Publicando o fluxo e ativando a campanha, o tick do worker entrega a mensagem via Hook7 e ela aparece como outbound na Inbox do lead (já coberto pelo executor existente).

## Fora de escopo

- Editor de mídia/template/botões (texto puro só).
- Seleção manual de instância Hook7 (executor escolhe a mais recente conectada).
- Validação de telefone no Builder (executor já pula lead sem `phone`).
