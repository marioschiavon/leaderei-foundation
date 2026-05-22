# Fase 1 — Leaderei (escopo fechado)

Objetivo: entregar a **fundação SaaS multi-tenant** + **identidade visual final do produto** + **shell completo do workspace comercial**, com todas as áreas navegáveis e prontas para receber integrações reais nas próximas fases. Nenhuma integração externa é finalizada agora; tudo aparece como estrutura visual + estados (`coming soon`, `setup needed`, `not connected`).

---

## 1. Módulos exatos da Fase 1

1. **Fundação SaaS**
   - Auth (signup, login, forgot password, verificação de email)
   - Multi-tenant: `companies` + `company_members` + `user_roles`
   - Papéis: `master_admin`, `company_admin`, `user`
   - RLS já ativa (já existe no schema atual)
   - Onboarding mínimo (criar/entrar em empresa, nome, slug)

2. **Shell do produto (visual final)**
   - Sidebar principal (colapsável, com grupos)
   - Topbar (busca, notificações, avatar/menu, switcher de empresa)
   - Sistema de design tokens consolidado (cores, fontes IBrand + Poppins)
   - Componentes base shadcn já tematizados
   - Layout responsivo

3. **Dashboard principal** (`/app`)
   - KPIs reais do tenant (contagens vindas do banco, mesmo que zeradas)
   - Gráfico de atividade semanal (mock visual aceitável nesta fase)
   - Checklist de próximos passos (onboarding contextual)

4. **Campanhas** (`/app/campaigns`)
   - Listagem visual completa
   - Estados: Ativa / Pausada / Rascunho
   - CRUD básico de campanha (nome, status, canal-alvo) — sem execução real
   - Botões de play/pause apenas mudam status no banco

5. **Leads** (`/app/leads`)
   - Tabela com filtros (estágio, origem, responsável, busca)
   - CRUD real de leads (criar, editar, excluir)
   - Import CSV estrutural (UI presente, parsing simples funcional)
   - Estágios fixos nesta fase: Novo, Qualificado, Em conversa, Proposta

6. **Inbox / Conversas** (`/app/inbox`)
   - Layout 3 colunas (lista de conversas / thread / detalhes do lead)
   - Dados mock por enquanto (estrutura de tabelas `conversations` + `messages` criada, mas sem ingestão real)
   - Composer desabilitado com tooltip "Conecte um canal em Integrações"

7. **Integrações** (`/app/integrations`)
   - Catálogo visual de todos os conectores planejados:
     Apollo, LinkedIn, HubSpot, Pipedrive, WhatsApp Business API, Resend, ElevenLabs, Email IMAP/SMTP, Google Calendar, Slack
   - Cada card mostra estado: `not connected` / `setup needed` / `coming soon`
   - Fluxo de conexão presente apenas para: **Resend** (real, via secret) e **Email IMAP/SMTP** (form estrutural salvo no banco, não testa de fato)
   - Demais: botão "Conectar" abre modal "Em breve na Fase 2"

8. **Pipeline / Vendas** (`/app/sales`)
   - Kanban visual já presente
   - CRUD de deals real (criar/mover entre colunas)
   - Colunas fixas: Qualificado, Em proposta, Negociação, Fechamento

9. **Construtor visual drag-and-drop (inicial)** (`/app/builder`)
   - Tela do builder com canvas vazio + paleta lateral de blocos
   - Blocos disponíveis na Fase 1: Texto, Imagem, Botão, Espaçador
   - Salvar/carregar layout em JSON por campanha (estrutural)
   - Sem export real, sem renderização externa
   - Marcado como **Beta** no menu

10. **Painel Master** (`/master/*`)
    - Acesso restrito a `master_admin`
    - `/master` — visão geral (total de empresas, usuários, MRR mock)
    - `/master/organizations` — listar/criar/suspender empresas
    - `/master/users` — listar usuários globais, alterar papel
    - `/master/plans` — definição de planos (estrutural, sem billing)
    - `/master/logs` — feed de eventos do sistema (estrutural)

11. **Configurações** (`/app/settings`)
    - Organização (nome, slug, logo)
    - Membros (convidar, remover, alterar papel) — real
    - Billing — **coming soon**
    - Preferências — **coming soon**
    - API keys — gerar/revogar key real por tenant

---

## 2. Telas que existirão

| Rota | Tipo |
|---|---|
| `/login`, `/signup`, `/forgot-password` | Funcional |
| `/onboarding` | Funcional |
| `/app` (dashboard) | Funcional + dados reais |
| `/app/leads` | Funcional CRUD |
| `/app/campaigns` | Funcional CRUD básico |
| `/app/sales` | Funcional CRUD |
| `/app/inbox` | Estrutural (mock) |
| `/app/integrations` | Estrutural + 2 conectores reais parciais |
| `/app/builder` | Estrutural-funcional (salva JSON) |
| `/app/settings` (org, membros, api) | Funcional |
| `/app/settings` (billing, prefs) | Estrutural |
| `/master`, `/master/organizations`, `/master/users` | Funcional |
| `/master/plans`, `/master/logs` | Estrutural |

---

## 3. Telas apenas estruturais nesta fase

- **Inbox**: layout completo + mocks; sem ingestão de canais.
- **Integrações** (exceto Resend e Email IMAP/SMTP form): cards + modais "Em breve".
- **Builder**: canvas com 4 blocos básicos, salva JSON, sem renderização externa.
- **Master / Plans** e **Master / Logs**: tabelas com dados de exemplo.
- **Settings / Billing** e **Settings / Preferências**: cards "coming soon".
- **Campanhas**: o "executar" é apenas mudança de status, sem disparo real.

---

## 4. Dados reais que devem existir já na Fase 1

Tabelas a criar/garantir (além das já existentes `companies`, `company_members`, `profiles`, `user_roles`):

- `leads` (id, company_id, name, email, company_name, stage, source, owner_id, created_at)
- `campaigns` (id, company_id, name, status, channel, created_by, created_at)
- `campaign_steps` (id, campaign_id, order, type, payload jsonb) — estrutural
- `deals` (id, company_id, lead_id, stage, value, owner_id, created_at)
- `conversations` (id, company_id, lead_id, channel, last_message_at) — estrutural
- `messages` (id, conversation_id, direction, body, created_at) — estrutural
- `integrations` (id, company_id, provider, status, config jsonb)
- `api_keys` (id, company_id, key_hash, created_at, revoked_at)
- `builder_documents` (id, company_id, campaign_id, schema jsonb)
- `audit_logs` (id, company_id, actor_id, action, target, created_at) — para master/logs

Todas com RLS por `company_id` via `get_user_company_id(auth.uid())`.
Master vê tudo via `has_role(auth.uid(), 'master_admin')`.

---

## 5. Estados de módulo (rótulos visuais)

- **`coming soon`**: ElevenLabs, WhatsApp API, LinkedIn, Apollo, HubSpot, Pipedrive, Slack, Google Calendar, Billing, Preferências, Master/Plans, Master/Logs.
- **`setup needed`**: Email IMAP/SMTP (form presente, credenciais não validadas), API keys (até gerar a primeira), Builder (até salvar primeiro doc).
- **`not connected`**: Resend (até o usuário colar a API key real e salvar como secret).
- **`beta`**: Construtor visual drag-and-drop.

---

## 6. Critérios de aceite da Fase 1

A Fase 1 está concluída quando **todos** os itens abaixo forem verdadeiros:

1. ✅ Usuário consegue: signup → verificar email → criar empresa → entrar no `/app` com dashboard renderizado.
2. ✅ Sidebar + topbar presentes em todas as rotas `/app/*` e `/master/*`, com identidade visual final.
3. ✅ Multi-tenant funciona via RLS.
4. ✅ Papéis funcionam (`user`, `company_admin`, `master_admin`).
5. ✅ CRUDs reais funcionando: **Leads (com import CSV)**, **Campanhas (criar/editar/duplicar/play-pause/arquivar)**, Membros, API keys (tabela), Builder documents (tabela com `schema` + `campaign_id`).
6. ⏳ Integrações: catálogo real listado; Resend/IMAP reais ainda pendentes.
7. ✅ Inbox renderiza layout de 3 colunas sem quebrar.
8. ⏳ Builder: tabela pronta, canvas drag-and-drop ainda pendente.
9. ✅ Painel Master lista empresas/usuários reais.
10. ✅ Empty states em todas as listas.
11. ✅ Build de produção passa; rotas protegidas redirecionam.
12. ✅ Documento `/.lovable/plan.md` atualizado.

---

## Fora de escopo da Fase 1 (explícito)

- Disparo real de email/LinkedIn/WhatsApp
- Cadências multicanal e automações condicionais
- IA generativa de copy / agentes / voz (ElevenLabs)
- OAuth real de Apollo, HubSpot, Pipedrive, LinkedIn
- Billing/Stripe
- Relatórios analíticos avançados
- Renderização pública de landing pages do builder
