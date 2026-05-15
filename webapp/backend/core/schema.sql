-- ============================================================
-- ELLIE — Executive Life Logic Intelligence Engine
-- Supabase PostgreSQL Schema
-- Run this in your Supabase SQL editor (supabase.com → SQL Editor)
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- USERS (mirrors Supabase auth.users, stores ELLIE preferences)
-- ============================================================
create table if not exists public.profiles (
  id           uuid references auth.users(id) on delete cascade primary key,
  display_name text,
  avatar_url   text,
  timezone     text default 'America/Los_Angeles',
  ellie_memory jsonb default '{}'::jsonb,  -- ELLIE stores context about AJH here
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- CALENDAR EVENTS
-- ============================================================
create table if not exists public.calendar_events (
  id          uuid default uuid_generate_v4() primary key,
  user_id     uuid references public.profiles(id) on delete cascade not null,
  title       text not null,
  notes       text,
  location    text,
  start_time  timestamptz not null,
  end_time    timestamptz,
  all_day     boolean default false,
  color       text default 'hud',        -- hud | amber | red | green
  category    text default 'general',    -- general | work | personal | faith | fitness | quill
  google_id   text,                      -- for Google Calendar sync
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index on public.calendar_events(user_id, start_time);

-- ============================================================
-- REMINDERS
-- ============================================================
create table if not exists public.reminders (
  id          uuid default uuid_generate_v4() primary key,
  user_id     uuid references public.profiles(id) on delete cascade not null,
  title       text not null,
  notes       text,
  due_date    date,
  due_time    time,
  priority    text default 'medium',     -- high | medium | low
  completed   boolean default false,
  completed_at timestamptz,
  category    text default 'general',    -- general | work | faith | fitness | quill | parking-lot
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index on public.reminders(user_id, completed, due_date);

-- ============================================================
-- NOTES
-- ============================================================
create table if not exists public.notes (
  id          uuid default uuid_generate_v4() primary key,
  user_id     uuid references public.profiles(id) on delete cascade not null,
  title       text not null,
  content     text,
  tags        text[] default '{}',
  pinned      boolean default false,
  category    text default 'general',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index on public.notes(user_id, pinned, created_at desc);

-- ============================================================
-- GOALS
-- ============================================================
create table if not exists public.goals (
  id           uuid default uuid_generate_v4() primary key,
  user_id      uuid references public.profiles(id) on delete cascade not null,
  title        text not null,
  description  text,
  category     text default 'general',   -- career | faith | fitness | financial | quill | personal
  target_date  date,
  progress     integer default 0,        -- 0-100 percent
  completed    boolean default false,
  completed_at timestamptz,
  milestones   jsonb default '[]'::jsonb, -- [{ title, completed, date }]
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index on public.goals(user_id, completed, category);

-- ============================================================
-- ELLIE CHAT HISTORY (persistent memory across sessions)
-- ============================================================
create table if not exists public.ellie_conversations (
  id         uuid default uuid_generate_v4() primary key,
  user_id    uuid references public.profiles(id) on delete cascade not null,
  widget     text,                        -- which widget triggered this brief
  role       text not null,               -- 'user' | 'assistant'
  content    text not null,
  created_at timestamptz default now()
);

create index on public.ellie_conversations(user_id, created_at desc);

-- ============================================================
-- WORLD DATA CACHE (reduces redundant API calls)
-- ============================================================
create table if not exists public.world_cache (
  id         uuid default uuid_generate_v4() primary key,
  cache_key  text unique not null,        -- e.g. 'news_general', 'markets', 'crypto'
  data       jsonb not null,
  fetched_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY — users only see their own data
-- ============================================================
alter table public.profiles           enable row level security;
alter table public.calendar_events    enable row level security;
alter table public.reminders          enable row level security;
alter table public.notes              enable row level security;
alter table public.goals              enable row level security;
alter table public.ellie_conversations enable row level security;

-- Profiles
create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Calendar events
create policy "Users can manage own calendar events"
  on public.calendar_events for all using (auth.uid() = user_id);

-- Reminders
create policy "Users can manage own reminders"
  on public.reminders for all using (auth.uid() = user_id);

-- Notes
create policy "Users can manage own notes"
  on public.notes for all using (auth.uid() = user_id);

-- Goals
create policy "Users can manage own goals"
  on public.goals for all using (auth.uid() = user_id);

-- ELLIE conversations
create policy "Users can manage own ellie history"
  on public.ellie_conversations for all using (auth.uid() = user_id);

-- World cache is public read (no PII)
alter table public.world_cache enable row level security;
create policy "Anyone can read world cache"
  on public.world_cache for select using (true);
create policy "Service role can write world cache"
  on public.world_cache for all using (auth.role() = 'service_role');

-- ============================================================
-- UPDATED_AT auto-trigger
-- ============================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();
create trigger set_updated_at before update on public.calendar_events
  for each row execute procedure public.set_updated_at();
create trigger set_updated_at before update on public.reminders
  for each row execute procedure public.set_updated_at();
create trigger set_updated_at before update on public.notes
  for each row execute procedure public.set_updated_at();
create trigger set_updated_at before update on public.goals
  for each row execute procedure public.set_updated_at();
