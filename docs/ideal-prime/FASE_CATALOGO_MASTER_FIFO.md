# Ideal Prime — Catálogo Mestre, Categorias Dinâmicas e FIFO

## Escopo desta evolução

Esta fase transforma a lista comercial original em um modelo de catálogo importável e amplia o Ideal Prime de forma aditiva, sem trocar a stack, sem renomear tabelas legadas e sem remover fluxos existentes.

### Catálogo Mestre

O template oficial fica em:

`client/public/templates/ideal-prime-catalogo-master.xlsx`

A aba obrigatória para importação é `PRODUTOS`. O importador continua aceitando o modelo legado e passa a reconhecer também os campos adicionais do Catálogo Mestre:

- subcategoria
- marca
- estoque_minimo
- ncm
- descricao_curta
- descricao
- imagem_url
- fonte_url
- termo_busca
- publicado
- b2b_habilitado
- observacoes

Os campos `brand`, `subcategory`, `source_url` e `search_term` foram adicionados à tabela de produtos pela migration aditiva `0035_ideal_prime_catalog_master.sql`.

### Categorias

A tabela dinâmica `permupay_categories` continua sendo a fonte de categorias cadastráveis. O cadastro/edição de produto agora usa essas categorias em vez de limitar a interface ao enum histórico. Categorias que chegam pela importação são criadas/reativadas automaticamente por slug normalizado.

O enum histórico da coluna `permupay_products.category` foi preservado para compatibilidade; categorias novas usam `OUTRO` internamente e o nome comercial em `category_label`.

### Estoque e Fila FIFO

O modo `INVENTORY` da importação é uma **conciliação de saldo**, não uma entrada de compra. Regras:

1. Nunca permite estoque importado menor que reservas B2B ativas.
2. Se o produto possui lote `EM_ESPERA`, bloqueia a alteração de estoque da planilha e exige Entrada/FIFO.
3. Se existe lote `ATIVO` e não há lote em espera, sincroniza `quantity_remaining` com a contagem física.
4. O fluxo B2B de expedição passa a consumir estoque respeitando FIFO e promove o próximo lote quando o ativo zera.
5. Cancelamento de item em espera atualiza tanto `permupay_stock_queue` quanto o `queue_status` do item de entrada.
6. O fluxo genérico de venda FIFO também mantém `quantity_remaining` sincronizado enquanto ainda há saldo.

A tela `/fila-estoque` expõe a fila completa para a equipe, com filtro por situação.

### Identidade

Foram alterados identificadores de navegador/cache novos para `Ideal Prime`, com migração compatível de carrinho e indicação armazenados no navegador. Nomes de tabelas `permupay_*` permanecem deliberadamente inalterados, pois são identificadores internos de banco e renomeá-los nesta fase aumentaria o risco de regressão sem benefício funcional.

## Publicação segura do seed

A lista original não contém preço, estoque, NCM ou EAN completos. Por isso o seed oficial usa preço/estoque zero onde não há informação e `publicado=NAO`. Esses campos devem ser conferidos antes da publicação do catálogo.

URLs de imagens e fontes incluídas no seed são dados auxiliares para curadoria. Para produção, a equipe pode substituir URLs externas por imagens enviadas ao armazenamento próprio do Ideal Prime.
