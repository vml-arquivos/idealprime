-- Migration 0025: canal de vendedores, atribuição de pedidos e comissões
-- 100% aditiva e idempotente; compatível com o runner de produção.

DO $$
BEGIN
  CREATE TYPE permupay_commission_status AS ENUM ('PENDENTE', 'PAGO', 'PAGA', 'CANCELADA');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

ALTER TYPE permupay_commission_status ADD VALUE IF NOT EXISTS 'PAGA';
--> statement-breakpoint
ALTER TYPE permupay_commission_status ADD VALUE IF NOT EXISTS 'CANCELADA';
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS permupay_sellers (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES permupay_users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email VARCHAR(320),
  phone VARCHAR(40),
  type TEXT NOT NULL DEFAULT 'EXTERNO',
  referral_code VARCHAR(60) NOT NULL UNIQUE,
  access_token VARCHAR(64),
  contact TEXT,
  commission_type TEXT NOT NULL DEFAULT 'PERCENT',
  commission_value REAL NOT NULL DEFAULT 0,
  commission_rate REAL NOT NULL DEFAULT 5.0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
--> statement-breakpoint

ALTER TABLE permupay_sellers
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'EXTERNO',
  ADD COLUMN IF NOT EXISTS access_token VARCHAR(64),
  ADD COLUMN IF NOT EXISTS contact TEXT,
  ADD COLUMN IF NOT EXISTS commission_type TEXT NOT NULL DEFAULT 'PERCENT',
  ADD COLUMN IF NOT EXISTS commission_value REAL NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_rate REAL NOT NULL DEFAULT 5.0;
--> statement-breakpoint

ALTER TABLE permupay_orders
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'VITRINE',
  ADD COLUMN IF NOT EXISTS seller_id INTEGER,
  ADD COLUMN IF NOT EXISTS referral_code VARCHAR(60);
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'permupay_orders_seller_id_fkey'
  ) THEN
    ALTER TABLE permupay_orders
      ADD CONSTRAINT permupay_orders_seller_id_fkey
      FOREIGN KEY (seller_id) REFERENCES permupay_sellers(id) ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS permupay_sellers_referral_code_idx
  ON permupay_sellers (referral_code);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS permupay_orders_seller_id_idx
  ON permupay_orders (seller_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS permupay_orders_referral_code_idx
  ON permupay_orders (referral_code);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS permupay_commissions (
  id SERIAL PRIMARY KEY,
  seller_id INTEGER NOT NULL REFERENCES permupay_sellers(id) ON DELETE CASCADE,
  order_id INTEGER NOT NULL REFERENCES permupay_orders(id) ON DELETE CASCADE,
  order_total REAL NOT NULL DEFAULT 0,
  commission_rate REAL NOT NULL DEFAULT 0,
  commission_value REAL NOT NULL DEFAULT 0,
  sale_amount REAL NOT NULL DEFAULT 0,
  cost_amount REAL NOT NULL DEFAULT 0,
  commission_amount REAL NOT NULL DEFAULT 0,
  status permupay_commission_status NOT NULL DEFAULT 'PENDENTE',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
--> statement-breakpoint

ALTER TABLE permupay_commissions
  ADD COLUMN IF NOT EXISTS order_total REAL NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_rate REAL NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_value REAL NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sale_amount REAL NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_amount REAL NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_amount REAL NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS permupay_commissions_order_id_uq
  ON permupay_commissions(order_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS permupay_commissions_seller_id_idx
  ON permupay_commissions(seller_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS permupay_commissions_status_idx
  ON permupay_commissions(status);
