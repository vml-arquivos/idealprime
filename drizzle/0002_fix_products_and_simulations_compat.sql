DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'permupay_margin_mode') THEN
    CREATE TYPE "public"."permupay_margin_mode" AS ENUM('PERCENT', 'VALUE');
  END IF;
END $$;

ALTER TABLE IF EXISTS "permupay_products" ADD COLUMN IF NOT EXISTS "desired_margin_value" real DEFAULT 0 NOT NULL;
ALTER TABLE IF EXISTS "permupay_products" ADD COLUMN IF NOT EXISTS "margin_mode" "permupay_margin_mode" DEFAULT 'PERCENT' NOT NULL;
ALTER TABLE IF EXISTS "permupay_products" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE IF EXISTS "permupay_products" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;

ALTER TABLE IF EXISTS "permupay_pricing_simulations" ADD COLUMN IF NOT EXISTS "user_id" integer;
ALTER TABLE IF EXISTS "permupay_pricing_simulations" ADD COLUMN IF NOT EXISTS "product_id" integer;
ALTER TABLE IF EXISTS "permupay_pricing_simulations" ADD COLUMN IF NOT EXISTS "payment_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE IF EXISTS "permupay_pricing_simulations" ADD COLUMN IF NOT EXISTS "result_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE IF EXISTS "permupay_pricing_simulations" ADD COLUMN IF NOT EXISTS "recommended_price" real DEFAULT 0 NOT NULL;
ALTER TABLE IF EXISTS "permupay_pricing_simulations" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE IF EXISTS "permupay_pricing_simulations" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
