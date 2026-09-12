-- Catálogo Mestre Ideal Prime — metadados comerciais aditivos.
-- Sem DROP/TRUNCATE e sem alteração do enum legado de categoria, preservando
-- compatibilidade com todos os produtos já cadastrados.

ALTER TABLE "permupay_products"
  ADD COLUMN IF NOT EXISTS "brand" text,
  ADD COLUMN IF NOT EXISTS "subcategory" text,
  ADD COLUMN IF NOT EXISTS "source_url" text,
  ADD COLUMN IF NOT EXISTS "search_term" text;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "permupay_products_category_label_idx"
  ON "permupay_products" ("category_label");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "permupay_products_brand_idx"
  ON "permupay_products" ("brand");
