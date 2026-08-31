-- 0022_fix_orders_product_fk.sql
-- Corrige a FK de permupay_orders.product_id que foi criada com ON DELETE RESTRICT.
-- Isso bloqueava a exclusão de produtos que tinham pedidos vinculados (erro 500).
-- Solução: remover a constraint, mantendo apenas o índice para performance.
-- O histórico dos pedidos é preservado (product_id fica como inteiro simples).

DO $$
DECLARE
  v_constraint TEXT;
BEGIN
  -- Descobre o nome exato da constraint (pode variar conforme o Postgres gerou)
  SELECT conname INTO v_constraint
  FROM pg_constraint
  WHERE conrelid = 'permupay_orders'::regclass
    AND contype = 'f'
    AND conkey = ARRAY[
      (SELECT attnum FROM pg_attribute
       WHERE attrelid = 'permupay_orders'::regclass
         AND attname = 'product_id')
    ]::smallint[];

  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE permupay_orders DROP CONSTRAINT %I', v_constraint);
    RAISE NOTICE '[0022] Constraint % removida de permupay_orders.product_id', v_constraint;
  ELSE
    RAISE NOTICE '[0022] Nenhuma FK encontrada em permupay_orders.product_id — nada a fazer';
  END IF;
END $$;
