-- Migration: 0017_wishlist_products_categories
-- Refatora a lista de desejos:
--   1. Adiciona productIds (array de IDs de produtos desejados)
--   2. Adiciona phone (telefone normalizado — chave de identificação)
--   3. Adiciona notes_public (observação opcional do visitante)
--   4. Normaliza dados antigos: copia contact → phone onde contactType = WHATSAPP
--   5. Cria tabela de categorias dinâmicas permupay_categories
--   6. Seed idempotente das categorias padrão
--   7. Cria índices de busca por telefone

-- ── 1. Novas colunas na wishlist ──────────────────────────────────────────────
ALTER TABLE permupay_wishlist_requests
  ADD COLUMN IF NOT EXISTS product_ids  integer[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS phone        text,
  ADD COLUMN IF NOT EXISTS notes_public text;

-- Corrige constraint: description pode ser vazia em pedidos novos
ALTER TABLE permupay_wishlist_requests
  ALTER COLUMN description SET DEFAULT '';

-- ── 2. Normaliza phone a partir de contact legado ─────────────────────────────
UPDATE permupay_wishlist_requests
  SET phone = regexp_replace(contact, '[^0-9]', '', 'g')
  WHERE contact_type = 'WHATSAPP'
    AND phone IS NULL
    AND contact IS NOT NULL;

-- ── 3. Tabela de categorias dinâmicas ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS permupay_categories (
  id          serial       PRIMARY KEY,
  slug        text         NOT NULL UNIQUE,
  label       text         NOT NULL,
  emoji       text         NOT NULL DEFAULT '📦',
  sort_order  integer      NOT NULL DEFAULT 0,
  active      boolean      NOT NULL DEFAULT true,
  created_at  timestamp    NOT NULL DEFAULT now(),
  updated_at  timestamp    NOT NULL DEFAULT now()
);

-- Seed idempotente
INSERT INTO permupay_categories (slug, label, emoji, sort_order) VALUES
  ('CELULAR',    'Celulares',              '📱', 1),
  ('ELETRONICO', 'Eletrônicos',            '💻', 2),
  ('PERFUME',    'Perfumes & Fragrâncias', '🌸', 3),
  ('OUTRO',      'Outros',                 '📦', 4)
ON CONFLICT (slug) DO NOTHING;

-- ── 4. Índices ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_wishlist_phone   ON permupay_wishlist_requests(phone);
CREATE INDEX IF NOT EXISTS idx_wishlist_contact ON permupay_wishlist_requests(contact);
