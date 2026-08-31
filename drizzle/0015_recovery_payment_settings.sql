-- ============================================================
-- 0015_recovery_payment_settings.sql
-- MIGRATION DE RECUPERAÇÃO
--
-- Contexto: A migration 0013 foi registrada como aplicada em um deploy
-- anterior sem ter executado o DDL (bug no migrate.mjs: arquivo não
-- encontrado em disco → marcado como aplicado silenciosamente).
-- A tabela permupay_payment_settings pode existir (de 0010/0011) mas
-- sem as colunas adicionadas pela 0013 e 0014.
--
-- Esta migration é TOTALMENTE IDEMPOTENTE — segura para re-executar.
-- Usa CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS em todos
-- os pontos, cobrindo todos os cenários possíveis:
--   • Tabela não existe → cria do zero com todas as colunas
--   • Tabela existe sem as colunas novas → adiciona apenas o que falta
--   • Tudo já existe → não faz nada, sem erro
-- ============================================================

-- ── GARANTE A EXISTÊNCIA DA TABELA BASE ─────────────────────────────────────
-- Se a tabela já existia desde 0010/0011, este bloco é no-op.
-- Se foi dropada ou nunca existiu, recria com estrutura completa.
CREATE TABLE IF NOT EXISTS permupay_payment_settings (
  id                           serial PRIMARY KEY,
  -- Campos originais (0010/0011)
  card_debit_fee               real NOT NULL DEFAULT 1.5,
  card_credit_cash_fee         real NOT NULL DEFAULT 2.5,
  card_credit_installment_fee  real NOT NULL DEFAULT 3.5,
  card_installments            integer NOT NULL DEFAULT 6,
  cash_discount_percent        real NOT NULL DEFAULT 0,
  updated_at                   timestamptz NOT NULL DEFAULT now()
);

-- ── COLUNAS DA 0013: FISCAL ──────────────────────────────────────────────────
ALTER TABLE permupay_payment_settings
  ADD COLUMN IF NOT EXISTS tax_regime               text NOT NULL DEFAULT 'SIMPLES_NACIONAL',
  ADD COLUMN IF NOT EXISTS tax_boleto               real NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS tax_debit                real NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS tax_credit_cash          real NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS tax_credit_installment   real NOT NULL DEFAULT 6;

-- ── COLUNAS DA 0013: CARTÃO EXTRA ───────────────────────────────────────────
ALTER TABLE permupay_payment_settings
  ADD COLUMN IF NOT EXISTS card_anticipation_rate       real    NOT NULL DEFAULT 1.5,
  ADD COLUMN IF NOT EXISTS card_monthly_rate            real    NOT NULL DEFAULT 1.99,
  ADD COLUMN IF NOT EXISTS card_customer_pays_interest  boolean NOT NULL DEFAULT false;

-- ── COLUNAS DA 0013: BOLETO ─────────────────────────────────────────────────
ALTER TABLE permupay_payment_settings
  ADD COLUMN IF NOT EXISTS boleto_months                real    NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS boleto_monthly_rate          real    NOT NULL DEFAULT 1.99,
  ADD COLUMN IF NOT EXISTS boleto_fixed_fee             real    NOT NULL DEFAULT 3.50,
  ADD COLUMN IF NOT EXISTS boleto_default_risk          real    NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS boleto_customer_pays_interest boolean NOT NULL DEFAULT false;

-- ── COLUNAS DA 0013: DESCONTOS UNIVERSAIS ───────────────────────────────────
ALTER TABLE permupay_payment_settings
  ADD COLUMN IF NOT EXISTS discount_pix     real NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_cash    real NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_boleto  real NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_debit   real NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_credit  real NOT NULL DEFAULT 0;

-- ── COLUNAS DA 0014: LINKS GLOBAIS ──────────────────────────────────────────
ALTER TABLE permupay_payment_settings
  ADD COLUMN IF NOT EXISTS payment_platform  text DEFAULT 'MERCADO_PAGO',
  ADD COLUMN IF NOT EXISTS pix_key           text,
  ADD COLUMN IF NOT EXISTS pix_link          text,
  ADD COLUMN IF NOT EXISTS card_payment_url  text,
  ADD COLUMN IF NOT EXISTS boleto_url        text;

-- ── GARANTE LINHA PADRÃO id=1 ───────────────────────────────────────────────
INSERT INTO permupay_payment_settings (
  id,
  tax_regime, tax_boleto, tax_debit, tax_credit_cash, tax_credit_installment,
  card_debit_fee, card_credit_cash_fee, card_credit_installment_fee, card_installments,
  card_anticipation_rate, card_monthly_rate, card_customer_pays_interest,
  boleto_months, boleto_monthly_rate, boleto_fixed_fee, boleto_default_risk, boleto_customer_pays_interest,
  discount_pix, discount_cash, discount_boleto, discount_debit, discount_credit,
  cash_discount_percent,
  payment_platform,
  updated_at
)
VALUES (
  1,
  'SIMPLES_NACIONAL', 6, 6, 6, 6,
  1.5, 2.5, 3.5, 6,
  1.5, 1.99, false,
  3, 1.99, 3.50, 2, false,
  0, 0, 0, 0, 0,
  0,
  'MERCADO_PAGO',
  now()
)
ON CONFLICT (id) DO NOTHING;
