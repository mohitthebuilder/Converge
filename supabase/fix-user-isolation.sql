-- Multi-user data isolation fix
-- Run this in Supabase SQL Editor BEFORE deploying the code update
-- This creates new RPC overloads that filter by user_id at the SQL level

-- 1. Vector search — scoped to user's data only
CREATE OR REPLACE FUNCTION match_chunks(
  user_id_param uuid,
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.2,
  match_count int DEFAULT 10
)
RETURNS TABLE(
  id uuid,
  content text,
  document_id uuid,
  similarity float,
  chunk_index int
) AS $$
  SELECT
    c.id,
    c.content,
    c.document_id,
    (1 - (c.embedding <=> query_embedding))::float AS similarity,
    c.chunk_index
  FROM chunk c
  INNER JOIN document d ON d.id = c.document_id
  INNER JOIN connection conn ON conn.id = d.connection_id
  WHERE conn.user_id = user_id_param
    AND conn.status = 'active'
    AND c.embedding IS NOT NULL
    AND (1 - (c.embedding <=> query_embedding)) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$ LANGUAGE sql;

-- 2. BM25 keyword search — scoped to user's data only
CREATE OR REPLACE FUNCTION match_chunks_bm25(
  user_id_param uuid,
  query_text text,
  match_count int DEFAULT 20
)
RETURNS TABLE(
  id uuid,
  content text,
  document_id uuid,
  rank real,
  chunk_index int
) AS $$
  SELECT
    c.id,
    c.content,
    c.document_id,
    ts_rank_cd(c.search_vector, plainto_tsquery('english', query_text))::real AS rank,
    c.chunk_index
  FROM chunk c
  INNER JOIN document d ON d.id = c.document_id
  INNER JOIN connection conn ON conn.id = d.connection_id
  WHERE conn.user_id = user_id_param
    AND conn.status = 'active'
    AND c.search_vector @@ plainto_tsquery('english', query_text)
  ORDER BY rank DESC
  LIMIT match_count;
$$ LANGUAGE sql;
