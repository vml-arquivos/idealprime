# Relatório de implantação — Ideal Prime

Última atualização: 2026-09-08, nesta rodada de auditoria/correção do módulo B2B.

## Estado do código

O B2B foi implementado de forma aditiva sobre a base PermuPay Vendas: contas empresariais, membership, tabela de preços versionada, catálogo empresarial isolado, cotação, pedido multitem idempotente e transacional, reserva de estoque, backoffice de importação CSV/XLSX. A implementação **já existente** (antes desta rodada) era funcionalmente mais completa do que os arquivos `schema.b2b.ts`/`b2b.router.ts` sugeririam a um leitor rápido — mas continha bugs concretos de autorização e concorrência, confirmados por execução real contra PostgreSQL 16 (não apenas por leitura de código). Ver `docs/ideal-prime/AUDITORIA_PERMUPAY_IDEAL_PRIME.md` para o detalhamento de cada achado.

## O que foi concluído nesta rodada

1. **Auditoria comportamental completa** comparando `permupay-vendas-main` e `idealprime-main` (não apenas diff de arquivo — leitura linha a linha dos módulos críticos, migrations aplicadas de fato contra Postgres real, bugs de concorrência reproduzidos com scripts contra o banco).
2. **Correção de 5 achados bloqueadores**: vazamento de pedidos entre empresas via `trpc.b2b.order` (B1); importação sem checagem de permissão (B2); `createOrderFromQuote` não atômico permitindo conversão dupla de uma cotação sob concorrência — reproduzido de fato antes da correção (B3); reservas de estoque B2B que nunca expiravam (B4); `drizzle/schema.b2b.ts` incompleto com risco de `DROP TABLE` em geração futura de migration (B5).
3. **Correção de 2 achados altos**: ausência de fluxo para a equipe vincular um segundo comprador a uma empresa já aprovada (A2 — nova mutation `b2b.admin.inviteMember`); máquina de estados do pedido sem validação de transição a partir do estado atual (A3).
4. **Correção de 1 achado médio**: `/portal` sem redirecionamento para usuário deslogado (M1).
5. **Migration aditiva nova**: `drizzle/0031_b2b_hardening.sql` — `CHECK` de formato de CNPJ no banco, `CHECK` de quantidade positiva em reservas B2B (faltava), índice de paginação de pedidos por empresa. Nenhum `DROP`/`TRUNCATE`.
6. **23 testes automatizados novos**: `server/b2b.router.test.ts` (7, autorização no router, sem precisar de banco) e `server/b2b.integration.test.ts` (16, contra PostgreSQL 16 real — idempotência, isolamento entre empresas, concorrência de última unidade, concorrência de conversão de cotação, atomicidade multitem, expiração de reserva, importação idempotente, não publicação automática). Suíte completa: **85 testes, todos passando**; a suíte de integração é pulada automaticamente (não falha) quando `DATABASE_URL` não está definida.
7. **Verificações executadas de fato nesta sessão** (não apenas assumidas): `pnpm install --frozen-lockfile`, `pnpm migrate:verify`, `pnpm check` (`tsc --noEmit`), `pnpm test` (com e sem banco disponível), `pnpm build`, `pnpm db:migrate` contra PostgreSQL 16 real (31 migrations aplicadas do zero com sucesso, e reaplicadas sem efeito na segunda execução), build de produção iniciado de fato com `node dist/index.js` e `GET /healthz` retornando 200.
8. Limite de linhas por importação (5000) adicionado como proteção contra abuso, que faltava.

## O que depende de configuração externa (não testável neste repositório isoladamente)

- Backup/restore reais do PostgreSQL de produção (procedimento documentado, não automatizado neste repo).
- Comportamento em container Docker real (Dockerfile/compose revisados e corretos por inspeção; não foi possível subir via `docker compose up` neste ambiente de auditoria por falta de daemon Docker acessível — o servidor foi validado rodando diretamente com Node contra Postgres real, o que exercita o mesmo código de produção).
- Verificação visual desktop/mobile das telas (não há renderização de navegador disponível neste ambiente de auditoria).
- `scripts/create-admin.mjs` é interativo por design (evita senha em variável de ambiente/log); não foi possível automatizá-lo via stdin não-interativo neste sandbox específico (limitação do `readline/promises` do Node com stdin não-TTY observada neste ambiente, não um defeito do script). A query SQL que ele executa foi validada diretamente contra o banco de teste com sucesso.

## O que está fora do escopo desta entrega (pendência priorizada, não implementada)

Sete migrations/módulos inteiros do PermuPay que nunca foram portados ao Ideal Prime (o repositório se bifurcou antes deles existirem — ver achado A1 da auditoria):

- Promissórias (`shared/promissoryNoteEngine.ts`, `server/db.promissoryNotes.ts`, migration `0030_promissory_notes`, página `Promissorias.tsx`).
- KYC/crédito de clientes (migration `0029_customers_kyc_credit`).
- Segurança de clientes (migration `0031_customer_security`).
- Métodos de pagamento por produto (migration `0032_product_payment_methods`).
- Histórico/comunicações de clientes (migration `0033_customer_history_and_communications`).
- Expansão de métodos em configurações de pagamento (migration `0034_payment_settings_methods`).
- Produtos em destaque/hero (migration `0035_products_featured_hero`).
- CRM de clientes / venda direta / autenticação de cliente / documentos e recibos em PDF (`Clientes.tsx`, `ClienteDetalhe.tsx`, `NovaVenda.tsx`, `server/_core/customerAuth.ts`, `server/_core/documentRoutes.ts`, `server/pdf.documents.ts`).

Cada um desses merece a mesma profundidade de auditoria comportamental feita aqui para o B2B antes de ser portado — copiar arquivo por arquivo sem essa auditoria é exatamente o que a tarefa original pediu para não fazer. Recomenda-se tratá-los como entregas subsequentes, um módulo por vez.

Também permanecem fora do escopo, por serem limitações intencionais do produto (não relacionadas à auditoria): emissão de NF-e, gateway de pagamento individual por empresa, ERP, estorno bancário automático, múltiplos depósitos e notificações automáticas por e-mail/WhatsApp. Pagamento nesta versão é confirmação manual pela equipe. Nenhum desses itens deve ser apresentado como concluído.

## Controles implementados (visão geral, atualizada)

RBAC equipe/comprador validado no servidor (não só na interface) e agora coberto por teste automatizado no nível do router tRPC; conta empresarial e membership com unicidade e CNPJ validado também no banco; tabela de preços versionada em centavos, com snapshot imutável em cada pedido; catálogo empresarial isolado por tabela vigente, sem custo/margem no payload; pedido multitem idempotente e atômico, com lock de concorrência testado sob carga simulada real; reservas de estoque com expiração automática (novo); máquina de estados do pedido com transições validadas (novo); conversão de cotação em pedido atômica sob concorrência, com retry automático em conflito de serialização (novo); importação auditável, idempotente por hash e com limite de linhas (novo); upload administrativo autenticado e agora também exigindo permissão B2B específica (corrigido); documentos privados; porta fixa; healthcheck com banco real verificado nesta sessão; volume Ideal Prime dedicado.

## Bloqueadores remanescentes para produção

Nenhum dos 5 achados bloqueadores identificados nesta auditoria permanece em aberto — todos foram corrigidos e cobertos por teste nesta rodada. **Não há bloqueador conhecido para o fluxo B2B em si** ao final desta entrega. A ressalva é a lacuna de paridade com o PermuPay (achado A1, sete módulos legados não portados) — não bloqueia o B2B, mas deve ser resolvida antes de se declarar paridade completa com o PermuPay Vendas.
