# Atualização — layout, acessos e popularização de produtos

## Ajustes aplicados

### 1) Vitrine pública (`client/src/pages/Marketplace.tsx`)
- reorganização do cabeçalho com navegação mais limpa;
- inclusão de dois acessos claros no topo:
  - **Portal da empresa**;
  - **Acesso da equipe**;
- criação de menu mobile organizado;
- refinamento do hero principal e do card lateral;
- inclusão de seção de acessos separados para empresa e equipe interna;
- melhora do enquadramento visual dos cards de produto;
- vitrine passa a exibir produtos publicados mesmo quando o estoque imediato é zero, mostrando status **sob consulta**;
- estados vazios mais claros para catálogo vazio e busca sem resultado.

### 2) Login (`client/src/pages/Login.tsx`)
- tela de login reorganizada;
- comunicação clara entre:
  - portal empresarial;
  - acesso da equipe interna;
- atalhos rápidos para vitrine, portal e simulador.

### 3) Portal empresarial (`client/src/pages/BusinessPortal.tsx`)
- melhora na apresentação visual dos produtos;
- uso de fallback visual consistente para produtos sem imagem;
- tratamento de itens sem preço comercial:
  - exibe **Preço sob consulta**;
  - mantém o item no catálogo B2B;
  - bloqueia pedido direto quando houver item sem preço;
  - orienta o uso de cotação comercial.

### 4) Seed do catálogo (`scripts/seed-catalog-master.mjs`)
- o seed agora gera versão de tabela B2B mesmo quando houver itens com preço zero;
- itens passam a entrar também na tabela empresarial, evitando catálogo B2B vazio;
- novas variáveis:
  - `CATALOG_SEED_FORCE_ACTIVE=false`
  - `CATALOG_SEED_FORCE_PUBLISH=false`
- documentação e arquivos de exemplo atualizados.

## Variáveis recomendadas para popularização controlada

```env
SEED_CATALOG_MASTER_ON_STARTUP=true
CATALOG_SEED_FILE=/app/data/seed/IDEAL_PRIME_CATALOGO_MASTER_SEED.xlsx
CATALOG_SEED_STOCK_MODE=SKIP
CATALOG_SEED_FORCE_ACTIVE=true
CATALOG_SEED_FORCE_PUBLISH=true
```

## Observação operacional
- `CATALOG_SEED_FORCE_PUBLISH=true` é útil quando a intenção é já exibir o catálogo na vitrine pública.
- `CATALOG_SEED_STOCK_MODE=SKIP` mantém a segurança para não sobrescrever estoque real.
- Após a primeira carga controlada, voltar `SEED_CATALOG_MASTER_ON_STARTUP=false`.
