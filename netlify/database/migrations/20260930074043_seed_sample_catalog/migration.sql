-- Sample catalog so the storefront isn't empty on first launch. Edit or delete these from /admin.
INSERT INTO "categories" ("name", "sort_order") VALUES
  ('Bridal', 1),
  ('Sarees', 2),
  ('Kurta Sets', 3),
  ('Western', 4);
--> statement-breakpoint
INSERT INTO "items" ("name", "category_id", "price", "description", "sizes", "colors", "images", "featured") VALUES
  ('Blush Zari Bridal Lehenga', (SELECT id FROM categories WHERE name = 'Bridal'), 85000, 'Hand-embroidered net lehenga with gold zari and sequin work, paired with a scalloped dupatta. Made to measure for your big day.', '{"Custom"}', '{"Blush Pink","Ivory Gold"}', '{"/img/item-lehenga.jpg"}', true),
  ('Emerald Banarasi Silk Saree', (SELECT id FROM categories WHERE name = 'Sarees'), 24500, 'Pure silk saree with a woven gold border and rich pallu. Comes with an unstitched blouse piece.', '{"Free Size"}', '{"Emerald","Wine"}', '{"/img/item-saree.jpg"}', true),
  ('Mint Chiffon Kurta Set', (SELECT id FROM categories WHERE name = 'Kurta Sets'), 6800, 'Breathable cotton kurta with palazzo pants and a soft chiffon dupatta — easy elegance for day events.', '{"S","M","L","XL"}', '{"Mint","Peach"}', '{"/img/item-kurta.jpg"}', false),
  ('Navy Silver Anarkali', (SELECT id FROM categories WHERE name = 'Kurta Sets'), 14200, 'Floor-length flared anarkali with fine silver threadwork. A festive favourite.', '{"S","M","L","XL"}', '{"Navy","Black"}', '{"/img/item-anarkali.jpg"}', true),
  ('Maroon Velvet Evening Gown', (SELECT id FROM categories WHERE name = 'Western'), 18900, 'Plush velvet gown with a subtle sequin shimmer, cut for a graceful silhouette.', '{"S","M","L"}', '{"Maroon","Midnight"}', '{"/img/item-gown.jpg"}', false),
  ('Beige Linen Co-ord Set', (SELECT id FROM categories WHERE name = 'Western'), 5400, 'Relaxed linen shirt and trouser set — modern, minimal and made for everyday comfort.', '{"S","M","L","XL"}', '{"Beige","Olive"}', '{"/img/item-coord.jpg"}', false);
--> statement-breakpoint
INSERT INTO "settings" ("key", "value") VALUES ('whatsapp', '9779709034988')
  ON CONFLICT ("key") DO NOTHING;
