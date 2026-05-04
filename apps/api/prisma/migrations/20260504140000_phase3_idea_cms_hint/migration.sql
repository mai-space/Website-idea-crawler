-- Phase 3: pitch briefing CMS hint on ideas
ALTER TABLE "ideas" ADD COLUMN IF NOT EXISTS "cms_hint" VARCHAR(1024);
