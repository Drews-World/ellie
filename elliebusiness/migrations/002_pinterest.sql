-- ELLIE Business — Pinterest promotion (Herald agent)
-- Adds per-listing Pin tracking so the Herald sweep is idempotent.
-- Run once against your Supabase project via the SQL editor or CLI.

alter table listings add column if not exists pinterest_pin_id text;
alter table listings add column if not exists promoted_at      timestamptz;

-- Fast lookup of un-promoted, linkable listings for the Herald sweep.
create index if not exists listings_unpromoted
    on listings (status)
    where pinterest_pin_id is null and etsy_listing_id is not null;
