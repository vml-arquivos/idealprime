-- 0019_entrada_produtos_custos.sql
-- Entrada de Produtos: persistência segura de moeda, pagamento de aquisição, imposto e outros custos.
-- Todos os campos entram com DEFAULT para preservar produtos/lotes antigos.

ALTER TABLE permupay_pricing_batches
  ADD COLUMN IF NOT EXISTS total_tax_cost real NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_other_cost real NOT NULL DEFAULT 0;

ALTER TABLE permupay_batch_items
  ADD COLUMN IF NOT EXISTS unit_cost_original real NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_currency text NOT NULL DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS exchange_rate real NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS acquisition_payment_method text NOT NULL DEFAULT 'OUTRO',
  ADD COLUMN IF NOT EXISTS operational_cost_per_unit real NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS allocated_tax_cost real NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_cost_per_unit real NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS allocated_other_cost real NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_cost_per_unit real NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS real_total_cost real NOT NULL DEFAULT 0;

-- Backfill leve para entradas antigas: não altera produto, preço, estoque ou vitrine.
UPDATE permupay_batch_items
SET unit_cost_original = unit_cost_brl
WHERE unit_cost_original = 0 AND unit_cost_brl > 0;

UPDATE permupay_batch_items
SET operational_cost_per_unit = CASE
    WHEN quantity > 0 THEN allocated_operational_cost / quantity
    ELSE 0
  END,
  real_total_cost = final_unit_cost * quantity
WHERE quantity > 0;
