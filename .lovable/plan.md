## Objetivo
Trocar o componente `Logo` (que hoje renderiza "leaderei" em texto via fonte Ibrand) pelas imagens oficiais enviadas, em todas as telas.

## Assets a importar
Copiar os 4 PNGs enviados para `src/assets/brand/`:
- `LARANJA.png` → versão laranja (padrão sobre fundos claros)
- `PRETO.png` → versão preta (fundos claros alternativa)
- `BRANCO.png` → versão branca (fundos escuros)
- `CINZA.png` → versão cinza (uso secundário)

## Mudanças em `src/components/brand/Logo.tsx`
Reescrever o componente para renderizar `<img>` ao invés de texto:
- Props mantidas: `className`, `tone` ("light" | "dark"), `size`.
- `tone="dark"` (sobre fundo claro) → usa `LARANJA.png` por padrão.
- `tone="light"` (sobre fundo escuro, ex.: painel lateral do login) → usa `BRANCO.png`.
- Nova prop opcional `variant?: "color" | "black" | "white" | "gray"` para forçar uma versão específica quando necessário.
- `size` passa a controlar `height` (ex.: `h-7`, `h-8`, `h-10`) mantendo proporção via `w-auto`.
- `alt="Leaderei"` para acessibilidade.

`LogoMark` (usado em espaços compactos como o card mock do login):
- Também passa a usar a imagem (laranja sobre claro, branca sobre escuro), recortada/quadrada via container — ou, se ficar ruim, substituído por uma versão reduzida da mesma imagem completa.

## Telas impactadas (sem mudança de uso)
Todas já consomem `<Logo />` / `<Logo tone="light" />` e continuam funcionando:
- `src/routes/login.tsx` (topo do form + painel direito)
- `src/routes/signup.tsx`
- `src/routes/forgot-password.tsx`
- `src/components/app/AppSidebar.tsx` (verificar uso)
- Telas master

## Limpeza
- Remover `@font-face` da fonte Ibrand em `src/styles.css` e a referência `--font-brand` (não será mais usada para o logo). Manter `public/fonts/ibrand.otf` no repo por enquanto (pode ser removido depois) — ou remover também se preferir.
- Total de fontes do projeto cai de 3 para 2 (Inter + Plus Jakarta Sans).

## Não muda
- Paleta, tokens de cor, layout das telas, autenticação, rotas.
