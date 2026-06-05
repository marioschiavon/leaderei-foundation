# Remover integração Google Calendar

Cal.com já encapsula Google Calendar, então o card separado é redundante. Hoje o provider existe no banco mas **não tem nenhuma conexão ativa** e **nenhum código de backend** o referencia — só aparece como ícone na grade de integrações.

## Mudanças

### 1. Banco (migration)
Remover o provider `google-calendar` de `integration_providers`.

```sql
DELETE FROM public.integration_providers WHERE slug = 'google-calendar';
```

Não precisa limpar `organization_integrations`/`integration_credentials` — consulta confirmou 0 linhas. (FK com `ON DELETE CASCADE` cobre o caso de qualquer relacionamento residual.)

### 2. Código
- `src/routes/_app.dashboard.integrations.tsx` — remover a entrada `"google-calendar"` do mapa de ícones (linha 61) e o import de `SiGooglecalendar` se ficar órfão.

### 3. Documentação
Nenhum arquivo em `docs/` menciona Google Calendar — busca não encontrou referências em `.md`/`.ts`/`.tsx`/`.sql`. Sem ajustes.

## Fora de escopo
- Conector Google Calendar do workspace Lovable (não está em uso pelo app, fica como está).
- Qualquer mexida no Cal.com — segue intacto.

## Resultado
Card "Google Calendar" some da página `/dashboard/integrations`. Cal.com continua sendo o único caminho para agenda.
