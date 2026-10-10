-- Fill product details for the bundled sample pieces, using only facts already stated in their descriptions.
-- Skips any piece the owner has renamed or already given details.
UPDATE "items" SET "fabric" = 'Net', "pattern" = 'Zari & sequin embroidery', "set_contents" = 'Lehenga & dupatta', "fit" = 'Made to measure', "occasions" = '{"Wedding"}'
  WHERE "name" = 'Blush Zari Bridal Lehenga' AND "fabric" = '' AND "occasions" = '{}';
--> statement-breakpoint
UPDATE "items" SET "fabric" = 'Banarasi silk', "pattern" = 'Woven zari border', "set_contents" = 'Saree & unstitched blouse piece', "occasions" = '{"Festive","Wedding"}'
  WHERE "name" = 'Emerald Banarasi Silk Saree' AND "fabric" = '' AND "occasions" = '{}';
--> statement-breakpoint
UPDATE "items" SET "fabric" = 'Cotton & chiffon', "set_contents" = 'Kurta, palazzo & dupatta', "occasions" = '{"Casual"}'
  WHERE "name" = 'Mint Chiffon Kurta Set' AND "fabric" = '' AND "occasions" = '{}';
--> statement-breakpoint
UPDATE "items" SET "pattern" = 'Silver threadwork', "fit" = 'Flared, floor-length', "occasions" = '{"Festive"}'
  WHERE "name" = 'Navy Silver Anarkali' AND "fabric" = '' AND "occasions" = '{}';
--> statement-breakpoint
UPDATE "items" SET "fabric" = 'Velvet', "pattern" = 'Sequin shimmer', "occasions" = '{"Party"}'
  WHERE "name" = 'Maroon Velvet Evening Gown' AND "fabric" = '' AND "occasions" = '{}';
--> statement-breakpoint
UPDATE "items" SET "fabric" = 'Linen', "set_contents" = 'Shirt & trousers', "fit" = 'Relaxed', "occasions" = '{"Casual"}'
  WHERE "name" = 'Beige Linen Co-ord Set' AND "fabric" = '' AND "occasions" = '{}';
