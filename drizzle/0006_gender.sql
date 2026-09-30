DROP INDEX "products_l2_idx";--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "gender" text DEFAULT 'women' NOT NULL;--> statement-breakpoint
CREATE INDEX "products_l2_idx" ON "products" USING btree ("gender","category_l2","active");