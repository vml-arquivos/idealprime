# Arquitetura B2B Ideal Prime

A derivação mantém o monólito React + Express/tRPC + PostgreSQL. O modelo novo é aditivo.

## Isolamento de acesso

`authenticatedProcedure` aceita qualquer sessão válida apenas para fluxos conscientemente compartilhados. `protectedProcedure` é exclusivo da equipe (`account_type=STAFF`). `adminProcedure` exige equipe + `role=admin`. Compradores usam `account_type=BUYER` e membership ativa em uma única conta empresarial.

## Dados B2B

- `permupay_business_accounts` / `permupay_business_memberships` — empresa e vínculo;
- `permupay_price_lists`, versões e itens — autoridade do preço B2B em centavos;
- `permupay_b2b_orders` + itens — snapshot de SKU/nome/unidade/preço/condições;
- `permupay_b2b_stock_reservations` — reserva antes da expedição;
- `permupay_b2b_notifications` — aviso interno do pedido;
- `permupay_import_jobs` / rows — idempotência, histórico e auditoria.

Produtos legados recebem `sku`, `unit`, `sales_multiple` e `b2b_enabled`. `published` continua sendo a decisão de vitrine pública e não é acionada por importação.

## Concorrência

Criação de pedido usa transação `SERIALIZABLE`, lock dos produtos, revalidação de reservas e chave de idempotência por empresa. Expedição consome a reserva e baixa estoque na mesma transação. Cancelamento libera reservas ativas.
