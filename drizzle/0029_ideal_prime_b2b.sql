ALTER TABLE "permupay_users" ADD COLUMN IF NOT EXISTS "account_type" text NOT NULL DEFAULT 'STAFF';
--> statement-breakpoint
ALTER TABLE "permupay_products" ADD COLUMN IF NOT EXISTS "sku" varchar(80);
--> statement-breakpoint
ALTER TABLE "permupay_products" ADD COLUMN IF NOT EXISTS "unit" varchar(20) NOT NULL DEFAULT 'UN';
--> statement-breakpoint
ALTER TABLE "permupay_products" ADD COLUMN IF NOT EXISTS "sales_multiple" integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE "permupay_products" ADD COLUMN IF NOT EXISTS "b2b_enabled" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "permupay_products_sku_unique" ON "permupay_products" (upper(trim("sku"))) WHERE "sku" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "permupay_business_accounts" (
  "id" serial PRIMARY KEY,
  "legal_name" text NOT NULL,
  "trade_name" text,
  "cnpj" varchar(18) NOT NULL UNIQUE,
  "email" varchar(320) NOT NULL,
  "phone" varchar(40),
  "status" varchar(20) NOT NULL DEFAULT 'PENDING',
  "assigned_price_list_id" integer,
  "account_manager_user_id" integer REFERENCES "permupay_users"("id") ON DELETE SET NULL,
  "payment_terms" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "min_order_cents" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "permupay_business_status_check" CHECK ("status" IN ('PENDING','APPROVED','SUSPENDED'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "permupay_business_memberships" (
  "id" serial PRIMARY KEY,
  "business_account_id" integer NOT NULL REFERENCES "permupay_business_accounts"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "permupay_users"("id") ON DELETE CASCADE,
  "role" varchar(20) NOT NULL DEFAULT 'BUYER',
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "permupay_business_membership_role_check" CHECK ("role" IN ('MANAGER','BUYER')),
  CONSTRAINT "permupay_business_membership_unique" UNIQUE ("business_account_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "permupay_price_lists" (
  "id" serial PRIMARY KEY,
  "name" text NOT NULL,
  "is_default" boolean NOT NULL DEFAULT false,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "permupay_one_default_price_list" ON "permupay_price_lists" ((1)) WHERE "is_default" = true AND "active" = true;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "permupay_price_list_versions" (
  "id" serial PRIMARY KEY,
  "price_list_id" integer NOT NULL REFERENCES "permupay_price_lists"("id") ON DELETE CASCADE,
  "version" integer NOT NULL,
  "effective_from" timestamp NOT NULL DEFAULT now(),
  "created_by" integer REFERENCES "permupay_users"("id") ON DELETE SET NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "permupay_price_list_version_unique" UNIQUE ("price_list_id","version")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "permupay_price_list_items" (
  "id" serial PRIMARY KEY,
  "version_id" integer NOT NULL REFERENCES "permupay_price_list_versions"("id") ON DELETE CASCADE,
  "product_id" integer NOT NULL REFERENCES "permupay_products"("id") ON DELETE CASCADE,
  "price_cents" integer NOT NULL,
  "active" boolean NOT NULL DEFAULT true,
  CONSTRAINT "permupay_price_item_positive" CHECK ("price_cents" >= 0),
  CONSTRAINT "permupay_price_item_unique" UNIQUE ("version_id","product_id")
);
--> statement-breakpoint
ALTER TABLE "permupay_business_accounts" DROP CONSTRAINT IF EXISTS "permupay_business_price_list_fk";
--> statement-breakpoint
ALTER TABLE "permupay_business_accounts" ADD CONSTRAINT "permupay_business_price_list_fk" FOREIGN KEY ("assigned_price_list_id") REFERENCES "permupay_price_lists"("id") ON DELETE SET NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "permupay_b2b_orders" (
  "id" serial PRIMARY KEY,
  "order_number" varchar(40) NOT NULL UNIQUE,
  "business_account_id" integer NOT NULL REFERENCES "permupay_business_accounts"("id"),
  "buyer_user_id" integer NOT NULL REFERENCES "permupay_users"("id"),
  "price_list_version_id" integer REFERENCES "permupay_price_list_versions"("id"),
  "idempotency_key" varchar(120) NOT NULL,
  "commercial_status" varchar(30) NOT NULL DEFAULT 'ENVIADO',
  "payment_status" varchar(30) NOT NULL DEFAULT 'PENDENTE',
  "fulfillment_status" varchar(40) NOT NULL DEFAULT 'AGUARDANDO_SEPARACAO',
  "payment_method" varchar(30),
  "total_cents" integer NOT NULL,
  "delivery_snapshot" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "terms_snapshot" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "assigned_to_user_id" integer REFERENCES "permupay_users"("id") ON DELETE SET NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "permupay_b2b_idempotency_unique" UNIQUE ("business_account_id","idempotency_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "permupay_b2b_order_items" (
  "id" serial PRIMARY KEY,
  "order_id" integer NOT NULL REFERENCES "permupay_b2b_orders"("id") ON DELETE CASCADE,
  "product_id" integer NOT NULL REFERENCES "permupay_products"("id"),
  "sku_snapshot" varchar(80) NOT NULL,
  "name_snapshot" text NOT NULL,
  "unit_snapshot" varchar(20) NOT NULL,
  "quantity" integer NOT NULL,
  "unit_price_cents" integer NOT NULL,
  "total_cents" integer NOT NULL,
  CONSTRAINT "permupay_b2b_item_qty_positive" CHECK ("quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "permupay_b2b_stock_reservations" (
  "id" serial PRIMARY KEY,
  "order_id" integer NOT NULL REFERENCES "permupay_b2b_orders"("id") ON DELETE CASCADE,
  "order_item_id" integer NOT NULL REFERENCES "permupay_b2b_order_items"("id") ON DELETE CASCADE,
  "product_id" integer NOT NULL REFERENCES "permupay_products"("id"),
  "quantity" integer NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
  "expires_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "permupay_b2b_reservation_status_check" CHECK ("status" IN ('ACTIVE','CONSUMED','RELEASED','EXPIRED'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permupay_b2b_reservations_product_active" ON "permupay_b2b_stock_reservations" ("product_id") WHERE "status" = 'ACTIVE';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "permupay_b2b_notifications" (
  "id" serial PRIMARY KEY,
  "user_id" integer REFERENCES "permupay_users"("id") ON DELETE CASCADE,
  "order_id" integer REFERENCES "permupay_b2b_orders"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "read_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "permupay_import_jobs" (
  "id" serial PRIMARY KEY,
  "content_hash" varchar(64) NOT NULL,
  "profile_key" varchar(120) NOT NULL,
  "mode" varchar(20) NOT NULL,
  "price_list_id" integer REFERENCES "permupay_price_lists"("id") ON DELETE SET NULL,
  "reference_at" timestamp,
  "actor_user_id" integer REFERENCES "permupay_users"("id") ON DELETE SET NULL,
  "status" varchar(20) NOT NULL,
  "summary" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "completed_at" timestamp,
  CONSTRAINT "permupay_import_mode_check" CHECK ("mode" IN ('PRICES','INVENTORY')),
  CONSTRAINT "permupay_import_idempotency" UNIQUE ("content_hash","profile_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "permupay_import_rows" (
  "id" serial PRIMARY KEY,
  "job_id" integer NOT NULL REFERENCES "permupay_import_jobs"("id") ON DELETE CASCADE,
  "row_number" integer NOT NULL,
  "sku" varchar(80),
  "status" varchar(20) NOT NULL,
  "before_data" jsonb,
  "after_data" jsonb,
  "errors" jsonb NOT NULL DEFAULT '[]'::jsonb
);
