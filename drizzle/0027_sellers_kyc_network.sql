-- ============================================================
-- Migration: 0027_sellers_kyc_network.sql
-- Cadastro completo do vendedor (KYC) + estrutura de rede
-- (patrocinador). 100% aditivo — não altera dados existentes.
-- ============================================================

DO $$
BEGIN
  CREATE TYPE permupay_seller_status AS ENUM ('PENDENTE', 'APROVADO', 'REJEITADO', 'INATIVO');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

ALTER TABLE permupay_sellers
  ADD COLUMN IF NOT EXISTS status permupay_seller_status NOT NULL DEFAULT 'APROVADO',
  ADD COLUMN IF NOT EXISTS parent_seller_id INTEGER,
  ADD COLUMN IF NOT EXISTS cpf VARCHAR(20),
  ADD COLUMN IF NOT EXISTS birth_date DATE,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS state VARCHAR(2),
  ADD COLUMN IF NOT EXISTS zip_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS pix_key TEXT,
  ADD COLUMN IF NOT EXISTS document_front_url TEXT,
  ADD COLUMN IF NOT EXISTS document_back_url TEXT,
  ADD COLUMN IF NOT EXISTS selfie_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS override_commission_type TEXT NOT NULL DEFAULT 'PERCENT',
  ADD COLUMN IF NOT EXISTS override_commission_value REAL NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS reviewed_by INTEGER REFERENCES permupay_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'permupay_sellers_parent_seller_id_fkey'
  ) THEN
    ALTER TABLE permupay_sellers
      ADD CONSTRAINT permupay_sellers_parent_seller_id_fkey
      FOREIGN KEY (parent_seller_id) REFERENCES permupay_sellers(id) ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS permupay_sellers_status_idx ON permupay_sellers (status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS permupay_sellers_parent_seller_id_idx ON permupay_sellers (parent_seller_id);
