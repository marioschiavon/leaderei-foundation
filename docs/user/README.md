# Manual do Usuário — Leaderei

> Guia de uso da plataforma. Atualizado conforme os módulos entram em operação real.

## Estado atual da Fase 1

Hoje a Fase 1 já entrega estes módulos com dados reais:

- Login / Signup
- Dashboard
- Leads (lista, filtros, criação, edição, arquivamento, **import CSV**)
- Campaigns (criar, editar, duplicar, iniciar, pausar, arquivar)
- Integrations
- Master · Overview
- Master · Organizations
- Master · Users
- Master · Plans

Os módulos abaixo continuam estruturais nesta etapa:

- Inbox
- Builder
- Settings
- Master · Logs

## 1. Primeiros passos

1. Crie sua conta em `/signup` ou entre em `/login`.
2. Depois do login, você cai em `/dashboard`.
3. Se não houver sessão, o sistema redireciona automaticamente para `/login`.
4. A área `/master` aparece apenas para usuários com papel `master_admin`.

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

Tela visual pronta, ainda sem execução operacional real.

### Inbox

Tela visual pronta, ainda sem envio e sincronização multicanal reais.

### Builder

Base visual pronta, sem drag-and-drop persistido nesta fase.

### Settings

Estrutura visual pronta, sem persistência completa.

## 8. Histórico recente

- 2026-05-22 — Dashboard passou a operar com KPIs reais por tenant.
- 2026-05-22 — Leads passaram a usar lista, filtros, detalhe e atividade reais.
- 2026-05-22 — Integrations passaram a exibir estados reais das conexões da organização.
- 2026-05-22 — Sidebar passou a mostrar organização ativa e papel do usuário.
- 2026-05-21 — Área Master foi conectada ao backend real.
