-- ============================================================
-- 0011_orders_reservations.sql
-- Cria ENUMs e tabela permupay_orders de forma idempotente.
-- Usa blocos DO $$ para não falhar se os tipos já existirem
-- (o migrate.mjs só ignora erros 42701/42P07, não erros de ENUM).
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type
    WHERE typname = 'permupay_order_status'
    AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = current_schema())
  ) THEN
    CREATE TYPE permupay_order_status AS ENUM (
      'AGUARDANDO_PAGAMENTO',
      'RESERVADO',
      'PAGO',
      'CANCELADO',
      'EXPIRADO'
    );
  END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type
    WHERE typname = 'permupay_payment_method'
    AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = current_schema())
  ) THEN
    CREATE TYPE permupay_payment_method AS ENUM (
      'PIX',
      'CARTAO',
      'BOLETO'
    );
  END IF;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "permupay_orders" (
  "id"                  SERIAL PRIMARY KEY,
  "product_id"          INTEGER NOT NULL REFERENCES "permupay_products"("id") ON DELETE RESTRICT,
  "quantity"            INTEGER NOT NULL DEFAULT 1,
  "buyer_name"          TEXT NOT NULL,
  "buyer_contact"       TEXT NOT NULL,
  "buyer_contact_type"  TEXT NOT NULL DEFAULT 'WHATSAPP',
  "payment_method"      permupay_payment_method NOT NULL,
  "unit_price"          REAL NOT NULL,
  "total_price"         REAL NOT NULL,
  "status"              permupay_order_status NOT NULL DEFAULT 'AGUARDANDO_PAGAMENTO',
  "expires_at"          TIMESTAMP NOT NULL,
  "confirmed_at"        TIMESTAMP,
  "confirmed_by"        INTEGER REFERENCES "permupay_users"("id") ON DELETE SET NULL,
  "cancelled_at"        TIMESTAMP,
  "admin_notes"         TEXT,
  "created_at"          TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at"          TIMESTAMP NOT NULL DEFAULT NOW()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "permupay_orders_status_expires" ON "permupay_orders"("status", "expires_at");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "permupay_orders_product_id" ON "permupay_orders"("product_id");
