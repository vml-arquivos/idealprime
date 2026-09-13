-- Seleção editorial da página principal. A vitrine completa continua usando
-- published/active; estes campos apenas controlam a faixa de destaques.
ALTER TABLE "permupay_products"
  ADD COLUMN IF NOT EXISTS "is_featured" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "featured_order" integer NOT NULL DEFAULT 0;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "permupay_products_featured_idx"
  ON "permupay_products" ("is_featured", "featured_order", "display_order");
