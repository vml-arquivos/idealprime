# Catálogo Mestre Ideal Prime

Arquivo oficial: `IDEAL_PRIME_CATALOGO_MASTER_SEED.xlsx`.

- 277 SKUs únicos, derivados dos 278 registros da planilha de origem;
- categorias dinâmicas e expansíveis;
- descrições iniciais e referências de pesquisa para catálogo;
- imagens somente quando houve correspondência suficientemente específica;
- preço e estoque ficam em zero quando não existem dados reais na origem;
- `publicado=NAO` até existir preço comercial válido;
- o seed faz upsert por SKU;
- `CATALOG_SEED_STOCK_MODE=SKIP` não altera saldo de SKU existente e cria SKU novo com saldo zero;
- `SET_IF_EMPTY` só preenche saldo de produto zerado;
- `FORCE` é bloqueado quando houver lote FIFO `ATIVO` ou `EM_ESPERA`.
