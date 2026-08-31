-- Migration segura e idempotente para permupay-vendas
-- Garante a criação de enums e tabelas sem quebrar se já existirem

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'permupay_product_category') THEN
        CREATE TYPE "public"."permupay_product_category" AS ENUM('CELULAR', 'ELETRONICO', 'PERFUME', 'OUTRO');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'permupay_tax_regime') THEN
        CREATE TYPE "public"."permupay_tax_regime" AS ENUM('SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL', 'MANUAL');
    END IF;

    -- Renomeia o enum 'role' para 'permupay_role' se ele existir com o nome antigo
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role') AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'permupay_role') THEN
        ALTER TYPE "public"."role" RENAME TO "permupay_role";
    ELSIF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'permupay_role') THEN
        CREATE TYPE "public"."permupay_role" AS ENUM('user', 'admin');
    END IF;
END $$;

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "permupay_products" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer,
    "name" text NOT NULL,
    "category" "permupay_product_category" NOT NULL,
    "ncm" text,
    "cost_price" real DEFAULT 0 NOT NULL,
    "packaging_cost" real DEFAULT 0 NOT NULL,
    "inbound_shipping_cost" real DEFAULT 0 NOT NULL,
    "operational_cost" real DEFAULT 0 NOT NULL,
    "desired_margin_rate" real DEFAULT 0 NOT NULL,
    "tax_regime" "permupay_tax_regime" DEFAULT 'SIMPLES_NACIONAL' NOT NULL,
    "estimated_tax_rate" real DEFAULT 0 NOT NULL,
    "notes" text,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "permupay_pricing_simulations" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer,
    "product_id" integer,
    "name" text NOT NULL,
    "product_snapshot" jsonb NOT NULL,
    "tax_snapshot" jsonb NOT NULL,
    "payment_snapshot" jsonb NOT NULL,
    "result_snapshot" jsonb NOT NULL,
    "best_payment_method" text NOT NULL,
    "worst_payment_method" text NOT NULL,
    "recommended_price" real NOT NULL,
    "minimum_break_even_price" real NOT NULL,
    "promotion_floor_price" real NOT NULL,
    "desired_margin_rate" real NOT NULL,
    "diagnosis" text NOT NULL,
    "notes" text,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint

-- Adiciona constraints apenas se não existirem
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'permupay_products_user_id_permupay_users_id_fk') THEN
        ALTER TABLE "permupay_products" ADD CONSTRAINT "permupay_products_user_id_permupay_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."permupay_users"("id") ON DELETE no action ON UPDATE no action;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'permupay_pricing_simulations_user_id_permupay_users_id_fk') THEN
        ALTER TABLE "permupay_pricing_simulations" ADD CONSTRAINT "permupay_pricing_simulations_user_id_permupay_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."permupay_users"("id") ON DELETE no action ON UPDATE no action;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'permupay_pricing_simulations_product_id_permupay_products_id_fk') THEN
        ALTER TABLE "permupay_pricing_simulations" ADD CONSTRAINT "permupay_pricing_simulations_product_id_permupay_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."permupay_products"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;
