-- Evolução aditiva do fluxo empresarial de cotações/pedidos.
-- Objetivo: transformar a cotação em uma proposta comercial completa, auditável e
-- exportável, preservando o fluxo existente e sem alterar estoque/FIFO.

ALTER TABLE "permupay_b2b_quotes"
  ADD COLUMN IF NOT EXISTS "customer_reference" varchar(120),
  ADD COLUMN IF NOT EXISTS "requested_delivery_date" date,
  ADD COLUMN IF NOT EXISTS "delivery_address" text,
  ADD COLUMN IF NOT EXISTS "contact_name" text,
  ADD COLUMN IF NOT EXISTS "contact_email" varchar(320),
  ADD COLUMN IF NOT EXISTS "contact_phone" varchar(40),
  ADD COLUMN IF NOT EXISTS "subtotal_cents" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "discount_cents" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "freight_cents" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "valid_until" date,
  ADD COLUMN IF NOT EXISTS "payment_terms_text" text,
  ADD COLUMN IF NOT EXISTS "delivery_terms_text" text,
  ADD COLUMN IF NOT EXISTS "commercial_notes" text,
  ADD COLUMN IF NOT EXISTS "approved_at" timestamp;
--> statement-breakpoint

UPDATE "permupay_b2b_quotes"
SET "subtotal_cents" = "total_cents"
WHERE "subtotal_cents" = 0 AND "total_cents" <> 0;
--> statement-breakpoint

ALTER TABLE "permupay_b2b_quotes"
  DROP CONSTRAINT IF EXISTS "permupay_b2b_quote_subtotal_nonnegative";
--> statement-breakpoint
ALTER TABLE "permupay_b2b_quotes"
  ADD CONSTRAINT "permupay_b2b_quote_subtotal_nonnegative" CHECK ("subtotal_cents" >= 0);
--> statement-breakpoint
ALTER TABLE "permupay_b2b_quotes"
  DROP CONSTRAINT IF EXISTS "permupay_b2b_quote_discount_nonnegative";
--> statement-breakpoint
ALTER TABLE "permupay_b2b_quotes"
  ADD CONSTRAINT "permupay_b2b_quote_discount_nonnegative" CHECK ("discount_cents" >= 0);
--> statement-breakpoint
ALTER TABLE "permupay_b2b_quotes"
  DROP CONSTRAINT IF EXISTS "permupay_b2b_quote_freight_nonnegative";
--> statement-breakpoint
ALTER TABLE "permupay_b2b_quotes"
  ADD CONSTRAINT "permupay_b2b_quote_freight_nonnegative" CHECK ("freight_cents" >= 0);
--> statement-breakpoint

ALTER TABLE "permupay_b2b_quote_items"
  ADD COLUMN IF NOT EXISTS "catalog_unit_price_cents" integer,
  ADD COLUMN IF NOT EXISTS "quoted_unit_price_cents" integer,
  ADD COLUMN IF NOT EXISTS "quoted_total_cents" integer;
--> statement-breakpoint

UPDATE "permupay_b2b_quote_items"
SET
  "catalog_unit_price_cents" = COALESCE("catalog_unit_price_cents", "unit_price_cents"),
  "quoted_unit_price_cents" = COALESCE("quoted_unit_price_cents", "unit_price_cents"),
  "quoted_total_cents" = COALESCE("quoted_total_cents", "total_cents");
--> statement-breakpoint

ALTER TABLE "permupay_b2b_quote_items"
  ALTER COLUMN "catalog_unit_price_cents" SET DEFAULT 0,
  ALTER COLUMN "catalog_unit_price_cents" SET NOT NULL,
  ALTER COLUMN "quoted_unit_price_cents" SET DEFAULT 0,
  ALTER COLUMN "quoted_unit_price_cents" SET NOT NULL,
  ALTER COLUMN "quoted_total_cents" SET DEFAULT 0,
  ALTER COLUMN "quoted_total_cents" SET NOT NULL;
--> statement-breakpoint

ALTER TABLE "permupay_b2b_quote_items"
  DROP CONSTRAINT IF EXISTS "permupay_b2b_quote_catalog_price_nonnegative";
--> statement-breakpoint
ALTER TABLE "permupay_b2b_quote_items"
  ADD CONSTRAINT "permupay_b2b_quote_catalog_price_nonnegative" CHECK ("catalog_unit_price_cents" >= 0);
--> statement-breakpoint
ALTER TABLE "permupay_b2b_quote_items"
  DROP CONSTRAINT IF EXISTS "permupay_b2b_quote_quoted_price_nonnegative";
--> statement-breakpoint
ALTER TABLE "permupay_b2b_quote_items"
  ADD CONSTRAINT "permupay_b2b_quote_quoted_price_nonnegative" CHECK ("quoted_unit_price_cents" >= 0);
--> statement-breakpoint
ALTER TABLE "permupay_b2b_quote_items"
  DROP CONSTRAINT IF EXISTS "permupay_b2b_quote_quoted_total_nonnegative";
--> statement-breakpoint
ALTER TABLE "permupay_b2b_quote_items"
  ADD CONSTRAINT "permupay_b2b_quote_quoted_total_nonnegative" CHECK ("quoted_total_cents" >= 0);
