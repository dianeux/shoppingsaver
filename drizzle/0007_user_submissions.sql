CREATE TABLE "submission_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"ip_hash" text NOT NULL,
	"product_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "source" text DEFAULT 'crawl' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "reports" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "submission_events_ip_idx" ON "submission_events" USING btree ("ip_hash","created_at");