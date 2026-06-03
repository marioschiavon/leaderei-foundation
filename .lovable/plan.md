## Mudança

Trocar o campo **"ID do event type"** (input numérico) por um **Select amigável** que lista os event types já sincronizados da conta Cal.com, mostrando título + duração (ex.: "Reunião 30min · 30min"). Internamente continua salvando o `event_type_id` no `config` do nó — zero mudança no executor.

## Onde

Nó por nó, no `ConfigPanel` do `src/components/builder/FlowEditor.tsx`:

1. **Consultar agenda** (`calcom_check_availability`) — troca input por Select.
2. **Agendar reunião** (`calcom_book_meeting`) — troca input por Select.
3. **Reagendar reunião** (`calcom_reschedule_booking`) — troca input por Select.
4. **Cancelar reunião** (`calcom_cancel_booking`) — não tem event type, sem mudança.

Os campos **Estratégia de escolha do horário**, **Janela de busca (dias)** e **Retomar fluxo após (dias úteis)** ficam como estão.

## UX do Select

- **Vazio (nenhum event type sincronizado)**: Select desabilitado + alerta inline com botão **"Sincronizar agora"** que chama `syncCalcomEventTypes` e refaz o `listCalcomEventTypes`.
- **Cal.com não conectado**: alerta "Conecte o Cal.com em Integrações" com link pra `/dashboard/integrations`.
- **Lista carregada**: cada opção mostra `título · Xmin` (ex.: "Demo · 45min"). Valor selecionado = `cal_event_type_id`.
- **Pré-seleção**: se `cfg.event_type_id` ainda for `0` (padrão) e existir só 1 event type, pré-seleciona ele automaticamente ao abrir o painel.
- Pequeno texto auxiliar: "Sincronizado em <data>. [Re-sincronizar]" (link que chama `syncCalcomEventTypes`).

## Implementação

- Novo componente local `CalEventTypeSelect` em `FlowEditor.tsx` que:
  - Usa `useQuery(['calcom-event-types'], () => listCalcomEventTypes())` para carregar a lista (cache compartilhado entre os 3 painéis).
  - Trata os 3 estados: não-conectado / vazio / com dados.
  - Aceita `value: number`, `onChange: (id: number) => void`.
- Refatora `CalEventTypePanel` e `CalBookMeetingPanel` para usar `CalEventTypeSelect` no lugar do `<Input type="number">`.
- Reaproveita a mutation de sync via `useMutation(syncCalcomEventTypes)` com invalidate da query.

## Fora deste plano

- "Padrão global" em Integrações — não é necessário, o Select cobre o caso.
- Edição/criação de event types dentro do app — continua sendo no Cal.com.

## Arquivos tocados

- `src/components/builder/FlowEditor.tsx` (substitui inputs dos 3 painéis Cal.com, adiciona componente `CalEventTypeSelect`).
- Nenhuma migration. Nenhuma mudança em server functions (já existem `listCalcomEventTypes` e `syncCalcomEventTypes`).
