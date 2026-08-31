CREATE TABLE IF NOT EXISTS permupay_product_images (
  id            serial        PRIMARY KEY,
  product_id    integer       NOT NULL REFERENCES permupay_products(id) ON DELETE CASCADE,
  url           text          NOT NULL,
  storage_key   text,
  is_thumbnail  boolean       NOT NULL DEFAULT false,
  sort_order    integer       NOT NULL DEFAULT 0,
  alt_text      text,
  created_at    timestamp     NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON permupay_product_images(product_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_product_images_thumbnail ON permupay_product_images(product_id, is_thumbnail);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION ensure_single_thumbnail()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_thumbnail = true THEN
    UPDATE permupay_product_images
    SET is_thumbnail = false
    WHERE product_id = NEW.product_id AND id <> NEW.id AND is_thumbnail = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_single_thumbnail ON permupay_product_images;
--> statement-breakpoint
CREATE TRIGGER trg_single_thumbnail
  AFTER INSERT OR UPDATE OF is_thumbnail ON permupay_product_images
  FOR EACH ROW EXECUTE FUNCTION ensure_single_thumbnail();
