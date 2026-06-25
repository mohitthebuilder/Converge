-- Step 26: BM25 hybrid search setup
-- Run this in Supabase SQL Editor (one-time)

-- 1. Add tsvector column
ALTER TABLE chunk ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- 2. Populate for existing chunks
UPDATE chunk SET search_vector = to_tsvector('english', content);

-- 3. Auto-populate on insert/update
CREATE OR REPLACE FUNCTION chunk_search_vector_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', NEW.content);
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS chunk_search_vector_update ON chunk;
CREATE TRIGGER chunk_search_vector_update
  BEFORE INSERT OR UPDATE OF content ON chunk
  FOR EACH ROW
  EXECUTE FUNCTION chunk_search_vector_trigger();

-- 4. GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_chunk_search_vector ON chunk USING gin(search_vector);

-- 5. BM25 search function
CREATE OR REPLACE FUNCTION match_chunks_bm25(
  query_text text,
  match_count int DEFAULT 20
)
RETURNS TABLE(
  id uuid,
  content text,
  document_id uuid,
  rank real
) AS $$
  SELECT
    c.id,
    c.content,
    c.document_id,
    ts_rank_cd(c.search_vector, plainto_tsquery('english', query_text))::real AS rank
  FROM chunk c
  WHERE c.search_vector @@ plainto_tsquery('english', query_text)
  ORDER BY rank DESC
  LIMIT match_count;
$$ LANGUAGE sql;
