CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY,
	"order_id" integer NOT NULL,
	"item_id" integer,
	"name" text NOT NULL,
	"image" text DEFAULT '' NOT NULL,
	"size" text NOT NULL,
	"colour" text DEFAULT '' NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" integer NOT NULL,
	"list_price" integer NOT NULL,
	"line_total" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY,
	"number" text NOT NULL UNIQUE,
	"access_token" text NOT NULL,
	"idempotency_key" text NOT NULL UNIQUE,
	"customer_name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"address" text NOT NULL,
	"city" text NOT NULL,
	"area" text NOT NULL,
	"landmark" text DEFAULT '' NOT NULL,
	"subtotal" integer NOT NULL,
	"delivery_charge" integer DEFAULT 0 NOT NULL,
	"discount" integer DEFAULT 0 NOT NULL,
	"total" integer NOT NULL,
	"payment_method" text DEFAULT 'bank_transfer' NOT NULL,
	"payment_status" text DEFAULT 'submitted' NOT NULL,
	"status" text DEFAULT 'payment_verification' NOT NULL,
	"stock_reserved" boolean DEFAULT true NOT NULL,
	"admin_notes" text DEFAULT '' NOT NULL,
	"client_hash" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY,
	"order_id" integer NOT NULL,
	"method" text DEFAULT 'bank_transfer' NOT NULL,
	"amount" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"transaction_id" text DEFAULT '' NOT NULL,
	"payment_date" text DEFAULT '' NOT NULL,
	"proof_key" text DEFAULT '' NOT NULL,
	"proof_type" text DEFAULT '' NOT NULL,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "stock" jsonb DEFAULT '{}' NOT NULL;--> statement-breakpoint
CREATE INDEX "orders_created_at_idx" ON "orders" ("created_at");--> statement-breakpoint
CREATE INDEX "orders_client_hash_idx" ON "orders" ("client_hash","created_at");--> statement-breakpoint
CREATE INDEX "orders_phone_idx" ON "orders" ("phone","created_at");--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_item_id_items_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE;