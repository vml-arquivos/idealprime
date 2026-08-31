-- ============================================================
-- 0014_payment_settings_links.sql
-- Expansão de permupay_payment_settings com campos de links globais:
--   • payment_platform: plataforma padrão de pagamento
--   • pix_key: chave Pix global padrão
--   • pix_link: link de pagamento Pix global
--   • card_payment_url: link de pagamento cartão global
--   • boleto_url: link de boleto global
--
-- IDEMPOTENTE: usa ADD COLUMN IF NOT EXISTS — seguro para re-executar.
-- Estes campos são usados como defaults globais; produtos podem sobrescrever.
-- ============================================================

ALTER TABLE permupay_payment_settings
  ADD COLUMN IF NOT EXISTS payment_platform text DEFAULT 'MERCADO_PAGO',
  ADD COLUMN IF NOT EXISTS pix_key text,
  ADD COLUMN IF NOT EXISTS pix_link text,
  ADD COLUMN IF NOT EXISTS card_payment_url text,
  ADD COLUMN IF NOT EXISTS boleto_url text;
