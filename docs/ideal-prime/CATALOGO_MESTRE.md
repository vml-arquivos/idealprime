# Catálogo Mestre Ideal Prime

O arquivo oficial é `data/seed/IDEAL_PRIME_CATALOGO_MASTER_SEED.xlsx` e a cópia disponível para a equipe é `client/public/templates/ideal-prime-catalogo-master.xlsx`. A aba `PRODUTOS` contém os 277 SKUs reais, descrições curtas e completas, categorias, marcas, unidade de venda, fonte, publicação B2B, preço e estoque.

## Regras de publicação

Todos os 277 produtos ficam ativos, publicados e habilitados para B2B no catálogo inicial. O seed não introduz preço ou estoque: `preco_venda=0` e `estoque_fisico=0` significam **preço sob consulta** e não sobrescrevem estoque operacional quando `CATALOG_SEED_STOCK_MODE=SKIP`.

Os produtos podem ser consultados, incluídos em cotações e usados na lista completa em `/vitrine`. Um pedido direto somente deve ser liberado quando existir preço comercial válido; itens sem preço permanecem no fluxo de cotação.

## Seleção da página principal

As colunas `destaque` e `ordem_destaque` controlam a seleção editorial. O painel **Produtos** permite marcar ou remover cada produto da página principal. A rota `/` mostra os produtos marcados; enquanto nenhum destaque estiver marcado, mostra uma seleção inicial limitada às primeiras oito opções publicadas. A rota `/vitrine` sempre preserva o catálogo integral.

## Imagens e fontes

A aba `FONTES_WEB` registra a URL da fonte do produto, a URL de referência visual, o status de verificação e se a imagem foi promovida. Apenas cinco imagens com correspondência exata foram promovidas para `/catalog/` e entram na biblioteca versionada do aplicativo. As sete referências parciais permanecem documentadas, mas não são apresentadas como se fossem a variante exata.

Uploads futuros no formato oficial preservam imagens, fontes, descrições e destaque. Uma imagem enviada passa a integrar a galeria do produto de forma idempotente. O mesmo arquivo não é processado duas vezes para a mesma tabela e modo.
