## Problema
Favicon atual é um "l" genérico branco em quadrado laranja, com bordas brancas aparecendo na aba do navegador (o fundo é branco, não transparente).

## Solução
1. **Gerar novo ícone** em PNG com:
   - Círculo laranja Leaderei (preenchido, cor da marca)
   - **O "l" da logo Leaderei** (mesmo desenho/tipografia da wordmark em `src/assets/brand/leaderei-color.png`, porém em branco) centralizado dentro do círculo
   - **Fundo totalmente transparente** ao redor do círculo
2. **Converter para `.ico`** multi-resolução (16×16, 32×32, 48×48) preservando transparência.
3. **Substituir** em `public/`:
   - `favicon.ico`
   - `favicon-512.png`
   - `apple-touch-icon.png`
4. **Manter** os `<link>` em `src/routes/__root.tsx` — sem alterações.

## Resultado
Círculo laranja com o "l" característico da Leaderei em branco, sem fundo branco/quadrado ao redor — flutua limpo na aba do navegador.