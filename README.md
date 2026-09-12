# Ideal Prime — Plataforma Comercial Empresarial

Plataforma de comércio e distribuição **B2B-first** da Ideal Prime. Reúne catálogo dinâmico, portal empresarial, tabelas comerciais versionadas, cotações, pedidos multitem, reserva e fila FIFO de estoque, clientes, vendedores, crédito, emissão fiscal preparada e operação administrativa.

## Princípios de arquitetura

- banco, segredos, volumes e domínio próprios da Ideal Prime;
- categorias comerciais são cadastráveis e não ficam limitadas a um setor;
- comprador B2B não acessa rotas internas e só consulta a empresa à qual está vinculado;
- preço B2B é armazenado em centavos e versionado; custo nunca é enviado ao comprador;
- pedido B2B é atômico, multitem e idempotente, com reservas de estoque;
- todo consumo de estoque deve respeitar a operação FIFO;
- confirmação comercial, pagamento, fiscal e expedição são estados separados;
- importação por SKU é auditável e não força estoque existente por padrão;
- nomes internos históricos `permupay_*` permanecem apenas por compatibilidade de migrations e não representam identidade de produto.

## Desenvolvimento e verificação

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm migrate:verify
corepack pnpm check
corepack pnpm test
corepack pnpm build
```

Ou, com as dependências instaladas:

```bash
pnpm release:verify
```

## Banco e inicialização

1. Copie `.env.example` para um arquivo seguro de ambiente e substitua todos os `CHANGE_ME`.
2. Provisione PostgreSQL exclusivo da Ideal Prime.
3. Execute `corepack pnpm db:migrate`.
4. Crie o primeiro administrador com `node scripts/create-admin.mjs` (senha lida de forma interativa).
5. Crie/valide a tabela B2B padrão no painel `/b2b-admin`.
6. Popule o Catálogo Mestre com `pnpm seed:catalog` ou faça upload pelo backoffice.
7. Informe preços/estoque reais e só então publique os produtos.

O servidor de produção usa a porta **4000** e expõe `GET /healthz`.

## Carga do Catálogo Mestre

O seed oficial acompanha o repositório em:

`data/seed/IDEAL_PRIME_CATALOGO_MASTER_SEED.xlsx`

Variáveis de segurança:

- `SEED_CATALOG_MASTER_ON_STARTUP=false` por padrão;
- `CATALOG_SEED_STOCK_MODE=SKIP` por padrão;
- `CATALOG_SEED_FORCE_ACTIVE=false` e `CATALOG_SEED_FORCE_PUBLISH=false` por padrão;
- `SET_IF_EMPTY` só preenche saldo quando o produto ainda está zerado;
- `FORCE` é bloqueado quando existe fila FIFO ativa/aguardando.

## Rotas principais

- `/` — vitrine pública;
- `/empresa/cadastro` — cadastro empresarial;
- `/portal` — catálogo, cotações e pedidos da empresa;
- `/dashboard` — central de operação;
- `/b2b-admin` — relacionamento comercial B2B;
- `/produtos` e `/categorias` — Catálogo Mestre;
- `/estoque`, `/lotes` e `/fila-estoque` — estoque e FIFO;
- `/notas-fiscais` — operação fiscal.

Consulte `DEPLOY.md` e `docs/ideal-prime/` antes de publicar.
