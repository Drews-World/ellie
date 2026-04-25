-- Prayer items table
create table if not exists prayer_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,          -- Clerk user ID
  title       text not null,
  notes       text,
  category    text not null default 'general',
  status      text not null default 'active',   -- 'active' | 'answered'
  answered_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Index for fast per-user queries
create index if not exists prayer_items_user_id_idx on prayer_items(user_id);

-- RLS (Row Level Security) — enable if using Supabase RLS
-- alter table prayer_items enable row level security;
-- create policy "Users manage own prayer items"
--   on prayer_items for all
--   using (user_id = auth.uid()::text);
