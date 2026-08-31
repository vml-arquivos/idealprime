ALTER TABLE "permupay_users"
  ADD COLUMN IF NOT EXISTS "permissions" jsonb NOT NULL DEFAULT '[]'::jsonb;
--> statement-breakpoint
UPDATE "permupay_users"
SET "permissions" = CASE
  WHEN "account_type" = 'BUYER' THEN '["b2b.catalog","b2b.quotes","b2b.orders","b2b.order_history"]'::jsonb
  ELSE '["dashboard","products","inventory","pricing","sales","reports","b2b.operations","b2b.catalog","b2b.quotes","b2b.orders","b2b.order_history","users","settings"]'::jsonb
END
WHERE "permissions" = '[]'::jsonb;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "permupay_b2b_quotes" (
  "id" serial PRIMARY KEY,
  "quote_number" varchar(40) NOT NULL UNIQUE,
  "business_account_id" integer NOT NULL REFERENCES "permupay_business_accounts"("id") ON DELETE CASCADE,
  "buyer_user_id" integer NOT NULL REFERENCES "permupay_users"("id") ON DELETE RESTRICT,
  "price_list_version_id" integer REFERENCES "permupay_price_list_versions"("id") ON DELETE SET NULL,
  "status" varchar(20) NOT NULL DEFAULT 'PENDING',
  "notes" text,
  "total_cents" integer NOT NULL DEFAULT 0,
  "idempotency_key" varchar(120) NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "permupay_b2b_quote_status_check" CHECK ("status" IN ('PENDING','APPROVED','REJECTED','CONVERTED','CANCELLED')),
  CONSTRAINT "permupay_b2b_quote_idempotency_unique" UNIQUE ("business_account_id","idempotency_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "permupay_b2b_quote_items" (
  "id" serial PRIMARY KEY,
  "quote_id" integer NOT NULL REFERENCES "permupay_b2b_quotes"("id") ON DELETE CASCADE,
  "product_id" integer NOT NULL REFERENCES "permupay_products"("id") ON DELETE RESTRICT,
  "sku_snapshot" varchar(80) NOT NULL,
  "name_snapshot" text NOT NULL,
  "unit_snapshot" varchar(20) NOT NULL,
  "quantity" integer NOT NULL,
  "unit_price_cents" integer NOT NULL,
  "total_cents" integer NOT NULL,
  CONSTRAINT "permupay_b2b_quote_item_qty_positive" CHECK ("quantity" > 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permupay_b2b_quotes_business_created" ON "permupay_b2b_quotes" ("business_account_id","created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permupay_b2b_quotes_status" ON "permupay_b2b_quotes" ("status");
