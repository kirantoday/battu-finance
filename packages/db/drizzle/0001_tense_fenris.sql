ALTER TABLE "battu"."liq_cache" ADD COLUMN "ingestion_version" text DEFAULT 'v1';--> statement-breakpoint
ALTER TABLE "battu"."liq_cache" ADD COLUMN "ticker_cik" text;