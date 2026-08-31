-- ============================================================
-- Migration: 0026_ai_knowledge_cache.sql
-- Cache/base de conhecimento interna do agente autônomo.
-- 100% aditivo.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS permupay_ai_suggestions_cache (
  id serial PRIMARY KEY,
  input_hash varchar(64) NOT NULL,
  source_type text NOT NULL,
  matched_product_id integer REFERENCES permupay_products(id) ON DELETE SET NULL,
  suggestion jsonb NOT NULL,
  origin text NOT NULL,
  confidence real NOT NULL DEFAULT 0,
  hits integer NOT NULL DEFAULT 1,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS permupay_ai_cache_input_hash_idx
  ON permupay_ai_suggestions_cache (input_hash);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS permupay_products_name_trgm_idx
  ON permupay_products USING gin (name gin_trgm_ops);
