# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Degen Command Center — a real-time Solana memecoin trading dashboard built as a single-page React app. It connects to PumpFun websocket for live token launches, enriches data from multiple free APIs (DexScreener, Helius, Jupiter, CoinGecko, RugCheck, Defined), tracks wallet performance, and persists everything to Supabase. Includes a gamified "Hunter" RPG system and an optional Claude-powered AI analysis chat room.

## Commands

```bash
npm run dev      # Start Vite dev server (localhost:5173)
npm run build    # Production build to dist/
npm run preview  # Preview production build
```

No test suite or linter is configured.

## Architecture

**Single-page React 19 app** using Vite 6. No router, no state management library, no CSS framework — everything is inline styles with a neon cyberpunk theme (colors in `NEON` object in App.jsx).

### Key Files (all in `src/`)

- **`App.jsx`** (~8300 lines) — The entire UI: token battlefield canvas, panels, modals, filtering, sorting, lock system, and all rendering logic. This is the monolith. The root component is `DegenCommandCenter`.
- **`useLiveData.js`** (~2300 lines) — Core data hook. Manages PumpFun websocket connection, per-token wallet tracking, holder counts, dev wallet detection, migration detection, DexScreener enrichment cycles, and direct Supabase writes for token_history and wallet_scores.
- **`api.js`** (~935 lines) — All external API calls. Exports ~25 functions for DexScreener, Helius RPC, PumpFun websocket, Jupiter, CoinGecko, RugCheck, Defined, and Raydium. Uses `proxyFetch()` which routes through Cloudflare Pages proxy when deployed.
- **`useIntelligence.js`** (~734 lines) — "Brain" system that computes a composite neural signal score per token, classifies wallet DNA archetypes (SNIPER, HOLDER, WHALE, etc.), and provides mock + real Claude chat analysis.
- **`useSupabase.js`** (~330 lines) — Persistence hook. Syncs wallet scores bidirectionally with Supabase every 60s with merge logic (no SDK, raw fetch to REST API).
- **`HunterSystem.jsx`** + **`HunterData.js`** — RPG gamification layer with items, stats, levels, loot drops, pixel character rendering, and Supabase-backed profiles.
- **`ClaudeRoom.jsx`** (~1180 lines) — AI chat room using Claude API (optional, requires `sk-ant-` key). Includes mock response mode with cost tracking.

### Duplicate Root Files

The root-level `App.jsx`, `api.js`, `useLiveData.js`, `useIntelligence.js`, and `useSupabase.js` are copies/older versions of the files in `src/`. The app imports from `src/`. Only edit files in `src/`.

### Deployment

Cloudflare Pages. The `functions/api/proxy.js` is a Cloudflare Pages Function that proxies external API calls to avoid CORS issues in production. It has a hostname allowlist. In local dev, `proxyFetch()` calls APIs directly (no proxy needed).

### Data Flow

1. `connectPumpFun()` websocket receives new token creates and trades
2. `useLiveData` builds per-token state: holder maps, wallet balances, buy/sell counts, dev wallet %, bonding curve progress
3. Enrichment cycles poll DexScreener (batch of 30), Helius (holder counts), RugCheck, Jupiter (slippage) on intervals
4. `useIntelligence` computes neural signal scores from the enriched data
5. `App.jsx` renders tokens on a canvas "battlefield" with qualification checks (8 criteria, need 6/8 to qualify)
6. Wallet wins/losses and token history persist to Supabase

### Environment Variables

- `VITE_HELIUS_KEY` — Helius API key (free tier, used for on-chain data and holder counts). App works without it but with degraded holder data.

### Important Patterns

- **No `const`/`let` at module top level** — The codebase uses `var` deliberately at module scope to avoid esbuild TDZ (Temporal Dead Zone) reordering bugs in production builds. The Vite config targets `es2015` for the same reason. Do not convert top-level `var` to `const`/`let`.
- **No Supabase SDK** — All Supabase calls use raw `fetch()` to the REST API with the anon key in headers.
- **Supabase anon key is intentionally in source** — it's a public anon key with RLS policies (public read/write). Not a secret.
- **Large files are normal** — App.jsx is ~8K lines by design. Don't try to split it unless asked.

### Supabase Tables

Schema in `supabase_schema.sql`: `wallet_scores`, `token_history`, `smart_alerts`, `leaderboard_snapshots`, plus `hunter_profiles` (used by HunterSystem).
