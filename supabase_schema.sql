-- ═══════════════════════════════════════════════
-- degen-LIVE Supabase Schema
-- Run this in Supabase → SQL Editor → New Query
-- ═══════════════════════════════════════════════

-- ── WALLET SCORES ──
-- One row per wallet address. Merged across all users/sessions.
create table if not exists wallet_scores (
  addr text primary key,
  wins integer default 0,
  losses integer default 0,
  holds integer default 0,
  total_pnl float default 0,
  total_bought float default 0,
  total_sold float default 0,
  big_wins integer default 0,
  trades jsonb default '[]'::jsonb,         -- array of trade objects
  win_addrs jsonb default '[]'::jsonb,       -- array of token addrs won (for dedup)
  loss_addrs jsonb default '[]'::jsonb,
  updated_at timestamptz default now()
);

-- ── TOKEN HISTORY ──
-- Every token ever seen, with peak data. Survives session death.
create table if not exists token_history (
  addr text primary key,
  name text,
  peak_mcap float default 0,
  entry_mcap float default 0,
  death_time bigint,
  first_seen bigint,
  graduated boolean default false,
  platform text default 'PumpFun',
  updated_at timestamptz default now()
);

-- ── SMART ALERTS HISTORY ──
-- Log of every smart money buy alert ever fired.
create table if not exists smart_alerts (
  id uuid primary key default gen_random_uuid(),
  wallet text not null,
  token_addr text,
  token_name text,
  sol_amount float,
  wins_at_time integer,
  win_rate float,
  total_pnl float,
  timestamp bigint,
  created_at timestamptz default now()
);

-- ── LEADERBOARD SNAPSHOTS ──
-- Periodic snapshots for time-bucketed boards (15m/1h/4h/12h/24h/weekly/monthly)
create table if not exists leaderboard_snapshots (
  id uuid primary key default gen_random_uuid(),
  wallet text not null,
  wins integer,
  losses integer,
  total_pnl float,
  win_rate float,
  bucket text,   -- '15m' | '1h' | '4h' | '12h' | '24h' | '7d' | '30d' | 'all'
  snapshot_at timestamptz default now()
);

-- ═══ INDEXES ═══
create index if not exists wallet_scores_wins_idx on wallet_scores(wins desc);
create index if not exists wallet_scores_pnl_idx on wallet_scores(total_pnl desc);
create index if not exists wallet_scores_updated_idx on wallet_scores(updated_at desc);
create index if not exists token_history_first_seen_idx on token_history(first_seen desc);
create index if not exists token_history_peak_mcap_idx on token_history(peak_mcap desc);
create index if not exists smart_alerts_timestamp_idx on smart_alerts(timestamp desc);
create index if not exists smart_alerts_wallet_idx on smart_alerts(wallet);
create index if not exists leaderboard_bucket_idx on leaderboard_snapshots(bucket, snapshot_at desc);

-- ═══ ROW LEVEL SECURITY ═══
-- Public read, public write (dashboard is public, no auth needed)
alter table wallet_scores enable row level security;
alter table token_history enable row level security;
alter table smart_alerts enable row level security;
alter table leaderboard_snapshots enable row level security;

create policy "public read wallet_scores" on wallet_scores for select using (true);
create policy "public write wallet_scores" on wallet_scores for insert with check (true);
create policy "public update wallet_scores" on wallet_scores for update using (true);

create policy "public read token_history" on token_history for select using (true);
create policy "public write token_history" on token_history for insert with check (true);
create policy "public update token_history" on token_history for update using (true);

create policy "public read smart_alerts" on smart_alerts for select using (true);
create policy "public write smart_alerts" on smart_alerts for insert with check (true);

create policy "public read leaderboard_snapshots" on leaderboard_snapshots for select using (true);
create policy "public write leaderboard_snapshots" on leaderboard_snapshots for insert with check (true);
