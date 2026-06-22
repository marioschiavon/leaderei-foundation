Vou corrigir o fluxo de gerenciamento das instâncias do WhatsApp para que as ações realmente reflitam na lista.

Plano:
1. Ajustar as funções de backend de WhatsApp para usar a verificação/carregamento de instância já existente também em `renomear` e `apagar`, evitando falhas silenciosas por permissão/RLS.
2. Fazer `renomear` atualizar o nome e retornar a instância atualizada, para a tela poder confirmar que a alteração aconteceu.
3. Fazer `apagar` arquivar a instância e checar erro da atualização no banco, em vez de apenas retornar sucesso.
4. Ajustar a interface para atualizar a lista imediatamente após salvar/apagar, fechar o modal só depois do sucesso e mostrar erro claro se algo falhar.
5. Validar no fluxo da tela de Integrações > WhatsApp > Gerenciar instâncias que salvar nome e apagar disparam a ação correta e recarregam a lista.