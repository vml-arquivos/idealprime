# Ideal Prime — Comércio e Distribuição B2B

Sistema B2B derivado da base PermuPay Vendas e isolado para a operação **Ideal Prime**. Mantém React 19, TypeScript, Express, tRPC, Drizzle e PostgreSQL, adicionando conta empresarial, tabela comercial versionada, catálogo B2B, pedido multitem, reserva de estoque, importação CSV/XLSX e RBAC entre equipe e compradores.

## Princípios desta derivação

- banco, segredos, volumes e domínio próprios da Ideal Prime;
- nenhum cliente, pedido ou credencial de produção da PermuPay é transportado por padrão;
- estruturas `permupay_*` históricas são preservadas por compatibilidade de migration;
- comprador B2B não acessa rotas internas e só consulta a empresa à qual está vinculado;
- preço B2B é armazenado em centavos e versionado; custo nunca é enviado ao comprador;
- um pedido é atômico, multitem e idempotente, com reservas de estoque;
- confirmação comercial, pagamento e expedição são estados separados;
- importação não publica produto na vitrine pública e não altera custo automaticamente.

## Desenvolvimento

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm migrate:verify
corepack pnpm check
corepack pnpm test
corepack pnpm build
```

## Banco e inicialização

1. Copie `.env.example` para um arquivo seguro de ambiente e substitua todos os `CHANGE_ME`.
2. Provisione PostgreSQL exclusivo da Ideal Prime.
3. Execute `corepack pnpm db:migrate`.
4. Crie o primeiro administrador com `node scripts/create-admin.mjs` (senha lida de forma interativa).
5. Crie a tabela B2B padrão no painel `/b2b-admin`.
6. Importe o catálogo real e só então aprove empresas compradoras.

O servidor de produção usa a porta **4000** e expõe `GET /healthz`.

## Rotas principais

- `/` — vitrine pública;
- `/empresa/cadastro` — solicitação de cadastro empresarial;
- `/login` — login;
- `/portal` — catálogo e pedidos da empresa compradora;
- `/b2b-admin` — operação empresarial para equipe Ideal Prime;
- `/dashboard` — módulos internos legados preservados.

Consulte `DEPLOY.md` e `docs/ideal-prime/` antes de publicar.
