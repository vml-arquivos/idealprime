-- Área do cliente (PF) — evolução comercial, Fase 4/6.
-- Reintroduz na tabela existente de clientes (permupay_customers) os campos
-- de ficha completa e de login próprio que existiam na base original
-- PermuPay Vendas e não foram portados quando o Ideal Prime foi derivado
-- dela (ver docs/ideal-prime/AUDITORIA_EVOLUCAO_COMERCIAL.md, seção 3).
-- Inteiramente aditivo: todas as colunas novas são nullable, sem DROP/TRUNCATE,
-- não altera nenhuma linha existente.

ALTER TABLE "permupay_customers"
  ADD COLUMN IF NOT EXISTS "cpf" text,
  ADD COLUMN IF NOT EXISTS "rg" text,
  ADD COLUMN IF NOT EXISTS "birth_date" date,
  ADD COLUMN IF NOT EXISTS "document_front_url" text,
  ADD COLUMN IF NOT EXISTS "document_back_url" text,
  ADD COLUMN IF NOT EXISTS "proof_address_url" text,
  ADD COLUMN IF NOT EXISTS "password_hash" text,
  ADD COLUMN IF NOT EXISTS "last_signed_in" timestamp;

-- Trilha de comunicações com o cliente ("conversas" na ficha do cliente).
CREATE TABLE IF NOT EXISTS "permupay_customer_communications" (
  "id" serial PRIMARY KEY,
  "customer_id" integer NOT NULL REFERENCES "permupay_customers"("id") ON DELETE CASCADE,
  "order_id" integer,
  "channel" text NOT NULL,
  "purpose" text NOT NULL,
  "target" text NOT NULL,
  "message_preview" text,
  "sent_by_user_id" integer,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "permupay_customer_communications_customer_idx"
  ON "permupay_customer_communications" ("customer_id", "created_at" DESC);
