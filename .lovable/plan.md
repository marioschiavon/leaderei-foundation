Criar `docs/user/UPDATES.md` — um histórico de evolução da plataforma Leaderei em linguagem simples, organizado por **versão** (não por data), focado no que o cliente percebe: módulos entregues e integrações conectadas (com status de teste).

## Estrutura do arquivo

1. **Cabeçalho curto** — explica que é o histórico de evolução da plataforma, organizado por versão. Cada versão lista o que foi entregue e o status das integrações.

2. **Legenda de status de integrações**:
   - ✅ Testada e funcionando em produção
   - 🧪 Implementada, em fase de testes
   - ⏳ Estrutura pronta, aguardando ativação

3. **Versões** (da mais recente para a mais antiga):

   - **v0.5 — IA e Builder maduro**
     - Módulo de IA da marca (painel Master)
     - Builder: exclusão e religação de conexões entre nós
     - Novo nó inicial padrão "Mensagem com IA"
     - Reforço de segurança em acesso a dados

   - **v0.4 — Comunicação e integrações externas**
     - WhatsApp via Hook7 (conexão por QR Code, instâncias por organização ou por usuário) — 🧪
     - Resend para email transacional (chave global + chave por organização) — ✅
     - Apollo (busca e enriquecimento de leads) — 🧪
     - Pipedrive (sincronização) — ⏳
     - Cal.com (agendamentos) — ⏳

   - **v0.3 — Campanhas, Builder e Inbox**
     - CRUD completo de campanhas (criar, editar, duplicar, iniciar, pausar, arquivar)
     - Builder visual de fluxos (criar, editar blocos, salvar com versão, publicar)
     - Inbox em 3 colunas (lista, conversa, painel do lead)
     - Auto-link entre nós ao arrastar do painel

   - **v0.2 — Leads e Dashboard**
     - Lista de leads com busca e filtros
     - Criação, edição e arquivamento de leads
     - Importação de leads via CSV
     - Dashboard com KPIs reais por organização

   - **v0.1 — Fundação**
     - Login e cadastro
     - Onboarding inicial
     - Estrutura multi-organização (workspaces)
     - Configurações da organização e convite de membros por email
     - Área Master (administrador da plataforma): organizações, usuários, planos, logs

4. **Próximas entregas** (seção curta no fim, sem versão ainda):
   - Disparo real de campanhas em loop
   - Webhooks de bounce/delivered do Resend
   - Editor avançado de blocos no Builder (templates, condições compostas, ramificações múltiplas)
   - Ativação completa de Pipedrive e Cal.com

## Manutenção contínua

Sempre que uma nova entrega for feita, o arquivo será atualizado:
- Funcionalidade nova relevante → entra em uma versão futura (ex: v0.6)
- Integração que avança de status → atualizar o ícone (⏳ → 🧪 → ✅)
- Correções menores não entram (mantém a leitura limpa para o cliente)

## Detalhes técnicos

- Arquivo único: `docs/user/UPDATES.md`
- Markdown simples, sem jargão técnico (sem "RLS", "edge function", "migration", etc.)
- Versionamento semântico simplificado por marcos de produto (0.1, 0.2, …) — não atrelado ao versionamento de código