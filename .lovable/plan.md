## Contexto
As mudanças mais recentes ainda **não constam** nos documentos do projeto. É necessário atualizar:

1. **Doc técnico** (`docs/technical/README.md`) — adicionar seção sobre as políticas RLS unificadas para `integration_credentials` e `pipedrive_sync_runs` (permissão `master_admin` + `company_admin` membro da org).
2. **Manual do usuário** (`docs/user/README.md`) — atualizar a seção WhatsApp/Hook7 para refletir que o status agora sincroniza corretamente após leitura do QR Code e que o nome do dispositivo (Google Chrome / Evolution Go) já aparece automaticamente.
3. **Changelog** (`docs/user/UPDATES.md`) — registrar a correção de RLS para Apollo e Pipedrive, e a correção de sincronização de status do WhatsApp/Hook7, possivelmente como patch da v0.4 ou abertura da v0.5.

## Escopo do plano
- Revisar e atualizar os 3 arquivos de documentação mencionados.
- Não alterar código da aplicação.
- Manter linguagem e formato consistentes com os documentos existentes.

## Entregáveis
- `docs/technical/README.md` atualizado.
- `docs/user/README.md` atualizado.
- `docs/user/UPDATES.md` atualizado.