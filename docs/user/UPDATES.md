# Atualizações da Plataforma — Leaderei

> Histórico de evolução do Leaderei em linguagem simples, organizado por versão.
> Cada versão lista os módulos entregues e o status das integrações conectadas.

## Como ler este arquivo

- As versões mais recentes ficam **no topo**.
- Cada entrega importante entra em uma nova versão (0.1, 0.2, 0.3…).
- Correções pequenas e ajustes de detalhe não aparecem aqui — o foco é a evolução do produto.

### Legenda de status das integrações

| Ícone | Significado |
| --- | --- |
| ✅ | Testada e funcionando em produção |
| 🧪 | Implementada, em fase de testes |
| ⏳ | Estrutura pronta, aguardando ativação |

---

## v0.5 — IA e Builder maduro

- **Módulo de IA no painel Master**: o administrador cria o *prompt mestre* (as regras-base que a IA segue em todas as mensagens) e monta um catálogo de opções de estilo (humor, abordagem, tamanho, idioma) que ficam disponíveis para as organizações. Na organização, o usuário preenche os dados da marca (nome, voz, produto, ICP, proposta de valor, CTA, palavras proibidas) e escolhe nas listas as opções liberadas pelo Master. A IA então gera cada mensagem combinando: prompt mestre + dados da marca + escolhas do usuário — ou seja, o Master define como a IA deve se comportar, e a mensagem final é montada a partir do que cada usuário decidir.
- **Builder mais flexível**: agora é possível **excluir uma conexão** entre nós e **religar** arrastando a ponta da seta para outro nó.
- **Novo nó inicial padrão**: novos fluxos já abrem com o nó "Mensagem com IA" no lugar do antigo nó de email.
- **Reforço de segurança** no acesso aos dados entre organizações.

---

## v0.4 — Comunicação e integrações externas

Primeira leva de integrações com serviços externos para envio de mensagens, enriquecimento de leads e agendamentos.

- **WhatsApp via Hook7** — 🧪
  Conexão de números reais por QR Code. Cada organização pode usar uma instância compartilhada ou uma instância por usuário. Mensagens recebidas já caem na Inbox automaticamente.
- **Email transacional (Resend)** — ✅
  Dois modos: chave global da plataforma (para convites, boas-vindas, recuperação de senha) e chave da própria organização (para campanhas e respostas da Inbox, preservando o domínio do cliente).
- **Apollo** — 🧪
  Busca e enriquecimento de leads (dados de empresa, cargo, contato).
- **Pipedrive** — ⏳
  Sincronização com o CRM Pipedrive. Estrutura pronta, ativação por organização sob demanda.
- **Cal.com** — ⏳
  Agendamento automático de reuniões a partir das conversas. Estrutura pronta.

---

## v0.3 — Campanhas, Builder e Inbox

Entrega dos três módulos operacionais do dia a dia.

- **Campanhas**: criar, editar, duplicar, iniciar, pausar e arquivar.
- **Builder visual de fluxos**: criar fluxo, editar cada bloco, salvar com controle de versão, publicar e despublicar.
- **Auto-link** entre nós: ao arrastar um novo bloco para o canvas, ele já se conecta automaticamente ao último bloco adicionado.
- **Inbox em 3 colunas**: lista de conversas, conversa atual e painel do lead com histórico e dados de enriquecimento.

---

## v0.2 — Leads e Dashboard

- **Lista de leads** com busca por nome, email, empresa, cargo e origem.
- **Filtros** por status e por origem.
- **Criação, edição inline e arquivamento** de leads.
- **Importação via CSV** com validação linha a linha e relatório do que foi aceito/ignorado.
- **Painel lateral do lead** com score, temperatura, origem, próximo follow-up, potencial comercial e atividade recente.
- **Dashboard** com KPIs reais por organização: total de leads, leads novos, conversas abertas, mensagens enviadas nos últimos 7 dias e campanhas ativas.

---

## v0.1 — Fundação

Estrutura base da plataforma.

- **Login e cadastro** de usuários.
- **Onboarding inicial** com tela de boas-vindas e próximos passos sugeridos.
- **Estrutura multi-organização** (workspaces): cada cliente tem seu próprio ambiente isolado.
- **Configurações da organização**: dados da empresa, papéis e permissões.
- **Convite de membros por email** com expiração e aceite.
- **Área Master** (administrador da plataforma): visão geral, organizações, usuários, planos e logs.

---

## Próximas entregas

Em desenvolvimento, ainda sem versão fechada:

- **Disparo real de campanhas em loop**, com métricas de envio e resposta.
- **Webhooks de bounce e delivered** do Resend (saber quando um email foi entregue, aberto ou rejeitado).
- **Editor avançado de blocos** no Builder: templates reutilizáveis, condições compostas e ramificações múltiplas.
- **Ativação completa** das integrações Pipedrive e Cal.com (passar de ⏳ para ✅).
