-- 0021_quase_zero_products.sql
-- Quase Zero: canal de venda e condição do produto.
-- Usa ADD COLUMN IF NOT EXISTS para ser segura em deploys repetidos.

ALTER TABLE permupay_products
  ADD COLUMN IF NOT EXISTS sales_channel text NOT NULL DEFAULT 'SHOP',
  ADD COLUMN IF NOT EXISTS product_condition text NOT NULL DEFAULT 'NEW',
  ADD COLUMN IF NOT EXISTS condition_notes text,
  ADD COLUMN IF NOT EXISTS is_unique_piece boolean NOT NULL DEFAULT false;

UPDATE permupay_products
SET sales_channel = 'SHOP'
WHERE sales_channel IS NULL OR sales_channel = '';

UPDATE permupay_products
SET product_condition = 'NEW'
WHERE product_condition IS NULL OR product_condition = '';
