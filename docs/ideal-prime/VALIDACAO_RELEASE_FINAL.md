# Validação da release — Ideal Prime

Data de empacotamento: 2026-09-12

## Escopo desta release

- painel empresarial e navegação administrativa reorganizados;
- indicadores B2B/estoque/fiscal adicionados ao dashboard sem remover os indicadores legados;
- gestão B2B com cabeçalho executivo e indicadores operacionais;
- vitrine/catálogo com fallback visual corporativo para produtos sem imagem;
- Catálogo Mestre com 277 SKUs únicos e metadados de categoria/subcategoria/marca/descrição;
- seed idempotente por SKU, com atualização segura de categorias, catálogo e tabela de preços;
- estoque protegido por modo `SKIP` por padrão e bloqueio de `FORCE` quando há FIFO ativo/aguardando;
- remoção do runtime específico do ambiente Manus do Vite e neutralização do coletor de debug;
- nomes internos históricos `permupay_*` preservados para compatibilidade de migrations.

## Verificações executadas neste ambiente

1. `node scripts/verify-migrations.mjs`
   - resultado: 35 migrations SQL conferidas 1:1 com o journal.
2. Parser/transpilador TypeScript 5.8.3 aplicado a 207 arquivos `.ts/.tsx` (exceto `.d.ts`).
   - resultado: 0 erro sintático.
3. `node --check` aplicado aos scripts JS/MJS do diretório `scripts/`.
   - resultado: sem erro sintático.
4. `bash -n docker-entrypoint.sh`.
   - resultado: sem erro sintático.
5. Integridade do XLSX do seed verificada como arquivo ZIP/OpenXML.
   - resultado: sem erro de compactação.
6. Busca por segredos em texto claro nos arquivos de entrega.
   - resultado: apenas placeholders em `.env.example`/`COOLIFY_VARIAVEIS.example` e leitura interativa de senha no script de criação de admin.

## Limitação desta validação

O ZIP recebido não contém `node_modules` e o executor utilizado nesta etapa não possui acesso DNS ao registro npm. Por isso não foi possível executar aqui `pnpm check`, `pnpm test` e `pnpm build` com todas as dependências do projeto.

A release **não deve ser promovida diretamente para produção sem a homologação abaixo** no ambiente com dependências instaladas e PostgreSQL de homologação.

```bash
corepack pnpm install --frozen-lockfile
pnpm migrate:verify
pnpm check
pnpm test
pnpm build
pnpm db:migrate
CATALOG_SEED_STOCK_MODE=SKIP pnpm seed:catalog
```

Depois validar manualmente: login e permissões, dashboard, cadastro/edição de categoria, catálogo, upload XLSX, FIFO, cadastro empresarial, tabela comercial, cotação, pedido B2B, reserva, confirmação de pagamento, expedição, clientes/vendedores e emissão fiscal no provedor configurado.

## Regra de segurança de dados

O seed automático permanece desativado por padrão (`SEED_CATALOG_MASTER_ON_STARTUP=false`). `CATALOG_SEED_STOCK_MODE=SKIP` é o padrão. A planilha não cria lote FIFO com custo fictício e não força saldo de estoque existente.
