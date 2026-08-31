-- Adiciona coluna de ordenação manual na vitrine
ALTER TABLE permupay_products
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;
