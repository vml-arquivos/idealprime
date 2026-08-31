-- ============================================================
-- Migration: 0024_extend_cotacao_locais.sql
-- Expande a tabela permupay_cotacao_locais com novos campos
-- para armazenar informações detalhadas do comércio, conforme
-- requisitos da refatoração premium do módulo de cotações.
-- ============================================================

ALTER TABLE permupay_cotacao_locais
  ADD COLUMN IF NOT EXISTS cnpj VARCHAR(20),
  ADD COLUMN IF NOT EXISTS telefone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(20),
  ADD COLUMN IF NOT EXISTS cep VARCHAR(20),
  ADD COLUMN IF NOT EXISTS logradouro TEXT,
  ADD COLUMN IF NOT EXISTS numero VARCHAR(20),
  ADD COLUMN IF NOT EXISTS complemento VARCHAR(50),
  ADD COLUMN IF NOT EXISTS bairro VARCHAR(100),
  ADD COLUMN IF NOT EXISTS cidade VARCHAR(100),
  ADD COLUMN IF NOT EXISTS estado VARCHAR(2),
  ADD COLUMN IF NOT EXISTS referencia TEXT,
  ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500);