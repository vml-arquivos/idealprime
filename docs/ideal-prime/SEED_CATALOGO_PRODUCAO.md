# Catálogo Mestre Ideal Prime — Operação de Seed

## Arquivo oficial

`data/seed/IDEAL_PRIME_CATALOGO_MASTER_SEED.xlsx`

A aba importável é obrigatoriamente `PRODUTOS`. O SKU é a chave de atualização. Nunca reutilize o mesmo SKU para produtos diferentes.

## Formas de carga

### Backoffice
Acesse **Comercial B2B > Relacionamento Comercial** e envie XLSX/CSV. O importador registra job e resultado por linha.

### CLI controlada

```bash
DATABASE_URL=... CATALOG_SEED_STOCK_MODE=SKIP CATALOG_SEED_FORCE_ACTIVE=false CATALOG_SEED_FORCE_PUBLISH=false pnpm seed:catalog
```

### Startup do container
Use somente para uma carga planejada:

```env
SEED_CATALOG_MASTER_ON_STARTUP=true
CATALOG_SEED_FILE=/app/data/seed/IDEAL_PRIME_CATALOGO_MASTER_SEED.xlsx
CATALOG_SEED_STOCK_MODE=SKIP
CATALOG_SEED_FORCE_ACTIVE=false
CATALOG_SEED_FORCE_PUBLISH=false
```

Depois da primeira carga bem-sucedida, volte `SEED_CATALOG_MASTER_ON_STARTUP=false`.

## Modos de estoque

- `SKIP`: recomendado em produção; nunca altera saldo de SKU já existente.
- `SET_IF_EMPTY`: preenche apenas se o estoque atual for zero ou negativo.
- `FORCE`: destinado a reconciliação controlada; bloqueia quando existe fila FIFO ativa/aguardando.

Entradas reais de mercadoria com custo/data/lote devem sempre usar o módulo **Entrada/FIFO**.

## Imagens

`imagem_url` aceita URL de referência. O frontend usa `ProductVisual`: se a URL falhar ou estiver ausente, renderiza uma representação de categoria em vez de imagem quebrada.

Antes de uma publicação definitiva em escala, recomenda-se copiar imagens validadas para armazenamento próprio da Ideal Prime e atualizar `imagem_url` para a URL interna/CDN da empresa.

## Publicação

`publicado=SIM` só deve ser usado depois de confirmar preço e disponibilidade. O seed também impede publicação nova quando `preco_venda <= 0`.
