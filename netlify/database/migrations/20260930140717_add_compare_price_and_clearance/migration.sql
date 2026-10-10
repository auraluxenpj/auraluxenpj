ALTER TABLE "items" ADD COLUMN "compare_price" integer;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "clearance" boolean DEFAULT false NOT NULL;