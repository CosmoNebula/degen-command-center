// useSupabase.js — degen-LIVE persistence layer
// Syncs walletScores to/from Supabase every 60s
// Merges data from all users — no duplicates, no lost wins

const SUPABASE_URL = "https://yrmjphhfgduysoftnuxv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlybWpwaGhmZ2R1eXNvZnRudXh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MzI5MzAsImV4cCI6MjA4ODMwODkzMH0.scHhvTGiABJDybgbjgjilw8XuxOfmWPsqo4iytMZmio";

// ── Lightweight fetch wrapper (no SDK needed) ──
const sb = {
  async select(table, opts = {}) {
    const params = new URLSearchParams();
    if (opts.limit) params.set("limit", opts.limit);
    if (opts.order) params.set("order", opts.order);
    if (opts.filter) Object.entries(opts.filter).forEach(([k, v]) => params.set(k, `eq.${v}`));
    const url = `${SUPABASE_URL}/rest/v1/${table}?${params}`;
    const r = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
    });
    if (!r.ok) throw new Error(`sb.select ${table} ${r.status}`);
    return r.json();
  },

  async upsert(table, rows, conflictCol = "addr") {
    if (!rows.length) return;
    const url = `${SUPABASE_URL}/rest/v1/${table}?on_conflict=${conflictCol}`;
    const r = await fetch(url, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(rows),
    });
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`sb.upsert ${table} ${r.status}: ${txt}`);
    }
    return r;
  },

  async insert(table, rows) {
    if (!Array.isArray(rows)) rows = [rows];
    if (!rows.length) return;
    const url = `${SUPABASE_URL}/rest/v1/${table}`;
    const r = await fetch(url, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(rows),
    });
    if (!r.ok) {
      const txt = await r.text();
      console.warn(`sb.insert ${table} ${r.status}: ${txt}`);
    }
    return r;
  },
};

// ── Merge two wallet score objects (remote + local) ──
// Winner: whichever has more of each metric.
// Trades: merged by addr, deduped. winAddrs union.
function mergeWalletScore(remote, local) {
  const remoteWinAddrs = new Set(remote.win_addrs || []);
  const remoteTradeAddrs = new Set((remote.trades || []).map(t => t.addr + t.type));

  // Merge trades — remote base, add local trades not already in remote
  const mergedTrades = [...(remote.trades || [])];
  for (const tr of (local.trades || [])) {
    const key = tr.addr + tr.type;
    if (!remoteTradeAddrs.has(key)) {
      mergedTrades.push(tr);
      remoteTradeAddrs.add(key);
    } else {
      // Update existing trade if local has better data (higher pnl recorded, sell events etc)
      const idx = mergedTrades.findIndex(r => r.addr === tr.addr && r.type === tr.type);
      if (idx >= 0 && (tr.pnl || 0) > (mergedTrades[idx].pnl || 0)) {
        mergedTrades[idx] = tr;
      }
    }
  }

  // Win/loss addrs union
  const allWinAddrs = [...new Set([
    ...(remote.win_addrs || []),
    ...(local.winAddrs ? [...local.winAddrs] : []),
  ])];
  const allLossAddrs = [...new Set([
    ...(remote.loss_addrs || []),
    ...(local.lossAddrs ? [...local.lossAddrs] : []),
  ])];

  // Take highest counts — never go backwards
  return {
    addr: remote.addr,
    wins: Math.max(remote.wins || 0, allWinAddrs.length),
    losses: Math.max(remote.losses || 0, allLossAddrs.length),
    holds: Math.max(remote.holds || 0, local.holds || 0),
    total_pnl: Math.max(remote.total_pnl || 0, local.totalPnl || 0),
    total_bought: Math.max(remote.total_bought || 0, local.totalBought || 0),
    total_sold: Math.max(remote.total_sold || 0, local.totalSold || 0),
    big_wins: Math.max(remote.big_wins || 0, local.bigWins || 0),
    trades: mergedTrades.slice(-50),
    win_addrs: allWinAddrs,
    loss_addrs: allLossAddrs,
    updated_at: new Date().toISOString(),
  };
}

// ── Convert DB row → walletScores in-memory format ──
function rowToLocal(row) {
  return {
    wins: row.wins || 0,
    losses: row.losses || 0,
    holds: row.holds || 0,
    totalPnl: row.total_pnl || 0,
    totalBought: row.total_bought || 0,
    totalSold: row.total_sold || 0,
    bigWins: row.big_wins || 0,
    trades: row.trades || [],
    tokens: (row.trades || []).filter(t => t.type === "WIN").map(t => t.token),
    lossTokens: (row.trades || []).filter(t => t.type === "LOSS").map(t => t.token),
    holdTokens: (row.trades || []).filter(t => t.type === "HOLD").map(t => t.token),
    winAddrs: new Set(row.win_addrs || []),
    lossAddrs: new Set(row.loss_addrs || []),
    holdAddrs: new Set((row.trades || []).filter(t => t.type === "HOLD").map(t => t.addr)),
    activeBuys: {},
    lastActivity: Date.now(),
    _fromDB: true,
  };
}

// ── Convert in-memory walletScore → DB row ──
function localToRow(addr, ws) {
  return {
    addr,
    wins: ws.wins || 0,
    losses: ws.losses || 0,
    holds: ws.holds || 0,
    total_pnl: ws.totalPnl || 0,
    total_bought: ws.totalBought || 0,
    total_sold: ws.totalSold || 0,
    big_wins: ws.bigWins || 0,
    trades: (ws.trades || []).slice(-50),
    win_addrs: ws.winAddrs ? [...ws.winAddrs] : [],
    loss_addrs: ws.lossAddrs ? [...ws.lossAddrs] : [],
    updated_at: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────
// MAIN HOOK
// ─────────────────────────────────────────────
import { useEffect, useRef, useCallback } from "react";

export function useSupabase({ onStatus } = {}) {
  const walletScoresRef = useRef(null); // set externally via setWalletScoresRef
  const dirtyWallets = useRef(new Set());
  const lastSyncRef = useRef(0);
  const syncingRef = useRef(false);
  const initialLoadDone = useRef(false);
  const alertsSentRef = useRef(new Set());

  const status = useCallback((msg, type = "info") => {
    console.log(`[SUPABASE] ${msg}`);
    if (onStatus) onStatus(msg, type);
  }, [onStatus]);

  const setWalletScoresRef = useCallback((ref) => {
    walletScoresRef.current = ref;
  }, []);

  const markDirty = useCallback((addr) => {
    dirtyWallets.current.add(addr);
  }, []);

  const logSmartAlert = useCallback(async (alert) => {
    const key = `${alert.wallet}-${alert.mint}-${Math.floor(Date.now() / 3600000)}`;
    if (alertsSentRef.current.has(key)) return;
    alertsSentRef.current.add(key);
    const ws = walletScoresRef.current?.current?.[alert.wallet];
    try {
      await sb.insert("smart_alerts", [{
        wallet: alert.wallet,
        token_addr: alert.mint,
        token_name: alert.name || "",
        sol_amount: alert.sol || 0,
        wins_at_time: alert.wins || ws?.wins || 0,
        win_rate: ws ? Math.round((ws.wins / Math.max(1, ws.wins + ws.losses)) * 100) : 0,
        total_pnl: ws?.totalPnl || 0,
        timestamp: Date.now(),
      }]);
    } catch (e) {
      console.warn("[SUPABASE] logSmartAlert failed:", e.message);
    }
  }, []);

  const loadFromDB = useCallback(async () => {
    const wsRef = walletScoresRef.current;
    if (!wsRef) return;
    if (initialLoadDone.current) return;
    status("Loading wallet history from DB...");
    try {
      const rows = await sb.select("wallet_scores", { order: "wins.desc", limit: 2000 });
      let loaded = 0;
      for (const row of rows) {
        if (!row.addr) continue;
        const existing = wsRef.current[row.addr];
        if (existing) {
          if ((row.wins || 0) > (existing.wins || 0)) {
            const merged = mergeWalletScore(row, existing);
            wsRef.current[row.addr] = rowToLocal(merged);
          }
        } else {
          wsRef.current[row.addr] = rowToLocal(row);
          loaded++;
        }
      }
      initialLoadDone.current = true;
      status(`✅ Loaded ${rows.length} wallets (${loaded} new) from DB`, "success");
    } catch (e) {
      status(`⚠ DB load failed: ${e.message}`, "error");
      console.error("[SUPABASE] loadFromDB error:", e);
    }
  }, [status]);

  const syncDirty = useCallback(async (force = false) => {
    const wsRef = walletScoresRef.current;
    if (!wsRef) return;
    if (syncingRef.current) return;
    if (!dirtyWallets.current.size && !force) return;
    const now = Date.now();
    if (!force && now - lastSyncRef.current < 55000) return;

    syncingRef.current = true;
    lastSyncRef.current = now;
    const toSync = [...dirtyWallets.current];
    dirtyWallets.current.clear();

    const qualifying = toSync.filter(addr => {
      const ws = wsRef.current[addr];
      return ws && (ws.wins > 0 || ws.losses > 0);
    });

    if (!qualifying.length) { syncingRef.current = false; return; }

    try {
      const BATCH = 50;
      for (let i = 0; i < qualifying.length; i += BATCH) {
        const batch = qualifying.slice(i, i + BATCH);
        const rows = batch.map(addr => localToRow(addr, wsRef.current[addr]));
        await sb.upsert("wallet_scores", rows);
      }
      status(`⬆ Synced ${qualifying.length} wallets`);
    } catch (e) {
      qualifying.forEach(a => dirtyWallets.current.add(a));
      status(`⚠ Sync failed: ${e.message}`, "error");
    }
    syncingRef.current = false;
  }, [status]);

  useEffect(() => {
    const interval = setInterval(() => syncDirty(), 60000);
    const onUnload = () => syncDirty(true);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [syncDirty]);

  // ── Upsert token to DB (called on qualify/migrate/death) ──
  const upsertToken = useCallback(async (token) => {
    if (!token?.addr) return;
    try {
      await sb.upsert("token_history", [{
        addr: token.addr,
        name: token.name || "???",
        peak_mcap: token.peakMcap || token.mcap || 0,
        entry_mcap: token.entryMcap || token.mcap || 0,
        death_time: token.alive === false ? Date.now() : null,
        first_seen: token.timestamp || Date.now(),
        graduated: token.migrated || false,
        platform: token.platform || "PumpFun",
        updated_at: new Date().toISOString(),
      }], "addr");
    } catch (e) {
      console.warn("[SUPABASE] upsertToken failed:", e.message);
    }
  }, []);

  // ── Load recent tokens from DB (last N hours) ──
  const loadTokensFromDB = useCallback(async (hoursBack = 6) => {
    try {
      const since = Date.now() - hoursBack * 3600000;
      // Fetch tokens updated recently, ordered by peak mcap
      const url = `${SUPABASE_URL}/rest/v1/token_history?updated_at=gte.${new Date(since).toISOString()}&order=peak_mcap.desc&limit=500`;
      const r = await fetch(url, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      });
      if (!r.ok) throw new Error(`status ${r.status}`);
      const rows = await r.json();
      console.log(`[SUPABASE] 🪙 Loaded ${rows.length} tokens from last ${hoursBack}h`);
      return rows;
    } catch (e) {
      console.warn("[SUPABASE] loadTokensFromDB failed:", e.message);
      return [];
    }
  }, []);

  return { markDirty, logSmartAlert, syncDirty, loadFromDB, setWalletScoresRef, upsertToken, loadTokensFromDB };
}

export default useSupabase;
// v161b
