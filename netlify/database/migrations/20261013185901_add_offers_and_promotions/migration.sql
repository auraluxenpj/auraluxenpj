CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" integer,
	"summary" text NOT NULL,
	"details" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"kind" text DEFAULT 'automatic' NOT NULL,
	"code" text UNIQUE,
	"discount_type" text DEFAULT 'percent' NOT NULL,
	"discount_value" integer NOT NULL,
	"min_purchase" integer DEFAULT 0 NOT NULL,
	"max_discount" integer,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"scope" text DEFAULT 'all' NOT NULL,
	"product_ids" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"category_ids" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"exclude_product_ids" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"exclude_sale" boolean DEFAULT false NOT NULL,
	"per_customer_limit" integer,
	"total_limit" integer,
	"stackable" boolean DEFAULT false NOT NULL,
	"show_banner" boolean DEFAULT false NOT NULL,
	"banner_title" text DEFAULT '' NOT NULL,
	"banner_text" text DEFAULT '' NOT NULL,
	"banner_image" text DEFAULT '' NOT NULL,
	"cta_text" text DEFAULT '' NOT NULL,
	"announcement" text DEFAULT '' NOT NULL,
	"show_countdown" boolean DEFAULT false NOT NULL,
	"cart_message" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "offer_id" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "offer_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "offer_discount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "coupon_id" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "coupon_code" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "coupon_discount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_waived" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_zone" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX "audit_log_created_at_idx" ON "audit_log" ("created_at");--> statement-breakpoint
CREATE INDEX "orders_offer_idx" ON "orders" ("offer_id");--> statement-breakpoint
CREATE INDEX "orders_coupon_idx" ON "orders" ("coupon_id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_offer_id_offers_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_coupon_id_offers_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "offers"("id") ON DELETE SET NULL;