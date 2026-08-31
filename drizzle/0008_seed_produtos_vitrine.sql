-- Migration: 0008_seed_produtos_vitrine
-- Insere produtos de demonstração publicados na vitrine (perfumes e eletrônicos)
-- Só insere se não houver produtos publicados (evita duplicar em redeploys)

DO $$
DECLARE
  v_user_id integer;
BEGIN
  -- Busca o primeiro usuário admin/user ativo
  SELECT id INTO v_user_id FROM permupay_users WHERE active = true ORDER BY id LIMIT 1;

  -- Só insere se não houver produtos publicados
  IF (SELECT COUNT(*) FROM permupay_products WHERE published = true) = 0 AND v_user_id IS NOT NULL THEN

    -- ── Perfumes ──────────────────────────────────────────────────────────────
    INSERT INTO permupay_products (
      user_id, name, category, short_description, description,
      suggested_price, suggested_price_pix, suggested_price_card, suggested_price_boleto,
      payment_platform, promo_tag, published, active,
      stock_quantity, minimum_stock, cost_price, final_unit_cost_brl,
      image_url, created_at, updated_at
    ) VALUES
    (
      v_user_id,
      'Perfume Importado 212 NYC Men',
      'PERFUME',
      'Fragrância masculina sofisticada com notas de madeira e especiarias.',
      'O 212 NYC Men é um clássico da Carolina Herrera. Notas de topo: bergamota e gengibre. Notas de coração: madeira de cedro. Notas de base: almíscar branco. Ideal para o homem moderno e urbano. Volume: 100ml.',
      349.90, 329.90, 349.90, 359.90,
      'MERCADO_PAGO', 'MAIS VENDIDO', true, true,
      15, 3, 180.00, 210.00,
      'https://images.unsplash.com/photo-1541643600914-78b084683702?w=600&q=80',
      now(), now()
    ),
    (
      v_user_id,
      'Perfume La Vie Est Belle Lancôme',
      'PERFUME',
      'Fragrância feminina floral e adocicada, símbolo de felicidade.',
      'La Vie Est Belle é um ícone da perfumaria feminina. Notas de topo: groselha preta e pera. Notas de coração: íris, jasmim e flor de laranjeira. Notas de base: pralinê, baunilha e patchouli. Volume: 75ml.',
      429.90, 409.90, 429.90, 439.90,
      'MERCADO_PAGO', 'PROMOÇÃO', true, true,
      10, 2, 220.00, 260.00,
      'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=600&q=80',
      now(), now()
    ),
    (
      v_user_id,
      'Perfume Sauvage Dior EDP',
      'PERFUME',
      'Fragrância masculina selvagem e elegante com bergamota e ambroxan.',
      'Sauvage Dior é uma das fragrâncias masculinas mais icônicas do mundo. Notas de topo: bergamota de Calábria. Notas de coração: pimenta de Sichuan e lavanda. Notas de base: ambroxan e cedro. Volume: 100ml EDP.',
      589.90, 559.90, 589.90, 599.90,
      'MERCADO_PAGO', 'LANÇAMENTO', true, true,
      8, 2, 310.00, 365.00,
      'https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=600&q=80',
      now(), now()
    ),
    (
      v_user_id,
      'Perfume Good Girl Carolina Herrera',
      'PERFUME',
      'Fragrância feminina sedutora em frasco icônico de stiletto.',
      'Good Girl é ousado, feminino e sedutor. Notas de topo: amêndoa torrada e café. Notas de coração: tuberosa e jasmim sambac. Notas de base: tonka, cacau e baunilha. Volume: 80ml EDP.',
      479.90, 459.90, 479.90, 489.90,
      'MERCADO_PAGO', NULL, true, true,
      12, 2, 245.00, 290.00,
      'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=600&q=80',
      now(), now()
    ),

    -- ── Eletrônicos ───────────────────────────────────────────────────────────
    (
      v_user_id,
      'Fone Bluetooth JBL Tune 520BT',
      'ELETRONICO',
      'Fone de ouvido sem fio com 57h de bateria e som Pure Bass.',
      'O JBL Tune 520BT oferece o som Pure Bass que você ama, agora com 57 horas de bateria. Conexão Bluetooth 5.3, dobrável e leve. Compatível com assistentes de voz. Carregamento rápido: 5 minutos = 3 horas de música.',
      299.90, 279.90, 299.90, 309.90,
      'MERCADO_PAGO', 'OFERTA', true, true,
      20, 5, 155.00, 185.00,
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80',
      now(), now()
    ),
    (
      v_user_id,
      'Smartwatch Samsung Galaxy Watch 6',
      'ELETRONICO',
      'Relógio inteligente com monitoramento avançado de saúde e GPS.',
      'Galaxy Watch 6 com tela Super AMOLED de 1,3". Monitora frequência cardíaca, oxigênio no sangue, sono e estresse. GPS integrado, resistente à água (5ATM). Bateria de 40h. Compatível com Android.',
      1.299, 1.239, 1.299, 1.319,
      'MERCADO_PAGO', 'NOVO', true, true,
      6, 2, 680.00, 800.00,
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80',
      now(), now()
    ),
    (
      v_user_id,
      'Caixa de Som JBL Charge 5',
      'ELETRONICO',
      'Caixa portátil à prova d''água com 20h de bateria e Power Bank.',
      'JBL Charge 5 com som potente e graves profundos. Resistente à água e poeira (IP67). Bateria de 20 horas. Função Power Bank para carregar seus dispositivos. Conexão Bluetooth 5.1. Ideal para festas e aventuras.',
      799.90, 759.90, 799.90, 819.90,
      'MERCADO_PAGO', 'MAIS VENDIDO', true, true,
      9, 2, 415.00, 490.00,
      'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&q=80',
      now(), now()
    ),
    (
      v_user_id,
      'Carregador Turbo 65W GaN USB-C',
      'ELETRONICO',
      'Carregador compacto GaN 65W com 3 portas para carregar tudo ao mesmo tempo.',
      'Tecnologia GaN (Nitreto de Gálio) para máxima eficiência e tamanho reduzido. 65W total: 1x USB-C PD 65W + 1x USB-C 20W + 1x USB-A 18W. Compatível com notebooks, tablets e smartphones. Proteção contra sobrecarga.',
      189.90, 179.90, 189.90, 194.90,
      'MERCADO_PAGO', NULL, true, true,
      25, 5, 95.00, 115.00,
      'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600&q=80',
      now(), now()
    );

  END IF;
END $$;
