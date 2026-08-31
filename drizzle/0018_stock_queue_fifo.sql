-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 0017 — Fila de Estoque FIFO por Lote
-- ══════════════════════════════════════════════════════════════════════════════
--
-- ARQUITETURA:
--   Cada lote que chega pode conter produtos que já estão com estoque ativo.
--   Esses itens NÃO entram imediatamente — ficam na fila (EM_ESPERA).
--   Quando o estoque ativo do produto zera, o sistema promove automaticamente
--   o lote mais antigo em espera (FIFO puro).
--
-- TABELAS:
--   permupay_stock_queue  →  filas de entrada por produto/lote
--   batch_items recebe    →  coluna queue_status para rastrear estado
-- ══════════════════════════════════════════════════════════════════════════════

-- Enum de status da fila
DO $$ BEGIN
  CREATE TYPE permupay_queue_status AS ENUM (
    'EM_ESPERA',   -- aguardando estoque ativo zerar
    'ATIVO',       -- promovido — é o lote sendo vendido agora
    'ESGOTADO',    -- esgotado — todas as unidades vendidas
    'CANCELADO'    -- cancelado manualmente
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Tabela principal da fila FIFO
CREATE TABLE IF NOT EXISTS "permupay_stock_queue" (
  "id"                       SERIAL PRIMARY KEY,

  -- Referências
  "product_id"               INTEGER NOT NULL
    REFERENCES "permupay_products"("id") ON DELETE CASCADE,
  "batch_id"                 INTEGER
    REFERENCES "permupay_pricing_batches"("id") ON DELETE SET NULL,
  "batch_item_id"            INTEGER
    REFERENCES "permupay_batch_items"("id") ON DELETE SET NULL,
  "user_id"                  INTEGER
    REFERENCES "permupay_users"("id") ON DELETE SET NULL,

  -- Dados do lote neste item da fila
  "quantity"                 REAL NOT NULL DEFAULT 0,
  "quantity_remaining"       REAL NOT NULL DEFAULT 0,   -- decrementado na venda
  "unit_cost"                REAL NOT NULL DEFAULT 0,   -- custo final já com rateio
  "suggested_price_pix"      REAL NOT NULL DEFAULT 0,
  "suggested_price_card"     REAL NOT NULL DEFAULT 0,
  "suggested_price_boleto"   REAL NOT NULL DEFAULT 0,
  "desired_margin_rate"      REAL NOT NULL DEFAULT 0,
  "estimated_tax_rate"       REAL NOT NULL DEFAULT 0,

  -- Controle FIFO
  "status"                   permupay_queue_status NOT NULL DEFAULT 'EM_ESPERA',
  "position"                 INTEGER NOT NULL DEFAULT 0,  -- posição na fila (menor = primeiro)
  "activated_at"             TIMESTAMP,                   -- quando foi promovido para ATIVO
  "exhausted_at"             TIMESTAMP,                   -- quando zerou

  "notes"                    TEXT,
  "created_at"               TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at"               TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Índices para performance nas queries FIFO críticas
CREATE INDEX IF NOT EXISTS idx_stock_queue_product_status
  ON "permupay_stock_queue" ("product_id", "status", "position");

CREATE INDEX IF NOT EXISTS idx_stock_queue_batch
  ON "permupay_stock_queue" ("batch_id");

-- Coluna queue_status em batch_items para visibilidade rápida
ALTER TABLE "permupay_batch_items"
  ADD COLUMN IF NOT EXISTS "queue_status" permupay_queue_status DEFAULT 'EM_ESPERA';

ALTER TABLE "permupay_batch_items"
  ADD COLUMN IF NOT EXISTS "queue_id" INTEGER
    REFERENCES "permupay_stock_queue"("id") ON DELETE SET NULL;

-- Coluna fifo_mode em pricingBatches: true = lote usa FIFO
ALTER TABLE "permupay_pricing_batches"
  ADD COLUMN IF NOT EXISTS "fifo_mode" BOOLEAN NOT NULL DEFAULT false;
