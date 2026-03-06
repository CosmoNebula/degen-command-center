-- ═══════════════════════════════════════════════
-- degen-LIVE Leaderboard Migration
-- Run in Supabase → SQL Editor → New Query
-- ═══════════════════════════════════════════════

-- Add new columns to token_history
alter table token_history add column if not exists holders integer default 0;
alter table token_history add column if not exists volume float default 0;
alter table token_history add column if not exists deployer text default '';
alter table token_history add column if not exists rug boolean default false;
alter table token_history add column if not exists image_uri text default '';

-- Indexes for leaderboard queries
create index if not exists token_history_holders_idx on token_history(holders desc);
create index if not exists token_history_volume_idx on token_history(volume desc);
create index if not exists token_history_deployer_idx on token_history(deployer);
create index if not exists token_history_rug_idx on token_history(rug);
