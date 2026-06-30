-- Converge — Database Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query → Paste → Run)

-- Enable pgvector extension for embeddings
create extension if not exists vector;

-- 1. user
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text not null,
  avatar_url text,
  created_at timestamptz default now()
);

-- 2. connection (one per user-tool link)
create table if not exists connection (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade not null,
  source_type text not null check (source_type in ('google_drive', 'slack', 'notion', 'jira', 'gmail', 'figma')),
  oauth_token text not null,
  refresh_token text,
  last_synced_at timestamptz,
  status text default 'active' check (status in ('active', 'disconnected', 'error')),
  created_at timestamptz default now(),
  unique(user_id, source_type)
);

-- 3. document (normalized representation of any source content)
create table if not exists document (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid references connection(id) on delete cascade not null,
  source_type text not null,
  source_id text not null,
  source_url text,
  title text,
  content text,
  author text,
  doc_type text,
  content_hash text,
  document_date timestamptz default now(),
  unique(connection_id, source_id)
);

-- 4. chunk (piece of document sized for LLM processing)
create table if not exists chunk (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references document(id) on delete cascade not null,
  content text not null,
  embedding vector(1536),
  chunk_index integer not null,
  token_count integer,
  metadata jsonb default '{}'::jsonb
);

-- 5. query (what the PM asked)
create table if not exists query (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade not null,
  original_query text not null,
  rewritten_query text,
  live_context_on boolean default false,
  thread_id uuid,
  created_at timestamptz default now()
);

-- 6. answer (synthesized response)
create table if not exists answer (
  id uuid primary key default gen_random_uuid(),
  query_id uuid references query(id) on delete cascade not null,
  answer_text text not null,
  model_used text,
  latency_ms integer,
  confidence text check (confidence in ('high', 'medium', 'low')),
  created_at timestamptz default now()
);

-- 7. citation (links answer to source chunks)
create table if not exists citation (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid references answer(id) on delete cascade not null,
  chunk_id uuid references chunk(id) on delete cascade not null,
  relevance_score float
);

-- 8. feedback (user rating on answer)
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid references answer(id) on delete cascade not null,
  user_id uuid references users(id) on delete cascade not null,
  rating integer not null check (rating >= 1 and rating <= 5),
  created_at timestamptz default now(),
  unique(answer_id, user_id)
);

-- Indexes for performance
create index if not exists idx_connection_user on connection(user_id);
create index if not exists idx_document_connection on document(connection_id);
create index if not exists idx_document_hash on document(content_hash);
create index if not exists idx_chunk_document on chunk(document_id);
create index if not exists idx_query_user on query(user_id);
create index if not exists idx_query_thread on query(thread_id);
create index if not exists idx_answer_query on answer(query_id);
create index if not exists idx_citation_answer on citation(answer_id);
create index if not exists idx_feedback_answer on feedback(answer_id);
