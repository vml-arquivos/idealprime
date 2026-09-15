# Ideal Prime — Otimização do Catálogo Empresarial

Data: 15/09/2026

## Objetivo

Reduzir drasticamente a rolagem da área de seleção de produtos para cotações e pedidos, preservando o fluxo B2B já existente e tornando a experiência mais rápida, legível e responsiva em desktop e mobile.

## Alterações implementadas

- Substituição dos cards grandes de produtos por lista compacta em linhas.
- Organização dos produtos por categoria em seções recolhíveis/expansíveis.
- Categorias fechadas por padrão para manter a página curta.
- Busca por SKU, nome ou categoria; ao pesquisar, apenas grupos com resultados são apresentados abertos.
- Cada linha exibe somente as informações necessárias para compra/cotação:
  - thumbnail pequena;
  - nome do produto;
  - SKU, unidade e múltiplo;
  - preço ou “Sob consulta”;
  - disponibilidade;
  - controle de quantidade.
- Novo seletor de quantidade com botões `−` e `+`, além de campo para digitação direta.
- Incremento/decremento respeita o múltiplo comercial do produto.
- Ao sair do campo digitado, uma quantidade fora do múltiplo é ajustada para o próximo múltiplo válido.
- Produtos selecionados recebem realce visual discreto e indicador de seleção.
- Cada categoria mostra quantidade de produtos e quantidade de itens selecionados.
- Limite inicial de 24 linhas por categoria, com carregamento incremental de mais 24 para impedir listas excessivamente longas.
- Controles “Expandir categorias” e “Recolher”.
- Barra fixa de ação no mobile quando houver itens selecionados, mostrando quantidade, estimativa e acesso direto à cotação.
- A “Planilha da compra” lateral e todos os fluxos existentes de cotação, pedido direto, cotação → pedido, exportação e histórico foram preservados.

## Responsividade

### Desktop

A lista usa quatro colunas compactas: foto, produto, preço/estoque e quantidade. Não existe rolagem horizontal.

### Mobile

Cada produto é renderizado em formato compacto de duas colunas, com thumbnail e identificação na primeira linha, preço/estoque e controle de quantidade reorganizados logo abaixo. Os botões de quantidade possuem áreas de toque amplas.

## Escopo técnico

Arquivo funcional alterado:

- `client/src/pages/BusinessPortal.tsx`

Nenhuma migration foi criada ou modificada. Backend, regras B2B, FIFO, estoque, preços, cotações e pedidos não tiveram sua lógica de persistência alterada.

## Validações realizadas neste ambiente

- `node scripts/verify-migrations.mjs`: OK — 37 migrations conferidas 1:1 com o journal.
- Parsing/transpilação sintática de `BusinessPortal.tsx` com TypeScript: OK.
- Verificação de whitespace/conflitos: OK.
- ZIP final: testar integridade antes da entrega.

## Homologação recomendada após CI/redeploy

1. Abrir Portal da Empresa > Produtos e seleção.
2. Confirmar categorias recolhidas e página curta.
3. Abrir uma categoria e validar as linhas compactas.
4. Testar busca por nome e SKU.
5. Testar `+`, `−` e digitação manual de quantidade.
6. Validar item com múltiplo maior que 1.
7. Adicionar itens de categorias diferentes e confirmar a seleção lateral.
8. No mobile, validar barra fixa “Cotação”.
9. Gerar uma cotação e confirmar que todos os produtos/quantidades selecionados permanecem corretos.
10. Validar pedido direto somente para itens com preço comercial válido.
