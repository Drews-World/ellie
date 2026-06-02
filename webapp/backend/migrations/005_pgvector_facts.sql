-- ============================================================
-- 005 — pgvector + facts table (ELLIE semantic memory)
-- Phase 0.2 of docs/ELLIE_REFACTOR_PLAN.md
-- Run this in your Supabase SQL editor (supabase.com -> SQL Editor)
-- ============================================================

-- 1. Enable pgvector (ships with Supabase, just needs enabling)
create extension if not exists vector;

-- ============================================================
-- 2. facts — Hub-visible semantic memory about Drew
--    (facts, preferences, recurring context ELLIE has learned)
--    This is the "semantic memory" layer from the refactor plan.
--    Hermes keeps its own agent-curated memory in SQLite; this table
--    is the slice that the Hub can read/display + share across floors.
-- ============================================================
create table if not exists public.facts (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,                       -- Clerk user ID
  content     text not null,                       -- the fact / preference, in plain language
  category    text not null default 'general',     -- 'preference' | 'personal' | 'work' | 'goal' | 'general'
  source      text not null default 'inferred',    -- 'chat' | 'manual' | 'inferred'
  confidence  real not null default 1.0,            -- 0.0–1.0, how sure ELLIE is
  embedding   vector(1536),                         -- text-embedding-3-small dim; nullable until embedded
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Fast per-user lookups (Hub queries by user)
create index if not exists facts_user_id_idx on public.facts(user_id);

-- Filter by category within a user
create index if not exists facts_user_category_idx on public.facts(user_id, category);

-- Approximate nearest-neighbour search for semantic recall (cosine distance).
-- HNSW handles null embeddings fine (rows without an embedding are skipped).
create index if not exists facts_embedding_idx
  on public.facts
  using hnsw (embedding vector_cosine_ops);

-- Keep updated_at fresh on edits
create or replace function public.touch_facts_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists facts_set_updated_at on public.facts;
create trigger facts_set_updated_at
  before update on public.facts
  for each row execute procedure public.touch_facts_updated_at();

-- RLS — enable if/when serving this table directly to the client.
-- The backend uses the service key, so it bypasses RLS regardless.
-- alter table public.facts enable row level security;
-- create policy "Users manage own facts"
--   on public.facts for all
--   using (user_id = auth.uid()::text);
