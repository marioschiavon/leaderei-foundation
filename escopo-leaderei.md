# Leaderei · Escopo do Produto

> Documento mestre. Versão 1.0 — junho de 2026.
>
> Híbrido (visão de produto + apêndices técnicos por módulo). Cobre o que está implementado, o que está planejado, dívidas técnicas e decisões pendentes.

---

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Stack técnica](#2-stack-técnica)
3. [Arquitetura multi-tenant e segurança](#3-arquitetura-multi-tenant-e-segurança)
4. [Módulos do produto](#4-módulos-do-produto)
   - [4.1 Autenticação e Onboarding](#41-autenticação-e-onboarding)
   - [4.2 Dashboard](#42-dashboard)
   - [4.3 Leads](#43-leads)
   - [4.4 Campanhas](#44-campanhas)
   - [4.5 Builder de fluxos](#45-builder-de-fluxos)
   - [4.6 Inbox unificado](#46-inbox-unificado)
   - [4.7 Settings](#47-settings)
   - [4.8 Integrações](#48-integrações)
   - [4.9 Master Admin](#49-master-admin)
5. [Integrações externas](#5-integrações-externas)
   - [5.1 Resend (email)](#51-resend-email)
   - [5.2 Hook7 (WhatsApp)](#52-hook7-whatsapp)
   - [5.3 Apollo + Pipedrive (CSV)](#53-apollo--pipedrive-csv)
   - [5.4 Cal.com (agendamento)](#54-calcom-agendamento)
   - [5.5 LinkedIn](#55-linkedin)
6. [Inteligência artificial e personalização](#6-inteligência-artificial-e-personalização)
7. [Executor de fluxos (scheduler)](#7-executor-de-fluxos-scheduler)
8. [Dívidas técnicas](#8-dívidas-técnicas)
9. [Roadmap por fases](#9-roadmap-por-fases)
10. [Decisões pendentes](#10-decisões-pendentes)
11. [Glossário](#11-glossário)

---

## 1. Visão geral

### 1.1 O que é o Leaderei

O Leaderei é uma plataforma SaaS de prospecção multicanal e orquestração de vendas, voltada para o mercado B2B brasileiro. O produto permite que times comerciais centralizem em um único lugar a descoberta de leads, a construção de cadências de abordagem multicanal (email, WhatsApp, LinkedIn, ligação), o acompanhamento de respostas em uma caixa unificada e a conversão em reunião agendada.

### 1.2 Quem é o cliente

- **Operador da plataforma** (S7 / UpEvolution) — desenvolve e mantém o app
- **Cliente do operador** (Liderei — Nico, Renan, Juliano) — opera o app como produto próprio
- **Cliente final** (ex: Mauna) — usa o produto para prospectar seus próprios leads

A estrutura é, portanto, multi-tenant em duas camadas: o operador hospeda o produto e atende a múltiplas organizações (clientes do operador), cada uma com seus próprios usuários e dados.

### 1.3 Princípio central

A conversão objetivo do produto é **reunião agendada**. Toda funcionalidade do Leaderei deve, em última análise, empurrar o lead em direção a esse evento. Esse princípio foi estabelecido em reunião com o cliente e orienta a priorização de features.

### 1.4 Princípios de produto

- **Fricção mínima** para o cliente final. Quando possível, o Leaderei absorve complexidade técnica (DNS, configuração de webhook, provisionamento de instâncias) para que o usuário final não precise lidar com infraestrutura
- **Multicanal real** — o produto não é "ferramenta de email" nem "ferramenta de WhatsApp": é uma orquestração entre canais
- **Humano desenha estratégia, IA executa conteúdo** — o usuário monta o fluxo no Builder visual, a IA personaliza a mensagem dentro de cada step
- **Score comportamental** acumulado ao longo da jornada determina quando passar para humano
- **Privacidade por organização** — dados de uma org nunca aparecem para outra, garantido por Row Level Security do PostgreSQL

---

## 2. Stack técnica

### 2.1 Camadas

| Camada | Tecnologia | Observação |
|---|---|---|
| Frontend | TanStack Start (React) | Roteamento file-based, server functions |
| Banco de dados | PostgreSQL via Supabase | Multi-tenant via RLS |
| Autenticação | Supabase Auth | Email/senha, sem confirmação no MVP |
| Storage | Supabase Storage | Logo da org, anexos futuros |
| Edge Functions | Supabase Edge Functions (Deno) | Webhook do Hook7 |
| Cron | Supabase pg_cron + pg_net | Pendente — para executor de fluxos |
| Email transacional | Resend | s7.dev.br como domínio (verificado) |
| WhatsApp | Hook7 (API própria) | Hospedada na VPS do operador via Dokploy |
| Ambiente de dev | Lovable | Build, edição via prompts, deploy |
| Hospedagem do app | Cloudflare (via Lovable) | Distribuição global |

### 2.2 Decisões deliberadas

- **Não usar VPS do operador para hospedar o app** — Lovable cuida de tudo. A VPS é exclusivamente para infraestrutura de canais (Hook7, futuro Cal.com)
- **Não usar serviços externos pagos** quando há equivalente nativo no stack — pg_cron substitui Inngest/Trigger.dev, Edge Functions substituem workers dedicados
- **TypeScript em tudo** — server functions, Edge Functions, frontend. Sem polyglot

---

## 3. Arquitetura multi-tenant e segurança

### 3.1 Modelo de organização

Cada cliente (Liderei, no caso atual) é uma **organização**. Dentro de uma org, há usuários com papéis distintos:

| Papel | Permissões |
|---|---|
| `master_admin` | Operador da plataforma (S7). Vê todas as orgs, gerencia plataforma. NÃO tem acesso a chaves de infraestrutura globais (essas vivem em env vars) |
| `company_admin` | Admin da organização cliente. Gerencia membros, integrações, configurações da org |
| `user` | Usuário comum da org. Cria campanhas, atende leads, mas não administra |

### 3.2 Row Level Security (RLS)

Todas as tabelas com dados sensíveis têm RLS habilitado. Toda query passa por duas funções helper criadas como SECURITY DEFINER:

- `is_org_member(user_id, organization_id)` — verifica se o usuário pertence à org
- `has_role(user_id, role)` — verifica se o usuário tem determinado papel

Policy típica de uma tabela:
```sql
CREATE POLICY "Org members select" ON tabela
FOR SELECT TO authenticated
USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org admins manage" ON tabela
FOR ALL TO authenticated
USING (
  is_org_member(auth.uid(), organization_id) 
  AND has_role(auth.uid(), 'company_admin')
);
```

### 3.3 Encryption de segredos

| Tipo de segredo | Onde mora |
|---|---|
| Chaves globais de infraestrutura (Hook7 apikey, futuras) | Variável de ambiente do servidor — NUNCA no banco |
| Tokens de instância (Hook7) | Coluna `bytea` criptografada via `pgp_sym_encrypt` (passphrase em env) |
| Chave Resend global (transacional) | Atualmente em `platform_settings` — dívida técnica para migrar para env var |
| Chave Resend por organização (campanhas, futuro) | Criptografada em `platform_settings` por org |

### 3.4 Auditoria de segurança aplicada

Auditoria realizada antes da publicação do MVP em maio/junho de 2026 identificou e corrigiu:

- Exposição de `api_keys.key_hash` a todos os membros da org (corrigido — agora apenas `company_admin`)
- Falso positivo de cross-org em `organization_invitations` (verificado — escopo já estava correto)
- Funções SECURITY DEFINER com EXECUTE para `anon` — analisadas caso a caso; algumas legítimas (`list_org_members` faz check de membership dentro da query), outras viraram dívida técnica para revogar EXECUTE de `anon`/`public`

### 3.5 Apêndice técnico — Tabelas core

```sql
-- Organizações
CREATE TABLE organizations (
  id uuid PK,
  name text,
  slug text UNIQUE,
  logo_url text,
  whatsapp_mode text DEFAULT 'shared',  -- 'shared' | 'per_user'
  created_at, updated_at
);

-- Membros
CREATE TABLE organization_members (
  id uuid PK,
  organization_id uuid FK,
  user_id uuid FK (auth.users),
  role app_role,  -- enum
  status member_status,
  joined_at, ...
);

-- Roles globais
CREATE TABLE user_roles (
  user_id uuid FK,
  role app_role,
  PRIMARY KEY (user_id, role)
);

-- Convites pendentes
CREATE TABLE organization_invitations (
  id uuid PK,
  organization_id uuid FK,
  email text,
  token text UNIQUE,
  role app_role,
  expires_at, created_at, accepted_at
);
```

---

## 4. Módulos do produto

### 4.1 Autenticação e Onboarding

#### 4.1.1 Visão de produto

O usuário se cadastra com email e senha. No MVP, **não há confirmação de email** — a primeira vez que ele entra, cai numa tela única de onboarding com uma visão dos 5 principais pilares do produto e um botão "Começar a usar". Depois disso, login subsequente vai direto para o Dashboard.

#### 4.1.2 Estado atual

- ✅ Cadastro sem confirmação de email
- ✅ Login/logout via Supabase Auth
- ✅ Provisionamento automático: ao cadastrar, função SECURITY DEFINER `provision_user_account` cria uma org default e atribui o usuário como `company_admin` dela
- ✅ Tela de onboarding em rota dedicada (`/onboarding`) — 5 cards (3 ativos, 2 "Em breve"), botão "Começar a usar" marca `profiles.onboarding_completed_at`
- ✅ Convite de novos membros via email (token único, link de aceite)

#### 4.1.3 Apêndice técnico

```sql
ALTER TABLE profiles
  ADD COLUMN onboarding_completed_at timestamptz;

-- Function de provisionamento (resumida)
CREATE FUNCTION provision_user_account(_user_id uuid, _email text)
RETURNS uuid SECURITY DEFINER AS $$
  -- 1. Cria org default
  -- 2. Cria organization_member com role company_admin
  -- 3. Atribui user_role company_admin
$$;
```

---

### 4.2 Dashboard

#### 4.2.1 Visão de produto

Tela inicial após login. Mostra KPIs reais da organização: total de leads, mensagens enviadas (período), conversas abertas, campanhas ativas. Resume o estado operacional.

#### 4.2.2 Estado atual

- ✅ KPIs básicos (leads, mensagens, conversas, campanhas)
- ⏳ Futuro: KPI "Reuniões agendadas este mês" (depende de Cal.com)
- ⏳ Futuro: KPI "Taxa de conversão lead → reunião"
- ⏳ Futuro: KPI "Score médio dos leads ativos"
- ⏳ Futuro: Funil de conversão (leads → abertos → respondidos → reuniões)

---

### 4.3 Leads

#### 4.3.1 Visão de produto

Lista central de contatos. Cada lead tem dados pessoais (nome, email, telefone), profissionais (cargo, empresa, setor) e enriquecimento (LinkedIn, site, departamento, etc).

O usuário pode:
- Cadastrar lead manualmente
- Importar lista via CSV (Apollo, Pipedrive, ou planilha customizada)
- Editar dados de qualquer lead
- Acompanhar status, temperatura, score

Quando uma mensagem WhatsApp chega de um número desconhecido, o sistema cria automaticamente um "lead órfão" marcado como `needs_review = true`. Esses leads aparecem em uma aba dedicada para revisão.

#### 4.3.2 Estado atual

- ✅ CRUD completo (criar, editar, listar, deletar)
- ✅ Importer CSV inteligente:
  - Auto-detecção de delimitador (`;` ou `,`)
  - Detecção de encoding (UTF-8 / ISO-8859-1)
  - Detecção de headers duplicados/vazios
  - Auto-sugestão de mapeamento (Apollo, Pipedrive, HubSpot, PT-BR)
  - Concatenação automática `first_name + last_name`
  - Validação de URLs (adiciona `https://` se faltar)
  - Validação de `employee_count` (aceita "100+", "50-200", extrai número)
- ✅ Esquema híbrido: campos fixos para dados comuns + `enrichment_data jsonb` para dados exóticos
- ✅ Lead órfão criado automaticamente quando mensagem WhatsApp inbound chega de número desconhecido (`needs_review = true`, `review_reason = 'inbound_from_unknown_whatsapp'`)
- ✅ Tab "Pra revisar" em `/dashboard/leads` lista leads órfãos
- ✅ Ações na revisão: Aceitar (mantém na base) ou Descartar (soft delete)
- ✅ Badge no menu sidebar com contagem de leads pendentes de revisão
- ⏳ Futuro: Pipeline visual de vendas (kanban)
- ⏳ Futuro: Filtros avançados (cidade, indústria, score, etc)
- ⏳ Futuro: Bulk actions (mover múltiplos leads, mudar status em lote)

#### 4.3.3 Apêndice técnico

```sql
CREATE TABLE leads (
  id uuid PK,
  organization_id uuid FK,
  
  -- Identidade
  full_name text,
  email text,
  phone text,
  
  -- Profissionais
  company_name text,
  job_title text,
  seniority text,
  department text,
  industry text,
  employee_count int,
  
  -- Enriquecimento (campos first-class)
  website_url text,
  linkedin_url text,
  city text,
  state text,
  country text,
  mobile_phone text,
  corporate_phone text,
  secondary_email text,
  personal_email text,
  
  -- Enriquecimento (campos raros)
  enrichment_data jsonb DEFAULT '{}',
  
  -- Estado do funil
  status text,
  temperature text,
  score int,
  
  -- Revisão (leads órfãos)
  needs_review boolean DEFAULT false,
  review_reason text,
  
  -- Soft delete
  archived_at timestamptz,
  
  created_at, updated_at
);
```

---

### 4.4 Campanhas

#### 4.4.1 Visão de produto

Campanha é o "contêiner" de uma estratégia de prospecção. Tem metadados (nome, descrição, canal, objetivo, limite operacional diário) e um fluxo associado (criado no Builder).

O usuário cria a campanha, associa leads, edita o fluxo no Builder, e dispara.

#### 4.4.2 Estado atual

- ✅ CRUD de campanhas (metadata)
- ✅ Associação com fluxo via tabela `builder_documents`
- ✅ Estado: rascunho / publicada
- ⏳ Futuro: Templates de fluxo prontos por nicho (contabilidade, SaaS, etc) — pedido do Renan
- ⏳ Futuro: Disparo agendado / inscrição em lote
- ⏳ Futuro: A/B test de variantes de mensagem
- ⏳ Futuro: Métricas por campanha (abertura, resposta, conversão)

---

### 4.5 Builder de fluxos

#### 4.5.1 Visão de produto

Editor visual onde o usuário desenha a cadência de prospecção. É um canvas com nós arrastáveis. Cada nó é um step (uma ação: enviar email, esperar X tempo, condição de ramificação).

O usuário arrasta steps da paleta lateral, conecta com setas, configura cada nó (texto da mensagem, tempo de espera, condição), salva e publica.

A inspiração de referência é o fluxo de cadência da Mauna (13 dias, 5 canais, 2 condicionais, 24+ steps, ramificações paralelas, raias temporais por dia). Esse fluxo é a baseline do que o Builder deve conseguir desenhar.

#### 4.5.2 Estado atual

- ✅ Canvas via `@xyflow/react` (drag and drop)
- ✅ Tipos de step ativos: Email, Wait (dias/horas/min), Condition (responded yes/no)
- ✅ Persistência via tabelas `builder_documents`, `flow_steps`, `flow_transitions`
- ✅ Salvar explícito (não auto-save)
- ✅ Publicar valida que todos os nós estão preenchidos
- ✅ Variáveis de lead disponíveis nos chips (full_name, first_name, company_name, etc)
- ✅ Auto-conectar: ao arrastar novo step, conecta automaticamente ao último criado
- ⏳ Próximo (1C.2 / Fase 2): Step Message WhatsApp (envio via Hook7)
- ⏳ Próximo: Step LinkedIn estrutural (gera notificação para vendedor executar manualmente — não é automação)
- ⏳ Futuro: Step Ligação (gera tarefa, depende de ElevenLabs no longo prazo)
- ⏳ Futuro: Step "Enviar link de agendamento" (depende de Cal.com)
- ⏳ Futuro: Condições baseadas em campo do lead ("tem telefone?", "indústria = X")
- ⏳ Futuro: Raias temporais por dia (visual estilo PPT da Mauna)
- ⏳ Futuro: Paralelismo real (mais de uma sequência rodando)
- ⏳ Futuro: Templates por nicho

#### 4.5.3 Tensão pendente: Builder fixo vs IA autônoma

Em reunião, o time do Liderei (especialmente Juliano) sinalizou interesse em IA "que decide o próximo passo sozinha, independente do fluxo desenhado". Por outro lado, o fluxo da Mauna (que o Renan apresentou) é estritamente determinístico.

**Decisão registrada:** o Builder visual permanece como **fonte de verdade da estrutura**. A IA atua dentro de cada step (gerando conteúdo personalizado), não decidindo o fluxo. Isso evita comportamentos erráticos (mensagens repetidas, falta de contexto) e mantém o usuário no controle da estratégia.

#### 4.5.4 Apêndice técnico

```sql
CREATE TABLE builder_documents (
  id uuid PK,
  organization_id uuid FK,
  campaign_id uuid FK,
  version int,
  status text,  -- draft | published
  ...
);

CREATE TABLE flow_steps (
  id uuid PK,
  document_id uuid FK,
  step_type text,  -- email | wait | condition_replied | message_whatsapp (futuro)
  config jsonb,
  position_x, position_y,
  is_entry boolean,
  ...
);

CREATE TABLE flow_transitions (
  id uuid PK,
  document_id uuid FK,
  from_step_id uuid FK,
  to_step_id uuid FK,
  branch text,  -- 'next' | 'yes' | 'no'
  ...
);
```

---

### 4.6 Inbox unificado

#### 4.6.1 Visão de produto

Tela com 3 colunas:
1. **Esquerda** — lista de conversas (todos os canais)
2. **Meio** — thread da conversa selecionada
3. **Direita** — detalhes do lead

O usuário vê todas as interações de todos os canais (email, WhatsApp, futuro LinkedIn) num lugar só. Pode responder via composer no rodapé do thread. Pode editar dados do lead na coluna direita.

Estilo visual das mensagens WhatsApp: bolhas verde-claras (#dcf8c6) para outbound, brancas para inbound, com ícones de status (✓ sent, ✓✓ delivered, ✓✓-azul read).

#### 4.6.2 Estado atual

- ✅ 3 colunas funcionais
- ✅ Mensagens de email mostradas
- ✅ Mensagens WhatsApp mostradas com bolhas estilo WhatsApp
- ✅ Realtime via Supabase channel — nova mensagem aparece sem F5
- ✅ Composer no rodapé para responder via WhatsApp (chama `sendWhatsAppMessage`)
- ✅ Status outbound (✓ ✓✓ ✓✓-azul) atualiza via webhook Receipt
- ✅ Filtros: Todas / Email / WhatsApp
- ✅ Banner amarelo quando lead está em revisão (`needs_review = true`)
- ⏳ Conhecido: latência do realtime — mensagem leva alguns segundos para aparecer na UI mesmo com webhook respondendo instantaneamente. Investigar (provável: invalidação de TanStack Query ou subscribe filtro)
- ⏳ Futuro: Marcação manual de "lido"
- ⏳ Futuro: Atribuição de conversa a vendedor específico
- ⏳ Futuro: Notas internas (anotações que só o time vê)
- ⏳ Futuro: Busca dentro de mensagens

#### 4.6.3 Apêndice técnico

```sql
CREATE TABLE conversations (
  id uuid PK,
  organization_id uuid FK,
  lead_id uuid FK,
  channel text,  -- 'email' | 'whatsapp'
  last_message_at timestamptz,
  ...
);

ALTER TABLE messages
  ADD COLUMN external_message_id text,
  ADD COLUMN source_channel text DEFAULT 'manual',  -- 'email' | 'whatsapp' | 'manual'
  ADD COLUMN whatsapp_status text,  -- 'sent' | 'delivered' | 'read' | 'failed'
  ADD COLUMN whatsapp_status_at timestamptz;

CREATE UNIQUE INDEX idx_messages_external_message_id
  ON messages (external_message_id)
  WHERE external_message_id IS NOT NULL;

ALTER PUBLICATION supabase_realtime ADD TABLE messages;
```

---

### 4.7 Settings

#### 4.7.1 Visão de produto

Área onde o `company_admin` configura a organização. Subdividida em abas:

- **Organização** — nome, logo, dados gerais
- **Membros** — convidar, listar, mudar papel, remover
- **Integrações** — modo de uso WhatsApp (compartilhado vs por vendedor), futuros toggles
- **API Keys** — chaves para integrações de terceiros (somente listar, não revelar valor)

#### 4.7.2 Estado atual

- ✅ Organização editável
- ✅ Membros: convite via email com token, aceite via link público
- ✅ API Keys: criação com revelação única (padrão GitHub/Stripe)
- ✅ Modo WhatsApp (`shared` / `per_user`)
- ⏳ Futuro: Webhooks externos (cliente recebe eventos do Leaderei em sistema dele)
- ⏳ Futuro: 2FA / TOTP

---

### 4.8 Integrações

#### 4.8.1 Visão de produto

Tela onde o `company_admin` conecta canais externos. Atualmente:

- **Email** (via Resend) — configurar chave própria ou usar transacional
- **WhatsApp** (via Hook7) — gerenciar instâncias (1 ou mais números)
- **Apollo** — placeholder (importação via CSV ativa, API futura)
- **Pipedrive** — placeholder (importação via CSV ativa, API futura)
- **Google Calendar** — placeholder (depende de Cal.com)

Cada card mostra status agregado (conectado, parcialmente conectado, desconectado).

#### 4.8.2 Estado atual

- ✅ Card WhatsApp totalmente funcional (criar/conectar/desconectar/reconectar/apagar/renomear instâncias)
- ✅ Card Resend funcional para chave da organização (campanhas)
- ⏳ Cards Apollo/Pipedrive são placeholders (a integração real está em Leads → Importar CSV)
- ⏳ Cards Cal.com, LinkedIn — futuros

---

### 4.9 Master Admin

#### 4.9.1 Visão de produto

Área exclusiva do operador da plataforma (S7). Permite ver todas as organizações, gerenciar plataforma, configurar URLs base de integrações, fazer "test connection" de serviços externos.

**Importante:** master_admin **não tem acesso a chaves globais de infraestrutura**. Essas vivem em variáveis de ambiente do servidor, fora do banco. Master_admin apenas vê status ("Configurado / Não configurado").

#### 4.9.2 Estado atual

- ✅ Listagem de organizações
- ✅ Seção Plataforma com Resend (chave global transacional)
- ✅ Seção WhatsApp · Hook7 com:
  - Badge de status da chave global (lida de env var)
  - URL base editável (`platform_settings.hook7_base_url`)
  - Prefixo de instâncias (read-only, env var)
  - Botão "Testar conexão"
  - Badge de status do webhook secret
- ⏳ Futuro: Logs de envio de email
- ⏳ Futuro: Logs de envio Hook7 com custo por instância
- ⏳ Futuro: Métricas globais (orgs ativas, total de leads, total de mensagens)
- ⏳ Futuro: Plano por organização (controle de limites)

---

## 5. Integrações externas

### 5.1 Resend (email)

#### 5.1.1 Visão de produto

Email é o primeiro canal multicanal do Leaderei. Atualmente usado para:
- **Emails transacionais** (convites, confirmações, notificações) — chave global da S7, domínio `s7.dev.br` verificado
- **Campanhas** (futuro, ainda não implementado) — chave da organização, domínio próprio dela

#### 5.1.2 Decisão estratégica sobre email em campanhas

Em reunião, o Nico levantou preocupação: exigir que o cliente final contrate Resend separadamente causa fricção que mata adoção. Proposta dele (validada pelo Juliano):

> "Imagina que entrou cliente Groomer. O Leaderei compra um domínio 'fake' parecido (groomer-comercial.com.br), configura DNS, embute custo no preço. Cliente nem sabe que existe Resend."

Esse é o modelo da empresa Neros (citada na reunião), que vende SPAM bem feito justamente porque elimina toda a fricção técnica. O Leaderei vai replicar essa abordagem para campanhas:

- Operador compra domínios parecidos com o do cliente
- Configura DNS (DKIM/SPF/DMARC)
- Conecta automaticamente à conta Resend
- Cliente paga "no preço" sem ver Resend separado

**Status:** decidido, não implementado. Vai entrar em fase de polish quando o produto começar a ser vendido.

#### 5.1.3 Estado atual

- ✅ Transacional funcionando (s7.dev.br + leaderei@s7.dev.br + template HTML com logo)
- ✅ Chave de organização configurável em Settings → Integrações (placeholder)
- ⏳ Pendente: implementação real de envio de campanha por org
- ⏳ Pendente: compra automatizada de domínio (provavelmente via API da Hostinger ou similar)

---

### 5.2 Hook7 (WhatsApp)

#### 5.2.1 Visão de produto

Hook7 é a API de WhatsApp não-oficial da S7, hospedada na VPS do operador via Dokploy. O Leaderei conecta múltiplas instâncias (1 por organização no modo `shared` ou 1 por vendedor no modo `per_user`).

Quando o `company_admin` clica "Conectar WhatsApp" no Leaderei:
1. Sistema chama `POST /instance/create` na Hook7 (autenticado pela chave global da S7)
2. Sistema chama `POST /instance/connect` com webhookUrl apontando para Edge Function
3. Sistema busca QR via `GET /instance/qr`
4. Usuário escaneia com WhatsApp do celular
5. Polling de status detecta `connected` em até 15s
6. Webhook `Connected` chega na Edge Function trazendo o número real (`jid`)

A partir daí, todas as mensagens trocadas (in e out) fluem via webhook na Edge Function, que grava em `messages` e dispara realtime.

#### 5.2.2 Importante: nomenclatura

**O backend técnico do Hook7 é Evolution Go (whatsmeow).** Mas em código, comentários, UI, documentação ou conversa com cliente, **a referência é sempre "Hook7"**. Evolution Go nunca é mencionado externamente.

#### 5.2.3 Riscos regulatórios

API não-oficial de WhatsApp viola os Termos de Serviço da Meta. Riscos reais:

- Banimento do número (probabilidade média-alta, especialmente sem aquecimento gradual)
- Bloqueio do método pela Meta (já aconteceu várias vezes na história do Baileys/whatsmeow)
- Reclamação ou ação legal do cliente final em caso de banimento

**Mitigação adotada:** o cliente final reconhece o risco no contrato. O modelo de mercado brasileiro atual é dominado por API não-oficial (Dripify, Waalaxy, etc todos usam abordagem similar), então o risco é o mesmo da concorrência. Estratégia de longo prazo: adicionar WhatsApp Business API oficial como upgrade premium para clientes enterprise.

#### 5.2.4 Estado atual

- ✅ Criar instância via UI
- ✅ Gerar QR e conectar
- ✅ Status polling (3 segundos)
- ✅ Desconectar, reconectar, apagar instância
- ✅ Renomear
- ✅ Card principal em Integrações reflete estado agregado real
- ✅ Webhook Edge Function recebe e processa:
  - `Message` inbound (cria lead órfão se número desconhecido + grava em messages)
  - `Message` outbound (grava em messages como sent)
  - `Receipt` delivered/read (atualiza status da mensagem outbound)
  - `Connected` (atualiza `phone_number` e status da instância)
  - `LoggedOut` (atualiza status para `disconnected` ou `banned`)
  - `ChatPresence` (descarta)
  - `SendMessage` (descarta — Message outbound já cobre)
- ✅ Idempotência via `Info.ID` do WhatsApp
- ✅ Auto-registro de webhookUrl no `/instance/connect`
- ✅ Eventos subscritos: `MESSAGE`, `SEND_MESSAGE`, `READ_RECEIPT`, `CONNECTION`
- ✅ Envio outbound via composer no Inbox
- ⏳ Pendente: investigação da latência do realtime (UI demora segundos pra atualizar mesmo com webhook respondendo instantâneo)
- ⏳ Pendente (1C.2): Step `message_whatsapp` no Builder
- ⏳ Pendente: Suporte a mensagens de mídia (imagem, áudio, vídeo, documento)
- ⏳ Pendente: Suporte a templates aprovados (para futuro WhatsApp Business API)

#### 5.2.5 Modelo de cobrança (pendente)

Você (operador da plataforma) mantém infraestrutura Hook7 na sua VPS. Quando outras orgs usarem o produto, vai precisar definir como cobrar:

- Por organização ativa (mesma estrutura do Cal.com proposto)
- Por instância ativa (mais granular, melhor para multi-vendedor)
- Híbrido (1 instância inclusa + R$ 29 por extra)

Modelo recomendado: **híbrido**. Decisão final em fase de precificação comercial.

#### 5.2.6 Apêndice técnico

```sql
CREATE TABLE hook7_instances (
  id uuid PK,
  organization_id uuid FK,
  owner_user_id uuid FK,  -- NULL = org-level, NOT NULL = vendor-level
  
  display_name text,         -- "Vendedor João"
  external_id text UNIQUE,   -- UUID retornado pelo Hook7
  external_name text UNIQUE, -- "lead-{orgSlug}-{nameSlug}-{shortId}"
  token_encrypted bytea,     -- pgp_sym_encrypt do token da instância
  phone_number text,         -- preenchido por webhook Connected
  connected_profile_name text, -- nome do perfil WhatsApp
  
  status text,  -- pending_qr | qr_ready | pairing | connected | disconnected | banned | error
  
  last_qr_at, last_connected_at, last_disconnected_at, last_status_check_at,
  
  config jsonb,
  archived_at timestamptz,
  created_at, updated_at, created_by
);
```

Endpoints Hook7 utilizados:
- `POST /instance/create` (header `apikey` global) → cria, retorna `{ id, name, token }`
- `POST /instance/connect` (header `apikey` instância) → inicia pareamento, registra webhook
- `GET /instance/qr` (header `apikey` instância) → retorna QR base64 em `data.Qrcode`
- `GET /instance/status` (header `apikey` instância) → retorna `data.Connected`, `data.LoggedIn`, `data.Name`
- `POST /instance/disconnect`, `/reconnect` (header `apikey` instância)
- `POST /send/text` (header `apikey` instância) → envia mensagem

Variáveis de ambiente:
- `HOOK7_GLOBAL_APIKEY` — chave master da S7 (env var, nunca no banco)
- `HOOK7_INSTANCE_PREFIX` — prefixo para nomes (default `"lead"`)
- `HOOK7_WEBHOOK_SECRET` — UUID secreto para path do webhook

---

### 5.3 Apollo + Pipedrive (CSV)

#### 5.3.1 Visão de produto

Os dois são fontes de leads. O modelo atual é importação manual via CSV (decisão do cliente na reunião — eles não querem complicar com API agora, e CSV cobre 95% dos casos).

O Apollo é o "core" de prospecção (palavra do Nico em reunião). Traz site da empresa, nome do contato, cargo, email, telefone, indústria, tamanho. É a "farinha de trigo" do processo comercial — boa farinha = boa pizza.

O Pipedrive é o CRM. Quem já usa Pipedrive exporta listas dele para o Leaderei.

#### 5.3.2 Estado atual

- ✅ Importer suporta nativamente headers em formato Apollo e Pipedrive
- ✅ Esquema híbrido: campos importantes viram colunas, resto vai pra `enrichment_data`
- ✅ Validado com 3 CSVs de teste (Apollo style, Pipedrive style, custom esquisito com PT-BR e separador `;`)
- ⏳ Futuro: Integração API direta com Apollo (busca + import sem CSV)
- ⏳ Futuro: Sync bidirecional com Pipedrive
- ⏳ Futuro: Enriquecimento via Apollo de leads já existentes (botão "Enriquecer com Apollo")

---

### 5.4 Cal.com (agendamento)

#### 5.4.1 Visão de produto

Sistema de booking nativo. Quando o lead chega no momento "agendar reunião", o Leaderei mostra (ou envia) um link de agendamento. Lead escolhe horário, reunião cai automaticamente na agenda do vendedor responsável.

A reunião agendada é registrada como **conversão** no painel do Leaderei.

A IA do Leaderei deve conseguir negociar agendamento em linguagem natural com o lead (sugerir horários, remarcar, cancelar) consumindo a API do Cal.com.

#### 5.4.2 Decisões tomadas

- **Self-hosted Cal.com** na VPS do operador (mesma do Hook7)
- **Caminho B (faseado)**: Google Calendar primeiro, Outlook em seguida
- **Round-robin entre vendedores** (lead escolhe quem)
- **Modelo comercial**: cobrança por cliente ativo (mesma estrutura do Hook7), valor decrescente conforme escala (R$ 49 → R$ 19 por cliente ativo/mês)
- **Duas opções para o cliente** do operador:
  - Gerenciado (operador hospeda, cobra mensalidade)
  - Self-service (cliente final conecta o próprio Cal.com)

#### 5.4.3 Estado atual

- ⏳ Briefing pronto para deploy em outro chat (`briefing-deploy-calcom.md`)
- ⏳ Proposta comercial pronta para apresentar (`proposta-booking-leaderei.md`)
- ⏳ Deploy pendente
- ⏳ Integração Leaderei → Cal.com pendente
- ⏳ Integração IA → Cal.com (negociação por linguagem natural) pendente

---

### 5.5 LinkedIn

#### 5.5.1 Visão de produto

LinkedIn é canal importante (fluxo da Mauna começa com Connection Request lá). Mas é o canal **mais arriscado** tecnicamente.

#### 5.5.2 Caminhos avaliados

| Caminho | Decisão |
|---|---|
| API oficial do LinkedIn | **Inviável** — exige parceria comercial com LinkedIn (Microsoft), processo de aprovação que leva meses e raramente aprova startups |
| Cookie-based (estilo Dripify/Waalaxy) | **Adiado** — requer infraestrutura própria de scraping + risco de banimento da conta do vendedor |
| Estrutural (gera notificação para vendedor) | **Adotado no MVP** — quando step LinkedIn dispara, sistema cria uma tarefa para o vendedor executar manualmente |
| Unipile (API terceirizada) | **Adiado** — custa US$ 60-200/mês por usuário, vale considerar quando produto tiver 50+ clientes pagantes |

#### 5.5.3 Estado atual

- ⏳ Pendente: Step `message_linkedin` no Builder com 3 sub-tipos (connection_request, connection_follow_up, message)
- ⏳ Pendente: Quando dispara, cria notificação para o vendedor (não envia automático)
- ⏳ Pendente: Tela de tarefas pendentes para o vendedor

---

## 6. Inteligência artificial e personalização

### 6.1 Visão de produto

A IA é o **core do produto**, não um extra. Posição registrada em reunião (Renan: "a abordagem em si, a grande dor, é o processo de pesquisa do lead, aprofundamento, conhecimento das informações do contexto para construção de uma boa abordagem. Isso aí a gente mata a pau").

A IA atua em três momentos:

1. **Pesquisa pré-abordagem** — scraping de site da empresa, leitura de dados do Apollo, montagem de contexto
2. **Geração de conteúdo** — escreve email/WhatsApp/LinkedIn personalizado dentro do tom configurado
3. **Negociação de agendamento** — conversa com o lead em linguagem natural quando ele quer marcar/remarcar/cancelar reunião

### 6.2 Escopo do scraping

| Fonte | Caminho | Risco |
|---|---|---|
| Site da empresa | **Jina AI Reader** (URL → markdown limpo) | Baixo — conteúdo público |
| Apollo (já comprado) | Dados que vêm no enriquecimento (cargo, setor, etc) | Zero |
| LinkedIn ativo (raspagem) | Não fazer | Alto risco regulatório |

### 6.3 Customização por marca

Pedido do Juliano em reunião: cada marca/cliente final do operador tem **prompt próprio** que define tom, vocabulário, área de atuação, casos de exemplo. O Builder do fluxo aceita marcar uma mensagem como "texto fixo" ou "reescrever com IA dentro do prompt da marca".

### 6.4 Stack de IA

| Camada | Tecnologia | Observação |
|---|---|---|
| Modelo principal | A definir entre OpenAI / Claude / Gemini | Suporte a fallback (se um falhar, usa outro) |
| Áudio / voz (futuro) | ElevenLabs | Diferencial — vendedor manda áudio personalizado por IA |
| Vídeo (longo prazo) | Possivelmente MiniMax (mais barato) | Apresentações personalizadas |
| Scraping | Jina AI Reader | Free tier generoso |

### 6.5 Modelo proprietário (longo prazo)

Estratégia de longo prazo do Nico: construir tecnologia proprietária (modelo fine-tunado próprio, infra própria) usando recursos públicos:

- **FAPESP** — projeto submetido "Desenvolvimento e validação experimental de arquitetura inteligente, orquestração multicanal baseada em agentes já contextualizados para prospecção B2B"
- **FINEP** — captação futura (R$ 20M+ possível, requer parceria com grande empresa)

Importante: **isso não muda o desenvolvimento imediato**. No MVP, usamos APIs de terceiros. O movimento para modelo proprietário é fase 3+ do produto.

### 6.6 Estado atual

- ⏳ Pendente: Tudo. Módulo de IA não foi implementado ainda. Próxima frente após executor de fluxos.

### 6.7 Sistema de score comportamental

Pedido do Nico em reunião: cada interação do lead gera pontos.

| Evento | Pontos (sugestão) |
|---|---|
| Email aberto | +5 |
| Email respondido | +20 |
| WhatsApp visualizado | +3 |
| WhatsApp respondido | +20 |
| LinkedIn conexão aceita | +10 |
| Áudio respondido com áudio | +30 |
| Click em link | +5 |
| Visita ao site (se tracking) | +15 |
| Não interagiu em 7 dias | -10 |

Quando score cruza threshold (ex: 70/100), o lead **muda de temperatura** e o sistema **notifica humano** ("este lead está quente — priorize ligação").

**Status:** decidido, não implementado. Entra após o módulo de IA estar funcionando.

---

## 7. Executor de fluxos (scheduler)

### 7.1 Visão de produto

Coração do produto. Sem isso, o Builder é UI bonita sem motor.

Quando um lead é inscrito numa campanha, o executor precisa:
1. Identificar o step de entrada
2. Executar (mandar email/WhatsApp/etc)
3. Aguardar o tempo configurado (pode ser minutos ou dias)
4. Avaliar condição (se houver — "respondeu?")
5. Seguir para o próximo step
6. Repetir até o fim do fluxo

Para o fluxo da Mauna (13 dias), o executor precisa "acordar" pontualmente dias depois para disparar steps subsequentes.

### 7.2 Decisões pendentes

Discussão em aberto sobre arquitetura. Decisão a tomar:

| Opção | Resumo |
|---|---|
| pg_cron + Edge Function | Tudo dentro do Supabase, sem nova infra. **Recomendado pelo claude** |
| Inngest / Trigger.dev | Plataforma externa especializada, ótima DX, custo após free tier |
| Cron externo (cron-job.org) + Edge Function | Grátis, mas dependência externa frágil |
| Worker dedicado em VPS | Controle total, requer infra extra (operador não quer usar VPS para o app) |
| Outra ideia do operador | A discutir |

### 7.3 Modelo de dados proposto (independente da escolha de scheduler)

```sql
CREATE TABLE flow_enrollments (
  id uuid PK,
  organization_id uuid FK,
  campaign_id uuid FK,
  flow_document_id uuid FK,  -- snapshot da versão do fluxo
  lead_id uuid FK,
  
  current_step_id uuid FK,    -- step atual (NULL = aguardando primeiro)
  next_execution_at timestamptz, -- quando processar próximo
  status text,  -- 'active' | 'paused' | 'completed' | 'errored' | 'cancelled'
  
  context jsonb,  -- variáveis acumuladas (respostas, etc)
  
  enrolled_at, completed_at, created_at, updated_at
);

CREATE INDEX idx_enrollments_pending 
  ON flow_enrollments(next_execution_at, status) 
  WHERE status = 'active';
```

### 7.4 Princípios obrigatórios

- **Idempotência** — duas execuções simultâneas não duplicam ação (lock via `SELECT FOR UPDATE SKIP LOCKED`)
- **Retry com backoff** — falha de API externa tenta 3x: 1min, 5min, 30min — depois marca `errored`
- **Snapshot do fluxo** — lead começou na versão X, continua na versão X mesmo se o fluxo for editado
- **Tracking de execução** — log de "step Y executado em hora Z" para auditoria

### 7.5 Estado atual

- ⏳ Pendente: definir arquitetura
- ⏳ Pendente: implementação completa
- **Bloqueio**: sem isso, todas as features do Builder ficam visuais sem efeito real

---

## 8. Dívidas técnicas

Lista das dívidas conhecidas em ordem de prioridade:

| # | Dívida | Severidade | Custo aproximado |
|---|---|---|---|
| 1 | Migrar chave Resend global de `platform_settings` para variável de ambiente (alinhar padrão com Hook7) | Média (afeta quando outro `master_admin` existir) | 1 rodada Lovable |
| 2 | Investigar latência do realtime no Inbox (mensagem demora segundos pra aparecer mesmo com webhook respondendo instantâneo) | Média (afeta UX visível) | 1 rodada de diagnóstico + 1 de fix |
| 3 | Storage bucket `public-assets` sem policy DELETE explícita (advisor cosmético, não há brecha real) | Baixa | 3 min |
| 4 | Funções SECURITY DEFINER com EXECUTE para `anon`/`public` (várias funcionalmente seguras, mas vale revogar onde não necessário) | Média | 30 min de análise + migration |
| 5 | Bucket público com SELECT broad pode permitir LIST (atualmente só tem o logo, baixo risco) | Baixa | 5 min |
| 6 | Sem audit log de envio (Resend) e de uso Hook7 (master_admin não consegue auditar custo) | Média (afeta operação a partir de 10+ orgs) | 1 rodada |
| 7 | Sem rotação de chaves criptografadas (uma vez setada a passphrase, não muda) | Baixa (relevante em ambiente regulado) | Mais elaborado |

---

## 9. Roadmap por fases

### Fase 1 — Fundação (concluída)

- Auth + multi-tenant + RLS + funções helper
- Dashboard com KPIs reais
- Leads CRUD + Importer CSV inteligente
- Campanhas CRUD
- Builder visual (Email + Wait + Condition)
- Inbox 3 colunas (visualização)
- Settings completo
- Master Admin
- Resend transacional
- Auditoria de segurança
- Tela de Onboarding
- Auto-link de cards no Builder

### Fase 2 — Multicanal (em andamento)

- ✅ Importer Apollo/Pipedrive com schema híbrido
- ✅ Refinamentos (onboarding, sem confirmação email, auto-link)
- ✅ Hook7: criar/gerenciar instâncias + webhook + recebimento
- ✅ Inbox: WhatsApp + realtime + composer + leads pra revisar
- ⏳ **Executor de fluxos (pg_cron + Edge Function)** — próximo
- ⏳ Step WhatsApp no Builder (depende do executor)
- ⏳ Step LinkedIn estrutural no Builder (gera notificação)
- ⏳ Investigação da latência do realtime
- ⏳ Cal.com self-hosted (em outro chat)
- ⏳ Integração Leaderei ↔ Cal.com

### Fase 3 — Inteligência (planejada)

- IA de scraping (Jina) + geração de abordagem personalizada
- Prompts customizados por marca/cliente
- IA negociadora de agendamento (consome API Cal.com em linguagem natural)
- Sistema de score comportamental
- Handoff automático para humano por threshold
- Templates de fluxo prontos por nicho

### Fase 4 — Refinamento e voz (planejada)

- ElevenLabs (TTS, voz própria do vendedor para áudios personalizados)
- Pipeline visual de vendas
- A/B test de mensagens
- Métricas detalhadas por campanha
- Audit logs operacionais

### Fase 5 — Escala e proprietário (longo prazo)

- Modelo de IA proprietário (recursos FAPESP/FINEP)
- WhatsApp Business API oficial (upgrade premium)
- LinkedIn via Unipile ou própria
- Sincronização bidirecional com CRMs
- Multi-idioma
- White label completo (cliente do operador rebrand)

---

## 10. Decisões pendentes

Lista do que ainda precisa ser definido para destravar próximas frentes:

| # | Decisão | Bloqueia | Quem decide |
|---|---|---|---|
| 1 | Arquitetura do executor de fluxos (pg_cron, Inngest, ou outra) | Builder funcional + Fase 3 inteira | Operador (S7) |
| 2 | Plano Apollo do cliente final (Basic/Pro/Org) | Integração API Apollo (Fase 3) | Cliente final |
| 3 | Volume mensal esperado de prospecção | Definição de plano + custo | Cliente final |
| 4 | Cliente final aprova proposta de Cal.com gerenciado vs self-service | Início do deploy Cal.com | Cliente do operador (Nico) |
| 5 | Modelo de cobrança final do operador (S7) para Hook7 + Cal.com | Faturamento | Operador |
| 6 | Estratégia de aquecimento de domínio para campanhas (quantos domínios "fake" por cliente, qual provider) | Implementação real de campanhas por email | Operador + cliente |
| 7 | Lista oficial de campos do Apollo que o cliente quer ver no Leaderei | Polish do importer | Renan (pendente desde reunião) |
| 8 | Templates de fluxo por nicho (contabilidade, SaaS, etc) | Fase 3 / Builder maduro | Renan |

---

## 11. Glossário

| Termo | Significado |
|---|---|
| **Operador** | A S7 / UpEvolution. Quem hospeda e mantém o produto Leaderei |
| **Cliente do operador** | A Liderei (Nico, Renan, Juliano). Quem usa o produto como base do seu próprio negócio |
| **Cliente final** | Ex: Mauna. Quem efetivamente prospecta leads usando o Leaderei via cliente do operador |
| **Organização (org)** | Tenant do produto. Cada cliente é uma org com seus dados isolados |
| **Master admin** | Papel do operador. Vê todas as orgs, gerencia plataforma. Não vê chaves de infraestrutura |
| **Company admin** | Papel de admin da org cliente |
| **Hook7** | API de WhatsApp não-oficial da S7. Substitui referências ao Evolution Go no produto |
| **Lead órfão** | Lead criado automaticamente quando uma mensagem WhatsApp chega de número desconhecido. Aparece em fila de revisão |
| **Builder** | Editor visual de fluxo de prospecção |
| **Step** | Cada nó do fluxo no Builder (email, wait, condição, WhatsApp, etc) |
| **Enrollment** | Registro de "lead X foi inscrito na campanha Y, está atualmente no step Z" |
| **Executor / scheduler** | Sistema que processa enrollments pendentes e executa os steps no momento certo |
| **RLS** | Row Level Security — mecanismo do PostgreSQL que filtra linhas por user automaticamente |
| **Score comportamental** | Pontuação acumulada por lead conforme interage com a abordagem |
| **Realtime** | Subscription do Supabase que envia mudanças do banco direto ao cliente sem polling |
| **JID** | Identificador WhatsApp do tipo `5541999999999@s.whatsapp.net` |
| **LID** | Identificador WhatsApp interno (LinkedID) do tipo `56028032950370@lid` — não é número real |
| **Webhook** | URL que recebe POST do Hook7 quando algo acontece (mensagem chega, conexão muda, etc) |

---

*Fim do documento. Última atualização: junho de 2026 — após fechamento da Fase 2 (1B.2).*
