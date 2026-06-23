## Trocar o favicon da S7 pelo da Leaderei

### Situação atual
- O projeto possui um `public/favicon.ico` herdado da S7.
- As logos da Leaderei já existem em `src/assets/brand/` (color, black, white, gray).
- O `<head>` em `src/routes/__root.tsx` não contém link explícito para favicon.\n
### O que será feito
1. **Gerar favicon.ico** a partir da logo `leaderei-color.png` (ou outra versão escolhida), criando um arquivo `.ico` multi-resolução (16x16, 32x32) para compatibilidade com abas e atalhos.
2. **Substituir** `public/favicon.ico` pelo novo arquivo da Leaderei.
3. **Adicionar link no `<head>`** em `src/routes/__root.tsx` para garantir que todos os navegadores utilizem o favicon correto (`<link rel="icon" href="/favicon.ico" />`).

### Decisão pendente
Qual versão da logo prefere como base do favicon?
- **Colorida** (laranja Leaderei) — recomendada, a cor chama atenção na aba.
- **Preta** — mais sóbria, funciona bem em temas claros e escuros.
- **Branca** — para fundos escuros do navegador (menos comum como padrão).

Se não houver preferência, usarei a **colorida**.