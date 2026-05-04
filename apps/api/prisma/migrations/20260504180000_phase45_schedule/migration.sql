-- Phase 5: per-site crawl schedule
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "schedule_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "schedule_cron" VARCHAR(128);
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "next_crawl_at" TIMESTAMPTZ;
