-- Módulo de Nota Fiscal Eletrônica (NF-e/NFC-e) — arquitetura pronta para receber
-- qualquer provedor de emissão (ver docs/ideal-prime/NFE_INTEGRACAO.md). Nenhuma
-- integração real está configurada nesta rodada; apenas o banco, as rotas e a interface
-- de preparação foram criados. Aditivo, sem DROP/TRUNCATE.

CREATE TABLE IF NOT EXISTS "permupay_fiscal_settings" (
  "id" serial PRIMARY KEY,
  "provider" varchar(30) NOT NULL DEFAULT 'NONE',
  "environment" varchar(20) NOT NULL DEFAULT 'HOMOLOGACAO',
  "issuer_legal_name" text,
  "issuer_cnpj" varchar(14),
  "issuer_state_registration" varchar(20),
  "issuer_tax_regime" varchar(30) NOT NULL DEFAULT 'SIMPLES_NACIONAL',
  "issuer_city" text,
  "issuer_state" varchar(2),
  "default_cfop" varchar(4),
  "default_ncm" varchar(8),
  "api_credentials_configured" boolean NOT NULL DEFAULT false,
  "notes" text,
  "updated_by" integer REFERENCES "permupay_users"("id") ON DELETE SET NULL,
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "permupay_fiscal_settings_provider_check" CHECK ("provider" IN ('NONE','MOCK','FOCUS_NFE','PLUGNOTAS','ENOTAS','NFEIO','CUSTOM')),
  CONSTRAINT "permupay_fiscal_settings_env_check" CHECK ("environment" IN ('HOMOLOGACAO','PRODUCAO'))
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "permupay_invoices" (
  "id" serial PRIMARY KEY,
  "order_type" varchar(10) NOT NULL,
  "retail_order_id" integer REFERENCES "permupay_orders"("id") ON DELETE RESTRICT,
  "b2b_order_id" integer REFERENCES "permupay_b2b_orders"("id") ON DELETE RESTRICT,
  "model" varchar(4) NOT NULL DEFAULT 'NFE',
  "series" varchar(10),
  "number" varchar(20),
  "access_key" varchar(44),
  "status" varchar(20) NOT NULL DEFAULT 'DRAFT',
  "provider_name" varchar(30) NOT NULL DEFAULT 'NONE',
  "provider_reference" text,
  "xml_url" text,
  "danfe_url" text,
  "total_cents" integer NOT NULL,
  "payload_snapshot" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "error_message" text,
  "created_by" integer REFERENCES "permupay_users"("id") ON DELETE SET NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "authorized_at" timestamp,
  "cancelled_at" timestamp,
  "cancel_reason" text,
  CONSTRAINT "permupay_invoice_order_type_check" CHECK ("order_type" IN ('RETAIL','B2B')),
  CONSTRAINT "permupay_invoice_order_ref_check" CHECK (
    ("order_type" = 'RETAIL' AND "retail_order_id" IS NOT NULL AND "b2b_order_id" IS NULL)
    OR ("order_type" = 'B2B' AND "b2b_order_id" IS NOT NULL AND "retail_order_id" IS NULL)
  ),
  CONSTRAINT "permupay_invoice_model_check" CHECK ("model" IN ('NFE','NFCE')),
  CONSTRAINT "permupay_invoice_status_check" CHECK ("status" IN ('DRAFT','PENDING_PROVIDER','PROCESSING','AUTHORIZED','REJECTED','CANCELLED','ERROR')),
  CONSTRAINT "permupay_invoice_access_key_format_check" CHECK ("access_key" IS NULL OR "access_key" ~ '^[0-9]{44}$')
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "permupay_invoice_access_key_unique" ON "permupay_invoices" ("access_key") WHERE "access_key" IS NOT NULL;
--> statement-breakpoint

-- Só pode haver uma nota "ativa" (linha ainda não cancelada) por pedido. Rejeição e
-- erro são retentados na MESMA linha; só depois de CANCELLED é permitido abrir uma
-- nova linha para o mesmo pedido (ciclo de vida real de uma NF-e).
CREATE UNIQUE INDEX IF NOT EXISTS "permupay_invoice_active_retail_unique" ON "permupay_invoices" ("retail_order_id") WHERE "retail_order_id" IS NOT NULL AND "status" <> 'CANCELLED';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "permupay_invoice_active_b2b_unique" ON "permupay_invoices" ("b2b_order_id") WHERE "b2b_order_id" IS NOT NULL AND "status" <> 'CANCELLED';
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "permupay_invoice_status_idx" ON "permupay_invoices" ("status");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "permupay_invoice_events" (
  "id" serial PRIMARY KEY,
  "invoice_id" integer NOT NULL REFERENCES "permupay_invoices"("id") ON DELETE CASCADE,
  "event_type" varchar(30) NOT NULL,
  "message" text,
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_by" integer REFERENCES "permupay_users"("id") ON DELETE SET NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "permupay_invoice_events_invoice_idx" ON "permupay_invoice_events" ("invoice_id","created_at");
