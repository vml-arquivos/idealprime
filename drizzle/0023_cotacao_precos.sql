-- ============================================================
-- Migration: 0023_cotacao_precos.sql
-- Módulo de Cotação de Preços — tabelas e índices
-- ============================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE permupay_cotacao_sessao_status AS ENUM (
    'em_andamento', 'concluida', 'cancelada'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE permupay_cotacao_sync_status AS ENUM (
    'local', 'pendente', 'sincronizado'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tabela: locais/comércios pesquisados
CREATE TABLE IF NOT EXISTS permupay_cotacao_locais (
  id                        SERIAL PRIMARY KEY,
  nome                      VARCHAR(200)    NOT NULL,
  endereco                  TEXT,
  lat                       DECIMAL(10, 8),
  lng                       DECIMAL(11, 8),
  foto_fachada              VARCHAR(500),
  tipo_comercio             VARCHAR(100),
  custo_operacional_padrao  DECIMAL(10, 2)  NOT NULL DEFAULT 0,
  usuario_id                INTEGER         NOT NULL REFERENCES permupay_users(id),
  ativo                     BOOLEAN         NOT NULL DEFAULT TRUE,
  created_at                TIMESTAMP       NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMP       NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cotacao_locais_usuario
  ON permupay_cotacao_locais(usuario_id);

CREATE INDEX IF NOT EXISTS idx_cotacao_locais_ativo
  ON permupay_cotacao_locais(ativo);

-- Tabela: sessões de cotação
CREATE TABLE IF NOT EXISTS permupay_cotacao_sessoes (
  id          SERIAL PRIMARY KEY,
  titulo      VARCHAR(200)                         NOT NULL,
  usuario_id  INTEGER                              NOT NULL REFERENCES permupay_users(id),
  status      permupay_cotacao_sessao_status        NOT NULL DEFAULT 'em_andamento',
  observacao  TEXT,
  created_at  TIMESTAMP                            NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP                            NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cotacao_sessoes_usuario
  ON permupay_cotacao_sessoes(usuario_id);

CREATE INDEX IF NOT EXISTS idx_cotacao_sessoes_status
  ON permupay_cotacao_sessoes(status);

-- Tabela: produtos em cada sessão
CREATE TABLE IF NOT EXISTS permupay_cotacao_sessao_prods (
  id          SERIAL PRIMARY KEY,
  sessao_id   INTEGER           NOT NULL REFERENCES permupay_cotacao_sessoes(id) ON DELETE CASCADE,
  produto_id  INTEGER           NOT NULL REFERENCES permupay_products(id),
  quantidade  DECIMAL(10, 3)    NOT NULL DEFAULT 1,
  unidade     VARCHAR(20)       DEFAULT 'un',
  obrigatorio BOOLEAN           NOT NULL DEFAULT FALSE,
  ordem       INTEGER           NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_cotacao_sessao_prods_sessao
  ON permupay_cotacao_sessao_prods(sessao_id);

CREATE INDEX IF NOT EXISTS idx_cotacao_sessao_prods_produto
  ON permupay_cotacao_sessao_prods(produto_id);

-- Tabela: preços coletados
CREATE TABLE IF NOT EXISTS permupay_cotacao_precos (
  id                SERIAL PRIMARY KEY,
  sessao_id         INTEGER                        NOT NULL REFERENCES permupay_cotacao_sessoes(id) ON DELETE CASCADE,
  sessao_produto_id INTEGER                        NOT NULL REFERENCES permupay_cotacao_sessao_prods(id) ON DELETE CASCADE,
  local_id          INTEGER                        NOT NULL REFERENCES permupay_cotacao_locais(id),
  preco_unitario    DECIMAL(10, 2),
  foto_preco        VARCHAR(500),
  encontrado        BOOLEAN                        NOT NULL DEFAULT TRUE,
  observacao        TEXT,
  uuid_local        VARCHAR(36),
  sync_status       permupay_cotacao_sync_status    NOT NULL DEFAULT 'sincronizado',
  created_at        TIMESTAMP                      NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP                      NOT NULL DEFAULT NOW()
);

-- Unicidade: um preço por produto/local/sessão
CREATE UNIQUE INDEX IF NOT EXISTS idx_cotacao_precos_unico
  ON permupay_cotacao_precos(sessao_produto_id, local_id);

-- Índices de performance para comparativo
CREATE INDEX IF NOT EXISTS idx_cotacao_precos_sessao
  ON permupay_cotacao_precos(sessao_id);

CREATE INDEX IF NOT EXISTS idx_cotacao_precos_local
  ON permupay_cotacao_precos(local_id);

CREATE INDEX IF NOT EXISTS idx_cotacao_precos_uuid
  ON permupay_cotacao_precos(uuid_local)
  WHERE uuid_local IS NOT NULL;
