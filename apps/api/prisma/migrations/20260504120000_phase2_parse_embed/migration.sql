CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "raw_html" TEXT;
ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

ALTER TABLE "ideas" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

CREATE UNIQUE INDEX IF NOT EXISTS "pages_site_id_url_key" ON "pages"("site_id", "url");

CREATE INDEX IF NOT EXISTS "pages_embedding_hnsw_idx" ON "pages" USING hnsw ("embedding" vector_cosine_ops) WHERE ("embedding" IS NOT NULL);
CREATE INDEX IF NOT EXISTS "ideas_embedding_hnsw_idx" ON "ideas" USING hnsw ("embedding" vector_cosine_ops) WHERE ("embedding" IS NOT NULL);
