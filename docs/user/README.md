# Manual do Usuário — Leaderei

> Guia de uso da plataforma. Atualizado conforme novos módulos entram em produção.

## 1. Primeiros passos

1. Acesse a tela de login e entre com seu email e senha.
2. Após login você cai em **Dashboard** (`/dashboard`), a home operacional.
3. No rodapé da barra lateral você pode trocar entre organizações (workspaces).

## 2. Navegação

A barra lateral organiza o produto em três grupos:

**Workspace**
- **Dashboard** — visão geral da operação dos últimos 7 dias.
- **Campaigns** — sequências de outbound multicanal.
- **Leads** — base comercial com filtros, estágios e detalhe.
- **Inbox** — conversas ativas vindas das campanhas.

**Tools**
- **Integrations** — conectar canais, CRMs e ferramentas externas.
- **Builder** — construtor de cadências (Beta).

**Admin**
- **Master** — painel administrativo (acesso restrito).
- **Settings** — configurações da organização e do usuário.

## 3. Dashboard

A home reúne em uma só tela:

- **Visão geral** — KPIs de leads, conversas, mensagens enviadas e taxa de resposta, com variação vs. semana anterior.
- **Atividade da semana** — gráfico de mensagens por dia.
- **Próximos passos** — checklist de onboarding (% concluído).
- **Campanhas em destaque** — ativas e pausadas, com progresso e ações de play/pause.
- **Alertas** — pendências acionáveis (LinkedIn não conectado, SPF/DKIM, limites).
- **Leads recentes** — últimas entradas no funil.
- **Integrações** — status compacto dos canais principais.
- **Atividade recente** — feed de eventos do workspace.

## 4. Leads

Workspace comercial com dois painéis:

- **Lista (esquerda)** — busca, filtros por estágio e origem, KPIs, seleção múltipla para ações em lote (mover de estágio, adicionar a campanha).
- **Detalhe (direita)** — informações do lead selecionado, score, histórico e atalhos rápidos. Pode ser fechado.

Cada lead tem **estágio** (Novo, Qualificado, Em conversa, Proposta, Ganho, Perdido) e **origem** (LinkedIn, Email, Inbound, Importado, Apollo).

## 5. Integrações

Sete integrações na Fase 1, cada uma com um destes estados:

| Estado                  | O que significa                                            |
| ----------------------- | ---------------------------------------------------------- |
| **Connected**           | Pronto para uso.                                           |
| **Not connected**       | Disponível, basta clicar em **Conectar**.                  |
| **Setup required**      | Falta uma configuração (ex.: SPF/DKIM, validação de conta).|
| **Internal setup needed** | Provisionamento feito pelo time Leaderei.                |
| **Coming soon**         | Em desenvolvimento, ainda não disponível.                  |

Integrações da Fase 1: Apollo, LinkedIn, HubSpot, **Pipedrive (ativo)**, WhatsApp API, Resend, ElevenLabs (em breve).

## 6. Campanhas

(Em desenvolvimento — esta seção será expandida quando o módulo entrar em produção.)

## 7. Inbox

(Em desenvolvimento.)

## 8. Builder

(Beta — construtor visual de cadências.)

## 9. Configurações

Em **Settings** você gerencia organização, membros, pipeline padrão, domínios de envio e preferências.

## 10. Suporte

Em caso de dúvida ou problema, contate o time Leaderei pelos canais internos da sua organização.

---

## Histórico de versões deste manual

> Atualizado a cada mudança visível ao usuário no produto.

- **2026-05-21** — Correção: navegação entre páginas filhas de `/dashboard` (Leads, Inbox, Integrations, etc.) agora funciona corretamente. Antes a URL mudava mas a tela continuava na home.
- **2026-05-21** — Rota base passa a ser `/dashboard` (era `/app`). Módulos de Leads e Integrações documentados.
- **2026-05-20** — Primeira versão.

