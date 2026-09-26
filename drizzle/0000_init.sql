CREATE TABLE "crawl_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text NOT NULL,
	"error" text,
	"stats" jsonb,
	"mapping_version" text,
	"llm_input_tokens" integer DEFAULT 0 NOT NULL,
	"llm_output_tokens" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_drops" (
	"product_id" text PRIMARY KEY NOT NULL,
	"detected_on" date NOT NULL,
	"median_30d" numeric(10, 2) NOT NULL,
	"current_price" numeric(10, 2) NOT NULL,
	"drop_pct" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_snapshots" (
	"product_id" text NOT NULL,
	"snapshot_date" date NOT NULL,
	"list_price" numeric(10, 2) NOT NULL,
	"sale_price" numeric(10, 2) NOT NULL,
	CONSTRAINT "price_snapshots_product_id_snapshot_date_pk" PRIMARY KEY("product_id","snapshot_date")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"brand" text NOT NULL,
	"source_id" text NOT NULL,
	"product_name" text NOT NULL,
	"product_url" text NOT NULL,
	"image_url" text,
	"category_l1" text NOT NULL,
	"category_l2" text NOT NULL,
	"source_category" text NOT NULL,
	"list_price" numeric(10, 2) NOT NULL,
	"sale_price" numeric(10, 2) NOT NULL,
	"colors" jsonb NOT NULL,
	"color_families" text[] DEFAULT '{}'::text[] NOT NULL,
	"size_range" text[] DEFAULT '{}'::text[] NOT NULL,
	"composition_raw" text,
	"composition" jsonb,
	"composition_status" text NOT NULL,
	"composition_source" text,
	"dominant_fiber" text,
	"material_score" real,
	"price_percentile" real,
	"value_score" integer,
	"attrs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"content_hash" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "price_drops" ADD CONSTRAINT "price_drops_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_snapshots" ADD CONSTRAINT "price_snapshots_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "crawl_runs_brand_idx" ON "crawl_runs" USING btree ("brand","started_at");--> statement-breakpoint
CREATE INDEX "snap_date_idx" ON "price_snapshots" USING btree ("snapshot_date");--> statement-breakpoint
CREATE INDEX "products_l2_idx" ON "products" USING btree ("category_l2","active");--> statement-breakpoint
CREATE INDEX "products_brand_idx" ON "products" USING btree ("brand","active");