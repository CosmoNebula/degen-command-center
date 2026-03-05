// ═══════════════════════════════════════════════════════════════
// useLiveData.js — PumpFun websocket with wallet-level tracking
// Builds holder count, dev wallet %, distribution from trade stream
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from "react";
import { connectPumpFun, fetchTokenByAddress, fetchJupiterPrice, fetchTokenMeta, fetchLargestHolders, fetchLatestProfiles, fetchBoostedTokens, connectHeliusWS, fetchRugCheck, fetchGeckoTrending, fetchGeckoPoolByToken, fetchPumpCurveProgress, fetchDefinedTrending, fetchJupiterSlippage, fetchJupiterVerified, fetchPumpFunDirect, fetchRaydiumPool, fetchUniqueSigners } from "./api";

// ─── DIRECT SUPABASE WRITES (no callback chain needed) ───
const SB_URL = "https://yrmjphhfgduysoftnuxv.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlybWpwaGhmZ2R1eXNvZnRudXh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MzI5MzAsImV4cCI6MjA4ODMwODkzMH0.scHhvTGiABJDybgbjgjilw8XuxOfmWPsqo4iytMZmio";

async function sbUpsertToken(token) {
  if (!token?.addr) return;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/token_history?on_conflict=addr`, {
      method: "POST",
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify([{
        addr: token.addr, name: token.name || "???",
        peak_mcap: token.peakMcap || token.mcap || 0,
        entry_mcap: token.entryMcap || token.mcap || 0,
        death_time: token.alive === false ? Date.now() : null,
        first_seen: token.timestamp || Date.now(),
        graduated: token.migrated || false,
        platform: token.platform || "PumpFun",
        updated_at: new Date().toISOString(),
      }]),
    });
    console.log(`[SB] 🪙 ${token.name} → ${r.ok ? "✅" : "❌ " + r.status}`);
  } catch(e) { console.warn("[SB] upsertToken failed:", e.message); }
}

async function sbUpsertWallet(addr, ws) {
  if (!addr || !ws) return;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/wallet_scores?on_conflict=addr`, {
      method: "POST",
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify([{
        addr, wins: ws.wins || 0, losses: ws.losses || 0, holds: ws.holds || 0,
        total_pnl: ws.totalPnl || 0, total_bought: ws.totalBought || 0,
        total_sold: ws.totalSold || 0, big_wins: ws.bigWins || 0,
        trades: (ws.trades || []).slice(-50),
        win_addrs: ws.winAddrs ? [...ws.winAddrs] : [],
        loss_addrs: ws.lossAddrs ? [...ws.lossAddrs] : [],
        updated_at: new Date().toISOString(),
      }]),
    });
    if (!r.ok) console.warn(`[SB] wallet ${addr.slice(0,8)} failed:`, r.status);
  } catch(e) { console.warn("[SB] upsertWallet failed:", e.message); }
}


const COIN_COLORS = [
  { bg: "#ff6b35", fg: "#fff", rim: "#cc5528" },
  { bg: "#00d4aa", fg: "#fff", rim: "#00a885" },
  { bg: "#7c4dff", fg: "#fff", rim: "#6237cc" },
  { bg: "#ff4081", fg: "#fff", rim: "#cc3367" },
  { bg: "#448aff", fg: "#fff", rim: "#366ecc" },
  { bg: "#ffd740", fg: "#222", rim: "#ccac33" },
  { bg: "#69f0ae", fg: "#111", rim: "#54c08b" },
  { bg: "#ff5252", fg: "#fff", rim: "#cc4141" },
  { bg: "#40c4ff", fg: "#fff", rim: "#339dcc" },
  { bg: "#b388ff", fg: "#fff", rim: "#8f6dcc" },
  { bg: "#ff9100", fg: "#fff", rim: "#cc7400" },
  { bg: "#00e5ff", fg: "#111", rim: "#00b7cc" },
  { bg: "#e040fb", fg: "#fff", rim: "#b333c9" },
  { bg: "#76ff03", fg: "#111", rim: "#5ecc02" },
  { bg: "#ff6e40", fg: "#fff", rim: "#b34828" },
  { bg: "#18ffff", fg: "#111", rim: "#10b0b0" },
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function formatNum(n) { if (n >= 1e6) return (n / 1e6).toFixed(1) + "M"; if (n >= 1e3) return (n / 1e3).toFixed(1) + "K"; return n.toFixed(0); }

let SOL_USD = 84; // default, updated live from Jupiter every 30s
let MCAP_CORRECTION = 1.0; // auto-calibrated: PumpPortal FDV → DexScreener mcap ratio
const mcapSamples = []; // stores {ppMcap, dexMcap} pairs for calibration

// Convert tradeData's lastMcapSol to USD, applying correction only for PumpPortal-sourced values
function tdMcapUsd(td) {
  if (!td || !td.lastMcapSol) return 0;
  return td.mcapSource === "dex"
    ? td.lastMcapSol * SOL_USD
    : td.lastMcapSol * SOL_USD * MCAP_CORRECTION;
}

export function useLiveData({ onMarkDirty, onSmartAlert, onUpsertToken } = {}) {
  const [tokens, setTokens] = useState([]);
  const tokensRef = useRef([]); // synchronous access for intervals
  tokensRef.current = tokens; // sync during render — always up to date

  // Keep callback refs always up to date — avoids stale closure in useEffect intervals
  const onMarkDirtyRef = useRef(onMarkDirty);
  const onSmartAlertRef = useRef(onSmartAlert);
  const onUpsertTokenRef = useRef(onUpsertToken);
  useEffect(() => { onMarkDirtyRef.current = onMarkDirty; }, [onMarkDirty]);
  useEffect(() => { onSmartAlertRef.current = onSmartAlert; }, [onSmartAlert]);
  useEffect(() => { onUpsertTokenRef.current = onUpsertToken; }, [onUpsertToken]);
  const [whaleAlerts, setWhaleAlerts] = useState([]);
  const [intelEvents, setIntelEvents] = useState([]);
  const [migrations, setMigrations] = useState([]);
  const [stats, setStats] = useState({ scanned: 0, deployed: 0, rejected: 0 });

  // ─── NEW INTEL SYSTEMS ───
  const [smartMoneyAlerts, setSmartMoneyAlerts] = useState([]);
  const [bundleAlerts, setBundleAlerts] = useState([]);
  const [narratives, setNarratives] = useState([]);
  const [sessionStats, setSessionStats] = useState({
    startTime: Date.now(), tokensScanned: 0, qualified: 0, locked: 0, ejected: 0,
    migrations: 0, bestToken: null, bestPct: 0, avgLifespan: 0, lifespans: [],
  });

  // Smart money: wallets that have been in winning tokens
  const walletScores = useRef({}); // { wallet: { wins, losses, tokens: [], lossTokens: [], totalBought: 0, bigWins: 0, trades: [{token,sol,type,mcap,time}] } }
  const copyTradeAlerts = useRef(new Set()); // prevent dupes

  // Per-token tracking with wallet-level detail
  const tradeData = useRef({});
  const mintToId = useRef({});
  const seenMints = useRef(new Set());
  const firedEvents = useRef(new Set());
  const migratedMints = useRef(new Set());
  const heliusWsRef = useRef(null);        // Helius WebSocket for post-migration live tracking
  const rugCheckCache = useRef({});         // {mint: rugCheckResult}
  const geckoTrendingRef = useRef([]);      // GeckoTerminal trending pool addresses
  const definedTrendingRef = useRef([]);    // Defined.fi trending token addresses
  const curveProgressCache = useRef({});    // {mint: {pct, ts}}
  const jupVerifiedRef = useRef(new Set()); // Jupiter verified token list
  const slippageCache = useRef({});         // {mint: {slippage, ts}}
  const pumpDirectCache = useRef({});       // {mint: {data, ts}}
  const raydiumPoolCache = useRef({});      // {mint: {pool, ts}}
  const activityCache = useRef({});         // {mint: {signers, ts}}

  // ─── EDGE DETECTION GLOBALS ───
  const globalWallets = useRef(new Set());   // every wallet we've ever seen trade
  const deployerHistory = useRef({});         // { deployer: { launches: N, rugs: N, mints: [] } }

  useEffect(() => {
    const pf = connectPumpFun(
      // ─── NEW TOKEN ───
      (newToken) => {
        if (seenMints.current.has(newToken.mint)) return;
        seenMints.current.add(newToken.mint);
        if (seenMints.current.size > 500) {
          seenMints.current = new Set([...seenMints.current].slice(-300));
        }

        const name = newToken.symbol || newToken.name || "???";
        const mcap = (newToken.marketCapSol || 0) * SOL_USD * MCAP_CORRECTION;
        const id = newToken.mint + Date.now();

        console.log(`[LIVE] 🆕 ${name} | mcap: $${formatNum(mcap)} | ${newToken.mint.slice(0, 12)}...`);

        // Subscribe to this token's trades
        if (pf.subscribeToken) pf.subscribeToken(newToken.mint);

        // Track deployer history
        const dep = newToken.deployer || "";
        if (dep) {
          if (!deployerHistory.current[dep]) deployerHistory.current[dep] = { launches: 0, rugs: 0, mints: [] };
          deployerHistory.current[dep].launches++;
          deployerHistory.current[dep].mints.push(newToken.mint);
        }

        // Init comprehensive trade tracking with edge detection
        tradeData.current[newToken.mint] = {
          buys: 0, sells: 0, volSol: 0, lastMcapSol: newToken.marketCapSol || 0, mcapSource: "pp",
          deployer: dep,
          wallets: {},
          deployerSold: false,
          deployerSellPct: 0,
          totalBoughtSol: 0,
          totalSoldSol: 0,
          startMcap: (newToken.marketCapSol || 0) * SOL_USD * MCAP_CORRECTION, // mcap at birth
          athMcap: (newToken.marketCapSol || 0) * SOL_USD * MCAP_CORRECTION,   // tracks all-time high
          // ─── EDGE DETECTION ───
          freshBuyers: 0,          // buyers never seen before
          totalBuyers: 0,          // total unique buyers
          buyTimes: [],            // last 60 buy timestamps for velocity
          buySizes: [],            // last 60 buy sizes in SOL
          launchTime: Date.now(),  // token creation time
          lastTradeTime: Date.now(),  // track staleness
          sellTimes: [],              // last 60 sell timestamps
          milestones: {},          // { "10k": ms_elapsed, "20k": ms_elapsed, ... }
          earlyBuyers: {},         // first 15 buyers: wallet -> { initBuy, totalBought, totalSold }
          earlyBuyerCount: 0,
          holderSnapshots: [],      // [{time, count}] for growth rate
          mcapSnapshots: [],        // [{time, mcap}] for trajectory
        };
        mintToId.current[newToken.mint] = id;

        const token = {
          id, addr: newToken.mint, name, fullName: newToken.name || name,
          platform: newToken.platform || "PumpFun", mcap, vol: 0, priceUsd: 0, liquidity: mcap * 0.1,
          holders: 1, devWallet: 0, buys: 0, sells: 0,
          riskScore: 30, qualified: false, qualScore: 0, qualChecks: [],
          threat: "SCANNING", threatColor: "#ffe600",
          bundleDetected: false, bundleSize: 0, mintAuth: false,
          topHolderPct: 0, dupeCount: 0,
          bx: Math.random() * 0.8 + 0.1, by: 0.92, targetY: 0.92,
          vx: (Math.random() - 0.5) * 0.0006, health: 50, alive: true,
          age: 0, trail: [], warpIn: false, warpProgress: 1,
          warpStartX: Math.random(), warpStartY: Math.random() * 0.2 - 0.1,
          bobOffset: Math.random() * Math.PI * 2,
          initials: name.slice(0, 2).toUpperCase(),
          coinColor: pick(COIN_COLORS),
          timestamp: Date.now(), deployer: newToken.deployer || "",
          imageUri: newToken.imageUri || "",
          jupVerified: jupVerifiedRef.current.has(newToken.mint),
        };

        setTokens(prev => {
          let list = [token, ...prev];
          // Purge aggressively — SOL tokens come and go fast
          const now2 = Date.now();
          list = list.filter(t => {
            if (t.migrated) return true;
            if (!t.alive && now2 - (t.deathTime || t.timestamp) > 45000) return false;
            if (t.alive && !t.qualified && t.buys <= 0 && t.sells <= 0 && now2 - t.timestamp > 30000) return false;
            if (t.alive && !t.migrated && (t.mcap || 0) < 3000 && (t.buys || 0) < 3 && now2 - t.timestamp > 90000) return false;
            return true;
          });
          return list.slice(0, 150);
        });
        setStats(s => ({ ...s, scanned: s.scanned + 1 }));

        setIntelEvents(prev => [{
          id: Date.now() + Math.random(), type: "launch", icon: "🚀", color: "#00ffff",
          text: `${name} launched | mcap $${formatNum(mcap)} | deployer: ${(newToken.deployer || "").slice(0, 8)}...`,
          timestamp: Date.now(), priority: "NORMAL",
        }, ...prev].slice(0, 40));
      },

      // ─── TRADE ───
      (trade) => {
        const mint = trade.mint;
        const td = tradeData.current[mint];
        if (!td) return;

        const wallet = trade.wallet || "";
        const sol = trade.solAmount || 0;
        const now = Date.now();

        td.lastTradeTime = now;  // track staleness

        // Track per-wallet activity
        if (!td.wallets[wallet]) td.wallets[wallet] = { bought: 0, sold: 0, entryMcap: 0, firstBuyTime: now, sellEvents: [] };

        if (trade.type === "buy") {
          // ─── CYCLE RESET: if wallet previously fully exited this token, start fresh ───
          const wData = td.wallets[wallet];
          if (wData && wData.bought > 0) {
            const prevSoldRatio = wData.bought > 0 ? (wData.sold || 0) / wData.bought : 0;
            if (prevSoldRatio >= 0.90) {
              // New buy cycle — wipe old position data
              td.wallets[wallet] = { bought: 0, sold: 0, entryMcap: 0, firstBuyTime: now, lastSellTime: null, exitMcap: 0, sellEvents: [] };
              // Also clear from wallet scores so new HOLD can be tracked cleanly
              const wsNow = walletScores.current[wallet];
              if (wsNow) {
                // Remove from holdAddrs so scoring loop treats this as a new position
                if (wsNow.holdAddrs?.has(mint)) {
                  wsNow.holdAddrs.delete(mint);
                  wsNow.holds = Math.max(0, (wsNow.holds||0) - 1);
                  wsNow.holdTokens = (wsNow.holdTokens||[]).filter(a => a !== mint);
                  // Keep the old resolved HOLD trade in history but allow new one
                  const oldHold = wsNow.trades?.find(tr => tr.addr === mint && tr.type === "HOLD");
                  if (oldHold) oldHold.type = "CLOSED_HOLD"; // archive it, stop refreshing
                }
                // Reset activeBuys for fresh entry
                if (wsNow.activeBuys) delete wsNow.activeBuys[mint];
              }
            }
          }
          td.buys++;
          td.totalBoughtSol += sol;
          td.wallets[wallet].bought += sol;
          if (!td.wallets[wallet].firstBuyTime) td.wallets[wallet].firstBuyTime = now;
          // Store entry mcap on first buy for this wallet on this token
          if (!td.wallets[wallet].entryMcap) {
            const mcapNow = (trade.marketCapSol || td.lastMcapSol || 0) * SOL_USD * MCAP_CORRECTION;
            td.wallets[wallet].entryMcap = mcapNow;
          }

          // ─── FRESH WALLET DETECTION ───
          td.totalBuyers++;
          if (!globalWallets.current.has(wallet)) {
            td.freshBuyers++;
          }

          // ─── BUY VELOCITY ───
          td.buyTimes.push(now);
          if (td.buyTimes.length > 60) td.buyTimes = td.buyTimes.slice(-60);

          // ─── BUY SIZE TRACKING ───
          td.buySizes.push(sol);
          if (td.buySizes.length > 60) td.buySizes = td.buySizes.slice(-60);

          // ─── EARLY BUYER TRACKING (first 15 buyers) ───
          if (td.earlyBuyerCount < 15 && !td.earlyBuyers[wallet]) {
            td.earlyBuyers[wallet] = { initBuy: sol, totalBought: sol, totalSold: 0 };
            td.earlyBuyerCount++;
          } else if (td.earlyBuyers[wallet]) {
            td.earlyBuyers[wallet].totalBought += sol;
          }

          // ─── BUNDLE DETECTION: 4+ unique wallets buying within 2s ───
          if (!td.recentBuyers) td.recentBuyers = [];
          td.recentBuyers.push({ wallet, time: now });
          td.recentBuyers = td.recentBuyers.filter(b => now - b.time < 2000);
          const uniqueRecent = new Set(td.recentBuyers.map(b => b.wallet));
          if (uniqueRecent.size >= 4 && !td.bundleDetected) {
            td.bundleDetected = true;
            td.bundleWallets = new Set(uniqueRecent); // FROZEN — only the original coordinated wallets
            td.bundleSize = uniqueRecent.size;
            const tokenName = mintToId.current[mint] ?
              undefined : mint.slice(0, 8);
            setBundleAlerts(p => [{
              id: Date.now() + Math.random(), mint, wallets: uniqueRecent.size,
              time: now, name: tokenName,
            }, ...p].slice(0, 30));
            console.log(`[BUNDLE] ⚠ ${mint.slice(0,8)} — ${uniqueRecent.size} wallets in 2s`);
          }
          // NOTE: no longer adds future buyers to bundleWallets — set is frozen at detection

          // ─── SMART MONEY: check if buying wallet has wins + win rate ───
          if (!td.smartWallets) td.smartWallets = new Set();
          // Create walletScores entry immediately on first buy so lastActivity is fresh
          if (!walletScores.current[wallet]) {
            walletScores.current[wallet] = {
              wins: 0, losses: 0, holds: 0,
              tokens: [], lossTokens: [], holdTokens: [],
              winAddrs: new Set(), lossAddrs: new Set(), holdAddrs: new Set(),
              totalBought: 0, totalSold: 0, totalPnl: 0, bigWins: 0, trades: [],
              lastActivity: now, activeBuys: {},
            };
          }
          const ws = walletScores.current[wallet];
          // Update lastActivity on actual trade (not scoring loop)
          if (ws) ws.lastActivity = now;

          // ─── TRACK ACTIVE POSITION so it shows in wallet detail immediately ───
          if (ws) {
            if (!ws.activeBuys) ws.activeBuys = {};
            const entryMcNow = tdMcapUsd(td);
            if (!ws.activeBuys[mint]) {
              const _tid = mintToId.current[mint];
              const _tname = _tid ? (tokensRef.current.find(t2=>t2.id===_tid)?.name || mint.slice(0,8)) : mint.slice(0,8);
              ws.activeBuys[mint] = { token: _tname, addr: mint, sol: 0, entryMcap: entryMcNow||0, time: now };
            }
            ws.activeBuys[mint].sol += sol;
          }
          // Compute unrealized loss drag from open holds
          const unrealizedPnl = ws ? (ws.trades||[]).filter(tr=>tr.type==="HOLD")
            .reduce((s,tr)=>s+(tr.pnl!=null?tr.pnl:((tr.sold||0)-tr.sol)),0) : 0;
          const qualWinCount = ws ? (ws.trades||[]).filter(tr=>tr.type==="WIN").length : 0;
          const qualLossCount = ws ? (ws.trades||[]).filter(tr=>tr.type==="LOSS").length : 0;
          const qualTotal = qualWinCount + qualLossCount;
          const qualRate = qualTotal > 0 ? qualWinCount / qualTotal : 0;
          const adjustedPnl = ws ? (ws.totalPnl||0) + unrealizedPnl : 0;
          const isElite = ws && qualWinCount >= 3 && qualRate >= 0.60 && qualWinCount >= (qualLossCount*2) && qualTotal >= 4 && (ws.totalPnl||0) >= 0.5 && adjustedPnl > 0.2 && sol > 0.2;
          if (isElite) {
            td.smartWallets.add(wallet);
            const alertKey = `${wallet.slice(0,8)}-${mint}`;
            if (!copyTradeAlerts.current.has(alertKey)) {
              copyTradeAlerts.current.add(alertKey);
              const alertObj = {
                id: Date.now() + Math.random(), wallet, mint, sol,
                wins: ws.wins, winTokens: ws.tokens.slice(-3),
                time: now,
              };
              setSmartMoneyAlerts(p => [alertObj, ...p].slice(0, 30));
              if (onSmartAlertRef.current) onSmartAlertRef.current(alertObj);
              console.log(`[SMART$] 🧠 Winner wallet (${ws.wins}w) bought ${sol.toFixed(2)} SOL into ${mint.slice(0,8)}`);
            }
          }
        } else {
          td.sells++;
          td.totalSoldSol += sol;
          td.wallets[wallet].sold += sol;

          // Update lastActivity on sell
          if (walletScores.current[wallet]) walletScores.current[wallet].lastActivity = now;
          td.wallets[wallet].lastSellTime = now;
          // Capture mcap at time of sell for accurate exit display
          const sellMcapNow = tdMcapUsd(td);
          td.wallets[wallet].exitMcap = sellMcapNow;

          // Track individual sell events for trade card breakdown
          if (!td.wallets[wallet].sellEvents) td.wallets[wallet].sellEvents = [];
          td.wallets[wallet].sellEvents.push({ sol, mcap: sellMcapNow, time: now });

          // ─── SELL VELOCITY ───
          td.sellTimes.push(now);
          if (td.sellTimes.length > 60) td.sellTimes = td.sellTimes.slice(-60);

          // Update early buyer sells
          if (td.earlyBuyers[wallet]) {
            td.earlyBuyers[wallet].totalSold += sol;
          }
        }

        // Mark wallet as globally seen
        globalWallets.current.add(wallet);
        // Cap global set size
        if (globalWallets.current.size > 50000) {
          const arr = [...globalWallets.current];
          globalWallets.current = new Set(arr.slice(-30000));
        }

        td.volSol += sol;
        if (trade.marketCapSol > 0) {
          // ─── MILESTONE TRACKING ───
          const oldMcap = td.mcapSource === "dex" ? td.lastMcapSol * SOL_USD : td.lastMcapSol * SOL_USD * MCAP_CORRECTION;
          td.lastMcapSol = trade.marketCapSol;
          td.mcapSource = "pp"; // PumpPortal raw value, needs correction
          const newMcapUsd = trade.marketCapSol * SOL_USD * MCAP_CORRECTION;
          // ─── ATH TRACKING ───
          if (!td.athMcap || newMcapUsd > td.athMcap) td.athMcap = newMcapUsd;
          const elapsed = now - td.launchTime;
          [10000, 20000, 30000, 50000].forEach(m => {
            if (!td.milestones[m] && newMcapUsd >= m && oldMcap < m) {
              td.milestones[m] = elapsed;
            }
          });
        }

        // Track deployer sells
        if (wallet === td.deployer && trade.type === "sell") {
          td.deployerSold = true;
          const devBought = td.wallets[wallet].bought;
          td.deployerSellPct = devBought > 0
            ? (td.wallets[wallet].sold / devBought) * 100
            : 100;
        }

        // Compute live metrics
        const uniqueWallets = Object.keys(td.wallets).length;
        const newMcap = tdMcapUsd(td);
        const volUsd = td.volSol * SOL_USD;

        // Top holder concentration: biggest NET holder's % of total net bought
        let maxNet = 0;
        let totalNet = 0;
        Object.values(td.wallets).forEach(w => {
          const net = Math.max(0, w.bought - w.sold);
          if (net > maxNet) maxNet = net;
          totalNet += net;
        });
        const topHolderPct = totalNet > 0 ? (maxNet / totalNet) * 100 : 0;

        // Dev wallet % = deployer's net holding as % of total volume
        const deployerNet = td.wallets[td.deployer]
          ? td.wallets[td.deployer].bought - td.wallets[td.deployer].sold : 0;
        const devPct = td.totalBoughtSol > 0 ? Math.max(0, (deployerNet / td.totalBoughtSol) * 100) : 0;

        // Liquidity estimate from volume
        const liq = volUsd * 0.3; // rough estimate

        // Update token (+ resurrect if dead but getting new buys)
        const tokenId = mintToId.current[mint];
        if (tokenId) {
          setTokens(prev => prev.map(t => {
            if (t.id !== tokenId) return t;
            // Revival conditions: dead token getting real traction back
            const canRevive = !t.alive && trade.type === "buy" && td.buys > td.sells + 2 && newMcap > 5000;
            // Reset resurrection flag after 60s so tokens can revive again
            if (td._resurrected && td._resurrectTime && Date.now() - td._resurrectTime > 60000) {
              td._resurrected = false;
            }
            if (canRevive && !td._resurrected) {
              td._resurrected = true;
              td._resurrectTime = Date.now();
              setIntelEvents(p => [{
                id: Date.now() + Math.random(), type: "momentum", icon: "🔥", color: "#ffd740",
                text: `${t.name} RESURRECTED — ${t.migrated?"migrated token":"token"} fighting back at $${formatNum(newMcap)}`,
                timestamp: Date.now(), priority: "HIGH",
              }, ...p].slice(0, 40));
            }
            return {
              ...t,
              buys: td.buys, sells: td.sells,
              vol: volUsd,
              mcap: newMcap > 0 ? newMcap : t.mcap,
              athMcap: Math.max(t.athMcap || 0, newMcap > 0 ? newMcap : 0, td.athMcap || 0),
              holders: uniqueWallets,
              topHolderPct: Math.round(topHolderPct),
              devWallet: Math.round(devPct),
              liquidity: liq,
              ...(canRevive ? { alive: true, health: 45, by: 0.92, bx: Math.random()*0.8+0.1 } : {}),
            };
          }));
        }

        // Whale alerts
        if (sol > 2) {
          const wTokenName = tokenId ? (tokensRef.current.find(t2=>t2.id===tokenId)?.name || mint.slice(0,8)+"...") : mint.slice(0,8)+"...";
          setWhaleAlerts(prev => [{
            id: Date.now() + Math.random(),
            wallet: wallet.slice(0, 12) + "...",
            action: trade.type === "buy" ? "BUY" : "SELL",
            token: wTokenName,
            tokenMint: mint.slice(0, 8) + "...",
            amount: sol * SOL_USD,
            solAmount: sol,
            timestamp: Date.now(),
          }, ...prev].slice(0, 20));
        }

        if (sol > 10) {
          setIntelEvents(prev => [{
            id: Date.now() + Math.random(),
            type: trade.type === "buy" ? "whale" : "dump",
            icon: trade.type === "buy" ? "🐋" : "📉",
            color: trade.type === "buy" ? "#bf00ff" : "#ff073a",
            text: `${sol.toFixed(1)} SOL ${trade.type} on ${mint.slice(0, 8)}...`,
            timestamp: Date.now(),
            priority: sol > 50 ? "HIGH" : "NORMAL",
          }, ...prev].slice(0, 40));
        }

        // Deployer sell alert
        if (wallet === td.deployer && trade.type === "sell" && sol > 0.5) {
          const tokenId2 = mintToId.current[mint];
          const tokenName = tokensRef.current.find(t2 => t2.id === tokenId2)?.name || mint.slice(0, 8);
          setIntelEvents(prev => [{
            id: Date.now() + Math.random(), type: "dump", icon: "🔴", color: "#ff073a",
            text: `DEV SELLING ${tokenName} — ${sol.toFixed(1)} SOL dumped by deployer`,
            timestamp: Date.now(), priority: "HIGH",
          }, ...prev].slice(0, 40));
        }
      },

      // ─── MIGRATION: token graduated to Raydium ───
      (migration) => {
        if (migratedMints.current.has(migration.mint)) return;
        migratedMints.current.add(migration.mint);

        // Subscribe to Helius WebSocket for real-time swap detection
        if (heliusWsRef.current) {
          heliusWsRef.current.subscribe(migration.mint);
          console.log(`[MIGRATE] 📡 Helius WS subscribed to ${migration.mint.slice(0, 8)}`);
        }

        // Run RugCheck in background (non-blocking)
        fetchRugCheck(migration.mint).then(rc => {
          if (!rc) return;
          rugCheckCache.current[migration.mint] = rc;
          console.log(`[RUGCHECK] 🛡 ${migration.mint.slice(0, 8)} → score:${rc.score} level:${rc.riskLevel} mint:${rc.mintAuthority} freeze:${rc.freezeAuthority}`);
          // Update token with rugcheck data
          const tid = mintToId.current[migration.mint];
          if (tid) {
            setTokens(prev => prev.map(t => t.id === tid ? {
              ...t,
              rugScore: rc.score,
              rugLevel: rc.riskLevel,
              rugRisks: rc.risks,
              lpLocked: rc.lpLocked,
            } : t));
          }
          // Update migration entry
          setMigrations(prev => prev.map(m => m.mint === migration.mint ? {
            ...m, rugScore: rc.score, rugLevel: rc.riskLevel, lpLocked: rc.lpLocked,
          } : m));
        }).catch(e => console.warn("[RUGCHECK] Failed:", e.message));

        const tokenId = mintToId.current[migration.mint];
        const td = tradeData.current[migration.mint];
        const mcapUsd = (migration.marketCapSol || 0) * SOL_USD * MCAP_CORRECTION;

        console.log(`[MIGRATE] 🌉 FIRING for ${migration.mint.slice(0,8)} | tokenId:${tokenId ? "YES" : "NO"} | mcapSol:${migration.marketCapSol} | mcapUsd:$${formatNum(mcapUsd)}`);

        // Find the token name
        let tokenName = migration.mint.slice(0, 8) + "...";
        const migTok = tokensRef.current.find(t => t.id === tokenId);
        if (migTok) tokenName = migTok.name;
        else console.warn(`[MIGRATE] ⚠ Token ${migration.mint.slice(0,8)} not found in tokensRef! tokenId:${tokenId}`);

        console.log(`[LIVE] 🌉 MIGRATION: ${tokenName} graduated to Raydium | mcap: $${formatNum(mcapUsd)}`);

        // Add to migrations list (deduplicate by mint)
        setMigrations(prev => {
          if(prev.some(m=>m.mint===migration.mint)) return prev;
          return [{
          id: Date.now() + Math.random(),
          mint: migration.mint,
          tokenId,
          name: tokenName,
          mcap: mcapUsd,
          vol: td ? td.volSol * SOL_USD : 0,
          holders: td ? Object.keys(td.wallets || {}).length : 0,
          timestamp: Date.now(),
          laserActive: true,
        }, ...prev].slice(0, 20)});

        // Mark token as migrated — enters battlefield with laser from radar
        if (tokenId) {
          // Calculate correct Y position from mcap (same formula as battlefield progression)
          // Piecewise Y matching battlefield zones
          const mc2 = mcapUsd;
          const zz=[[5000,0.95],[10000,0.63],[20000,0.47],[50000,0.32],[100000,0.20],[300000,0.10]];
          let entryY=0.95;
          if(mc2>=300000)entryY=0.05;
          else{for(let i=0;i<zz.length-1;i++){
            if(mc2>=zz[i][0]&&mc2<zz[i+1][0]){
              const pct=(mc2-zz[i][0])/(zz[i+1][0]-zz[i][0]);
              entryY=zz[i][1]+(zz[i+1][1]-zz[i][1])*pct;break;}}}
          const landX = 0.3 + Math.random() * 0.35;
          setTokens(prev => prev.map(t => t.id === tokenId && !t.migrated ? {
            ...t, migrated: true, migratedAt: Date.now(),
            laserIn: true, laserProgress: 0,
            laserTargetX: landX, laserTargetY: entryY,
            bx: 1.02, by: 0.18, targetY: entryY,
            warpIn: false, alive: true,
            qualified: true, health: 95,
          } : t));
          // Write migration to DB
          if (onUpsertTokenRef.current) onUpsertTokenRef.current({
            addr: migration.mint, name: tokenName,
            mcap: mcapUsd, peakMcap: mcapUsd,
            timestamp: Date.now(), migrated: true,
            alive: true, platform: "Raydium",
          });
        }

        setIntelEvents(prev => [{
          id: Date.now() + Math.random(), type: "migration", icon: "🌉", color: "#39ff14",
          text: `${tokenName} MIGRATED TO RAYDIUM — $${formatNum(mcapUsd)} mcap — ON THE FIELD`,
          timestamp: Date.now(), priority: "HIGH",
        }, ...prev].slice(0, 40));
      }
    );

    // ─── QUALIFY TOKENS EVERY 5s ───
    const qualInterval = setInterval(() => {
      setTokens(prev => {
        const result = prev.map(t => {
        const td = tradeData.current[t.addr];
        if (!td || (td.buys + td.sells < 2)) return t;

        const buys = td.buys;
        const sells = td.sells;
        const volUsd = td.volSol * SOL_USD;
        const mcap = tdMcapUsd(td);
        const uniqueWallets = Object.keys(td.wallets).length;
        const volMcapRatio = mcap > 0 ? volUsd / mcap : 0;
        const isSuspicious = mcap > 50000 && volMcapRatio < 0.05;
        const now = Date.now();

        // Top holder concentration (net position, not raw buys)
        let maxNet2 = 0, totalNet2 = 0;
        Object.values(td.wallets).forEach(w => {
          const net = Math.max(0, w.bought - w.sold);
          if (net > maxNet2) maxNet2 = net;
          totalNet2 += net;
        });
        const topPct = totalNet2 > 0 ? (maxNet2 / totalNet2) * 100 : 0;

        // Dev wallet
        const deployerNet = td.wallets[td.deployer]
          ? td.wallets[td.deployer].bought - td.wallets[td.deployer].sold : 0;
        const devPct = td.totalBoughtSol > 0 ? Math.max(0, (deployerNet / td.totalBoughtSol) * 100) : 0;

        // ═══════════ EDGE DETECTION METRICS ═══════════

        // 1. FRESH WALLET % — high = probably coordinated
        const freshPct = td.totalBuyers > 0 ? (td.freshBuyers / td.totalBuyers) * 100 : 50;

        // 1b. SNAPSHOT COLLECTION — holder count and mcap over time
        const holderCount = Object.keys(td.wallets).filter(w => {
          const ww = td.wallets[w];
          return (ww.totalBought || 0) > (ww.totalSold || 0);
        }).length || 1;
        if(!td.holderSnapshots)td.holderSnapshots=[];
        if(!td.mcapSnapshots)td.mcapSnapshots=[];
        td.holderSnapshots.push({time: now, count: holderCount});
        td.mcapSnapshots.push({time: now, mcap: mcap});
        // Keep only last 2 minutes of snapshots
        td.holderSnapshots = td.holderSnapshots.filter(s => now - s.time < 120000);
        td.mcapSnapshots = td.mcapSnapshots.filter(s => now - s.time < 120000);

        // HOLDER GROWTH RATE — holders/min over last 30s
        const hSnap30 = td.holderSnapshots.filter(s => now - s.time < 30000);
        const holderGrowthRate = hSnap30.length >= 2 ?
          (hSnap30[hSnap30.length-1].count - hSnap30[0].count) / ((now - hSnap30[0].time) / 60000) : 0;

        // MCAP VELOCITY — $ change per minute over last 30s
        const mSnap30 = td.mcapSnapshots.filter(s => now - s.time < 30000);
        const mcapVelocity = mSnap30.length >= 2 ?
          (mSnap30[mSnap30.length-1].mcap - mSnap30[0].mcap) / ((now - mSnap30[0].time) / 60000) : 0;
        // MCAP trajectory as % change per minute
        const mcapStart = mSnap30.length >= 2 ? mSnap30[0].mcap : mcap;
        const mcapTrajectory = mcapStart > 0 ? (mcapVelocity / mcapStart) * 100 : 0;

        // 2. BUY VELOCITY — buys in last 30s vs previous 30s
        const recentBuys = td.buyTimes.filter(t2 => now - t2 < 30000).length;
        const prevBuys = td.buyTimes.filter(t2 => now - t2 >= 30000 && now - t2 < 60000).length;
        const velocity = recentBuys; // raw buys per 30s
        const accelerating = recentBuys > prevBuys * 1.3 && recentBuys >= 3;

        // 3. BUY SIZE DISTRIBUTION — lots of small buys = organic
        const smallBuys = td.buySizes.filter(s => s < 0.5).length; // under 0.5 SOL (~$42)
        const largeBuys = td.buySizes.filter(s => s > 3).length;   // over 3 SOL (~$250)
        const smallBuyRatio = td.buySizes.length > 0 ? smallBuys / td.buySizes.length : 0;
        const avgBuySize = td.buySizes.length > 0 ? td.buySizes.reduce((a, b) => a + b, 0) / td.buySizes.length : 0;

        // 4. TIME TO MILESTONES — faster = hotter
        const timeTo10k = td.milestones[10000] || 0;
        const timeTo20k = td.milestones[20000] || 0;
        const fastRunner = timeTo10k > 0 && timeTo10k < 120000; // hit 10K in under 2 min
        const rocketShip = timeTo20k > 0 && timeTo20k < 180000; // hit 20K in under 3 min

        // 5. HOLDER RETENTION — are early buyers holding or dumping?
        let earlyHolding = 0, earlyDumped = 0;
        Object.values(td.earlyBuyers).forEach(eb => {
          const net = eb.totalBought - eb.totalSold;
          if (net > eb.initBuy * 0.3) earlyHolding++;  // still holding 30%+
          else earlyDumped++;
        });
        const retentionPct = td.earlyBuyerCount > 0 ? (earlyHolding / td.earlyBuyerCount) * 100 : 50;

        // 6. DEPLOYER REPUTATION — graded A-F
        const depHist = deployerHistory.current[td.deployer];
        const depLaunches = depHist ? depHist.launches : 0;
        const depRugs = depHist ? depHist.rugs : 0;
        let deployerGrade = "A"; // no history = clean
        if (depRugs > 0) deployerGrade = depLaunches > 5 ? "F" : "D";
        else if (depLaunches > 8) deployerGrade = "F";
        else if (depLaunches > 3) deployerGrade = "C";
        else if (depLaunches > 1) deployerGrade = "B";
        const serialDeployer = depLaunches > 3;
        const hyperDeployer = depLaunches > 8;

        // 7. BUNDLE DETECTION — coordinated buys (live active count)
        const bundleDetected = !!td.bundleDetected;
        let bundleSize = 0;
        if (bundleDetected && td.bundleWallets) {
          td.bundleWallets.forEach(w => {
            const wd = td.wallets[w];
            if (wd && (wd.bought - wd.sold) > 0.01) bundleSize++;
          });
          td.bundleSize = bundleSize; // update live count
        }

        // 8. SMART MONEY — winning wallets still holding? (live active count)
        let hasSmartMoney = false;
        let smartWalletCount = 0;
        const smartSet = td.smartWallets || new Set();
        // Check tracked smart wallets + scan all wallets for new smart money
        // Also remove wallets that have degraded below threshold
        const newSmartSet = new Set();
        Object.keys(td.wallets).forEach(w => {
          const ws = walletScores.current[w];
          const wsTotal2 = ws ? (ws.wins + ws.losses) : 0;
          const wsRate2 = wsTotal2 > 0 ? ws.wins / wsTotal2 : 0;
          if (ws && ws.wins >= 3 && wsRate2 >= 0.60 && ws.wins > (ws.losses||0) && wsTotal2 >= 4) {
            newSmartSet.add(w);
            const wd = td.wallets[w];
            if (wd && (wd.bought - wd.sold) > 0.01) {
              hasSmartMoney = true;
              smartWalletCount++;
            }
          }
        });
        td.smartWallets = newSmartSet;

        // 9. NARRATIVE MATCH — is token name trending?
        let narrativeMatch = false;
        let narrativeWord = "";
        setNarratives(narr => {
          const nameWords = (t.name || "").toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/);
          for (const n of narr) {
            if (nameWords.includes(n.word) && n.count >= 3) {
              narrativeMatch = true;
              narrativeWord = n.word;
              break;
            }
          }
          return narr;
        });

        // 10. STALENESS — how long since last trade (migrated tokens get grace)
        const staleSec = Math.floor((now - td.lastTradeTime) / 1000);
        const migratedGrace = t.migrated && t.migratedAt && (now - t.migratedAt < 300000); // 5min grace
        const isStale = !migratedGrace && staleSec > 60;  // no trades in 60s
        const isDead = !migratedGrace && staleSec > 180;  // no trades in 3 min = probably dead

        // Track deployer rugs (mark once)
        if (isDead && td.deployer && !td._rugMarked) {
          td._rugMarked = true;
          const dh = deployerHistory.current[td.deployer];
          if (dh) dh.rugs = (dh.rugs || 0) + 1;
        }

        // 11. RECENT SELL PRESSURE — sells vs buys in last 30s
        const recentBuys30 = td.buyTimes.filter(t2 => now - t2 < 30000).length;
        const recentSells30 = td.sellTimes.filter(t2 => now - t2 < 30000).length;
        const sellDumping = recentSells30 > recentBuys30 * 2 && recentSells30 >= 3;

        // ═══════════ RISK SCORING (soft signals) ═══════════
        let risk = 40;

        // Base metrics
        if (buys > 5) risk += 8;
        if (buys > sells * 1.5 && buys > 3) risk += 8;
        if (volUsd > 1000) risk += 8;
        if (mcap > 5000) risk += 5;
        if (uniqueWallets > 10) risk += 8;
        if (topPct > 50) risk -= 12;
        if (td.deployerSold) risk -= 15;
        if (devPct > 30) risk -= 10;
        if (isSuspicious) risk -= 25;

        // Fresh wallet penalty (soft — not disqualifying)
        if (freshPct > 85 && td.totalBuyers > 5) risk -= 12;   // very sus
        else if (freshPct > 70 && td.totalBuyers > 8) risk -= 6; // kinda sus
        else if (freshPct < 50) risk += 5;                       // established wallets = good

        // Buy velocity bonus
        if (accelerating) risk += 10;
        if (velocity >= 5) risk += 5;   // 5+ buys in 30s = hot

        // Buy size distribution
        if (smallBuyRatio > 0.6 && td.buySizes.length > 5) risk += 8;  // lots of small = organic retail
        if (largeBuys > 3 && smallBuys < 2) risk -= 8;                 // all whales, no retail = propped up

        // Speed bonus
        if (fastRunner) risk += 8;
        if (rocketShip) risk += 5;

        // Holder retention
        if (retentionPct > 70 && td.earlyBuyerCount >= 5) risk += 10;  // diamond hands
        else if (retentionPct < 30 && td.earlyBuyerCount >= 5) risk -= 10; // early dump

        // Staleness — no trades = dying
        if (isDead) risk -= 25;       // 3+ min no trades = probably rugged
        else if (isStale) risk -= 12;  // 1+ min no trades = losing interest

        // Active sell pressure
        if (sellDumping) risk -= 15;  // sells overwhelming buys = dump in progress

        // Bundle detection — coordinated launch
        if (bundleDetected) risk -= 15;  // multi-wallet same-block buys = likely manipulated

        // Smart money signal
        if (hasSmartMoney) risk += 8;   // proven winners are buying
        if (smartWalletCount >= 3) risk += 5;  // multiple smart wallets = strong conviction

        // Narrative momentum
        if (narrativeMatch) risk += 5;   // riding a trending meta

        // Deployer grade (replaces simple serial/hyper check)
        if (deployerGrade === "F") risk -= 20;  // serial rugger
        else if (deployerGrade === "D") risk -= 15;  // has rugged before
        else if (deployerGrade === "C") risk -= 8;   // too many launches
        else if (deployerGrade === "A") risk += 3;    // clean deployer

        // On-chain flags from Helius
        if (t.mintAuth) risk -= 20;    // mint authority still enabled = can create more tokens
        if (t.frozen) risk -= 25;      // frozen = can freeze your tokens
        risk = Math.max(0, Math.min(100, risk));

        // ═══════════ QUALIFICATION CHECKS ═══════════
        let score = 0;
        const checks = [];
        const test = (n, pass) => { checks.push({ name: n, pass: !!pass }); if (pass) score++; };

        test("RISK", risk >= 45);
        test("WALLETS", uniqueWallets >= 4);
        test("DEV<25%", devPct < 25);
        test("NO DUMP", !td.deployerSold || td.deployerSellPct < 50);
        test("ORGANIC", !isSuspicious);
        test("VOLUME", volUsd > 200);
        test("BUYS", buys > sells && buys > 2);
        test("DISTRO", topPct < 55);

        const qualified = score >= 5;
        const threat = isSuspicious ? "SUSPICIOUS" :
          hyperDeployer ? "SERIAL DEV" :
          bundleDetected ? "⚠ BUNDLED" :
          td.deployerSold ? "DEV SOLD" :
          hasSmartMoney ? "🧠 SMART$" :
          accelerating && risk > 60 ? "🔥 HOT" :
          risk > 75 ? "LOW" : risk > 55 ? "MODERATE" : risk > 35 ? "HIGH" : "EXTREME";
        const threatColor = isSuspicious || hyperDeployer ? "#ff073a" :
          bundleDetected ? "#ff073a" :
          td.deployerSold ? "#ff073a" :
          hasSmartMoney ? "#ff9500" :
          accelerating && risk > 60 ? "#39ff14" :
          risk > 75 ? "#39ff14" : risk > 55 ? "#ffe600" : risk > 35 ? "#ff6600" : "#ff073a";

        // Fire events once
        if (!firedEvents.current.has(t.id)) {
          firedEvents.current.add(t.id);

          if (isSuspicious) {
            setIntelEvents(p => [{
              id: Date.now() + Math.random(), type: "rug_pattern", icon: "🔴", color: "#ff073a",
              text: `${t.name} — SUSPICIOUS: $${formatNum(mcap)} mcap, only $${formatNum(volUsd)} vol (${(volMcapRatio * 100).toFixed(1)}%)`,
              timestamp: Date.now(), priority: "HIGH",
            }, ...p].slice(0, 40));
          }

          if (serialDeployer) {
            setIntelEvents(p => [{
              id: Date.now() + Math.random(), type: "rug_pattern", icon: "⚠", color: "#ff6600",
              text: `${t.name} — SERIAL DEPLOYER: ${depHist.launches} tokens launched from this wallet`,
              timestamp: Date.now(), priority: "HIGH",
            }, ...p].slice(0, 40));
          }

          if (freshPct > 80 && td.totalBuyers > 5) {
            setIntelEvents(p => [{
              id: Date.now() + Math.random(), type: "rug_pattern", icon: "👻", color: "#ff6600",
              text: `${t.name} — ${Math.round(freshPct)}% fresh wallets (${td.freshBuyers}/${td.totalBuyers}) — possible coordinated buy`,
              timestamp: Date.now(), priority: "NORMAL",
            }, ...p].slice(0, 40));
          }

          if (rocketShip) {
            setIntelEvents(p => [{
              id: Date.now() + Math.random(), type: "momentum", icon: "⚡", color: "#ffd740",
              text: `${t.name} — ROCKET: hit $20K in ${(timeTo20k / 1000).toFixed(0)}s`,
              timestamp: Date.now(), priority: "HIGH",
            }, ...p].slice(0, 40));
          }

          if (qualified) {
            setStats(s => ({ ...s, deployed: s.deployed + 1 }));
            setIntelEvents(p => [{
              id: Date.now() + Math.random(), type: "deploy", icon: "⚡", color: "#39ff14",
              text: `${t.name} qualified ${score}/8 — ${uniqueWallets}w, $${formatNum(volUsd)} vol, ${Math.round(freshPct)}% fresh, ${Math.round(retentionPct)}% retain`,
              timestamp: Date.now(), priority: "HIGH",
            }, ...p].slice(0, 40));
          } else {
            setStats(s => ({ ...s, rejected: s.rejected + 1 }));
            setIntelEvents(p => [{
              id: Date.now() + Math.random(), type: "reject", icon: "🚫", color: "#ff073a",
              text: `${t.name} failed ${score}/8 — ${threat}`,
              timestamp: Date.now(), priority: "NORMAL",
            }, ...p].slice(0, 40));
          }
        }

        const updatedToken = {
          ...t, qualified, qualScore: score, qualChecks: checks,
          riskScore: risk, threat, threatColor,
          mcap: mcap > 0 ? mcap : t.mcap, vol: volUsd,
          buys, sells, holders: uniqueWallets,
          topHolderPct: Math.round(topPct),
          devWallet: Math.round(devPct),
          health: qualified ? 70 + (risk - 50) * 0.6 : 20 + risk * 0.3,
          freshPct: Math.round(freshPct),
          velocity, accelerating,
          smallBuyRatio: Math.round(smallBuyRatio * 100),
          avgBuySol: avgBuySize,
          retentionPct: Math.round(retentionPct),
          timeTo10k, timeTo20k, fastRunner, rocketShip,
          holderGrowthRate: Math.round(holderGrowthRate * 10) / 10,
          mcapVelocity: Math.round(mcapVelocity),
          mcapTrajectory: Math.round(mcapTrajectory * 10) / 10,
          serialDeployer, deployerLaunches: depHist ? depHist.launches : 0,
          staleSec, isStale, isDead, sellDumping,
          bundleDetected, bundleSize,
          hasSmartMoney, smartWalletCount,
          narrativeMatch, narrativeWord,
          deployerGrade,
          peakMcap: Math.max(t.peakMcap || 0, mcap > 0 ? mcap : t.mcap),
        };
        // Write to DB when newly qualified or when mcap hits new peak
        if ((qualified && !t.qualified) || (updatedToken.peakMcap > (t.peakMcap || 0))) {
          sbUpsertToken(updatedToken);
        }
        return updatedToken;
      });
      return result;
      });
    }, 5000);

    // ─── ENRICHMENT: DexScreener + Helius (for qualified tokens) ───
    const enriched = {};  // { mint: { lastDex: ms, lastHelius: ms, heliusDone: bool } }
    const dexInterval = setInterval(async () => {
      const now = Date.now();
      // Find qualified tokens that need DexScreener data (not enriched in last 30s)
      const needsEnrich = [];
      tokensRef.current.forEach(t => {
        if (!t.qualified || !t.addr) return;
        const e = enriched[t.addr];
        if (!e) { enriched[t.addr] = { lastDex: 0, lastHelius: 0, heliusDone: false }; }
        if (now - (enriched[t.addr]?.lastDex || 0) > 30000) {
          needsEnrich.push(t.addr);
        }
      });

      // DexScreener: up to 3 tokens per cycle
      const batch = needsEnrich.slice(0, 3);
      for (const mint of batch) {
        try {
          const dex = await fetchTokenByAddress(mint);
          if (!dex) continue;
          enriched[mint].lastDex = now;
          const td = tradeData.current[mint];

          setTokens(prev => prev.map(t => {
            if (t.addr !== mint) return t;
            return {
              ...t,
              // DexScreener gives us real liquidity, mcap, volume, image
              liquidity: dex.liquidity || t.liquidity,
              mcap: dex.mcap > 0 ? dex.mcap : t.mcap,
              vol: dex.vol > 0 ? Math.max(t.vol, dex.vol) : t.vol,
              priceUsd: dex.priceUsd || t.priceUsd,
              imageUri: dex.imageUrl || t.imageUri,
              dexPlatform: dex.platform || t.platform,
              dexEnriched: true,
            };
          }));
          // Update tradeData mcap from DexScreener (more accurate than PumpFun estimate)
          if (td && dex.mcap > 0) {
            // ─── AUTO-CALIBRATE: compare PumpPortal FDV vs DexScreener real mcap ───
            if (td.mcapSource === "pp" && td.lastMcapSol > 0) {
              const ppMcapUsd = td.lastMcapSol * SOL_USD; // raw PumpPortal value, no correction
              const ratio = dex.mcap / ppMcapUsd;
              if (ratio > 0.1 && ratio < 2.0) { // sanity check
                mcapSamples.push(ratio);
                if (mcapSamples.length > 30) mcapSamples.shift();
                // Median of recent samples
                const sorted = [...mcapSamples].sort((a, b) => a - b);
                const newCorr = sorted[Math.floor(sorted.length / 2)];
                if (Math.abs(newCorr - MCAP_CORRECTION) > 0.02) {
                  MCAP_CORRECTION = newCorr;
                  console.log(`[MCAP] 🔧 Correction updated: ${MCAP_CORRECTION.toFixed(3)} (${mcapSamples.length} samples) — PP:$${ppMcapUsd.toFixed(0)} vs DEX:$${dex.mcap.toFixed(0)}`);
                }
              }
            }
            td.lastMcapSol = dex.mcap / SOL_USD;
            td.mcapSource = "dex";
          }
          console.log(`[DEX] ✅ ${mint.slice(0, 8)} — mcap:$${dex.mcap?.toFixed(0)} liq:$${dex.liquidity?.toFixed(0)} vol:$${dex.vol?.toFixed(0)}`);
        } catch (e) {
          console.warn(`[DEX] ❌ ${mint.slice(0, 8)}`, e.message);
        }
      }

      // Helius: check on-chain metadata once per token
      for (const mint of batch) {
        if (enriched[mint]?.heliusDone) continue;
        try {
          const [meta, holders] = await Promise.all([
            fetchTokenMeta(mint),
            fetchLargestHolders(mint),
          ]);
          enriched[mint].heliusDone = true;
          enriched[mint].lastHelius = now;

          if (meta || holders) {
            setTokens(prev => prev.map(t => {
              if (t.addr !== mint) return t;
              return {
                ...t,
                mintAuth: meta?.mintAuth || false,
                frozen: meta?.frozen || false,
                holders: holders?.holderCount > t.holders ? holders.holderCount : t.holders,
                topHolderPct: holders?.topHolderPct > 0 ? Math.round(holders.topHolderPct) : t.topHolderPct,
                heliusEnriched: true,
              };
            }));
            console.log(`[HELIUS] ✅ ${mint.slice(0, 8)} — mintAuth:${meta?.mintAuth} holders:${holders?.holderCount} top10:${holders?.topHolderPct?.toFixed(1)}%`);
          }
        } catch (e) {
          enriched[mint].heliusDone = true; // don't retry on failure
          console.warn(`[HELIUS] ❌ ${mint.slice(0, 8)}`, e.message);
        }
      }
    }, 10000);

    // ─── SOL PRICE: Keep USD conversion accurate ───
    const SOL_MINT = "So11111111111111111111111111111111111111112";
    const fetchSolPrice = async () => {
      // Try Jupiter first
      try {
        const prices = await fetchJupiterPrice(SOL_MINT);
        const p = prices[SOL_MINT];
        if (p && p.price) {
          const newPrice = parseFloat(p.price);
          if (newPrice > 10 && newPrice < 1000) {
            SOL_USD = newPrice;
            console.log(`[SOL] ✅ Jupiter: $${SOL_USD.toFixed(2)} | MCAP corr: ${MCAP_CORRECTION.toFixed(3)} (${mcapSamples.length} samples)`);
            return;
          }
        }
        console.warn("[SOL] Jupiter returned no price, trying DexScreener...");
      } catch (e) { console.warn("[SOL] Jupiter failed:", e.message); }
      // Fallback: DexScreener SOL/USDC pair
      try {
        const res = await fetch("https://api.dexscreener.com/tokens/v1/solana/So11111111111111111111111111111111111111112");
        const data = await res.json();
        const pair = data?.pairs?.[0] || (Array.isArray(data) ? data[0] : null);
        if (pair && pair.priceUsd) {
          const newPrice = parseFloat(pair.priceUsd);
          if (newPrice > 10 && newPrice < 1000) {
            SOL_USD = newPrice;
            console.log(`[SOL] ✅ DexScreener fallback: $${SOL_USD.toFixed(2)}`);
            return;
          }
        }
      } catch (e2) { console.warn("[SOL] DexScreener fallback also failed:", e2.message); }
      console.warn(`[SOL] ⚠ Using default: $${SOL_USD}`);
    };
    fetchSolPrice(); // immediate
    const solPriceInterval = setInterval(fetchSolPrice, 30000); // every 30s

    // ─── JUPITER: Batch price updates for all qualified tokens ───
    const jupInterval = setInterval(async () => {
      const mints = [];
      tokensRef.current.forEach(t => { if (t.qualified && t.addr) mints.push(t.addr); });
      if (mints.length === 0) return;

      // Jupiter supports up to 100 comma-separated IDs
      const batchMints = mints.slice(0, 50);
      try {
        const prices = await fetchJupiterPrice(batchMints);
        if (!prices || Object.keys(prices).length === 0) return;

        setTokens(prev => prev.map(t => {
          const p = prices[t.addr];
          if (!p || !p.price) return t;
          const jupPrice = parseFloat(p.price);
          // Update mcap from Jupiter price (most accurate)
          const td = tradeData.current[t.addr];
          const supply = td?.supply || 1000000000; // default 1B supply
          const jupMcap = jupPrice * supply;
          return {
            ...t,
            priceUsd: jupPrice,
            // Only use Jupiter mcap if it seems reasonable (not 0 or astronomical)
            mcap: jupMcap > 100 && jupMcap < 100000000 ? jupMcap : t.mcap,
            jupEnriched: true,
          };
        }));
        console.log(`[JUP] ✅ Priced ${Object.keys(prices).length}/${batchMints.length} tokens`);
      } catch (e) {
        console.warn("[JUP] ❌", e.message);
      }
    }, 15000);

    // ─── FALLBACK MIGRATION DETECTION: catch tokens PumpPortal missed ───
    // If a token has high mcap and goes silent, check DexScreener for Raydium pair
    const migFallbackChecked = new Set();
    const migFallbackInterval = setInterval(async () => {
      const candidates = [];
      const now = Date.now();
      Object.entries(tradeData.current).forEach(([mint, td]) => {
        if (migratedMints.current.has(mint)) return; // already migrated
        if (migFallbackChecked.has(mint)) return; // already checked and failed
        if (!td.lastMcapSol || td.lastMcapSol < 300) return; // not near migration
        const silentSec = (now - td.lastTradeTime) / 1000;
        if (silentSec < 10) return; // still getting trades
        if (silentSec > 300) return; // too old, probably dead
        candidates.push({ mint, mcapSol: td.lastMcapSol, silentSec });
      });
      if (candidates.length === 0) return;
      // Check top 2 candidates
      const toCheck = candidates.sort((a, b) => b.mcapSol - a.mcapSol).slice(0, 2);
      for (const c of toCheck) {
        try {
          const dex = await fetchTokenByAddress(c.mint);
          if (!dex) { migFallbackChecked.add(c.mint); continue; }
          const isRaydium = (dex.platform || "").toLowerCase().includes("raydium");
          const highMcap = (dex.mcap || 0) > 25000;
          if (isRaydium || highMcap) {
            console.log(`[MIGRATE-FALLBACK] 🌉 Detected ${c.mint.slice(0,8)} on ${dex.platform} — $${formatNum(dex.mcap)} mcap (was silent ${c.silentSec.toFixed(0)}s)`);
            // Trigger migration
            migratedMints.current.add(c.mint);
            const tokenId = mintToId.current[c.mint];
            const td = tradeData.current[c.mint];
            let tokenName = c.mint.slice(0, 8);
            const tok = tokensRef.current.find(t => t.id === tokenId);
            if (tok) tokenName = tok.name;
            const mcapUsd = dex.mcap || (c.mcapSol * SOL_USD);
            setMigrations(prev => {
              if(prev.some(m=>m.mint===c.mint)) return prev;
              return [{
              id: Date.now() + Math.random(), mint: c.mint, tokenId, name: tokenName,
              mcap: mcapUsd, vol: dex.vol || (td ? td.volSol * SOL_USD : 0),
              holders: td ? Object.keys(td.wallets || {}).length : 0,
              timestamp: Date.now(), laserActive: true,
            }, ...prev].slice(0, 20)});
            if (tokenId) {
              const mc2 = mcapUsd;
              const zz=[[5000,0.95],[10000,0.63],[20000,0.47],[50000,0.32],[100000,0.20],[300000,0.10]];
              let entryY=0.95;
              if(mc2>=300000)entryY=0.05;
              else{for(let i=0;i<zz.length-1;i++){
                if(mc2>=zz[i][0]&&mc2<zz[i+1][0]){
                  const pct=(mc2-zz[i][0])/(zz[i+1][0]-zz[i][0]);
                  entryY=zz[i][1]+(zz[i+1][1]-zz[i][1])*pct;break;}}}
              const landX = 0.3 + Math.random() * 0.35;
              setTokens(prev => prev.map(t => t.id === tokenId && !t.migrated ? {
                ...t, migrated: true, migratedAt: Date.now(),
                laserIn: true, laserProgress: 0,
                laserTargetX: landX, laserTargetY: entryY,
                bx: 1.02, by: 0.18, targetY: entryY,
                warpIn: false, alive: true, qualified: true, health: 95,
                mcap: mcapUsd,
              } : t));
            }
            // Update tradeData
            if (td) {
              td.lastTradeTime = Date.now();
              td.lastMcapSol = (dex.mcap || 0) / SOL_USD;
              td.mcapSource = "dex";
            }
            setIntelEvents(prev => [{
              id: Date.now() + Math.random(), type: "migration", icon: "🌉", color: "#39ff14",
              text: `${tokenName} MIGRATED (fallback detected) — $${formatNum(mcapUsd)} on ${dex.platform}`,
              timestamp: Date.now(), priority: "HIGH",
            }, ...prev].slice(0, 40));
          } else {
            migFallbackChecked.add(c.mint);
          }
        } catch (e) {
          console.warn("[MIGRATE-FALLBACK] error:", e.message);
        }
      }
    }, 8000); // check every 8s

    // ─── HELIUS WEBSOCKET: Real-time post-migration swap detection ───
    const PUMP_SUPPLY = 1_000_000_000;
    let lastWsPrice = {}; // debounce: {mint: timestamp}

    const heliusWs = connectHeliusWS(async (activity) => {
      const { mint, isSwap, timestamp } = activity;
      if (!isSwap) return; // only care about swaps

      // Debounce: max 1 price fetch per mint per 2s
      if (lastWsPrice[mint] && timestamp - lastWsPrice[mint] < 2000) return;
      lastWsPrice[mint] = timestamp;

      const id = mintToId.current[mint];
      if (!id) return;

      // Instant Jupiter price fetch
      try {
        const jupData = await fetchJupiterPrice([mint]);
        const jp = jupData[mint];
        if (!jp || !jp.price) return;
        const priceUsd = parseFloat(jp.price);
        const jupMcap = priceUsd * PUMP_SUPPLY;

        const td = tradeData.current[mint];
        if (td) { td.lastTradeTime = Date.now(); td.lastMcapSol = jupMcap / SOL_USD; }

        setTokens(prev => prev.map(t => t.id === id ? {
          ...t, mcap: jupMcap, priceUsd,
          health: jupMcap > 10000 ? Math.max(t.health, 50) : t.health,
        } : t));

        setMigrations(prev => prev.map(m => m.mint === mint ? {
          ...m, curMcap: jupMcap, curPrice: priceUsd, lastDexUpdate: Date.now(),
        } : m));

        console.log(`[HELIUS-WS] ⚡ ${mint.slice(0, 8)} swap → $${priceUsd.toFixed(8)} ($${formatNum(jupMcap)} mcap)`);
      } catch (e) {
        console.warn("[HELIUS-WS] Jupiter fetch failed:", e.message);
      }
    });
    heliusWsRef.current = heliusWs;

    // Subscribe existing migrated mints (in case of reconnect)
    if (heliusWs) {
      migratedMints.current.forEach(mint => heliusWs.subscribe(mint));
    }

    // ─── MIGRATED TOKEN FALLBACK POLLING: DexScreener for vol/buys/sells + Helius holders ───
    let migratedLastSeen = {};
    let migratedPollCycle = 0;

    const migratedInterval = setInterval(async () => {
      const mints = [...migratedMints.current];
      if (mints.length === 0) return;

      const curTokens = tokensRef.current;
      const now = Date.now();
      const toPoll = mints.slice(0, 8).map(mint => ({
        addr: mint,
        id: mintToId.current[mint] || null,
      })).filter(m => {
        if (!m.id) return false;
        const live = curTokens.find(t => t.id === m.id);
        if (live) { migratedLastSeen[m.addr] = now; return true; }
        const lastSeen = migratedLastSeen[m.addr] || now;
        migratedLastSeen[m.addr] = migratedLastSeen[m.addr] || now;
        const goneSec = (now - lastSeen) / 1000;
        if (goneSec > 300) { migratedMints.current.delete(m.addr); delete migratedLastSeen[m.addr]; return false; }
        return true;
      });

      if (toPoll.length === 0) return;
      migratedPollCycle++;

      // === JUPITER PRICE FALLBACK: only if Helius WS hasn't updated in 10s ===
      if (migratedPollCycle % 2 === 0) {
        const now2 = Date.now();
        const staleTokens = toPoll.filter(mt => !lastWsPrice[mt.addr] || now2 - lastWsPrice[mt.addr] > 10000);
        if (staleTokens.length > 0) {
          try {
            const jupAddrs = staleTokens.map(m => m.addr);
            const jupData = await fetchJupiterPrice(jupAddrs);
            for (const mt of staleTokens) {
              const jp = jupData[mt.addr];
              if (!jp || !jp.price) continue;
              const priceUsd = parseFloat(jp.price);
              const jupMcap = priceUsd * PUMP_SUPPLY;

          const td = tradeData.current[mt.addr];
          if (td) { td.lastTradeTime = now; td.lastMcapSol = jupMcap / SOL_USD; }

          setTokens(prev => prev.map(t => t.id === mt.id ? {
            ...t, mcap: jupMcap, priceUsd: priceUsd,
            health: jupMcap > 10000 ? Math.max(t.health, 50) : t.health,
          } : t));

          setMigrations(prev => prev.map(m => m.mint === mt.addr ? {
            ...m, curMcap: jupMcap, curPrice: priceUsd, lastDexUpdate: now,
          } : m));

          console.log("[MIGRATED-JUP] \u26A1 " + mt.addr.slice(0, 8) + " \u2192 $" + priceUsd.toFixed(8) + " ($" + formatNum(jupMcap) + " mcap) [FALLBACK]");
        }
          } catch (e) {
            console.warn("[MIGRATED-JUP] fallback price failed:", e.message);
          }
        }
      }

      // === DEXSCREENER: every 3rd cycle (vol, buys, sells, liquidity) ===
      if (migratedPollCycle % 3 === 0) {
        for (const mt of toPoll) {
          try {
            const dex = await fetchTokenByAddress(mt.addr);
            if (!dex) continue;

            const td = tradeData.current[mt.addr];
            if (td) {
              td.lastTradeTime = now;
              if (dex.mcap) { td.lastMcapSol = dex.mcap / SOL_USD; td.mcapSource = "dex"; }
              if (dex.buys > (td.buys || 0)) td.buys = dex.buys;
              if (dex.sells > (td.sells || 0)) td.sells = dex.sells;
            }

            setTokens(prev => prev.map(t => t.id === mt.id ? {
              ...t,
              mcap: dex.mcap || t.mcap,
              vol: dex.vol != null ? dex.vol : t.vol,
              buys: dex.buys != null ? dex.buys : t.buys,
              sells: dex.sells != null ? dex.sells : t.sells,
              holders: dex.holders != null ? dex.holders : t.holders,
              liquidity: dex.liquidity != null ? dex.liquidity : t.liquidity,
              dexEnriched: true,
            } : t));

            setMigrations(prev => prev.map(m => m.mint === mt.addr ? {
              ...m,
              curMcap: dex.mcap || m.curMcap,
              curVol: dex.vol || m.curVol,
              curBuys: dex.buys != null ? dex.buys : m.curBuys,
              curSells: dex.sells != null ? dex.sells : m.curSells,
              curHolders: dex.holders || m.curHolders,
              curLiquidity: dex.liquidity || m.curLiquidity,
              lastDexUpdate: now,
            } : m));

            console.log("[MIGRATED-DEX] \uD83D\uDCCA " + mt.addr.slice(0, 8) + " \u2192 $" + formatNum(dex.mcap) + " mcap, " + dex.buys + "b/" + dex.sells + "s liq:$" + formatNum(dex.liquidity));
          } catch (e) {
            console.warn("[MIGRATED-DEX] fetch failed:", e.message);
          }
        }
      }

      // === HELIUS HOLDERS: every 6th cycle (~30s) ===
      if (migratedPollCycle % 6 === 0) {
        for (const mt of toPoll.slice(0, 3)) {
          try {
            const h = await fetchLargestHolders(mt.addr);
            if (!h || h.holderCount === 0) continue;

            setTokens(prev => prev.map(t => t.id === mt.id ? {
              ...t,
              holders: Math.max(t.holders || 0, h.holderCount),
              topHolderPct: h.topHolderPct || t.topHolderPct,
            } : t));

            setMigrations(prev => prev.map(m => m.mint === mt.addr ? {
              ...m, curHolders: Math.max(m.curHolders || 0, h.holderCount), lastDexUpdate: now,
            } : m));

            console.log("[MIGRATED-HEL] \uD83D\uDC65 " + mt.addr.slice(0, 8) + " \u2192 " + h.holderCount + " holders, top10: " + h.topHolderPct.toFixed(1) + "%");
          } catch (e) {
            console.warn("[MIGRATED-HEL] holders failed:", e.message);
          }
        }
      }
    }, 5000);

    // ─── DEAD FIELD CHECK: Verify DB-hydrated + stale tokens every 2 mins ───
    const deadCheckInterval = setInterval(async () => {
      const now = Date.now();
      const candidates = tokensRef.current.filter(t => {
        if (!t.alive) return false;
        const td = tradeData.current[t.addr];
        const lastTrade = td?.lastTradeTime || t.timestamp;
        const silentMs = now - lastTrade;
        // Check DB tokens after 3 mins silence, live tokens after 8 mins
        return t.fromDB ? silentMs > 180000 : (silentMs > 480000 && t.qualified);
      }).slice(0, 5); // max 5 at a time

      for (const t of candidates) {
        try {
          const res = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${t.addr}`);
          const data = await res.json();
          const pair = data?.pairs?.[0] || (Array.isArray(data) ? data[0] : null);
          const liveMcap = pair?.marketCap || pair?.fdv || 0;
          const peakMcap = t.peakMcap || t.mcap || 0;
          const isDead = !pair || liveMcap < 1000 || (peakMcap > 5000 && liveMcap < peakMcap * 0.12);

          if (isDead) {
            console.log(`[DEADCHECK] 💀 ${t.name} — no activity, mcap $${liveMcap?.toFixed(0)||0} (peak $${peakMcap?.toFixed(0)}) — removing`);
            setTokens(prev => prev.map(tok => tok.addr === t.addr ? { ...tok, alive: false, health: 0, deathTime: now } : tok));
            if (onUpsertTokenRef.current) sbUpsertToken({ ...t, alive: false, mcap: liveMcap, peakMcap });
          } else if (liveMcap > 0 && Math.abs(liveMcap - t.mcap) / (t.mcap || 1) > 0.05) {
            // Still alive but mcap changed — update position + DB
            const zz=[[5000,0.95],[10000,0.63],[20000,0.47],[50000,0.32],[100000,0.20],[300000,0.10]];
            let targetY=0.95;
            if(liveMcap>=300000)targetY=0.08;
            else{for(let i=0;i<zz.length-1;i++){if(liveMcap>=zz[i][0]&&liveMcap<zz[i+1][0]){const pct=(liveMcap-zz[i][0])/(zz[i+1][0]-zz[i][0]);targetY=zz[i][1]+(zz[i+1][1]-zz[i][1])*pct;break;}}}
            setTokens(prev => prev.map(tok => tok.addr === t.addr ? {
              ...tok, mcap: liveMcap, targetY,
              peakMcap: Math.max(tok.peakMcap || 0, liveMcap),
            } : tok));
            if (onUpsertTokenRef.current) sbUpsertToken({ ...t, mcap: liveMcap, peakMcap: Math.max(peakMcap, liveMcap), alive: true });
          }
        } catch(e) { /* network err, skip */ }
      }
    }, 120000); // every 2 mins

    return () => {
      if (typeof pf === 'function') pf();
      else if (pf && pf.cleanup) pf.cleanup();
      if (heliusWs) heliusWs.cleanup();
      clearInterval(qualInterval);
      clearInterval(dexInterval);
      clearInterval(jupInterval);
      clearInterval(solPriceInterval);
      clearInterval(migratedInterval);
      clearInterval(migFallbackInterval);
      clearInterval(deadCheckInterval);
    };
  }, []);

  // ═══ DEXSCREENER POLLING — catches Moonshot, Bags, etc ═══
  const dexSeenRef = useRef(new Set());
  useEffect(() => {
    const pollDex = async () => {
      try {
        const [profiles, boosts] = await Promise.all([
          fetchLatestProfiles(),
          fetchBoostedTokens(),
        ]);
        // Combine and dedupe
        const allTokens = [...profiles, ...boosts];
        const newMints = [];
        allTokens.forEach(t => {
          const addr = t.tokenAddress;
          if (!addr || dexSeenRef.current.has(addr) || mintToId.current[addr]) return;
          dexSeenRef.current.add(addr);
          newMints.push(addr);
        });
        if (newMints.length === 0) return;

        // Fetch full pair data for new tokens (batch up to 5 at a time)
        const batch = newMints.slice(0, 5);
        for (const mint of batch) {
          try {
            const res = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${mint}`);
            const data = await res.json();
            const pair = data?.pairs?.[0] || (Array.isArray(data) ? data[0] : null);
            if (!pair || !pair.baseToken) continue;

            const mcap = pair.marketCap || pair.fdv || 0;
            if (mcap < 2000 || mcap > 500000) continue; // filter to our range

            const name = pair.baseToken.symbol || "???";
            const dexId = (pair.dexId || "").toLowerCase();
            let platform = "DexScreener";
            if (dexId.includes("moonshot") || dexId.includes("moonit")) platform = "Moonshot";
            else if (dexId.includes("raydium") && pair.labels?.includes("Bonk")) platform = "Bonk";
            else if (dexId.includes("raydium")) platform = "Raydium";
            else if (dexId.includes("orca")) platform = "Orca";
            else if (dexId.includes("meteora")) platform = "Meteora";

            const id = mint + Date.now();
            mintToId.current[mint] = id;

            // Lightweight tradeData init
            tradeData.current[mint] = {
              buys: pair.txns?.h1?.buys || 0, sells: pair.txns?.h1?.sells || 0,
              volSol: 0, lastMcapSol: mcap / SOL_USD, mcapSource: "dex",
              deployer: "", wallets: {}, deployerSold: false, deployerSellPct: 0,
              totalBoughtSol: 0, totalSoldSol: 0,
              freshBuyers: 0, totalBuyers: 0, buyTimes: [], buySizes: [],
              launchTime: pair.pairCreatedAt || Date.now(),
              lastTradeTime: Date.now(), sellTimes: [],
              milestones: {}, earlyBuyers: {}, earlyBuyerCount: 0,
            };

            const token = {
              id, addr: mint, name, fullName: pair.baseToken.name || name,
              platform, mcap, vol: pair.volume?.h24 || pair.volume?.h1 || 0,
              priceUsd: parseFloat(pair.priceUsd || 0), liquidity: pair.liquidity?.usd || 0,
              holders: 1, devWallet: 0,
              buys: pair.txns?.h1?.buys || 0, sells: pair.txns?.h1?.sells || 0,
              riskScore: 50, qualified: false, qualScore: 0, qualChecks: [],
              threat: "SCANNING", threatColor: "#ffe600",
              bundleDetected: false, bundleSize: 0, mintAuth: false,
              topHolderPct: 0, dupeCount: 0,
              bx: Math.random() * 0.8 + 0.1, by: 0.92, targetY: 0.92,
              vx: (Math.random() - 0.5) * 0.0006, health: 60, alive: true,
              age: 0, trail: [], warpIn: false, warpProgress: 1,
              warpStartX: Math.random(), warpStartY: Math.random() * 0.2 - 0.1,
              bobOffset: Math.random() * Math.PI * 2,
              initials: name.slice(0, 2).toUpperCase(),
              coinColor: pick(COIN_COLORS),
              timestamp: Date.now(), deployer: "",
              imageUri: pair.info?.imageUrl || "",
            };

            setTokens(prev => {
              let list = [token, ...prev];
              const now2 = Date.now();
              list = list.filter(t => {
                if (t.migrated) return true;
                if (!t.alive && now2 - (t.deathTime || t.timestamp) > 45000) return false;
                if (t.alive && !t.qualified && t.buys <= 0 && t.sells <= 0 && now2 - t.timestamp > 30000) return false;
                if (t.alive && !t.migrated && (t.mcap || 0) < 3000 && (t.buys || 0) < 3 && now2 - t.timestamp > 90000) return false;
                return true;
              });
              return list.slice(0, 150);
            });
            setStats(s => ({ ...s, scanned: s.scanned + 1 }));
            setIntelEvents(prev => [{
              id: Date.now() + Math.random(), type: "launch", icon: "🌐", color: "#ff9500",
              text: `[${platform}] ${name} spotted | $${mcap > 1000 ? (mcap/1000).toFixed(1)+"K" : mcap.toFixed(0)}`,
              timestamp: Date.now(), priority: "NORMAL",
            }, ...prev].slice(0, 40));
            console.log(`[DexScreener] Added ${name} from ${platform} — $${mcap.toFixed(0)}`);
          } catch (e) {
            console.warn("[DexScreener] Token fetch failed:", e.message);
          }
        }
      } catch (e) {
        console.warn("[DexScreener] Poll failed:", e.message);
      }
    };
    // Poll every 45 seconds
    const iv = setInterval(pollDex, 45000);
    setTimeout(pollDex, 10000); // first poll after 10s
    return () => clearInterval(iv);
  }, []);

  // ═══ CROSS-SOURCE ENRICHMENT — GeckoTerminal + Defined.fi + SolanaTracker ═══

  // ─── GECKO + DEFINED TRENDING: cross-reference our tokens with what's hot ───
  useEffect(() => {
    const pollTrending = async () => {
      try {
        const [geckoTrending, definedTrending] = await Promise.all([
          fetchGeckoTrending(),
          fetchDefinedTrending(),
        ]);

        // Store trending addresses for cross-referencing
        geckoTrendingRef.current = geckoTrending;
        definedTrendingRef.current = definedTrending;

        const geckoNames = new Set(geckoTrending.map(g => g.name?.split("/")?.[0]?.trim()?.toUpperCase()).filter(Boolean));
        const definedAddrs = new Set(definedTrending.map(d => d.address).filter(Boolean));
        const definedNames = new Set(definedTrending.map(d => d.symbol?.toUpperCase()).filter(Boolean));

        // Tag our tokens with trending status from multiple sources
        setTokens(prev => {
          let changed = false;
          const updated = prev.map(t => {
            const onGecko = geckoNames.has(t.name?.toUpperCase());
            const onDefined = definedAddrs.has(t.addr) || definedNames.has(t.name?.toUpperCase());
            const trendScore = (onGecko ? 1 : 0) + (onDefined ? 1 : 0) + (t.narrativeMatch ? 1 : 0);
            
            if (t.onGeckoTrending !== onGecko || t.onDefinedTrending !== onDefined || t.trendScore !== trendScore) {
              changed = true;
              return { ...t, onGeckoTrending: onGecko, onDefinedTrending: onDefined, trendScore };
            }
            return t;
          });
          return changed ? updated : prev;
        });

        // Fire intel events for newly trending tokens
        setTokens(prev => {
          prev.forEach(t => {
            if (t.onGeckoTrending && !t._geckoAnnounced) {
              t._geckoAnnounced = true;
              setIntelEvents(ev => [{
                id: Date.now() + Math.random(), type: "trend", icon: "🦎", color: "#39ff14",
                text: `${t.name} trending on GeckoTerminal! Cross-platform buzz detected.`,
                timestamp: Date.now(), priority: "HIGH",
              }, ...ev].slice(0, 40));
            }
            if (t.onDefinedTrending && !t._definedAnnounced) {
              t._definedAnnounced = true;
              setIntelEvents(ev => [{
                id: Date.now() + Math.random(), type: "trend", icon: "📡", color: "#00ccff",
                text: `${t.name} flagged by Defined.fi — high social activity.`,
                timestamp: Date.now(), priority: "NORMAL",
              }, ...ev].slice(0, 40));
            }
          });
          return prev;
        });

        console.log(`[TRENDING] 🦎 Gecko: ${geckoTrending.length} pools | 📡 Defined: ${definedTrending.length} tokens`);
      } catch (e) {
        console.warn("[TRENDING] Poll failed:", e.message);
      }
    };
    const iv = setInterval(pollTrending, 60000); // every 60s
    setTimeout(pollTrending, 15000); // first poll after 15s
    return () => clearInterval(iv);
  }, []);

  // ─── SOLANATRACKER: Bonding curve progress for pre-migration PumpFun tokens ───
  useEffect(() => {
    let cycle = 0;
    const iv = setInterval(async () => {
      cycle++;
      const cur = tokensRef.current;
      // Get qualified PumpFun tokens that haven't migrated yet
      const pumpTokens = cur.filter(t =>
        t.alive && t.qualified && !t.migrated && t.platform === "PumpFun"
      ).slice(0, 4); // max 4 per cycle to avoid rate limits

      for (const t of pumpTokens) {
        // Skip if cached less than 15s ago
        const cached = curveProgressCache.current[t.addr];
        if (cached && Date.now() - cached.ts < 15000) continue;

        try {
          const st = await fetchPumpCurveProgress(t.addr);
          if (!st) continue;
          curveProgressCache.current[t.addr] = { ...st, ts: Date.now() };

          setTokens(prev => prev.map(tok => tok.addr === t.addr ? {
            ...tok,
            // Only set bondingPct from SolanaTracker if PumpFun Direct hasn't already set it
            // PumpFun Direct reads actual on-chain reserves (accurate), SolanaTracker estimates from mcap (rough)
            bondingPct: tok.realSolReserves ? tok.bondingPct : st.bondingCurvePct,
            stVol1h: st.vol1h,
            stPriceChange5m: st.priceChange5m,
            stPriceChange1h: st.priceChange1h,
            stHolders: st.holders > (tok.holders || 0) ? st.holders : tok.holders,
            stLiquidity: st.liquidityUsd,
          } : tok));

          // Alert when token is close to migration (>80% bonding)
          const effectivePct = t.realSolReserves ? t.bondingPct : st.bondingCurvePct;
          if (effectivePct != null && effectivePct > 80 && !t._bondingAlerted) {
            t._bondingAlerted = true;
            setIntelEvents(ev => [{
              id: Date.now() + Math.random(), type: "migrate", icon: "🔥", color: NEON_GREEN,
              text: `${t.name} at ${effectivePct.toFixed(0)}% bonding — MIGRATION IMMINENT!`,
              timestamp: Date.now(), priority: "HIGH",
            }, ...ev].slice(0, 40));
          }

          if (st.bondingCurvePct != null) {
            console.log(`[CURVE] 📈 ${t.name} → ${st.bondingCurvePct.toFixed(1)}% to migration | $${(st.mcapUsd/1000).toFixed(1)}K mcap`);
          }
        } catch (e) {
          console.warn("[CURVE] Failed:", e.message);
        }
      }

      // ─── GECKO POOL ENRICHMENT for migrated tokens (every 3rd cycle ~30s) ───
      if (cycle % 3 === 0) {
        const migrated = cur.filter(t => t.alive && t.migrated).slice(0, 3);
        for (const t of migrated) {
          try {
            const gp = await fetchGeckoPoolByToken(t.addr);
            if (!gp) continue;
            setTokens(prev => prev.map(tok => tok.addr === t.addr ? {
              ...tok,
              geckoMcap: gp.mcap,
              geckoVol5m: gp.vol5m,
              geckoVol1h: gp.vol1h,
              geckoVol24h: gp.vol24h,
              geckoBuys5m: gp.buys5m,
              geckoSells5m: gp.sells5m,
              geckoBuys1h: gp.buys1h,
              geckoSells1h: gp.sells1h,
              geckoChange5m: gp.priceChange5m,
              geckoChange1h: gp.priceChange1h,
              geckoReserve: gp.reserveUsd,
              geckoPoolAddr: gp.poolAddr,
              geckoDex: gp.dex,
            } : tok));

            // Also update migrations list
            setMigrations(prev => prev.map(m => m.mint === t.addr ? {
              ...m,
              geckoVol5m: gp.vol5m, geckoVol1h: gp.vol1h,
              geckoBuys5m: gp.buys5m, geckoSells5m: gp.sells5m,
              geckoChange5m: gp.priceChange5m, geckoChange1h: gp.priceChange1h,
              geckoReserve: gp.reserveUsd,
            } : m));

            console.log(`[GECKO] 🦎 ${t.name} → 5m: ${gp.priceChange5m>0?"+":""}${gp.priceChange5m.toFixed(1)}% (${gp.buys5m}b/${gp.sells5m}s) | 1h: ${gp.priceChange1h>0?"+":""}${gp.priceChange1h.toFixed(1)}% | reserve: $${(gp.reserveUsd/1000).toFixed(1)}K`);
          } catch (e) {
            console.warn("[GECKO] Pool enrichment failed:", e.message);
          }
        }
      }
    }, 10000); // every 10s
    return () => clearInterval(iv);
  }, []);

  // ─── JUPITER VERIFIED LIST: load once + refresh every 5min ───
  useEffect(() => {
    const load = async () => {
      const verified = await fetchJupiterVerified();
      jupVerifiedRef.current = verified;
      // Tag all current tokens
      setTokens(prev => {
        let changed = false;
        const updated = prev.map(t => {
          const isVerified = verified.has(t.addr);
          if (t.jupVerified !== isVerified) { changed = true; return { ...t, jupVerified: isVerified }; }
          return t;
        });
        return changed ? updated : prev;
      });
    };
    load();
    const iv = setInterval(load, 300000); // refresh every 5min
    return () => clearInterval(iv);
  }, []);

  // ─── PUMP.FUN DIRECT + RAYDIUM: deep enrichment cycle ───
  useEffect(() => {
    let deepCycle = 0;
    const iv = setInterval(async () => {
      deepCycle++;
      const cur = tokensRef.current;
      const now = Date.now();

      // === PUMP.FUN DIRECT: bonding curve + community for pre-migration PumpFun tokens ===
      if (deepCycle % 2 === 0) {
        const pumpTokens = cur.filter(t =>
          t.alive && t.qualified && !t.migrated && t.platform === "PumpFun" &&
          (!pumpDirectCache.current[t.addr] || now - pumpDirectCache.current[t.addr].ts > 20000)
        ).slice(0, 3);

        for (const t of pumpTokens) {
          try {
            const pd = await fetchPumpFunDirect(t.addr);
            if (!pd) continue;
            pumpDirectCache.current[t.addr] = { ...pd, ts: now };

            setTokens(prev => prev.map(tok => tok.addr === t.addr ? {
              ...tok,
              bondingPct: pd.bondingPct,
              realSolReserves: pd.realSolReserves,
              replyCount: pd.replyCount,
              isKOTH: pd.isKOTH,
              hasSocials: !!(pd.twitter || pd.telegram || pd.website),
              pumpComplete: pd.complete,
              pumpCreator: pd.creator,
              pumpNsfw: pd.nsfw,
            } : tok));

            console.log(`[PUMP.FUN] 🎰 ${t.name} → ${pd.bondingPct.toFixed(1)}% curve | ${pd.realSolReserves.toFixed(1)} SOL | ${pd.replyCount} replies${pd.isKOTH?" | 👑 KOTH":""}${pd.twitter?" | 🐦":""}${pd.telegram?" | 📱":""}`);
          } catch (e) {
            console.warn("[PUMP.FUN] Failed:", e.message);
          }
        }
      }

      // === RAYDIUM POOL DATA: reserves + LP burn for migrated tokens ===
      if (deepCycle % 4 === 0) {
        const migrated = cur.filter(t =>
          t.alive && t.migrated &&
          (!raydiumPoolCache.current[t.addr] || now - raydiumPoolCache.current[t.addr].ts > 30000)
        ).slice(0, 2);

        for (const t of migrated) {
          try {
            const rp = await fetchRaydiumPool(t.addr);
            if (!rp) continue;
            raydiumPoolCache.current[t.addr] = { ...rp, ts: now };

            setTokens(prev => prev.map(tok => tok.addr === t.addr ? {
              ...tok,
              rayTvl: rp.tvl,
              rayVol24h: rp.vol24h,
              rayFees24h: rp.fees24h,
              rayApr24h: rp.apr24h,
              rayBurnPct: rp.burnPct,
              rayPoolId: rp.poolId,
            } : tok));

            setMigrations(prev => prev.map(m => m.mint === t.addr ? {
              ...m, rayTvl: rp.tvl, rayBurnPct: rp.burnPct, rayVol24h: rp.vol24h, rayFees24h: rp.fees24h,
            } : m));

            console.log(`[RAYDIUM] 💎 ${t.name} → TVL:$${(rp.tvl/1000).toFixed(1)}K | Vol24h:$${(rp.vol24h/1000).toFixed(1)}K | LP burn:${rp.burnPct.toFixed(0)}% | Fees:$${rp.fees24h.toFixed(0)}`);
          } catch (e) {
            console.warn("[RAYDIUM] Failed:", e.message);
          }
        }
      }

      // === JUPITER SLIPPAGE: liquidity depth check for locked/qualified tokens ===
      if (deepCycle % 5 === 0) {
        const toCheck = cur.filter(t =>
          t.alive && t.qualified && t.mcap > 15000 &&
          (!slippageCache.current[t.addr] || now - slippageCache.current[t.addr].ts > 60000)
        ).slice(0, 2);

        for (const t of toCheck) {
          try {
            const slip = await fetchJupiterSlippage(t.addr, 5000, SOL_USD);
            if (!slip) continue;
            slippageCache.current[t.addr] = { ...slip, ts: now };

            setTokens(prev => prev.map(tok => tok.addr === t.addr ? {
              ...tok,
              slippage5k: slip.slippagePct,
              priceImpact5k: slip.priceImpact,
              liquidityRating: slip.liquidityRating,
            } : tok));

            console.log(`[SLIPPAGE] 💧 ${t.name} → $5K sell = ${slip.slippagePct.toFixed(1)}% slippage | Rating: ${slip.liquidityRating}`);
          } catch (e) {
            console.warn("[SLIPPAGE] Failed:", e.message);
          }
        }
      }

      // === HELIUS SIGNATURES: on-chain activity intensity for top tokens ===
      // Every 5th cycle (~60s) to conserve Helius credits
      if (deepCycle % 5 === 0) {
        const hotTokens = cur.filter(t =>
          t.alive && t.qualified && t.mcap > 10000 &&
          (!activityCache.current[t.addr] || now - activityCache.current[t.addr].ts > 25000)
        ).slice(0, 3);

        for (const t of hotTokens) {
          try {
            const sigs = await fetchUniqueSigners(t.addr, 50);

            if (sigs) {
              const updates = {
                activityLevel: sigs.activityLevel,
                txPerMinute: sigs.txPerMinute,
                recentTx5m: sigs.recentTx5m,
                txErrorRate: sigs.errorRate,
              };
              activityCache.current[t.addr] = { ...sigs, ts: now };
              setTokens(prev => prev.map(tok => tok.addr === t.addr ? { ...tok, ...updates } : tok));
            }

            console.log(`[ACTIVITY] 🔥 ${t.name} → ${sigs?.activityLevel||"?"} (${sigs?.recentTx5m||0} tx/5m, ${sigs?.txPerMinute?.toFixed(1)||0}/min)`);
          } catch (e) {
            console.warn("[ACTIVITY] Failed:", e.message);
          }
        }
      }
    }, 12000); // every 12s base cycle
    return () => clearInterval(iv);
  }, []);

  const NEON_GREEN = "#39ff14";

  // ═══ SMART MONEY: Score wallets based on WALLET P&L, not token outcome ═══
  useEffect(() => {
    const iv = setInterval(() => {
      const now3 = Date.now();
      setTokens(prev => {
        prev.forEach(t => {
          const td = tradeData.current[t.addr];
          if (!td) return;

          // Token state — used only to determine if an open position has expired
          const age = now3 - t.timestamp;
          const tokenDead = ((!t.alive || (t.health || 0) <= 0) && age > 60000) ||
            (age > 120000 && t.mcap < 5000 && !t.migrated) ||
            (age > 180000 && (t.health || 0) < 30 && t.mcap < 20000);
          const tokenAlive = !tokenDead && t.alive;

          Object.entries(td.wallets).forEach(([w, data]) => {
            if (data.bought <= 0.01) return;
            if (!walletScores.current[w]) walletScores.current[w] = {
              wins: 0, losses: 0, holds: 0,
              tokens: [], lossTokens: [], holdTokens: [],   // display names only
              winAddrs: new Set(), lossAddrs: new Set(), holdAddrs: new Set(), // dedup by addr
              totalBought: 0, totalSold: 0, totalPnl: 0, bigWins: 0, trades: [], lastActivity: now3,
            };
            const ws = walletScores.current[w];
            // Migrate old wallets that don't have addr sets yet
            if (!ws.winAddrs)  ws.winAddrs  = new Set();
            if (!ws.lossAddrs) ws.lossAddrs = new Set();
            if (!ws.holdAddrs) ws.holdAddrs = new Set();

            // ─── BOT FILTER — ignore sub-30s flips ───
            const holdDuration = (data.lastSellTime || now3) - (data.firstBuyTime || now3);
            const hasExited = (data.sold || 0) >= data.bought * 0.5;
            if (hasExited && holdDuration < 30000) return;

            const sellEvts = (data.sellEvents || []).filter(s =>
              s.time >= (data.firstBuyTime || 0) &&
              (!data.lastSellTime || s.time <= data.lastSellTime)
            );
            // Cap sell amounts to bought so bleed can't inflate sells beyond buy size
            let capRemaining = data.bought;
            const cappedSellEvts = sellEvts.filter(s => {
              if (capRemaining <= 0.001) return false;
              capRemaining -= s.sol;
              return true;
            });

            // ─── WALLET-LEVEL OUTCOME ───
            // PumpPortal reports solAmount on sells as original cost basis, NOT SOL received.
            // Detect this: if sold ≈ bought but mcap moved significantly, estimate real SOL out.
            const rawSold = data.sold || 0;
            const entryMcap = data.entryMcap || 0;
            const exitMcapRaw = data.exitMcap || t.mcap || 0;
            const mcapRatio = entryMcap > 0 && exitMcapRaw > 0 ? exitMcapRaw / entryMcap : 1;
            const soldRatioRaw = data.bought > 0 ? rawSold / data.bought : 0;
            // If sold ≈ bought (within 2%) but mcap moved >10% — cost-basis reporting detected
            const costBasisReporting = soldRatioRaw >= 0.9 && soldRatioRaw <= 1.1 && Math.abs(mcapRatio - 1) > 0.1;
            // Estimated actual SOL received = bought * mcapRatio (bonding curve approximation)
            const estimatedSold = costBasisReporting ? data.bought * mcapRatio : rawSold;
            const sold = estimatedSold;
            const pnl = sold - data.bought;
            const soldRatio = data.bought > 0 ? sold / data.bought : 0;
            const positionClosed = soldRatioRaw >= 0.5; // use raw ratio to detect exit
            const positionFullyExited = soldRatioRaw >= 0.95;

            const exitMcap = positionClosed ? (data.exitMcap || t.mcap || 0) : (t.mcap || 0);

            const walletWin = positionClosed && pnl > 0 && (soldRatio >= 1.2 || positionFullyExited);
            const walletLoss = !walletWin && (
              (tokenDead && pnl < 0) ||
              (positionFullyExited && pnl < 0)
            );
            const walletHold = !walletWin && !walletLoss && tokenAlive;

            // Use capped+filtered sell events for all trade records
            const sellEvents = cappedSellEvts;

            // ── WIN ──
            if (walletWin && !ws.winAddrs.has(t.addr)) {
              if (ws.holdAddrs.has(t.addr)) {
                ws.holds = Math.max(0, ws.holds - 1);
                ws.holdAddrs.delete(t.addr);
                ws.holdTokens = (ws.holdTokens||[]).filter(a => a !== t.addr);
                const holdTrade = ws.trades.find(tr => tr.addr === t.addr && tr.type === "HOLD");
                if (holdTrade) { holdTrade.type = "WIN"; holdTrade.mcap = data.exitMcap||exitMcap; holdTrade.sold = sold; holdTrade.pnl = pnl; holdTrade.athMcap = Math.max(td.athMcap||0, data.exitMcap||exitMcap, holdTrade.athMcap||0); holdTrade.sellEvents = sellEvents; }
              } else {
                ws.trades.push({ token: t.name, addr: t.addr, sol: data.bought, sold: sold, type: "WIN", mcap: exitMcap, entryMcap, pnl,
                  entryTime: data.firstBuyTime || now3, exitTime: data.lastSellTime || now3,
                  athMcap: td.athMcap || exitMcap, startMcap: td.startMcap || entryMcap, time: now3, sellEvents });
                if (ws.trades.length > 50) ws.trades = ws.trades.slice(-50);
              }
              ws.wins++;
              ws.winAddrs.add(t.addr);
              ws.tokens.push(t.name); // display name — winAddrs Set handles dedup
              ws.totalBought += data.bought;
              ws.totalSold += sold; // use corrected sold not raw data.sold
              ws.totalPnl += pnl;
              if (exitMcap > 100000) ws.bigWins = (ws.bigWins || 0) + 1;
              if (ws.wins === 3) console.log(`[SMART$] 🧠 Wallet ${w.slice(0,8)} hit 3 wins`);
              if (ws.wins === 6) console.log(`[SMART$] 🧠🧠 Wallet ${w.slice(0,8)} hit 6 WINS`);
              td.wallets[w] = { bought: 0, sold: 0, firstBuyTime: null, lastSellTime: null, entryMcap: 0, exitMcap: 0, sellEvents: [] };
              // Keep addr in winAddrs — never delete, prevents same position re-triggering as win
              if (ws.activeBuys) delete ws.activeBuys[t.addr];
              sbUpsertWallet(w, walletScores.current[w]);
            }

            // ── LOSS ──
            if (walletLoss && !ws.lossAddrs.has(t.addr) && !ws.winAddrs.has(t.addr)) {
              if (ws.holdAddrs.has(t.addr)) {
                ws.holds = Math.max(0, ws.holds - 1);
                ws.holdAddrs.delete(t.addr);
                ws.holdTokens = (ws.holdTokens||[]).filter(a => a !== t.addr);
                const holdTrade = ws.trades.find(tr => tr.addr === t.addr && tr.type === "HOLD");
                if (holdTrade) { holdTrade.type = "LOSS"; holdTrade.mcap = data.exitMcap||exitMcap; holdTrade.sold = sold; holdTrade.pnl = pnl; holdTrade.athMcap = Math.max(td.athMcap||0, data.exitMcap||exitMcap, holdTrade.athMcap||0); holdTrade.sellEvents = sellEvents; }
              } else {
                ws.trades.push({ token: t.name, addr: t.addr, sol: data.bought, sold: sold, type: "LOSS", mcap: exitMcap, entryMcap, pnl,
                  entryTime: data.firstBuyTime || now3, exitTime: data.lastSellTime || now3,
                  athMcap: td.athMcap || exitMcap, startMcap: td.startMcap || entryMcap, time: now3, sellEvents });
                if (ws.trades.length > 50) ws.trades = ws.trades.slice(-50);
              }
              ws.losses++;
              ws.lossAddrs.add(t.addr);
              ws.lossTokens.push(t.name); // display name
              ws.totalBought += data.bought;
              ws.totalSold += sold;
              ws.totalPnl += pnl;
              td.wallets[w] = { bought: 0, sold: 0, firstBuyTime: null, lastSellTime: null, entryMcap: 0, exitMcap: 0, sellEvents: [] };
              // Keep addr in lossAddrs — never delete
              if (ws.activeBuys) delete ws.activeBuys[t.addr];
              sbUpsertWallet(w, walletScores.current[w]);
            }

            // ── HOLD ──
            if (walletHold && !ws.winAddrs.has(t.addr) && !ws.lossAddrs.has(t.addr) && !ws.holdAddrs.has(t.addr)) {
              ws.holds = (ws.holds || 0) + 1;
              ws.holdAddrs.add(t.addr);
              ws.holdTokens = ws.holdTokens || [];
              ws.holdTokens.push(t.addr); // store addr not name
              ws.trades.push({ token: t.name, addr: t.addr, sol: data.bought, sold: sold, type: "HOLD", mcap: exitMcap, entryMcap, pnl,
                entryTime: data.firstBuyTime || now3, exitTime: null,
                athMcap: td.athMcap || exitMcap, startMcap: td.startMcap || entryMcap, time: now3, sellEvents });
              if (ws.trades.length > 50) ws.trades = ws.trades.slice(-50);
              sbUpsertWallet(w, walletScores.current[w]);
            }
            // Refresh live HOLD entries with current mcap/pnl/athMcap/sellEvents
            if (walletHold && ws.holdAddrs.has(t.addr)) {
              const existTrade = ws.trades.find(tr => tr.addr === t.addr && tr.type === "HOLD");
              if (existTrade) { existTrade.mcap = exitMcap; existTrade.sold = sold; existTrade.pnl = pnl; existTrade.athMcap = Math.max(td.athMcap||0, existTrade.athMcap||0); existTrade.sellEvents = sellEvents; }
            }
          });
        });
        return prev;
      });
      // ── SMART PRUNING ──
      const keys = Object.keys(walletScores.current);
      // Hard cap
      if (keys.length > 5000) {
        const sorted = keys.sort((a, b) => (walletScores.current[b]?.wins || 0) - (walletScores.current[a]?.wins || 0));
        const keep = new Set(sorted.slice(0, 2000));
        keys.forEach(k => { if (!keep.has(k)) delete walletScores.current[k]; });
      }
      // Purge spray-and-pray wallets (10:1+ loss:win ratio)
      // Purge no-win no-hold wallets after 2 min of inactivity
      // Purge 1W/1L/0H wallets after 5 min of inactivity
      Object.keys(walletScores.current).forEach(k => {
        const ws = walletScores.current[k];
        const idle = now3 - (ws.lastActivity || 0);
        if (ws.losses > 10 && ws.wins > 0 && ws.losses / ws.wins >= 10) {
          delete walletScores.current[k]; return;
        }
        // No wins, no holds, only losses — purge after 2 min idle
        if (ws.wins === 0 && (ws.holds || 0) === 0 && idle > 120000) {
          delete walletScores.current[k]; return;
        }
        // 1 win, 1+ loss, no holds — mediocre, purge after 5 min idle
        if (ws.wins <= 1 && ws.losses >= 1 && (ws.holds || 0) === 0 && idle > 300000) {
          delete walletScores.current[k]; return;
        }
        // 0 wins, 0 losses, only holds that never resolved — purge after 10 min idle
        if (ws.wins === 0 && ws.losses === 0 && idle > 600000) {
          delete walletScores.current[k]; return;
        }
      });
    }, 3000);
    return () => clearInterval(iv);
  }, []);

  // ═══ NARRATIVE CLUSTERING: Detect trending themes ═══
  useEffect(() => {
    const iv = setInterval(() => {
      setTokens(prev => {
        const recent = prev.filter(t => Date.now() - t.timestamp < 300000); // last 5 min
        if (recent.length < 5) return prev;
        // Extract keywords from names
        const keywords = {};
        const stopWords = new Set(["the","of","to","a","in","is","it","for","on","inu","token","coin","sol"]);
        recent.forEach(t => {
          const words = (t.name + " " + (t.fullName || "")).toLowerCase()
            .replace(/[^a-z0-9\s]/g, "").split(/\s+/)
            .filter(w => w.length > 2 && !stopWords.has(w));
          words.forEach(w => {
            if (!keywords[w]) keywords[w] = { count: 0, tokens: [], totalMcap: 0 };
            if (!keywords[w].tokens.find(x => x.name === t.name)) {
              keywords[w].count++;
              keywords[w].tokens.push({ name: t.name, mcap: t.mcap, qualified: t.qualified });
              keywords[w].totalMcap += t.mcap;
            }
          });
        });
        // Find trending (3+ tokens with same keyword)
        const trending = Object.entries(keywords)
          .filter(([, v]) => v.count >= 3)
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 8)
          .map(([word, data]) => ({
            word, count: data.count, tokens: data.tokens.slice(0, 5),
            avgMcap: data.totalMcap / data.count,
            qualified: data.tokens.filter(t => t.qualified).length,
          }));
        if (trending.length > 0) setNarratives(trending);
        return prev;
      });
    }, 15000);
    return () => clearInterval(iv);
  }, []);

  // ═══ SESSION STATS ═══
  useEffect(() => {
    const iv = setInterval(() => {
      setTokens(prev => {
        const qualified = prev.filter(t => t.qualified).length;
        const dead = prev.filter(t => !t.alive || (t.health || 0) <= 0).length;
        const alive = prev.filter(t => t.alive && (t.health || 0) > 0);
        let best = null, bestPct = 0;
        alive.forEach(t => {
          if (t.mcap > 30000 && t.mcap > bestPct) { best = t.name; bestPct = t.mcap; }
        });
        setSessionStats(s => ({
          ...s, tokensScanned: prev.length, qualified, dead,
          bestToken: best || s.bestToken, bestPct: bestPct || s.bestPct,
          smartWallets: Object.values(walletScores.current).filter(w => {
            const wins=(w.trades||[]).filter(tr=>tr.type==="WIN").length;
            const losses=(w.trades||[]).filter(tr=>tr.type==="LOSS").length;
            const total=wins+losses;
            const rate=total>0?wins/total:0;
            const unrealized=(w.trades||[]).filter(tr=>tr.type==="HOLD").reduce((s,tr)=>s+(tr.pnl!=null?tr.pnl:((tr.sold||0)-tr.sol)),0);
            const adjustedPnl=(w.totalPnl||0)+unrealized;
            return wins>=4&&rate>=0.60&&wins>=(losses*2)&&total>=5&&(w.totalPnl||0)>=1.0&&adjustedPnl>0.5;
          }).length,
          solPrice: SOL_USD, mcapCorr: MCAP_CORRECTION,
        }));
        return prev;
      });
    }, 5000);
    return () => clearInterval(iv);
  }, []);

  return { tokens, whaleAlerts, intelEvents, migrations, stats,
    smartMoneyAlerts, bundleAlerts, narratives, sessionStats, walletScoresRef: walletScores };
}
