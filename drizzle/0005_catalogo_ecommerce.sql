-- Migration: 0005_catalogo_ecommerce
-- Adiciona campos de catálogo, descrição e links de pagamento ao produto
-- Cada ALTER TABLE usa instrução separada para compatibilidade com PostgreSQL

-- 1. Descrição curta e longa
ALTER TABLE permupay_products ADD COLUMN IF NOT EXISTS short_description text;
ALTER TABLE permupay_products ADD COLUMN IF NOT EXISTS description text;

-- 2. Preços sugeridos calculados
ALTER TABLE permupay_products ADD COLUMN IF NOT EXISTS suggested_price real NOT NULL DEFAULT 0;
ALTER TABLE permupay_products ADD COLUMN IF NOT EXISTS suggested_price_pix real NOT NULL DEFAULT 0;
ALTER TABLE permupay_products ADD COLUMN IF NOT EXISTS suggested_price_card real NOT NULL DEFAULT 0;
ALTER TABLE permupay_products ADD COLUMN IF NOT EXISTS suggested_price_boleto real NOT NULL DEFAULT 0;

-- 3. Configurações de pagamento (links externos)
ALTER TABLE permupay_products ADD COLUMN IF NOT EXISTS payment_platform text DEFAULT 'MERCADO_PAGO';
ALTER TABLE permupay_products ADD COLUMN IF NOT EXISTS pix_key text;
ALTER TABLE permupay_products ADD COLUMN IF NOT EXISTS pix_link text;
ALTER TABLE permupay_products ADD COLUMN IF NOT EXISTS card_payment_url text;
ALTER TABLE permupay_products ADD COLUMN IF NOT EXISTS boleto_url text;

-- 4. Slug de categoria customizável para filtro
ALTER TABLE permupay_products ADD COLUMN IF NOT EXISTS category_label text;
