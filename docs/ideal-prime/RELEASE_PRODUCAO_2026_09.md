# Ideal Prime — Release de Produção / Catálogo e Painel Empresarial

## Objetivo

Esta release consolida a transformação visual e operacional do Ideal Prime em uma plataforma empresarial B2B-first, preservando os fluxos já existentes de catálogo, precificação, estoque, FIFO, clientes, vendedores, pedidos, crédito, fiscal, permissões e portal empresarial.

## Alterações principais

### Painel empresarial
- Dashboard remodelado com identidade Ideal Prime, contraste reforçado e indicadores reais de empresas, pedidos B2B, faturamento confirmado, estoque, FIFO, fiscal, clientes e vendedores.
- Gestão Comercial B2B ganhou cabeçalho executivo e visão rápida de empresas, cadastros, cotações e pedidos.
- Menu interno reorganizado por módulos: Catálogo & Estoque, Comercial B2B, Vendas & Clientes, Financeiro & Fiscal e Administração.

### Catálogo Mestre
- Seed oficial em `data/seed/IDEAL_PRIME_CATALOGO_MASTER_SEED.xlsx`.
- 277 SKUs únicos provenientes da lista original de 278 registros, com uma duplicidade registrada na planilha de auditoria.
- Categorias comerciais livres e expansíveis, incluindo limpeza, higiene, descartáveis, EPI, utilidades, papel/dispensers e categorias futuras como eletrônicos, brinquedos e papelaria.
- Campos adicionais de marca, subcategoria, NCM, descrições, imagem, fonte e termo de pesquisa.
- 12 produtos receberam imagem pesquisada com correspondência específica; 14 possuem fonte web registrada. Produtos sem imagem utilizam fallback visual por categoria.

### Seed idempotente
- `pnpm seed:catalog` lê o Catálogo Mestre e faz upsert por SKU.
- Cria/reativa categorias dinâmicas sem alterar o enum histórico do banco.
- Não publica itens sem preço válido.
- Não força estoque existente por padrão.
- `CATALOG_SEED_STOCK_MODE=SET_IF_EMPTY` preenche apenas produto zerado.
- `CATALOG_SEED_STOCK_MODE=FORCE` recusa alteração se houver lote FIFO `ATIVO` ou `EM_ESPERA`.
- O seed automático no container fica **desligado por padrão** (`SEED_CATALOG_MASTER_ON_STARTUP=false`).

### Estoque e FIFO
- Fluxo B2B de expedição permanece integrado ao consumo/promoção FIFO implementado na fase anterior.
- O Catálogo Mestre não cria lote de custo fictício. Compra real deve continuar entrando pelo módulo de Entrada/FIFO.

### Identidade
- Vitrine e dashboard usam a marca Ideal Prime e linguagem empresarial.
- Runtime específico do antigo ambiente de desenvolvimento foi retirado do Vite; coletor local foi neutralizado para namespace de debug genérico.
- Chaves legadas de carrinho/referral são mantidas apenas como migração compatível, sem identidade visual.
- Nomes de tabelas `permupay_*` permanecem deliberadamente inalterados por compatibilidade de migrations e segurança de dados.

## Regra de publicação

A planilha de origem não contém preço, contagem física, EAN ou NCM confiável para todos os SKUs. Por isso o seed mantém os itens não publicados até que os dados comerciais reais sejam fornecidos. Isso evita publicar produto por R$ 0,00, criar estoque fictício ou atribuir NCM presumido.

## Verificação antes do deploy

No ambiente com dependências instaladas e PostgreSQL de homologação:

```bash
pnpm release:verify
```

Depois, em banco de homologação:

```bash
pnpm db:migrate
CATALOG_SEED_STOCK_MODE=SKIP pnpm seed:catalog
```

Validar manualmente: login/permissions, dashboard, categorias, produtos, upload de planilha, FIFO, portal B2B, cotação, pedido, reserva, pagamento, expedição e nota fiscal em modo configurado.

## Critério de não regressão

As mudanças desta fase são aditivas ou compatíveis. Não há `DROP`, `TRUNCATE` ou renomeação destrutiva de tabelas. A carga por planilha é opt-in e o seed automático permanece desligado. A confirmação definitiva de não regressão exige a suíte completa no mesmo conjunto de dependências e banco de homologação que antecede produção.
