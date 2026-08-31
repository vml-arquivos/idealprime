-- Migration 0010: Adiciona colunas de configuração fiscal, boleto e cartão
-- Todas as colunas são adicionadas de forma idempotente (IF NOT EXISTS)

ALTER TABLE permupay_products
  ADD COLUMN IF NOT EXISTS tax_cash real NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS tax_boleto real NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS tax_debit real NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS tax_credit_cash real NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS tax_credit_installment real NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS boleto_months real NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS boleto_monthly_rate real NOT NULL DEFAULT 1.99,
  ADD COLUMN IF NOT EXISTS boleto_fixed_fee real NOT NULL DEFAULT 3.50,
  ADD COLUMN IF NOT EXISTS boleto_default_risk real NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS boleto_customer_pays_interest boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS card_debit_fee real NOT NULL DEFAULT 1.5,
  ADD COLUMN IF NOT EXISTS card_credit_cash_fee real NOT NULL DEFAULT 2.5,
  ADD COLUMN IF NOT EXISTS card_credit_installment_fee real NOT NULL DEFAULT 3.5,
  ADD COLUMN IF NOT EXISTS card_installments real NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS card_anticipation_rate real NOT NULL DEFAULT 1.5,
  ADD COLUMN IF NOT EXISTS card_monthly_rate real NOT NULL DEFAULT 1.99,
  ADD COLUMN IF NOT EXISTS card_customer_pays_interest boolean NOT NULL DEFAULT false;
