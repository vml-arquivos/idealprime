-- Hardening aditivo do módulo B2B (ver docs/ideal-prime/AUDITORIA_PERMUPAY_IDEAL_PRIME.md).
-- Nenhum DROP/TRUNCATE. Todas as alterações são aditivas e retrocompatíveis.

-- 1) CNPJ deve ficar normalizado (somente dígitos, 14 posições) também no banco,
--    não só na aplicação — defesa em profundidade caso outro processo grave direto.
ALTER TABLE "permupay_business_accounts"
  ADD CONSTRAINT "permupay_business_cnpj_format_check" CHECK ("cnpj" ~ '^[0-9]{14}$');
--> statement-breakpoint

-- 2) Reserva de estoque B2B não pode ter quantidade zero/negativa (as demais tabelas
--    de item já tinham este check; a de reservas ficou sem).
ALTER TABLE "permupay_b2b_stock_reservations"
  ADD CONSTRAINT "permupay_b2b_reservation_qty_positive" CHECK ("quantity" > 0);
--> statement-breakpoint

-- 3) Índice para listagem/paginação de pedidos por empresa (mesma necessidade que já
--    existia e foi resolvida para cotações em 0030_enterprise_permissions_quotes.sql).
CREATE INDEX IF NOT EXISTS "permupay_b2b_orders_business_created" ON "permupay_b2b_orders" ("business_account_id","created_at" DESC);
