-- Rows from the old 30-day-median rule have no day-0 price and mean something else; rebuilt nightly.
DELETE FROM "price_drops";--> statement-breakpoint
ALTER TABLE "price_drops" ALTER COLUMN "baseline_price" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "price_drops" DROP COLUMN "median_30d";