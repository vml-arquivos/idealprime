-- Migration: Add USD cost and stock fields to products
-- Descrição: Adiciona suporte a custo em dólar, cotação manual, estoque e custo final unitário.

DO $$ 
BEGIN
    -- Adicionar colunas se não existirem
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'permupay_products' AND column_name = 'cost_currency') THEN
        ALTER TABLE permupay_products ADD COLUMN cost_currency text DEFAULT 'BRL';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'permupay_products' AND column_name = 'cost_price_usd') THEN
        ALTER TABLE permupay_products ADD COLUMN cost_price_usd numeric(12,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'permupay_products' AND column_name = 'usd_exchange_rate') THEN
        ALTER TABLE permupay_products ADD COLUMN usd_exchange_rate numeric(12,4) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'permupay_products' AND column_name = 'cost_price_brl') THEN
        ALTER TABLE permupay_products ADD COLUMN cost_price_brl numeric(12,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'permupay_products' AND column_name = 'stock_quantity') THEN
        ALTER TABLE permupay_products ADD COLUMN stock_quantity numeric(12,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'permupay_products' AND column_name = 'minimum_stock') THEN
        ALTER TABLE permupay_products ADD COLUMN minimum_stock numeric(12,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'permupay_products' AND column_name = 'average_cost_brl') THEN
        ALTER TABLE permupay_products ADD COLUMN average_cost_brl numeric(12,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'permupay_products' AND column_name = 'final_unit_cost_brl') THEN
        ALTER TABLE permupay_products ADD COLUMN final_unit_cost_brl numeric(12,2) DEFAULT 0;
    END IF;

END $$;
