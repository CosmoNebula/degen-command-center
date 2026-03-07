import { useState, useRef, useEffect } from 'react';

var SB_URL = "https://yrmjphhfgduysoftnuxv.supabase.co";
var SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlybWpwaGhmZ2R1eXNvZnRudXh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MzI5MzAsImV4cCI6MjA4ODMwODkzMH0.scHhvTGiABJDybgbjgjilw8XuxOfmWPsqo4iytMZmio";
var hdrs = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };

// ── 1. WALLET DNA ARCHETYPES ──────────────────────────────────────────────────
var ARCHETYPES = {
  SNIPER:  { icon: '🎯', color: '#ff073a', desc: 'Fast entry, quick flip' },
  HOLDER:  { icon: '💎', color: '#00ffff', desc: 'Patient, waits for big moves' },
  WHALE:   { icon: '🐋', color: '#7c4dff', desc: 'Large position sizes' },
  FLIPPER: { icon: '⚡', color: '#ffe600', desc: 'Trades same token multiple times' },
  SCOUT:   { icon: '🔭', color: '#39ff14', desc: 'Small buys, high diversity' },
  DEGEN:   { icon: '🎲', color: '#ff6600', desc: 'Low win rate, high risk' },
  ELITE:   { icon: '👑', color: '#ffd700', desc: 'Consistent multi-factor winner' },
};

function classifyWalletDNA(ws) {
  const trades = ws.trades || [];
  const wins = ws.wins || 0;
  const losses = ws.losses || 0;
  const holds = ws.holds || 0;
  const total = wins + losses;
  if (total < 2 && holds === 0) return null;

  const winRate = total > 0 ? wins / total : 0;
  const avgBuy = trades.length > 0
    ? trades.reduce((s, t) => s + (t.sol || 0), 0) / trades.length : 0;

  // Hold duration from trade records
  const closedTrades = trades.filter(t => t.entryTime && t.exitTime && t.exitTime > t.entryTime);
  const avgHoldMs = closedTrades.length > 0
    ? closedTrades.reduce((s, t) => s + (t.exitTime - t.entryTime), 0) / closedTrades.length : 0;

  // Flip detection: multiple trade records on same addr
  const addrCounts = {};
  trades.forEach(t => { addrCounts[t.addr] = (addrCounts[t.addr] || 0) + 1; });
  const flippedTokens = Object.values(addrCounts).filter(c => c > 1).length;

  const bigWinRate = wins > 0 ? (ws.bigWins || 0) / wins : 0;
  const avgPnl = trades.filter(t => t.pnl != null).length > 0
    ? trades.filter(t => t.pnl != null).reduce((s, t) => s + t.pnl, 0)
      / trades.filter(t => t.pnl != null).length : 0;

  // Score each archetype
  const scores = { SNIPER: 0, HOLDER: 0, WHALE: 0, FLIPPER: 0, SCOUT: 0, DEGEN: 0, ELITE: 0 };

  // ELITE: rare, multi-factor
  if (wins >= 5 && winRate >= 0.65 && (ws.bigWins || 0) >= 2 && avgPnl > 0.5) scores.ELITE += 10;

  // WHALE
  if (avgBuy >= 1.5) scores.WHALE += 4;
  else if (avgBuy >= 0.7) scores.WHALE += 2;

  // SNIPER: fast holder, high mcap exits
  if (avgHoldMs > 0 && avgHoldMs < 120000) scores.SNIPER += 4;   // <2min
  else if (avgHoldMs < 300000) scores.SNIPER += 2;               // <5min
  if (bigWinRate >= 0.4) scores.SNIPER += 2;
  if (winRate >= 0.55 && avgHoldMs < 300000) scores.SNIPER += 1;

  // HOLDER: long holds
  if (avgHoldMs >= 600000) scores.HOLDER += 4;                   // 10+ min
  else if (avgHoldMs >= 300000) scores.HOLDER += 2;
  if (holds > wins) scores.HOLDER += 2;
  if (bigWinRate >= 0.3 && avgHoldMs >= 300000) scores.HOLDER += 2;

  // FLIPPER: same token multiple times
  if (flippedTokens >= 3) scores.FLIPPER += 4;
  else if (flippedTokens >= 1) scores.FLIPPER += 2;

  // SCOUT: small, diverse
  if (avgBuy <= 0.2) scores.SCOUT += 3;
  else if (avgBuy <= 0.35) scores.SCOUT += 1;
  if (total >= 8 && avgBuy < 0.3) scores.SCOUT += 2;

  // DEGEN: mostly loses
  if (winRate < 0.25 && total >= 4) scores.DEGEN += 4;
  else if (winRate < 0.4 && total >= 3) scores.DEGEN += 2;
  if (losses > wins * 2) scores.DEGEN += 2;

  const archetype = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
  const confidence = Math.min(100, Object.entries(scores).sort((a,b)=>b[1]-a[1])[0][1] * 10);

  return {
    archetype,
    meta: ARCHETYPES[archetype] || ARCHETYPES.DEGEN,
    confidence,
    scores,
    stats: { avgBuy, avgHoldMs, winRate, bigWinRate, avgPnl, flippedTokens, total },
    computed: Date.now(),
  };
}

// ── 2. TOKEN DNA FINGERPRINT ──────────────────────────────────────────────────
function extractFingerprint(token, td) {
  if (!td) return null;
  const now = Date.now();
  const age = now - (td.launchTime || token.timestamp || now);

  const buys60s = td.buyTimes ? td.buyTimes.filter(t => t > (td.launchTime||now) - 1 + age - 60000).length : 0;
  const avgBuy = td.buySizes && td.buySizes.length > 0
    ? td.buySizes.reduce((s, v) => s + v, 0) / td.buySizes.length : 0;
  const sellPressure = (td.buys || 0) > 0 ? Math.min(1, (td.sells || 0) / (td.buys || 1)) : 0;
  const devPct = (token.devWallet || 0) / 100;
  const holderDensity = Math.min(1, (token.holders || 0) / 100);
  const earlyQuality = Math.min(1, (td.earlyBuyerCount || 0) / 15);
  const retentionRaw = (token.retentionPct || 50) / 100;
  const velocity = Math.min(1, (token.velocity || 0) / 20);
  const mcapTraj = Math.min(1, (token.mcap || 0) / 40000);
  const freshPct = (token.freshPct || 50) / 100;

  return {
    velocity,           // buy velocity
    avgBuy: Math.min(1, avgBuy / 1.5),
    sellPressure,
    devPct,
    holderDensity,
    earlyQuality,
    retention: retentionRaw,
    mcapTraj,
    freshness: freshPct,
    bundled: token.bundleDetected ? 0 : 1, // inverted: no bundle = good
  };
}

var FP_WEIGHTS = {
  velocity: 1.5,
  holderDensity: 1.3,
  retention: 1.2,
  earlyQuality: 1.1,
  mcapTraj: 1.0,
  sellPressure: 0.8,  // lower sell pressure = better
  avgBuy: 0.7,
  freshness: 0.6,
  bundled: 1.0,
  devPct: 0.5,
};

function scoreAgainstWinners(fp, winnerFPs) {
  if (!winnerFPs.length || !fp) return 0;
  const keys = Object.keys(FP_WEIGHTS);
  let totalSim = 0;

  for (const wfp of winnerFPs) {
    let weightedDist = 0, totalWeight = 0;
    for (const k of keys) {
      const w = FP_WEIGHTS[k] || 1;
      // sellPressure and devPct: lower is better — invert distance
      const a = k === 'sellPressure' || k === 'devPct' ? 1 - (fp[k] || 0) : (fp[k] || 0);
      const b = k === 'sellPressure' || k === 'devPct' ? 1 - (wfp[k] || 0) : (wfp[k] || 0);
      weightedDist += w * (a - b) ** 2;
      totalWeight += w;
    }
    const normDist = Math.sqrt(weightedDist / totalWeight);
    totalSim += 1 / (1 + normDist * 3);
  }

  return Math.min(100, Math.round((totalSim / winnerFPs.length) * 100 * 1.4));
}

// ── 3. SNIPE WINDOW ───────────────────────────────────────────────────────────
function computeSnipeWindow(histRows) {
  const validRows = histRows.filter(r => r.entry_mcap > 100 && r.peak_mcap > 0);
  if (validRows.length < 5) return null;

  // Optimal entry = rows where peak_mcap / entry_mcap > 3x
  const goodEntries = validRows.filter(r => r.peak_mcap / r.entry_mcap >= 3);
  const entryMcaps = goodEntries.map(r => r.entry_mcap).sort((a, b) => a - b);

  if (!entryMcaps.length) return null;
  const p25 = entryMcaps[Math.floor(entryMcaps.length * 0.2)];
  const p75 = entryMcaps[Math.floor(entryMcaps.length * 0.8)];
  const avgMultiple = goodEntries.reduce((s, r) => s + r.peak_mcap / r.entry_mcap, 0) / goodEntries.length;
  const avgPeak = validRows.reduce((s, r) => s + r.peak_mcap, 0) / validRows.length;
  const successRate = Math.round((goodEntries.length / validRows.length) * 100);

  return { low: Math.round(p25), high: Math.round(p75), avgMultiple: Math.round(avgMultiple * 10) / 10,
    avgPeak: Math.round(avgPeak), successRate, sampleSize: validRows.length };
}

// ── 4. MARKET TEMPERATURE ─────────────────────────────────────────────────────
function computeMarketTemp(tokens, walletScores) {
  const now = Date.now();
  const recentTokens = tokens.filter(t => now - t.timestamp < 600000);
  const aliveQ = tokens.filter(t => t.alive && t.qualified);

  const recentMigrations = tokens.filter(t => t.migrated && t.migratedAt && now - t.migratedAt < 3600000).length;
  const migScore = Math.min(100, recentMigrations * 10);

  const qualRate = recentTokens.length > 0
    ? recentTokens.filter(t => t.qualified).length / recentTokens.length : 0;
  const qualScore = Math.round(qualRate * 100);

  const ws = walletScores || {};
  const activeSmartWallets = Object.values(ws).filter(w =>
    (w.wins || 0) >= 3 && (now - (w.lastActivity || 0)) < 300000
  ).length;
  const smartScore = Math.min(100, activeSmartWallets * 8);

  const avgHealth = aliveQ.length > 0
    ? aliveQ.reduce((s, t) => s + (t.health || 50), 0) / aliveQ.length : 50;

  const bundleRate = tokens.filter(t => t.bundleDetected && now - t.timestamp < 600000).length;
  const bundlePenalty = Math.min(25, bundleRate * 6);

  const raw = migScore * 0.30 + qualScore * 0.25 + smartScore * 0.20 + avgHealth * 0.25 - bundlePenalty;
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  let label, color, emoji;
  if (score >= 82) { label = 'MANIC'; color = '#ff073a'; emoji = '🔥'; }
  else if (score >= 65) { label = 'ON FIRE'; color = '#ff6600'; emoji = '⚡'; }
  else if (score >= 45) { label = 'HEATING'; color = '#ffe600'; emoji = '📈'; }
  else if (score >= 28) { label = 'SLOW'; color = '#00ccff'; emoji = '🌊'; }
  else { label = 'ICE COLD'; color = '#6688aa'; emoji = '🧊'; }

  return { score, label, color, emoji,
    factors: { migrations: recentMigrations, qualRate: Math.round(qualRate * 100),
      smartWallets: activeSmartWallets, avgHealth: Math.round(avgHealth), bundleRate } };
}

// ── 5. PERSISTENCE SCORING ────────────────────────────────────────────────────
function computePersistence(ws) {
  const now = Date.now();
  const trades = ws.trades || [];
  let score = 0;

  for (const trade of trades) {
    if (trade.type !== 'WIN') continue;
    const daysAgo = Math.max(0, (now - (trade.exitTime || trade.time || now)) / 86400000);
    // Half-life of 5 days — recent wins worth much more
    const decay = Math.exp(-0.693 * daysAgo / 5);
    // Size multiplier: bigger wins count more
    const sizeM = (trade.pnl || 0) > 3 ? 2.5 : (trade.pnl || 0) > 1 ? 1.7 : (trade.pnl || 0) > 0.3 ? 1.2 : 1;
    // Big win bonus
    const bigM = trade.athMcap > 100000 ? 1.5 : 1;
    score += decay * sizeM * bigM;
  }

  const tier = score >= 8 ? 'LEGENDARY' : score >= 4 ? 'ELITE' : score >= 1.5 ? 'PROVEN'
    : score >= 0.3 ? 'EMERGING' : 'FADING';
  const tierColor = { LEGENDARY: '#ffd700', ELITE: '#ff6eb4', PROVEN: '#39ff14',
    EMERGING: '#00ccff', FADING: '#5a5a7a' }[tier];

  return { score: Math.round(score * 10) / 10, tier, tierColor };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN HOOK
// ═══════════════════════════════════════════════════════════════════════════════
export function useIntelligence({ walletScoresRef, tokens, tradeDataRef, deployerHistoryRef }) {
  const [walletDNA, setWalletDNA] = useState({});
  const [tokenDNA, setTokenDNA] = useState({});
  const [devFlags, setDevFlags] = useState({});    // deployer addr -> flag data
  const [clusters, setClusters] = useState([]);
  const [snipeWindow, setSnipeWindow] = useState(null);
  const [marketTemp, setMarketTemp] = useState({ score: 50, label: 'NEUTRAL', color: '#ffe600', emoji: '📊', factors: {} });
  const [persistenceScores, setPersistenceScores] = useState({});
  const [clusterAlerts, setClusterAlerts] = useState([]);
  const [signalBoost, setSignalBoost] = useState({});        // addr -> {boost:0-100, reasons[], tier}
  const [hotClusterTokens, setHotClusterTokens] = useState(new Set()); // addrs being cluster-bought now
  const [signalBoost, setSignalBoost] = useState({});        // addr -> {boost, reasons[]}
  const [hotClusterTokens, setHotClusterTokens] = useState(new Set()); // addrs in active clusters

  const winnerFPs = useRef([]);
  const coBuyMatrix = useRef({});      // "addrA|addrB" -> {count, lastSeen, tokens:Set}
  const alertedClusters = useRef(new Set());

  // ── BOOT: load winner fingerprints + dev history from Supabase ──────────────
  useEffect(() => {
    const boot = async () => {
      try {
        // Load winners for fingerprints — upgrade to 500 rows with better query
        const r1 = await fetch(
          `${SB_URL}/rest/v1/token_history?select=entry_mcap,peak_mcap,holders,volume,graduated&peak_mcap=gte.15000&entry_mcap=gt.0&limit=500&order=peak_mcap.desc`,
          { headers: hdrs }
        );
        if (r1.ok) {
          const rows = await r1.json();
          // Build real fingerprints using proxy math from available DB columns
          winnerFPs.current = rows.filter(r => r.peak_mcap > 15000 && r.entry_mcap > 0).map(r => {
            const multiple = r.peak_mcap / r.entry_mcap;
            const volToMcap = r.volume > 0 ? r.volume / r.peak_mcap : 0;
            // velocity proxy: high vol relative to peak = lots of early trading = fast mover
            const velocity = Math.min(1, volToMcap * 2.5);
            // retention: big multiple + graduated = holders never sold through pump
            const retention = r.graduated
              ? Math.min(0.95, 0.55 + Math.min(0.4, (multiple / 20) * 0.4))
              : Math.min(0.85, 0.35 + Math.min(0.4, (multiple / 15) * 0.4));
            // earlyQuality: tokens with big multiples had quality early buyers
            const earlyQuality = Math.min(0.95, Math.max(0.2, (multiple - 1) / 15));
            // holderDensity from actual count (proxy: bigger multiples attract more holders)
            const holderDensity = Math.min(1, Math.max(
              (r.holders || 0) / 120,
              multiple > 5 ? 0.4 : 0.2
            ));
            return {
              velocity,
              avgBuy: Math.min(1, (r.peak_mcap / 40000) * 0.5),
              sellPressure: Math.min(0.8, Math.max(0.1, 1 - retention)),
              devPct: 0.06,
              holderDensity, earlyQuality, retention,
              mcapTraj: Math.min(1, r.entry_mcap / 35000),
              freshness: 0.45,
              bundled: r.graduated ? 1 : 0.75,
              peakMcap: r.peak_mcap, multiple,
            };
          });
          console.log(`[INTEL] 📊 ${winnerFPs.current.length} winner fingerprints loaded`);
        }

        // Load dev history for surveillance
        const r2 = await fetch(
          `${SB_URL}/rest/v1/token_history?select=deployer,rug,graduated,peak_mcap,name&deployer=neq.&limit=3000`,
          { headers: hdrs }
        );
        if (r2.ok) {
          const rows2 = await r2.json();
          const devMap = {};
          for (const row of rows2) {
            if (!row.deployer || row.deployer.length < 10) continue;
            if (!devMap[row.deployer]) devMap[row.deployer] = {
              launches: 0, rugs: 0, graduated: 0, totalPeak: 0, tokens: []
            };
            const d = devMap[row.deployer];
            d.launches++;
            if (row.rug) d.rugs++;
            if (row.graduated) d.graduated++;
            d.totalPeak += row.peak_mcap || 0;
            if (d.tokens.length < 5) d.tokens.push(row.name || '???');
          }

          const flags = {};
          for (const [addr, d] of Object.entries(devMap)) {
            if (d.launches < 2) continue;
            const rugRate = d.launches > 0 ? d.rugs / d.launches : 0;
            const avgPeak = d.launches > 0 ? d.totalPeak / d.launches : 0;
            const tier =
              d.rugs >= 3 || (d.launches >= 4 && rugRate >= 0.6) ? 'SERIAL_RUGGER' :
              d.rugs >= 2 || (d.launches >= 3 && rugRate >= 0.5) ? 'DANGEROUS' :
              d.launches >= 2 && rugRate >= 0.33 ? 'SUSPICIOUS' :
              d.graduated >= 2 && rugRate < 0.2 ? 'PROVEN' :
              d.launches >= 4 && rugRate < 0.25 ? 'EXPERIENCED' : null;

            if (tier) {
              flags[addr] = { ...d, tier, rugRate: Math.round(rugRate * 100), avgPeak, flagged: tier !== 'PROVEN' && tier !== 'EXPERIENCED' };
            }
          }
          setDevFlags(flags);
          console.log(`[INTEL] 🕵 ${Object.keys(flags).length} dev profiles flagged`);
        }
      } catch (e) {
        console.warn('[INTEL] Boot failed:', e.message);
      }
    };
    boot();
    // Refresh every 10min
    const iv = setInterval(boot, 600000);
    return () => clearInterval(iv);
  }, []);

  // ── SNIPE WINDOW: compute from DB every 5min ───────────────────────────────
  useEffect(() => {
    const compute = async () => {
      try {
        const r = await fetch(
          `${SB_URL}/rest/v1/token_history?select=entry_mcap,peak_mcap&peak_mcap=gte.10000&entry_mcap=gt.500&limit=500&order=peak_mcap.desc`,
          { headers: hdrs }
        );
        if (!r.ok) return;
        const rows = await r.json();
        const sw = computeSnipeWindow(rows);
        if (sw) { setSnipeWindow(sw); console.log(`[INTEL] 🎯 Snipe window $${sw.low.toLocaleString()}-$${sw.high.toLocaleString()} (${sw.sampleSize} winners, ${sw.avgMultiple}x avg)`); }
      } catch (e) { console.warn('[INTEL] Snipe window failed:', e.message); }
    };
    compute();
    const iv = setInterval(compute, 300000);
    return () => clearInterval(iv);
  }, []);

  // ── WALLET DNA: classify every 8s ─────────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      const ws = walletScoresRef?.current;
      if (!ws) return;
      const newDNA = {};
      for (const [addr, score] of Object.entries(ws)) {
        const total = (score.wins || 0) + (score.losses || 0);
        if (total < 2 && (score.holds || 0) < 1) continue;
        const dna = classifyWalletDNA(score);
        if (dna) newDNA[addr] = dna;
      }
      setWalletDNA(newDNA);
    }, 8000);
    return () => clearInterval(iv);
  }, [walletScoresRef]);

  // ── PERSISTENCE SCORES: compute every 30s ─────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      const ws = walletScoresRef?.current;
      if (!ws) return;
      const scores = {};
      for (const [addr, w] of Object.entries(ws)) {
        if (!(w.trades?.length)) continue;
        const p = computePersistence(w);
        if (p.score > 0.1) scores[addr] = p;
      }
      setPersistenceScores(scores);
    }, 30000);
    return () => clearInterval(iv);
  }, [walletScoresRef]);

  // ── TOKEN DNA: score every 15s ────────────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      if (!tokens.length) return;
      const newDNA = {};
      const fps = winnerFPs.current;
      for (const t of tokens) {
        if (!t.alive) continue;
        const td = tradeDataRef?.current?.[t.addr];
        const fp = extractFingerprint(t, td);
        if (!fp) continue;
        const score = fps.length > 0 ? scoreAgainstWinners(fp, fps) : 0;
        const label = score >= 72 ? 'STRONG MATCH' : score >= 52 ? 'MODERATE' : score >= 35 ? 'WEAK' : 'LOW';
        const labelColor = score >= 72 ? '#39ff14' : score >= 52 ? '#ffe600' : score >= 35 ? '#ff6600' : '#5a5a7a';
        newDNA[t.addr] = { score, label, labelColor, fingerprint: fp };
      }
      setTokenDNA(newDNA);
    }, 15000);
    return () => clearInterval(iv);
  }, [tokens, tradeDataRef]);

  // ── MARKET TEMPERATURE: every 4s ─────────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      const temp = computeMarketTemp(tokens, walletScoresRef?.current);
      setMarketTemp(temp);
    }, 4000);
    return () => clearInterval(iv);
  }, [tokens, walletScoresRef]);

  // ── WALLET CLUSTERING: detect coordinated groups every 12s ───────────────
  useEffect(() => {
    const iv = setInterval(() => {
      const td = tradeDataRef?.current;
      if (!td) return;
      const now = Date.now();

      // Step 1: scan all tokens for co-buy pairs within 30s window
      for (const [mint, data] of Object.entries(td)) {
        const wallets = data.wallets || {};
        const buyerTimes = [];
        for (const [w, wdata] of Object.entries(wallets)) {
          if ((wdata.bought || 0) > 0.1 && wdata.firstBuyTime) {
            buyerTimes.push([w, wdata.firstBuyTime]);
          }
        }
        buyerTimes.sort((a, b) => a[1] - b[1]);

        for (let i = 0; i < buyerTimes.length; i++) {
          for (let j = i + 1; j < buyerTimes.length; j++) {
            if (buyerTimes[j][1] - buyerTimes[i][1] > 30000) break;
            const key = [buyerTimes[i][0], buyerTimes[j][0]].sort().join('|');
            if (!coBuyMatrix.current[key]) coBuyMatrix.current[key] = { count: 0, lastSeen: 0, tokens: new Set() };
            const entry = coBuyMatrix.current[key];
            if (!entry.tokens.has(mint)) {
              entry.tokens.add(mint);
              entry.count++;
              entry.lastSeen = now;
            }
          }
        }
      }

      // Prune stale pairs (>2h old)
      const cutoff = now - 7200000;
      for (const key of Object.keys(coBuyMatrix.current)) {
        if (coBuyMatrix.current[key].lastSeen < cutoff) delete coBuyMatrix.current[key];
      }

      // Step 2: union-find to merge overlapping pairs into clusters
      const strongPairs = Object.entries(coBuyMatrix.current)
        .filter(([, v]) => v.count >= 3)
        .sort((a, b) => b[1].count - a[1].count);

      if (!strongPairs.length) return;

      const parent = {};
      const getRoot = (x) => {
        if (!parent[x]) parent[x] = x;
        if (parent[x] !== x) parent[x] = getRoot(parent[x]);
        return parent[x];
      };
      for (const [key] of strongPairs) {
        const [a, b] = key.split('|');
        const ra = getRoot(a), rb = getRoot(b);
        if (ra !== rb) parent[ra] = rb;
      }

      // Group into clusters
      const clusterMap = {};
      for (const [key, data] of strongPairs) {
        const [a, b] = key.split('|');
        const root = getRoot(a);
        if (!clusterMap[root]) clusterMap[root] = { wallets: new Set(), cobuys: 0, tokens: new Set(), lastSeen: 0 };
        const c = clusterMap[root];
        c.wallets.add(a); c.wallets.add(b);
        if (data.count > c.cobuys) c.cobuys = data.count;
        data.tokens.forEach(t => c.tokens.add(t));
        if (data.lastSeen > c.lastSeen) c.lastSeen = data.lastSeen;
      }

      const clusterList = Object.entries(clusterMap)
        .filter(([, c]) => c.wallets.size >= 2 && c.cobuys >= 3)
        .map(([id, c]) => ({
          id,
          wallets: [...c.wallets].slice(0, 8),
          walletCount: c.wallets.size,
          cobuys: c.cobuys,
          tokenCount: c.tokens.size,
          tokens: [...c.tokens].slice(0, 5),
          lastSeen: c.lastSeen,
          strength: Math.min(100, c.cobuys * 12 + c.wallets.size * 8),
          isHot: now - c.lastSeen < 120000, // active in last 2 min
        }))
        .sort((a, b) => b.strength - a.strength)
        .slice(0, 15);

      setClusters(clusterList);

      // ── NEURAL BOOST: compute per-token signal boost from clusters + DNA ──
      const hotTokens = new Set();
      const boosts = {};

      // Cluster boost: weight by wallet persistence — LEGENDARY/ELITE clusters hit harder
      for (const cl of clusterList) {
        // Compute persistence multiplier from wallets in this cluster
        const ws = walletScoresRef?.current || {};
        const ps = {}; // persistence scores (computed inline for speed)
        let bestPersistTier = 'NONE';
        for (const wAddr of cl.wallets) {
          const w = ws[wAddr];
          if (!w?.trades?.length) continue;
          let pScore = 0;
          const now2 = Date.now();
          for (const trade of w.trades) {
            if (trade.type !== 'WIN') continue;
            const daysAgo = Math.max(0, (now2 - (trade.exitTime || trade.time || now2)) / 86400000);
            const decay = Math.exp(-0.693 * daysAgo / 5);
            const sizeM = (trade.pnl || 0) > 3 ? 2.5 : (trade.pnl || 0) > 1 ? 1.7 : 1.2;
            pScore += decay * sizeM;
          }
          const tier = pScore >= 8 ? 'LEGENDARY' : pScore >= 4 ? 'ELITE' : pScore >= 1.5 ? 'PROVEN' : 'EMERGING';
          if (['LEGENDARY','ELITE','PROVEN'].indexOf(tier) > ['LEGENDARY','ELITE','PROVEN'].indexOf(bestPersistTier)) {
            bestPersistTier = tier;
          }
        }
        const persistMult = bestPersistTier === 'LEGENDARY' ? 2.8
          : bestPersistTier === 'ELITE' ? 2.0
          : bestPersistTier === 'PROVEN' ? 1.5 : 1.0;

        const boostAmount = cl.isHot
          ? Math.min(35, (cl.strength / 3.5) * persistMult)
          : Math.min(12, (cl.strength / 8) * persistMult);

        for (const mint of cl.tokens) {
          if (cl.isHot) hotTokens.add(mint);
          if (!boosts[mint]) boosts[mint] = { boost: 0, reasons: [] };
          boosts[mint].boost += boostAmount;
          const label = persistMult >= 2 ? `🔗🔥 ${cl.walletCount}w ELITE cluster` : `🔗${cl.isHot ? '🔥' : ''} ${cl.walletCount}w/${cl.cobuys}x`;
          if (!boosts[mint].reasons.includes(label)) boosts[mint].reasons.push(label);
        }
      }

      // DNA boost: tokens matching winner fingerprint pattern
      for (const [addr, dna] of Object.entries(tokenDNA)) {
        if (dna.score >= 55) {
          if (!boosts[addr]) boosts[addr] = { boost: 0, reasons: [] };
          const dnaBoost = Math.min(18, (dna.score - 50) * 0.36);
          boosts[addr].boost += dnaBoost;
          boosts[addr].reasons.push(`🧬 DNA:${dna.score}%`);
        }
      }

      setHotClusterTokens(hotTokens);
      setSignalBoost(boosts);

      // Fire alerts for new hot clusters
      const newAlerts = [];
      for (const cl of clusterList) {
        if (!cl.isHot) continue;
        const alertKey = `${cl.id}-${cl.cobuys}`;
        if (!alertedClusters.current.has(alertKey)) {
          alertedClusters.current.add(alertKey);
          newAlerts.push({
            id: Date.now() + Math.random(),
            time: now,
            walletCount: cl.walletCount,
            cobuys: cl.cobuys,
            tokens: cl.tokens,
            strength: cl.strength,
          });
        }
      }
      if (newAlerts.length > 0) {
        setClusterAlerts(prev => [...newAlerts, ...prev].slice(0, 30));
      }
    }, 12000);
    return () => clearInterval(iv);
  }, [tradeDataRef]);

  // ── NEURAL SIGNAL BOOST: fuse all intelligence into per-token signal — every 3s ──────
  useEffect(() => {
    const iv = setInterval(() => {
      const now = Date.now();
      const newBoost = {};
      const newHot = new Set();

      // Pre-build: which clusters are hot + what tokens they're targeting
      const hotClusters = clusters.filter(cl => cl.isHot); // active in last 2min
      const clusterTargets = new Map(); // addr -> {strength, walletCount, cobuys}
      for (const cl of hotClusters) {
        for (const addr of cl.tokens) {
          const existing = clusterTargets.get(addr);
          if (!existing || cl.strength > existing.strength) {
            clusterTargets.set(addr, { strength: cl.strength, walletCount: cl.walletCount, cobuys: cl.cobuys });
          }
          newHot.add(addr);
        }
      }

      // Get all token addresses from tokenDNA (already filtered to alive tokens)
      const allAddrs = new Set([...Object.keys(tokenDNA), ...clusterTargets.keys()]);

      for (const addr of allAddrs) {
        let boost = 0;
        const reasons = [];

        // ── 1. CLUSTER SIGNAL (most powerful — coordinated whales) ──────────
        const clData = clusterTargets.get(addr);
        if (clData) {
          const clBoost = Math.min(45, clData.strength * 0.45 + clData.walletCount * 3);
          boost += clBoost;
          reasons.push(`🔗 CLUSTER ${clData.walletCount}w (${clBoost.toFixed(0)}pts)`);
        }

        // ── 2. TOKEN DNA vs WINNERS ──────────────────────────────────────────
        const dna = tokenDNA[addr];
        if (dna && dna.score > 0) {
          const dnaBoost = dna.score >= 75 ? 20 : dna.score >= 55 ? 12 : dna.score >= 40 ? 6 : 0;
          if (dnaBoost > 0) {
            boost += dnaBoost;
            reasons.push(`🧬 DNA ${dna.score}% (${dnaBoost}pts)`);
          }
        }

        // ── 3. SNIPE WINDOW alignment ────────────────────────────────────────
        // (snipeWindow is global — we'd need token mcap here, skip for now)

        // ── 4. SMART WALLET ARCHETYPES buying this token ─────────────────────
        // We detect this by checking walletDNA for wallets that have trades on this addr
        let eliteCount = 0, whaleCount = 0, sniperCount = 0;
        const ps = persistenceScores;
        for (const [waddr, dnaW] of Object.entries(walletDNA)) {
          // Check if this wallet has traded this token (approximate via trades array)
          const wScore = walletScoresRef?.current?.[waddr];
          const hasTrade = wScore?.trades?.some(t => t.addr === addr);
          if (!hasTrade) continue;
          if (dnaW.archetype === 'ELITE') eliteCount++;
          else if (dnaW.archetype === 'WHALE') whaleCount++;
          else if (dnaW.archetype === 'SNIPER') sniperCount++;
          // Persistence bonus
          const pScore = ps[waddr];
          if (pScore?.tier === 'LEGENDARY') boost += 8;
          else if (pScore?.tier === 'ELITE') boost += 5;
          else if (pScore?.tier === 'PROVEN') boost += 3;
        }
        if (eliteCount > 0) { boost += eliteCount * 12; reasons.push(`👑 ELITE×${eliteCount}`); }
        if (whaleCount > 0) { boost += whaleCount * 7; reasons.push(`🐋 WHALE×${whaleCount}`); }
        if (sniperCount > 0) { boost += sniperCount * 5; reasons.push(`🎯 SNIPER×${sniperCount}`); }

        if (boost <= 0) continue;
        boost = Math.min(100, Math.round(boost));
        const tier = boost >= 70 ? 'ELITE' : boost >= 45 ? 'HOT' : boost >= 20 ? 'WARM' : 'WEAK';
        const tierColor = { ELITE: '#ffd700', HOT: '#ff6600', WARM: '#00ccff', WEAK: '#5a5a7a' }[tier];
        newBoost[addr] = { boost, reasons, tier, tierColor, ts: now };
      }

      setSignalBoost(newBoost);
      setHotClusterTokens(newHot);
    }, 3000);
    return () => clearInterval(iv);
  }, [clusters, tokenDNA, walletDNA, persistenceScores, walletScoresRef]);


  useEffect(() => {
    const iv = setInterval(() => {
      const depHistory = deployerHistoryRef?.current;
      if (!devFlags || !depHistory) return;
      // If a deployer has accumulated rug data in live session, add to devFlags
      const additions = {};
      for (const [addr, d] of Object.entries(depHistory)) {
        if (d.launches >= 2 && d.rugs >= 1 && !devFlags[addr]) {
          additions[addr] = {
            launches: d.launches, rugs: d.rugs, graduated: 0,
            tier: d.rugs >= 2 ? 'DANGEROUS' : 'SUSPICIOUS',
            rugRate: Math.round((d.rugs / d.launches) * 100),
            flagged: true, liveDetected: true,
          };
        }
      }
      if (Object.keys(additions).length > 0) setDevFlags(prev => ({ ...prev, ...additions }));
    }, 30000);
    return () => clearInterval(iv);
  }, [devFlags, deployerHistoryRef]);

  return {
    walletDNA,       // { addr -> {archetype, meta, confidence, stats} }
    tokenDNA,        // { addr -> {score, label, labelColor, fingerprint} }
    devFlags,        // { deployer_addr -> {tier, rugRate, launches, rugs, ...} }
    clusters,        // [{id, wallets, walletCount, cobuys, strength, isHot}]
    clusterAlerts,   // [{id, time, walletCount, cobuys, tokens, strength}]
    snipeWindow,     // {low, high, avgMultiple, successRate, sampleSize} | null
    marketTemp,      // {score, label, color, emoji, factors}
    persistenceScores, // { addr -> {score, tier, tierColor} }
    signalBoost,     // { addr -> {boost, reasons[]} } — cluster + DNA composite boost
    hotClusterTokens, // Set of mint addrs currently targeted by active clusters
    // Expose helpers for UI
    ARCHETYPES,
    computePersistence,
    classifyWalletDNA,
  };
}

// ── EXPORTS for direct use in App.jsx UI ─────────────────────────────────────
export { ARCHETYPES, computePersistence };
