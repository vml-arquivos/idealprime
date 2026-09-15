# Home Ideal Prime — modelo aprovado aplicado ao código

Atualização aplicada diretamente ao repositório completo com foco em reproduzir o modelo visual aprovado.

## Alterações

- Hero principal reorganizado para manter o título em três linhas: “Produtos que / movimentam o / seu negócio.”
- Tipografia e proporções do hero reduzidas para evitar a quebra excessiva vista no deploy anterior.
- Card lateral dinâmico/padronizado removido do hero.
- Nova composição visual premium da lateral adicionada em `client/src/assets/brand/ideal-prime-hero-products.webp`, baseada no modelo aprovado, com produtos sobre pedestais, folhagem, painel suave e blocos de benefícios.
- Cabeçalho, catálogo, cards de produtos, fluxo empresarial, CTA final, SEO e rodapé da refatoração anterior foram preservados.
- Nenhuma regra de backend, banco, estoque, FIFO, seed, autenticação, B2B, clientes, pedidos ou migrations foi alterada.

## Arquivos desta rodada

- `client/src/pages/Marketplace.tsx`
- `client/src/assets/brand/ideal-prime-hero-products.webp`
- `REFERENCIA_HOME_PREMIUM_APROVADA.png`

## Verificação local

Foi executada verificação de parsing TypeScript/TSX. Não houve erro sintático no arquivo alterado. O ambiente local não conseguiu acessar o registry npm dentro do tempo disponível, portanto o `pnpm release:verify` completo deve ser executado no CI/deploy antes da publicação.

## Deploy

Após substituir o repositório, execute o pipeline normal. O servidor do Coolify deve possuir espaço livre suficiente, pois o erro de deploy anterior foi `no space left on device` durante o unpack da imagem Docker.
