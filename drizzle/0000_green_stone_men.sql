-- PermuPay Vendas — Migration inicial
-- Usa IF NOT EXISTS para ser segura em banco compartilhado (rifas)

DO $$ BEGIN
  CREATE TYPE "public"."permupay_role" AS ENUM('user', 'admin');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "permupay_users" (
"id" serial PRIMARY KEY NOT NULL,
"email" varchar(320) NOT NULL,
"name" text NOT NULL,
"passwordHash" text NOT NULL,
"role" "public"."permupay_role" DEFAULT 'user' NOT NULL,
"active" boolean DEFAULT true NOT NULL,
"createdAt" timestamp DEFAULT now() NOT NULL,
"updatedAt" timestamp DEFAULT now() NOT NULL,
"lastSignedIn" timestamp DEFAULT now() NOT NULL,
CONSTRAINT "permupay_users_email_unique" UNIQUE("email")
);
