-- ============================================================
-- Migration: 0028_customers_cart.sql
-- Clientes finais (identificação por contato, sem senha) +
-- agrupamento de carrinho no checkout. 100% aditivo.
-- ============================================================

CREATE TABLE IF NOT EXISTS permupay_customers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  contact TEXT NOT NULL,
  contact_type TEXT NOT NULL DEFAULT 'WHATSAPP',
  email VARCHAR(320),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(2),
  zip_code VARCHAR(20),
  referred_by_seller_id INTEGER REFERENCES permupay_sellers(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS permupay_customers_contact_idx
  ON permupay_customers (lower(contact));
--> statement-breakpoint

ALTER TABLE permupay_orders
  ADD COLUMN IF NOT EXISTS customer_id INTEGER,
  ADD COLUMN IF NOT EXISTS checkout_group_id VARCHAR(36);
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'permupay_orders_customer_id_fkey'
  ) THEN
    ALTER TABLE permupay_orders
      ADD CONSTRAINT permupay_orders_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES permupay_customers(id) ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS permupay_orders_customer_id_idx ON permupay_orders (customer_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS permupay_orders_checkout_group_id_idx ON permupay_orders (checkout_group_id);
