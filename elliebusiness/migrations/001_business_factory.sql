-- ELLIE Business Factory — initial schema
-- Run once against your Supabase project via the SQL editor or CLI.

-- ── Designs ──────────────────────────────────────────────────────────────────
create table if not exists designs (
    id              uuid primary key default gen_random_uuid(),
    niche           text not null,
    concept_name    text not null,
    image_prompt    text,
    sell_reason     text,
    products        jsonb default '[]',
    forge_score     numeric(4,3) default 0,
    status          text not null default 'pending_drew_review',
    -- status values: pending_drew_review | approved | rejected | listed
    image_url       text,
    printify_id     text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index if not exists designs_status_score on designs (status, forge_score desc);
create index if not exists designs_niche on designs (niche);

-- ── Listings ─────────────────────────────────────────────────────────────────
create table if not exists listings (
    id              uuid primary key default gen_random_uuid(),
    design_id       uuid references designs(id),
    etsy_listing_id text unique,
    printify_id     text,
    title           text,
    description     text,
    tags            text[],
    price_usd       numeric(8,2),
    status          text not null default 'draft',
    -- status values: draft | active | inactive | sold_out
    views           integer default 0,
    favorites       integer default 0,
    sales           integer default 0,
    revenue_usd     numeric(10,2) default 0,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

-- ── Orders ───────────────────────────────────────────────────────────────────
create table if not exists orders (
    id              uuid primary key default gen_random_uuid(),
    etsy_order_id   text unique,
    listing_id      uuid references listings(id),
    amount_usd      numeric(8,2),
    net_usd         numeric(8,2),
    status          text not null default 'pending',
    -- status values: pending | processing | shipped | complete | refunded
    ordered_at      timestamptz,
    created_at      timestamptz not null default now()
);

-- ── Trends ───────────────────────────────────────────────────────────────────
create table if not exists trends (
    id              uuid primary key default gen_random_uuid(),
    niche           text not null,
    signal_count    integer default 0,
    avg_price_usd   numeric(8,2),
    top_tags        text[],
    opportunity     text,           -- LLM summary
    raw_data        jsonb default '{}',
    observed_at     timestamptz not null default now()
);

create index if not exists trends_niche_time on trends (niche, observed_at desc);

-- ── Feedback Events ───────────────────────────────────────────────────────────
create table if not exists feedback_events (
    id              uuid primary key default gen_random_uuid(),
    target_kind     text not null default 'design',
    target_id       text not null,
    verdict         text not null,  -- approve | reject | iterate
    notes           text default '',
    drew_tags       text[] default '{}',
    occurred_at     timestamptz not null default now()
);

create index if not exists feedback_target on feedback_events (target_kind, target_id);

-- ── Cost Events ───────────────────────────────────────────────────────────────
create table if not exists cost_events (
    id              uuid primary key default gen_random_uuid(),
    service         text not null,  -- openrouter | openai | gemini | printify | etsy
    agent           text not null,  -- nova | forge | archives | treasury | ellie
    kind            text not null,  -- llm | image | api
    cost_usd        numeric(10,6) not null,
    detail          text default '',
    occurred_at     timestamptz not null default now()
);

create index if not exists cost_events_date on cost_events (occurred_at desc);
create index if not exists cost_events_agent on cost_events (agent, occurred_at desc);

-- ── Auto-update updated_at ────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create or replace trigger designs_updated_at
    before update on designs
    for each row execute function set_updated_at();

create or replace trigger listings_updated_at
    before update on listings
    for each row execute function set_updated_at();
