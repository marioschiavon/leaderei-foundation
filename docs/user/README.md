# Manual do Usuário — Leaderei

> Guia de uso da plataforma. Atualizado conforme os módulos entram em operação real.

## Estado atual da Fase 1

Hoje a Fase 1 já entrega estes módulos com dados reais:

- Login / Signup
- Dashboard
- Leads (lista, filtros, criação, edição, arquivamento, **import CSV**)
- Campaigns (criar, editar, duplicar, iniciar, pausar, arquivar)
- Inbox (3 colunas: lista, conversa, painel do lead)
- **Builder** (criar fluxo, editar blocos, salvar com versão, publicar/despublicar, excluir)
- Settings (Organização, Membros com convites por email, API keys)
- Integrations (status real + **conexão Resend per-org** via dialog)
- Master · Overview, Organizations, Users, Plans, **Platform** (Resend global + branding + logs), Logs

A Fase 1 está fechada. Restam para próximas fases:

- Execução real de campanhas (envio em loop usando Resend per-org + métricas)
- Webhooks de bounce/delivered do Resend
- Editor avançado de blocos no Builder (templates, condições compostas, ramificações múltiplas)

## 1. Primeiros passos

1. Crie sua conta em `/signup` ou entre em `/login`.
2. **Confirmação de email está desabilitada no MVP** — após o signup, o usuário entra direto na plataforma sem precisar clicar em link de verificação. Para reativar futuramente: religar `Confirm email` nas configurações de Auth do Lovable Cloud (Auth → Email) e restaurar a tela de "verifique seu email" no `/signup`.
3. No primeiro acesso, o usuário é levado para `/onboarding` — uma tela única de boas-vindas com 5 cards (Importar leads, Criar fluxos, Acompanhar painel, IA — em breve, Agendamento — em breve) e um botão "Começar a usar" que marca `profiles.onboarding_completed_at = now()` e leva para `/dashboard`.
4. Logins subsequentes vão direto para `/dashboard`. A rota `/onboarding` continua acessível manualmente.
5. Se não houver sessão, o sistema redireciona automaticamente para `/login`.
6. A área `/master` aparece apenas para usuários com papel `master_admin`.

### Builder — auto-link

No Builder, ao arrastar um novo step (Email, Aguardar, Condição) da paleta para o canvas, o sistema **conecta automaticamente** o novo nó ao último nó adicionado, com `branch = next` (ou na primeira saída livre `yes`/`no` para Condições). O novo nó é posicionado 280px à direita do último. Quando o último nó já tem todas as saídas ocupadas — ou quando é uma Condição com `yes` e `no` ambos ocupados — o novo nó fica solto e o usuário conecta manualmente. A operação ainda exige clicar em "Salvar" para persistir.


## 2. Navegação

### Workspace

- Dashboard
- Campaigns
- Leads
- Inbox

### Tools

- Integrations
- Builder

### Admin

- Master
- Settings

No rodapé da sidebar, a conta mostra:

- nome do usuário autenticado
- organização ativa
- papel atual no workspace

## 3. Dashboard

O Dashboard já usa dados reais da organização atual.

Hoje ele mostra:

- total de leads
- leads novos
- conversas abertas
- mensagens enviadas nos últimos 7 dias
- campanhas ativas

Se ainda não houver operação no tenant, a tela mostra um empty state real com os próximos passos sugeridos.

## 4. Leads

O módulo de Leads já funciona com base real.

Recursos disponíveis:

- busca por nome, email, empresa, cargo e origem
- filtro por status e por origem
- criação de lead (sheet "Novo lead")
- edição inline e arquivamento no painel lateral
- **importação via CSV** (botão "Importar")
- painel lateral com score, temperatura, origem, próximo follow-up, potencial comercial, enrichment recente e atividade

### Importar CSV

1. Clique em **Importar** no topo da página.
2. Selecione um arquivo `.csv` com cabeçalho. Cabeçalhos aceitos:
   `full_name` (ou `nome`), `email`, `phone`, `company_name`, `job_title`.
3. Opcional: escolha uma origem padrão para todos os leads importados.
4. Linhas sem nome ou email válido são **ignoradas** e listadas no resumo
   pós-importação (com número da linha original e motivo).
5. Os leads criados aparecem imediatamente na lista.

## 5. Integrations

O módulo de Integrações já lê os providers e as conexões reais da organização.

Estados usados na tela:

| Estado | Significado |
| --- | --- |
| Connected | A integração está ativa no tenant |
| Pending | O setup foi iniciado, mas ainda não terminou |
| Disconnected | O provider existe, mas não está conectado |
| Error | Houve falha na autenticação ou sincronização |

A tela também mostra:

- nome do provider
- categoria
- nome da conexão quando existir
- último sync
- erro mais recente, se houver

### WhatsApp via Hook7

O provider **WhatsApp** usa o Hook7 (API própria da S7) para conectar números reais via QR Code.

- A **chave global do Hook7** é configurada pelo operador da plataforma (S7) via variável de ambiente do servidor (`HOOK7_GLOBAL_APIKEY`). O `master_admin` pode verificar status e testar a conexão em **Master → Plataforma → WhatsApp · Hook7**, mas **não** pode visualizar ou alterar o valor pela UI. A **URL base** continua editável pela UI (não é segredo).
- O prefixo de nomes de instância é controlado pela variável `HOOK7_INSTANCE_PREFIX` (padrão `lead`).
- Em cada organização, o `company_admin` abre **Integrações → WhatsApp → Gerenciar instâncias** para criar uma instância, gerar o QR Code e escaneá-lo no app WhatsApp do celular. O status é atualizado a cada 3 segundos e expira em 2 minutos se ninguém parear.
- O modo de uso (compartilhado pela organização ou por usuário) é definido em **Configurações → WhatsApp**. Em modo "por usuário", cada instância pertence a um membro específico.
- Tokens de instância são armazenados criptografados (pgp_sym_encrypt) e só são acessíveis via função SECURITY DEFINER para administradores da organização ou pelo service role.



## 6. Área Master

Para usuários `master_admin`, o painel Master já permite:

- acompanhar overview da plataforma
- listar e criar organizações
- alterar status de organizações
- visualizar memberships reais
- visualizar e criar planos

`Master · Logs` continua como área futura.

## 7. Módulos ainda estruturais

### Campaigns

Já é possível criar, editar, duplicar, iniciar, pausar e arquivar campanhas.
Disparo real multicanal entra em fase posterior.

### Inbox

Tela visual pronta, ainda sem envio e sincronização multicanal reais.

### Builder

Base visual pronta, sem drag-and-drop persistido nesta fase.

### Settings

Estrutura visual pronta, sem persistência completa.

## 8. Histórico recente

- 2026-05-22 — Leads ganharam **importação via CSV** com validação por linha.
- 2026-05-22 — Campaigns ganharam **CRUD real** (criar, editar, duplicar, iniciar/pausar, arquivar).
- 2026-05-22 — Tabela `builder_documents` renomeou `document` para `schema` e ganhou vínculo opcional a campanhas.
- 2026-05-22 — Dashboard passou a operar com KPIs reais por tenant.
- 2026-05-22 — Leads passaram a usar lista, filtros, detalhe e atividade reais.
- 2026-05-22 — Integrations passaram a exibir estados reais das conexões da organização.
- 2026-05-22 — Sidebar passou a mostrar organização ativa e papel do usuário.
- 2026-05-21 — Área Master foi conectada ao backend real.

## Email transacional (modelo híbrido)

O Leaderei envia emails em dois modos:

- **Chave global (Resend)** — gerenciada pelo administrador master em **Master → Plataforma**. É usada para `invitation`, `welcome`, `password_reset` e `system_alert`. Envios automáticos sob o domínio padrão `leaderei@s7cloud.com.br` (ou o que o master configurar).
- **Chave por organização** — cada org conecta seu próprio Resend em **Integrações** para enviar `campaign` e `inbox_reply` sob o domínio e reputação próprios. **Não há fallback** para a chave global nesses casos (protege reputação).

Todos os envios ficam registrados em `email_send_log`, auditáveis pelo master em **Master → Plataforma → Logs**.

### Histórico

- Adicionado: roteador central de email (`src/lib/email.functions.ts`), tabela `platform_settings` com Vault/pgcrypto, tabela `email_send_log`, página **Master → Plataforma** (chave Resend global, branding/logo, teste de envio, logs), banner explicativo em Integrações.

## Webhook Hook7 / Recebimento de mensagens

A infraestrutura WhatsApp (Hook7) entrega cada mensagem recebida no número conectado para uma Edge Function do Leaderei (`hook7-webhook`), que grava as mensagens na tabela `messages` e cria automaticamente um **lead órfão** (`needs_review = true`, motivo `inbound_from_unknown_whatsapp`) quando o número remetente ainda não existe na organização.

A URL do webhook tem o formato `https://<projeto>.supabase.co/functions/v1/hook7-webhook/{secret}/{org-slug}` e é registrada automaticamente no Hook7 toda vez que uma instância é conectada ou reconectada. Mensagens de grupo, eventos de presença e tipos desconhecidos são descartados (200 + nada). A idempotência usa `Info.ID` (campo `external_message_id`), então reentregas do mesmo evento nunca duplicam linhas.

**Configuração:** defina `HOOK7_WEBHOOK_SECRET` no painel de deploy (UUID v4 gerado uma única vez — **nunca rotacionar**, rotacionar invalida todos os webhooks já registrados nas instâncias existentes). Sem essa variável as instâncias ainda conectam, mas o Leaderei não recebe mensagens — o status aparece em **Master → Plataforma → WhatsApp · Hook7 → Webhook URL**.
