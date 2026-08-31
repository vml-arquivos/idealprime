-- Migration: 0009_margin_mode_columns
-- Adiciona colunas margin_mode e desired_margin_value ao produto (idempotente)
-- Também garante que o enum permupay_margin_mode existe

DO $$ BEGIN
  CREATE TYPE permupay_margin_mode AS ENUM ('PERCENT', 'VALUE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE permupay_products ADD COLUMN IF NOT EXISTS desired_margin_value real NOT NULL DEFAULT 0;
ALTER TABLE permupay_products ADD COLUMN IF NOT EXISTS margin_mode text NOT NULL DEFAULT 'PERCENT';
