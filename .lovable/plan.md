# Integração Cal.com v2

## Decisões já fechadas

- **Escopo**: leitura + escrita (consultar disponibilidade e criar/cancelar/reagendar).
- **Autenticação**: 1 API key por organização (configurada em **Integrações**).
- **API**: Cal.com v2 (`https://api.cal.com/v2`).
- **Match de lead**: por email; se não existir, **ignora** o booking (não cria lead novo).
- **Webhooks ouvidos**: `BOOKING_CREATED`, `BOOKING_RESCHEDULED`, `BOOKING_CANCELLED`.

---

## 1. Banco de dados (1 migration)

### 1.1 `lead_bookings` — controle dos agendamentos
Campos relevantes: `organization_id`, `lead_id`, `campaign_id` (opcional), `enrollment_id` (opcional), `cal_booking_id` (uid do Cal), `cal_booking_uid`, `event_type_id`, `event_type_slug`, `title`, `start_at`, `end_at`, `attendee_email`, `attendee_name`, `organizer_email`, `meeting_url`, `location`, `status` (enum: `confirmed | rescheduled | cancelled | no_show`), `reschedule_count`, `cancellation_reason`, `rescheduled_from_uid`, `raw_payload` (jsonb), timestamps.
- RLS: org members veem/gerenciam; master admin tudo.
- GRANTs: `authenticated` + `service_role`.
- Índices: `(organization_id, status)`, `(lead_id)`, `(cal_booking_uid)` único, `(campaign_id)`.

### 1.2 `cal_event_types_cache` — cache local de event types
Para o builder mostrar dropdown sem chamar API toda hora.
Campos: `organization_id`, `cal_event_type_id`, `slug`, `title`, `length_minutes`, `scheduling_type`, `synced_at`. Refrescado sob demanda (botão "Sincronizar" + automático a cada 24h na primeira chamada).

### 1.3 Sem nova credencial table
A API key reaproveita `integration_credentials` (já existe, criptografada). Provider `cal_com` em `integration_providers`.

---

## 2. Configuração em Integrações

Nova tela/card "Cal.com" em `_app.dashboard.integrations.tsx`:
- Campo: **API Key** (criptografada via `set_platform_secret`-style em `integration_credentials`).
- Campo: **Webhook secret** (gerado pelo CRM, exibido para o usuário colar no Cal.com).
- Botão **Testar conexão** → chama `/v2/me`.
- Botão **Sincronizar event types** → popula `cal_event_types_cache`.
- Painel mostra: URL do webhook a ser cadastrada no Cal.com (`/api/public/hooks/calcom`), eventos a marcar (`BOOKING_CREATED`, `BOOKING_RESCHEDULED`, `BOOKING_CANCELLED`).

---

## 3. Server functions (`src/lib/calcom.functions.ts` + `calcom.server.ts`)

Helper `calcomFetch(orgId, path, init)` que descriptografa a key e injeta `Authorization: Bearer <key>` + `cal-api-version: 2024-08-13`.

Funções expostas:
- `testCalcomConnection({})` → GET `/v2/me`.
- `syncCalcomEventTypes({})` → GET `/v2/event-types` → upsert cache.
- `getCalcomAvailability({ event_type_id, date_from, date_to, attendee_timezone? })` → GET `/v2/slots` (usado pelo nó "Consultar agenda" e, futuramente, pela IA).
- `createCalcomBooking({ event_type_id, start, attendee:{email,name,timezone}, metadata })` → POST `/v2/bookings`.
- `cancelCalcomBooking({ booking_uid, reason })` → POST `/v2/bookings/:uid/cancel`.
- `rescheduleCalcomBooking({ booking_uid, new_start, reason })` → POST `/v2/bookings/:uid/reschedule`.
- `listLeadBookings({ lead_id? , campaign_id?, status?, scope })` → leitura.

---

## 4. Nós novos no builder (`src/components/builder/FlowEditor.tsx` + `builder.functions.ts`)

Adicionar 4 tipos em `STEP_TYPES`:

| Tipo | Função no fluxo | Config |
|------|-----------------|--------|
| `calcom_check_availability` | Consulta horários livres (preparado para IA decidir depois). Sai com `next` se há slots, `no_slots` se não. | `event_type_id`, `window_days` (default 7), `business_hours_only` |
| `calcom_book_meeting` | **Nó principal** — cria booking. Normalmente último nó útil antes do `end`. Usa email do lead. | `event_type_id`, `slot_strategy` (`first_available` \| `ai_decided` \| `lead_picks_link`), `fallback_link_text` |
| `calcom_cancel_booking` | Cancela o booking ativo do lead na campanha. | `reason_template` |
| `calcom_reschedule_booking` | Reagenda usando próximo slot disponível ou link enviado ao lead. | `event_type_id`, `strategy` |

Validações (em `validateConfigForType` + `validateGraph`):
- `event_type_id` obrigatório nos 3 que precisam.
- `calcom_book_meeting` pode ter saídas `next` (sucesso) e `failed` (sem slots/erro API).
- Helper `stepLabelShort` em `flow-step-label.ts` aprende esses tipos (chips no card da campanha continuam funcionando).

Executor (`flow-executor.server.ts`): adiciona handlers que chamam as server fns acima, persiste resultado em `lead_bookings`, registra em `lead_activities` (tipo `booking_created` / `_cancelled` / `_rescheduled`).

---

## 5. Webhook receiver

`src/routes/api/public/hooks/calcom.ts` — rota pública:
1. Lê body cru, valida HMAC com `cal_webhook_secret` da org (header `X-Cal-Signature-256`).
2. Identifica `organization_id` (rota com `?org=<id>` ou pelo secret matching).
3. Switch por `triggerEvent`:
   - `BOOKING_CREATED`: match lead por `attendees[0].email`. Se existir → insert em `lead_bookings`, atualiza `lead.last_contact_at`, pausa enrollment ativo (`status='paused'`) e avança nó se o atual for `calcom_book_meeting` aguardando confirmação, registra `lead_activities`.
   - `BOOKING_RESCHEDULED`: localiza booking pelo `rescheduledFromUid` ou `bookingUid`, atualiza `start_at/end_at`, incrementa `reschedule_count`, registra activity, dispara notificação ao `owner_user_id` (insert em `conversations`/badge ou usar `lead_activities`).
   - `BOOKING_CANCELLED`: marca booking `cancelled` + `cancellation_reason`, registra activity, **reativa enrollment** se a campanha tinha sido pausada por esse booking (volta `status='active'`, `next_run_at = now() + retry_delay`), permitindo o fluxo continuar (ex: nova tentativa).
4. Sempre retorna `200` rápido; processamento idempotente via `cal_booking_uid` único.

---

## 6. UI — visibilidade dos bookings

Sem tela dedicada (decisão sua). Em vez disso:
- **Card da campanha**: nova linha "Reuniões agendadas: X" usando count em `lead_bookings` por `campaign_id` com `status='confirmed'`.
- **Tela do lead** (`_app.dashboard.leads.tsx` painel lateral / drawer): seção "Agendamentos" listando os bookings do lead (data, link, status, botões cancelar/reagendar que chamam as server fns).
- **Timeline do lead** (`lead_activities`) recebe os eventos automaticamente.

---

## 7. Notificações sobre eventos (sugestões — confirmar)

Para você ter "visão melhor" sem criar tela nova:
- **Toast/badge no topbar** quando webhook chega (Realtime em `lead_activities`).
- **Resumo diário** (cron) com: bookings criados, cancelados, reagendados nas últimas 24h — enviado por email ao owner da org.
- **Ícone de "reunião marcada"** ao lado do lead em listagens quando houver booking `confirmed` futuro.

Posso incluir as 3, ou só as que você marcar depois.

---

## 8. Out of scope (próxima fase)

- Decisão de slot pela IA (`slot_strategy='ai_decided'` fica como enum mas executor usa `first_available` por enquanto).
- OAuth por usuário, MEETING_ENDED / NO_SHOW, tela dedicada de "Calendário".

---

## Arquivos afetados

**Novos**: `src/lib/calcom.functions.ts`, `src/lib/calcom.server.ts`, `src/routes/api/public/hooks/calcom.ts`, migration única.

**Modificados**: `integration_providers` (seed `cal_com`), `src/routes/_app.dashboard.integrations.tsx` (card + sync), `src/components/builder/FlowEditor.tsx` (paleta + node renderers + config panels), `src/lib/builder.functions.ts` (`STEP_TYPES` + validações), `src/lib/flow-executor.server.ts` (handlers), `src/lib/flow-step-label.ts` (labels), `src/routes/_app.dashboard.campaigns.tsx` (contador de reuniões), `src/routes/_app.dashboard.leads.tsx` (seção agendamentos).

---

Confirmar 2 pontos antes de partir para a implementação:
1. As 3 notificações da seção 7 entram todas, ou só toast + ícone no lead?
2. Quando `BOOKING_CANCELLED` chega, o lead volta ao fluxo após quanto tempo? (sugestão: 3 dias úteis, configurável no nó `calcom_book_meeting`).
