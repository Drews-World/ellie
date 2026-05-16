-- ELLIE Business Factory — activity logging + pipeline run tracking
-- Run once in Supabase SQL editor after 001_business_factory.sql

-- ── Add run_id to designs ─────────────────────────────────────────────────────
alter table designs add column if not exists run_id uuid;
create index if not exists designs_run_id on designs (run_id);

-- ── Activity log ──────────────────────────────────────────────────────────────
-- Persistent event log — replaces in-memory supervisor notifications
create table if not exists activity_log (
    id           uuid primary key default gen_random_uuid(),
    agent        text not null,        -- nova | forge | archives | printify | ellie
    event_type   text not null,        -- run_started | design_created | design_approved
                                       -- design_rejected | product_published | error | info
    message      text not null,
    metadata     jsonb default '{}',
    run_id       uuid,
    occurred_at  timestamptz not null default now()
);

create index if not exists activity_log_time   on activity_log (occurred_at desc);
create index if not exists activity_log_run    on activity_log (run_id);
create index if not exists activity_log_agent  on activity_log (agent, occurred_at desc);

-- ── Pipeline runs ─────────────────────────────────────────────────────────────
-- One row per ELLIE pipeline invocation (Nova → Forge batch)
create table if not exists pipeline_runs (
    id               uuid primary key default gen_random_uuid(),
    niche            text,              -- comma-sep if multiple niches
    command          text,              -- Drew's original command
    started_at       timestamptz not null default now(),
    finished_at      timestamptz,
    status           text not null default 'running',
    -- status: running | done | error | partial
    current_step     text default 'starting',
    designs_created  integer default 0,
    drafts_published integer default 0,
    initiated_by     text default 'ellie'  -- ellie | manual
);

create index if not exists pipeline_runs_time on pipeline_runs (started_at desc);
