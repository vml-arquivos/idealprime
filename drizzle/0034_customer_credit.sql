-- Análise de crédito do cliente (crediário/boleto) — evolução comercial,
-- pedida explicitamente sem distinção entre pessoa física e jurídica
-- ("deixe também a de crédito, pode deixar tudo, sem distinção"). Ver
-- docs/ideal-prime/AUDITORIA_EVOLUCAO_COMERCIAL.md.
-- Inteiramente aditivo: colunas novas nullable (ou com DEFAULT), sem
-- DROP/TRUNCATE, não altera nenhuma linha existente — cadastros já
-- existentes recebem credit_status = 'NAO_ANALISADO' automaticamente pelo
-- DEFAULT da coluna.

ALTER TABLE "permupay_customers"
  ADD COLUMN IF NOT EXISTS "credit_status" text NOT NULL DEFAULT 'NAO_ANALISADO',
  ADD COLUMN IF NOT EXISTS "credit_notes" text,
  ADD COLUMN IF NOT EXISTS "credit_limit" real,
  ADD COLUMN IF NOT EXISTS "reviewed_by" integer,
  ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp;

-- Histórico de mudanças de status de crédito — uma linha por análise, exibido
-- na aba "Crédito" da ficha do cliente.
CREATE TABLE IF NOT EXISTS "permupay_credit_status_history" (
  "id" serial PRIMARY KEY,
  "customer_id" integer NOT NULL REFERENCES "permupay_customers"("id") ON DELETE CASCADE,
  "previous_status" text,
  "new_status" text NOT NULL,
  "notes" text,
  "credit_limit" real,
  "changed_by_user_id" integer,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "permupay_credit_status_history_customer_idx"
  ON "permupay_credit_status_history" ("customer_id", "created_at" DESC);
