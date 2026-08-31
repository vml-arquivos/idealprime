-- Migration: 0006_lista_desejos
-- Cria tabela de lista de desejos dos visitantes

-- Enum de status do desejo
DO $$ BEGIN
  CREATE TYPE permupay_wishlist_status AS ENUM (
    'NOVO',
    'VISUALIZADO',
    'CONTATADO',
    'ATENDIDO',
    'FECHADO'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Tabela principal
CREATE TABLE IF NOT EXISTS permupay_wishlist_requests (
  id                serial          PRIMARY KEY,

  -- Identidade do solicitante
  visitor_name      text            NOT NULL,
  contact           text            NOT NULL,          -- WhatsApp (55+DDD+número) ou email
  contact_type      text            NOT NULL DEFAULT 'WHATSAPP',  -- 'WHATSAPP' | 'EMAIL'

  -- O que procura
  category          text,                               -- mesmo enum de produtos: CELULAR, ELETRONICO, PERFUME, OUTRO
  brand             text,                               -- ex: Samsung, Apple, Carolina Herrera
  model             text,                               -- ex: Galaxy S24, iPhone 15 Pro
  description       text            NOT NULL,           -- descrição livre do que deseja

  -- Faixa de orçamento
  budget_min        real            NOT NULL DEFAULT 0,
  budget_max        real            NOT NULL DEFAULT 0,

  -- Gestão pelo admin
  status            permupay_wishlist_status NOT NULL DEFAULT 'NOVO',
  admin_notes       text,                               -- anotações internas do operador
  attended_by       integer         REFERENCES permupay_users(id) ON DELETE SET NULL,

  -- Controle
  is_anonymous      boolean         NOT NULL DEFAULT false,
  ip_hash           text,                               -- hash do IP para deduplicação básica (não expor)
  created_at        timestamp       NOT NULL DEFAULT now(),
  updated_at        timestamp       NOT NULL DEFAULT now()
);

-- Índices via DO block — ignora silenciosamente se já existir (42P07)
DO $$ BEGIN
  CREATE INDEX idx_wishlist_status ON permupay_wishlist_requests(status);
EXCEPTION WHEN sqlstate '42P07' THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX idx_wishlist_category ON permupay_wishlist_requests(category);
EXCEPTION WHEN sqlstate '42P07' THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX idx_wishlist_created ON permupay_wishlist_requests(created_at DESC);
EXCEPTION WHEN sqlstate '42P07' THEN NULL;
END $$;
