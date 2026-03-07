import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────
// 🔑 DROP YOUR KEY HERE
// Get one at console.anthropic.com → API Keys
// Leave as null to show the Coming Soon preview
// ─────────────────────────────────────────────
const ANTHROPIC_KEY = null;
// const ANTHROPIC_KEY = "sk-ant-api03-...";

const CLAUDE_MODEL = "claude-sonnet-4-20250514";

// ─────────────────────────────────────────────
// 💰 BUDGET CONFIG
// ─────────────────────────────────────────────
const BUDGET_USD        = 50;
const COST_INPUT_PER_M  = 3.00;   // $ per 1M input tokens (Sonnet 4)
const COST_OUTPUT_PER_M = 15.00;  // $ per 1M output tokens
const STORAGE_KEY_REAL  = "degen_claude_spend_cents";
const STORAGE_KEY_MOCK  = "degen_claude_mock_est_cents";

// Estimated avg tokens per call (for mock cost projection)
const MOCK_AVG_INPUT_TOK  = 3200;
const MOCK_AVG_OUTPUT_TOK = 650;

function loadSpendCents(mock = false) {
  try { return parseFloat(localStorage.getItem(mock ? STORAGE_KEY_MOCK : STORAGE_KEY_REAL) || "0") || 0; }
  catch { return 0; }
}
function saveSpendCents(v, mock = false) {
  try { localStorage.setItem(mock ? STORAGE_KEY_MOCK : STORAGE_KEY_REAL, String(v)); } catch {}
}
function calcCallCostCents(inputTok, outputTok) {
  return ((inputTok / 1_000_000) * COST_INPUT_PER_M
        + (outputTok / 1_000_000) * COST_OUTPUT_PER_M) * 100;
}
const MOCK_CALL_COST_CENTS = calcCallCostCents(MOCK_AVG_INPUT_TOK, MOCK_AVG_OUTPUT_TOK);

const SYSTEM_PROMPT = `You are the intelligence officer embedded inside degen-LIVE — a real-time Solana memecoin trading dashboard built by Cosmo. You have a dedicated office inside the dashboard and watch live token data to diagnose problems, identify patterns, and suggest improvements.

════ DASHBOARD ARCHITECTURE ════

LIFECYCLE: Tokens enter as PumpFun launches (~$2-4K mcap) → tracked through bonding curve → graduate to Raydium at ~$69K mcap. Session holds up to 100 tokens.

PARK SYSTEM (Holding Bay):
- staleHigh: mcap ≥$40K + silent 2.5min → parks
- staleMid: mcap <$40K + silent 1min (live tokens only) → parks  
- staleDB: fromDB + mcap <$40K + silent 10min → parks
- preMigration: bondingPct>80 OR mcap $22-85K + silent 90s → parks
- dbGrace: fromDB + session <3min → BLOCKS all parking
- Guards: isLocked / laserIn / accelerating → never parks runners
KEY TELL: If a token park-cycles rapidly, it's oscillating on a rule boundary. Identify which rule.

LOCK SYSTEM:
- qualScore 7/8+ required before lock fires
- Factors: holders, buy%, trajectory, smart money hits, acceleration
- Auto-eject if crashes >40% from lock price
- intelBoost ≥25 → +5 lock score | hotCluster → +4 | DNA ≥75 → +3 | PROVEN dev → +2

NEURAL SIGNAL (0-100):
- qualScore backbone + smart money + momentum + retention + platform signals + on-chain security + penalties
- ≥72: cyan aura on canvas | ≥88: gold corona

INTELLIGENCE ENGINE:
- Wallet DNA: winner wallet fingerprinting (46w, 17w, 13w etc = wins count)
- Token DNA: similarity scoring to past winners (velocity, retention, buy pattern)
- Cluster detection: coordinated wallet groups, fires kill feed CLUSTER STRIKE
- Snipe window: optimal entry mcap range from historical winners
- Market temp: bull/bear pressure from recent activity

DATA GAPS (known):
- SolanaTracker 401 → bondingPct unreliable, mcap proxy used
- Jupiter 401 → price feed backing off
- tokenDNA partially hollow (DB lacks velocity/retention columns)
- GeckoTerminal CORS blocking direct pool lookups for migrated tokens

════ YOUR JOB ════

You receive periodic JSON snapshots of full system state. Analyze ruthlessly.

Flag format — always use these prefixes:
🔴 CRITICAL — system malfunction, data integrity issue, rule broken
🟡 WARNING — threshold sensitivity, logic edge case, unexpected behavior
🟢 PATTERN — behavioral pattern worth noting, correlation found
💡 SUGGESTION — specific fix, threshold change, or code improvement  
📊 STAT — notable metric, comparison, or measurement

Rules:
- Be SURGICAL. Don't say "AI is parking a lot" — say "AI has cycled 47× in 23min, mcap $36-39K oscillating on staleMid $40K boundary. Add $3K buffer or 3-cycle debounce."
- Name specific tokens, specific mcap values, specific wallet win counts
- Cross-reference rules above when diagnosing park/lock behavior
- If lock performance is poor, identify whether it's bundle inflation, trajectory noise, or threshold mismatch
- Track patterns ACROSS snapshots — don't just describe the current state, diagnose change over time
- If you see the same token flagged repeatedly across multiple snapshots, escalate your assessment`;

// ─────────────────────────────────────────────
// STATUS DETECTION
// ─────────────────────────────────────────────
const KEY_STATUS  = !ANTHROPIC_KEY ? "no_key" : ANTHROPIC_KEY.startsWith("sk-ant-") ? "ready" : "invalid";
const IS_MOCK_MODE = KEY_STATUS !== "ready"; // true when no valid key — runs full simulation


// ─────────────────────────────────────────────
// COMING SOON OVERLAY
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// MOCK CHAT RESPONDER
// Answers questions using real snapshot data
// ─────────────────────────────────────────────
function generateMockChatResponse(question, snap) {
  const q = question.toLowerCase();
  const h = snap.health || {};
  const tokens = snap.detailedTokens || [];
  const cyclers = snap.topCyclers || [];
  const locks = snap.lockPerformance || [];

  // Route to relevant data based on question keywords
  if (q.includes("park") || q.includes("cycle") || q.includes("cycling")) {
    const top = cyclers[0];
    if (!top) return "📊 MOCK: No park cycling detected in current session data.";
    return `📊 MOCK ANALYSIS — PARK CYCLING

Top cycler: ${top.name} — ${top.cycles}× cycles at $${top.mcap.toLocaleString()} mcap

${top.cycles >= 8 ? `🔴 CRITICAL: This is excessive. ` : `🟡 WARNING: `}${top.mcap >= 35000 && top.mcap <= 45000 ? `Oscillating on the staleMid $40K boundary. Token trades are pushing it just above and below the threshold. Fix: add ±$3K dead zone so tokens between $37K-$43K require 2 consecutive silent checks.` : top.mcap >= 22000 && top.mcap <= 30000 ? `Oscillating in the preMigration range ($22-30K). The mcap proxy may be ticking back and forth with each trade. Check if bondingPct fallback is stable.` : `Silence threshold may be too tight for this mcap range. Consider raising staleMid silence from 1min to 90s.`}

${cyclers.slice(1,4).length > 0 ? `Also cycling: ${cyclers.slice(1,4).map(c => `${c.name}(${c.cycles}×)`).join(", ")}` : ""}`;
  }

  if (q.includes("lock") || q.includes("locked") || q.includes("eject")) {
    const active = locks.filter(l => l.status === "ACTIVE");
    const crashed = locks.filter(l => l.status === "CRASHED");
    const wins = locks.filter(l => l.status === "WIN");
    if (locks.length === 0) return "📊 MOCK: No lock history recorded yet this session.";
    return `📊 MOCK ANALYSIS — LOCK PERFORMANCE

${locks.length} locks total: ${active.length} active · ${wins.length} wins · ${crashed.length} crashed

${crashed.length > 0 ? `🔴 Crashed: ${crashed.map(l => `${l.name} (exit ${l.exitPct}% from lock@$${l.lockMcap.toLocaleString()})`).join(", ")}

${crashed[0]?.peakPct < 10 ? `💡 Near-zero peak before crash on ${crashed[0].name} — possible bundle inflation at lock time. Trajectory calc may be over-counting initial buy cluster.` : `Peak was +${crashed[0]?.peakPct}% before reversal — eject timing working correctly.`}

` : ""}${active.length > 0 ? `🟢 Active: ${active.map(l => `${l.name} locked@$${l.lockMcap.toLocaleString()} peak +${l.peakPct}%`).join(", ")}` : ""}`;
  }

  if (q.includes("signal") || q.includes("score") || q.includes("neural")) {
    const high = tokens.filter(t => t.signal >= 72).sort((a,b) => b.signal - a.signal);
    if (high.length === 0) return "📊 MOCK: No tokens currently above ◈72 signal threshold.";
    const top = high[0];
    return `📊 MOCK ANALYSIS — SIGNAL SCORES

${high.length} tokens above ◈72

Top: ${top.name} ◈${top.signal} — ${top.smartMoney}x smart $, ${top.holders}w, ${top.buyPct}% buys, mcap $${top.mcap.toLocaleString()}

${top.signal >= 88 ? `🟢 Gold corona threshold (◈88) hit on ${top.name}. If this isn't locked, check qualScore — likely failing on holder count or buy% minimum.` : `🟡 Cyan aura active. Strong signal but not elite tier yet.`}

${high.length > 1 ? `Other high signals: ${high.slice(1,4).map(t => `${t.name}(◈${t.signal})`).join(", ")}` : ""}`;
  }

  if (q.includes("cluster") || q.includes("smart money") || q.includes("wallet")) {
    const clustered = tokens.filter(t => t.hotCluster);
    const smartToks = tokens.filter(t => t.smartMoney >= 2).sort((a,b) => b.smartMoney - a.smartMoney);
    return `📊 MOCK ANALYSIS — WALLET INTELLIGENCE

${clustered.length > 0 ? `🟡 Hot cluster tokens (${clustered.length}): ${clustered.map(t => t.name).join(", ")}
Watch for coordinated dump — cluster wallets tend to exit together.

` : "🟢 No active hot clusters.

"}${smartToks.length > 0 ? `Smart money hits: ${smartToks.slice(0,4).map(t => `${t.name}(${t.smartMoney}x)`).join(", ")}
${smartToks[0] && smartToks[0].status !== "LOCKED" ? `
💡 ${smartToks[0].name} has ${smartToks[0].smartMoney}x smart hits but isn't locked — check if qualScore is failing on another factor.` : ""}` : "No significant smart money activity."}`;
  }

  if (q.includes("cost") || q.includes("price") || q.includes("expensive") || q.includes("cheap")) {
    const spent = (snap._mockSpendCents || 0) / 100;
    return `📊 MOCK COST PROJECTION

Est. per auto-watch call: $${(MOCK_CALL_COST_CENTS/100).toFixed(4)}
At 30s intervals: ~$${(MOCK_CALL_COST_CENTS * 120 / 100).toFixed(2)}/hr
At 60s intervals: ~$${(MOCK_CALL_COST_CENTS * 60 / 100).toFixed(2)}/hr

$50 budget → ~${Math.round(5000 / (MOCK_CALL_COST_CENTS * 120))}hrs at 30s · ~${Math.round(5000 / (MOCK_CALL_COST_CENTS * 60))}hrs at 60s

💡 Chat questions cost ~2× an auto-watch snap (longer input from the question + snapshot). Budget for ~5-10 chats/session if watching actively.`;
  }

  // Generic fallback — summarize current state
  return `📊 MOCK ANALYSIS — CURRENT STATE

${h.total || 0} tokens tracked · ${h.locked || 0} locked · ${h.parked || 0} parked · ${h.field || 0} on field

Market: ${snap.market?.temp || "UNKNOWN"} (bull ${snap.market?.bullPressure || 0}% / bear ${snap.market?.bearPressure || 0}%)
Snipe window: ${snap.intel?.snipeWindow || "calculating"}

${tokens.length > 0 ? `Top signal: ${tokens.sort((a,b)=>b.signal-a.signal)[0]?.name || "none"} ◈${tokens.sort((a,b)=>b.signal-a.signal)[0]?.signal || 0}` : "No interesting tokens yet"}

◈ MOCK MODE — This is simulated intelligence. Add API key for live analysis.`;
}


// ─────────────────────────────────────────────
// MOCK RESPONSE GENERATOR
// Uses real snapshot data, zero API cost
// ─────────────────────────────────────────────
function generateMockResponse(snap) {
  const lines = [];
  const h = snap.health || {};
  const topCycler = (snap.topCyclers || [])[0];
  const topLocked = (snap.lockPerformance || []).find(l => l.status === "ACTIVE");
  const crashed   = (snap.lockPerformance || []).find(l => l.status === "CRASHED");
  const hotToks   = (snap.detailedTokens || []).filter(t => t.hotCluster);
  const highSig   = (snap.detailedTokens || []).filter(t => t.signal >= 72).sort((a,b) => b.signal - a.signal);
  const smartHits = (snap.detailedTokens || []).filter(t => t.smartMoney >= 2).sort((a,b) => b.smartMoney - a.smartMoney);
  const flash30   = (snap.flash30s || [])[0];
  const clusters  = snap.intel?.clusters || [];

  lines.push(`📊 MOCK TRIAL — SNAP #${snap.snap} · session ${snap.sessionMin}m`);
  lines.push(`📊 FIELD: ${h.total} tokens · ${h.locked} locked · ${h.parked} parked · ${h.field} active`);
  lines.push(``);

  // Market temp
  if (snap.market?.temp) {
    const bull = snap.market.bullPressure || 0;
    const bear = snap.market.bearPressure || 0;
    const emoji = bull > bear ? "🟢" : bear > bull + 20 ? "🔴" : "🟡";
    lines.push(`${emoji} MARKET ${snap.market.temp} — bull ${bull}% / bear ${bear}%`);
    if (bear > 60) lines.push(`🟡 WARNING: Heavy bear pressure. Lock thresholds may need tightening — trajectory projections overfit on buy pressure.`);
  }

  lines.push(``);

  // Park cyclers
  if (topCycler && topCycler.cycles >= 4) {
    const severity = topCycler.cycles >= 15 ? "🔴 CRITICAL" : topCycler.cycles >= 8 ? "🟡 WARNING" : "🟡 WARNING";
    lines.push(`${severity}: ${topCycler.name} has cycled ${topCycler.cycles}× — mcap $${topCycler.mcap.toLocaleString()}`);
    if (topCycler.mcap >= 35000 && topCycler.mcap <= 45000) {
      lines.push(`💡 SUGGESTION: Oscillating on staleMid $40K boundary. Add ±$3K buffer zone or require 3 consecutive silent checks before parking fires.`);
    } else if (topCycler.mcap >= 20000 && topCycler.mcap <= 30000) {
      lines.push(`💡 SUGGESTION: Cycling in $22-30K range — likely hitting preMigration rule. Check if bondingPct proxy is oscillating with each trade.`);
    } else {
      lines.push(`💡 SUGGESTION: Review staleMid silence threshold — 1min may be too tight for this mcap range.`);
    }
    const otherCyclers = (snap.topCyclers || []).slice(1, 4).filter(c => c.cycles >= 3);
    if (otherCyclers.length > 0) {
      lines.push(`📊 Also cycling: ${otherCyclers.map(c => `${c.name} (${c.cycles}×)`).join(", ")}`);
    }
  } else {
    lines.push(`🟢 PATTERN: Park system stable — no excessive cycling detected.`);
  }

  lines.push(``);

  // Lock performance
  if (crashed) {
    const dropPct = crashed.exitPct ?? -40;
    lines.push(`🔴 CRITICAL: ${crashed.name} ejected ${dropPct}% from lock@$${crashed.lockMcap.toLocaleString()}`);
    if (crashed.peakPct > 15) {
      lines.push(`📊 Peak was +${crashed.peakPct}% before reversal — lock captured the top, eject timing is working.`);
    } else {
      lines.push(`💡 SUGGESTION: Near-zero peak before crash — token may have been locked on bundle inflation. Review trajectory calc for ${crashed.name}.`);
    }
  }
  if (topLocked) {
    lines.push(`🟢 PATTERN: ${topLocked.name} active lock — locked@$${topLocked.lockMcap.toLocaleString()}, peak so far +${topLocked.peakPct}%`);
  }

  lines.push(``);

  // Signal scores
  if (highSig.length > 0) {
    const top = highSig[0];
    lines.push(`📊 TOP SIGNAL: ${top.name} ◈${top.signal} — ${top.smartMoney}x smart money, ${top.holders}w, ${top.buyPct}% buys`);
    if (top.signal >= 88) {
      lines.push(`🟢 PATTERN: Gold corona threshold hit on ${top.name}. If not locked, worth manual review.`);
    }
    if (highSig.length > 1) {
      lines.push(`📊 ${highSig.length - 1} other tokens above ◈72: ${highSig.slice(1, 4).map(t => `${t.name}(${t.signal})`).join(", ")}`);
    }
  }

  lines.push(``);

  // Smart money
  if (smartHits.length > 0) {
    const top = smartHits[0];
    lines.push(`🟢 PATTERN: ${top.name} — ${top.smartMoney}x smart money hits, mcap $${top.mcap.toLocaleString()}`);
    if (top.smartMoney >= 5 && top.status !== "LOCKED") {
      lines.push(`💡 SUGGESTION: ${top.name} has ${top.smartMoney} smart money hits but isn't locked — check qualScore. May be failing on holders or buy%.`);
    }
  }

  // Clusters
  if (hotToks.length > 0) {
    lines.push(``);
    lines.push(`🟡 WARNING: ${hotToks.length} token${hotToks.length > 1 ? "s" : ""} in active cluster — ${hotToks.map(t => t.name).join(", ")}`);
    if (clusters.length > 0) {
      const c = clusters[0];
      lines.push(`📊 Cluster: ${c.wallets} wallets, strength ${c.strength}, ${c.ageSec}s old — watch for coordinated dump.`);
    }
  }

  // Flash movers
  if (flash30) {
    lines.push(``);
    lines.push(`📊 FLASH 30s: ${flash30.name} +${flash30.chg}% — ${flash30.chg > 50 ? "potential run forming" : "moderate momentum"}`);
  }

  // Intel
  lines.push(``);
  lines.push(`📊 INTEL: snipe window ${snap.intel?.snipeWindow || "calculating"} · ${snap.intel?.devFlagCount || 0} devs flagged · ${snap.intel?.fingerprints || 0} winner prints loaded`);
  if ((snap.intel?.fingerprints || 0) < 100) {
    lines.push(`🟡 WARNING: Low fingerprint count (${snap.intel?.fingerprints || 0}) — DNA scores are approximate until DB velocity/retention columns are populated.`);
  }

  lines.push(``);
  lines.push(`◈ MOCK TRIAL COMPLETE — This is simulated analysis based on real session data. Add API key to activate live intelligence.`);

  return lines.join("
");
}


// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export default function ClaudeRoom({
  tokensRef,
  lockedTokens,
  tradeDataRef,
  signalScoresRef,
  intel,
  flashBoard30s,
  flashBoard1m,
  marketTemp,
  isActive,
}) {
  const [observations, setObservations]   = useState([]);
  const [chatInput, setChatInput]         = useState("");
  const [isLoading, setIsLoading]         = useState(false);
  const [autoWatch, setAutoWatch]         = useState(false);
  const [snapshotSecs, setSnapshotSecs]   = useState(30);
  const [sessionStats, setSessionStats]   = useState({ snapshots: 0, flags: 0 });
  const [spendCents, setSpendCents]       = useState(() => loadSpendCents(IS_MOCK_MODE));
  const spendRef = useRef(loadSpendCents(IS_MOCK_MODE)); // always in sync for writes
  const [offlineStatus, setOfflineStatus] = useState(null); // null | "out_of_credits"

  const conversationRef   = useRef([]);
  const parkCycleRef      = useRef({});
  const lockHistoryRef    = useRef({});
  const prevTokenStateRef = useRef({});
  const autoWatchRef      = useRef(false);
  const intervalRef       = useRef(null);
  const sessionStartRef   = useRef(Date.now());
  const feedEndRef        = useRef(null);
  const snapshotCountRef  = useRef(0);

  const isLive = !IS_MOCK_MODE && !offlineStatus;

  useEffect(() => { autoWatchRef.current = autoWatch; }, [autoWatch]);
  useEffect(() => { feedEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [observations]);

  // ─── PARK CYCLE TRACKER ───────────────────
  const updateParkCycles = useCallback((tokens) => {
    tokens.forEach((t) => {
      const isParked = !!t.isParked;
      const prev = prevTokenStateRef.current[t.mint];
      if (prev === undefined) {
        prevTokenStateRef.current[t.mint] = isParked;
        if (!parkCycleRef.current[t.mint])
          parkCycleRef.current[t.mint] = { name: t.name || t.mint?.slice(0,8), count: 0, lastParked: isParked };
      } else if (prev !== isParked) {
        parkCycleRef.current[t.mint] = {
          name: t.name || t.mint?.slice(0,8),
          count: (parkCycleRef.current[t.mint]?.count || 0) + 1,
          lastParked: isParked,
          mcap: Math.round(t.mcap || 0),
        };
        prevTokenStateRef.current[t.mint] = isParked;
      }
    });
  }, []);

  // ─── LOCK HISTORY TRACKER ─────────────────
  const updateLockHistory = useCallback((locked, tokens) => {
    const lockedMints = new Set((locked || []).map((t) => t.mint));
    (locked || []).forEach((t) => {
      if (!lockHistoryRef.current[t.mint]) {
        lockHistoryRef.current[t.mint] = {
          name: t.name, lockedAt: Date.now(),
          mcapAtLock: t.mcap || 0, peakMcap: t.mcap || 0,
          exitMcap: null, status: "ACTIVE",
        };
      } else {
        const h = lockHistoryRef.current[t.mint];
        if ((t.mcap || 0) > h.peakMcap) h.peakMcap = t.mcap;
      }
    });
    Object.keys(lockHistoryRef.current).forEach((mint) => {
      const h = lockHistoryRef.current[mint];
      if (h.status === "ACTIVE" && !lockedMints.has(mint)) {
        const token = tokens.find((t) => t.mint === mint);
        const exitMcap = token?.mcap || h.peakMcap;
        const pct = h.mcapAtLock > 0 ? ((exitMcap - h.mcapAtLock) / h.mcapAtLock) * 100 : 0;
        h.exitMcap = exitMcap;
        h.status = pct <= -35 ? "CRASHED" : pct >= 20 ? "WIN" : "FLAT";
        h.exitPct = Math.round(pct);
      }
    });
  }, []);

  // ─── SNAPSHOT BUILDER ─────────────────────
  const buildSnapshot = useCallback(() => {
    const tokens    = tokensRef?.current       || [];
    const tradeData = tradeDataRef?.current    || {};
    const sigScores = signalScoresRef?.current || {};
    const locked    = lockedTokens             || [];

    updateParkCycles(tokens);
    updateLockHistory(locked, tokens);

    const lockedMints     = new Set(locked.map((t) => t.mint));
    const hotClusterMints = intel?.hotClusterTokens || new Set();
    const clusters        = intel?.clusters || [];

    const interesting = tokens.filter((t) =>
      lockedMints.has(t.mint) ||
      hotClusterMints.has(t.mint) ||
      (sigScores[t.mint] || 0) >= 65 ||
      (parkCycleRef.current[t.mint]?.count || 0) >= 4 ||
      (t.mcap || 0) >= 15000
    ).slice(0, 25);

    const detailedTokens = interesting.map((t) => {
      const td   = tradeData[t.mint] || {};
      const buys = td.buyTimes?.length  || 0;
      const sells= td.sellTimes?.length || 0;
      const total= buys + sells;
      return {
        name:       t.name || t.mint?.slice(0,8),
        mint8:      t.mint?.slice(0,8),
        mcap:       Math.round(t.mcap || 0),
        status:     lockedMints.has(t.mint) ? "LOCKED" : t.isParked ? "PARKED" : "FIELD",
        ageMin:     td.launchTime    ? Math.round((Date.now() - td.launchTime)    / 60000) : null,
        silentMin:  td.lastTradeTime ? Math.round((Date.now() - td.lastTradeTime) / 60000) : null,
        signal:     Math.round(sigScores[t.mint] || 0),
        intelBoost: intel?.signalBoost?.[t.mint] || 0,
        hotCluster: hotClusterMints.has(t.mint),
        parkCycles: parkCycleRef.current[t.mint]?.count || 0,
        holders:    td.holders || 0,
        buyPct:     total > 0 ? Math.round((buys / total) * 100) : 0,
        vol:        Math.round(td.totalVol || 0),
        smartMoney: td.smartMoneyHits || 0,
        bundle:     !!t._bundleDetected,
        fromDB:     !!t.fromDB,
        migrated:   !!t.migrated,
      };
    });

    const summaryTokens = tokens
      .filter((t) => !interesting.find((i) => i.mint === t.mint))
      .slice(0, 40)
      .map((t) => ({
        name: t.name || t.mint?.slice(0,8),
        mcap: Math.round(t.mcap || 0),
        s:    lockedMints.has(t.mint) ? "L" : t.isParked ? "P" : "F",
        sig:  Math.round(sigScores[t.mint] || 0),
        cyc:  parkCycleRef.current[t.mint]?.count || 0,
      }));

    const topCyclers = Object.entries(parkCycleRef.current)
      .sort(([, a], [, b]) => b.count - a.count).slice(0, 8)
      .map(([mint, v]) => {
        const token = tokens.find((t) => t.mint === mint);
        return { name: v.name, cycles: v.count, mcap: Math.round(token?.mcap || 0), parked: !!token?.isParked };
      });

    const lockPerf = Object.values(lockHistoryRef.current).map((h) => ({
      name:     h.name,
      lockMcap: Math.round(h.mcapAtLock),
      peakMcap: Math.round(h.peakMcap),
      peakPct:  h.mcapAtLock > 0 ? Math.round(((h.peakMcap - h.mcapAtLock) / h.mcapAtLock) * 100) : 0,
      status:   h.status,
      exitPct:  h.exitPct ?? null,
      ageMin:   Math.round((Date.now() - h.lockedAt) / 60000),
    }));

    const activeClusters = clusters.slice(0, 5).map((c) => ({
      tokens:   c.tokens?.slice(0, 4).map((m) => { const tok = tokens.find((t) => t.mint === m); return tok?.name || m?.slice(0,8); }),
      wallets:  c.wallets?.length || 0,
      strength: Math.round(c.strength || 0),
      ageSec:   c.detectedAt ? Math.round((Date.now() - c.detectedAt) / 1000) : null,
    }));

    return {
      snap:       ++snapshotCountRef.current,
      time:       new Date().toLocaleTimeString(),
      sessionMin: Math.round((Date.now() - sessionStartRef.current) / 60000),
      health: {
        total:    tokens.length,
        locked:   locked.length,
        parked:   tokens.filter((t) => t.isParked).length,
        field:    tokens.filter((t) => !t.isParked && !lockedMints.has(t.mint)).length,
        fromDB:   tokens.filter((t) => t.fromDB).length,
        migrated: tokens.filter((t) => t.migrated).length,
      },
      market: { temp: marketTemp?.temp || "UNKNOWN", bullPressure: marketTemp?.bullPressure || 0, bearPressure: marketTemp?.bearPressure || 0 },
      intel: {
        snipeWindow:   intel?.snipeWindow ? `$${Math.round(intel.snipeWindow.low)}-$${Math.round(intel.snipeWindow.high)} (${intel.snipeWindow.count}w, ${intel.snipeWindow.avgMultiple?.toFixed(1)}x avg)` : null,
        clusters:      activeClusters,
        hotTokenCount: hotClusterMints.size,
        devFlagCount:  intel?.devFlags ? Object.keys(intel.devFlags).length : 0,
        fingerprints:  intel?.tokenDNA?.winnerFingerprints?.length || 0,
      },
      flash30s:        (flashBoard30s || []).slice(0, 6).map((t) => ({ name: t.name, chg: Math.round(t.change30s || 0) })),
      flash1m:         (flashBoard1m  || []).slice(0, 6).map((t) => ({ name: t.name, chg: Math.round(t.change1m  || 0) })),
      detailedTokens,
      summaryTokens,
      topCyclers,
      lockPerformance: lockPerf,
    };
  }, [tokensRef, lockedTokens, tradeDataRef, signalScoresRef, intel, flashBoard30s, flashBoard1m, marketTemp, updateParkCycles, updateLockHistory]);

  // ─── CLAUDE API CALL ──────────────────────
  const callClaude = useCallback(async (userMessage, isAuto = false) => {
    setIsLoading(true);

    // ── MOCK PATH — no API, uses generateMockResponse ──────────────────────
    if (IS_MOCK_MODE || offlineStatus) {
      await new Promise(r => setTimeout(r, 900 + Math.random() * 900)); // fake latency

      // For auto-watch: full mock report. For chat: mock answer referencing the question.
      let reply;
      if (isAuto) {
        // parse snap out of message
        try {
          const jsonStart = userMessage.indexOf("{");
          const snap = jsonStart >= 0 ? JSON.parse(userMessage.slice(jsonStart)) : {};
          reply = generateMockResponse(snap);
        } catch {
          reply = generateMockResponse({});
        }
      } else {
        // Chat in mock mode — mock-intelligent reply based on question + snapshot
        try {
          const snapStart = userMessage.indexOf("CURRENT SNAPSHOT:");
          const questionEnd = userMessage.indexOf("\n\nCURRENT SNAPSHOT:");
          const question = questionEnd > 0 ? userMessage.slice("QUESTION: ".length, questionEnd) : userMessage;
          const snap = snapStart > 0 ? JSON.parse(userMessage.slice(userMessage.indexOf("{", snapStart))) : {};
          reply = generateMockChatResponse(question, snap);
        } catch {
          reply = "📊 MOCK MODE — Unable to parse snapshot for this question. Deploy with API key for full chat intelligence.";
        }
      }

      const flagCount = (reply.match(/[🔴🟡🟢💡📊]/g) || []).length;

      // Track estimated cost (accumulates — shows what it WOULD cost)
      const newSpend = spendRef.current + MOCK_CALL_COST_CENTS;
      spendRef.current = newSpend;
      saveSpendCents(newSpend, true);
      setSpendCents(newSpend);

      setObservations(prev => [...prev, {
        id: Date.now(), type: isAuto ? "watch" : "chat",
        time: new Date().toLocaleTimeString(),
        snap: isAuto ? snapshotCountRef.current : null,
        query: isAuto ? null : userMessage.slice(0, 120),
        reply, flags: flagCount,
        isMock: true,
        costCents: MOCK_CALL_COST_CENTS,
      }]);
      setSessionStats(prev => ({ snapshots: prev.snapshots + (isAuto ? 1 : 0), flags: prev.flags + flagCount }));
      setIsLoading(false);
      return;
    }

    // ── LIVE PATH — real API call ───────────────────────────────────────────
    try {
      const messages = [...conversationRef.current, { role: "user", content: userMessage }];

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 1000, system: SYSTEM_PROMPT, messages }),
      });

      if (res.status === 529 || res.status === 402) {
        setOfflineStatus("out_of_credits");
        setAutoWatch(false);
        setIsLoading(false);
        return;
      }
      if (res.status === 401) {
        setObservations(prev => [...prev, { id: Date.now(), type: "error", time: new Date().toLocaleTimeString(), query: "Auth failed", reply: "401 — key rejected. Check ANTHROPIC_KEY in ClaudeRoom.jsx.", flags: 0 }]);
        setAutoWatch(false);
        setIsLoading(false);
        return;
      }

      const data  = await res.json();
      const reply = data.content?.[0]?.text || "[no response]";

      conversationRef.current = [...messages, { role: "assistant", content: reply }].slice(-16);

      const flagCount = (reply.match(/[🔴🟡🟢💡📊]/g) || []).length;

      const usage = data.usage || {};
      const callCents = calcCallCostCents(usage.input_tokens || 0, usage.output_tokens || 0);
      const newSpend = spendRef.current + callCents;
      spendRef.current = newSpend;
      saveSpendCents(newSpend, false);
      setSpendCents(newSpend);

      if (newSpend >= BUDGET_USD * 100) {
        setOfflineStatus("out_of_credits");
        setAutoWatch(false);
      }

      setObservations(prev => [...prev, { id: Date.now(), type: isAuto ? "watch" : "chat", time: new Date().toLocaleTimeString(), snap: isAuto ? snapshotCountRef.current : null, query: isAuto ? null : userMessage, reply, flags: flagCount, costCents: callCents }]);
      setSessionStats(prev => ({ snapshots: prev.snapshots + (isAuto ? 1 : 0), flags: prev.flags + flagCount }));

    } catch (err) {
      setObservations(prev => [...prev, { id: Date.now(), type: "error", time: new Date().toLocaleTimeString(), query: "API error", reply: err.message, flags: 0 }]);
    } finally {
      setIsLoading(false);
    }
  }, [IS_MOCK_MODE, offlineStatus, isLive]);

  // ─── AUTO-WATCH TICK ─────────────────────
  const runWatch = useCallback(() => {
    if (!autoWatchRef.current) return;
    const snap = buildSnapshot();
    callClaude(`AUTO-WATCH SNAPSHOT #${snap.snap}:\n${JSON.stringify(snap, null, 1)}`, true);
  }, [buildSnapshot, callClaude]);

  useEffect(() => {
    clearInterval(intervalRef.current);
    if (autoWatch) {
      runWatch();
      intervalRef.current = setInterval(runWatch, snapshotSecs * 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [autoWatch, snapshotSecs, runWatch]);

  // ─── MANUAL CHAT ─────────────────────────
  const handleSend = useCallback(() => {
    if (!chatInput.trim() || isLoading) return;
    const snap = buildSnapshot();
    callClaude(`QUESTION: ${chatInput}\n\nCURRENT SNAPSHOT:\n${JSON.stringify(snap, null, 1)}`, false);
    setChatInput("");
  }, [chatInput, isLoading, buildSnapshot, callClaude]);

  // ─── SNAP NOW ────────────────────────────
  const snapNow = useCallback(() => {
    if (isLoading) return;
    const snap = buildSnapshot();
    callClaude(`MANUAL SNAPSHOT REQUEST #${snap.snap}:\n${JSON.stringify(snap, null, 1)}`, true);
  }, [isLoading, buildSnapshot, callClaude]);

  // ─── DEBRIEF EXPORT ──────────────────────
  const exportDebrief = useCallback(() => {
    const sessionMin = Math.round((Date.now() - sessionStartRef.current) / 60000);
    const cyclers    = Object.entries(parkCycleRef.current).sort(([, a], [, b]) => b.count - a.count).slice(0, 10);
    const locks      = Object.values(lockHistoryRef.current);
    const lines = [
      `╔══════════════════════════════════════╗`,
      `  CLAUDE INTELLIGENCE DEBRIEF`,
      `  Session: ${sessionMin}min · ${sessionStats.snapshots} snapshots · ${sessionStats.flags} flags`,
      `  ${new Date().toLocaleString()}`,
      `╚══════════════════════════════════════╝`,
      ``,
      `── LOCK PERFORMANCE (${locks.length} locks) ──`,
      ...locks.map(h => `  ${h.name}: lock@$${Math.round(h.mcapAtLock)} → peak@$${Math.round(h.peakMcap)} (+${Math.round(((h.peakMcap - h.mcapAtLock) / (h.mcapAtLock || 1)) * 100)}%) → ${h.status}${h.exitPct != null ? ` [exit ${h.exitPct > 0 ? "+" : ""}${h.exitPct}%]` : ""}`),
      ``,
      `── TOP PARK CYCLERS ──`,
      ...cyclers.map(([, v]) => `  ${v.name}: ${v.count} cycles  mcap@$${v.mcap}`),
      ``,
      `── OBSERVATIONS (${observations.length}) ──`,
      ...observations.map(o => `\n[${o.time}]${o.snap ? ` SNAP#${o.snap}` : ""}${o.query ? ` Q: ${o.query}` : ""}\n${o.reply}`),
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    setObservations(prev => [...prev, { id: Date.now(), type: "system", time: new Date().toLocaleTimeString(), query: "📋 Debrief copied to clipboard", reply: `${sessionMin}min session · ${sessionStats.snapshots} snapshots · ${sessionStats.flags} flags · ${locks.length} locks tracked · ${cyclers.length} cyclers logged\n\nPaste into a new chat to pick up exactly where we left off.`, flags: 0 }]);
  }, [observations, sessionStats]);

  // ─── RENDER HELPERS ──────────────────────
  const renderReply = (text) =>
    text.split("\n").map((line, i) => {
      let color = "#8888aa";
      if (line.startsWith("🔴")) color = "#ff2244";
      else if (line.startsWith("🟡")) color = "#ffcc00";
      else if (line.startsWith("🟢")) color = "#39ff14";
      else if (line.startsWith("💡")) color = "#00ffff";
      else if (line.startsWith("📊")) color = "#bf00ff";
      else if (line.match(/^[A-Z]{2,}/)) color = "#c0c0e0";
      return <div key={i} style={{ color, lineHeight:"1.65", minHeight:"1em", fontFamily:"'Share Tech Mono',monospace", fontSize:"11px" }}>{line||"\u00a0"}</div>;
    });

  // live sidebar values
  const tokens      = tokensRef?.current || [];
  const locked      = lockedTokens || [];
  const parked      = tokens.filter(t => t.isParked).length;
  const field       = tokens.filter(t => !t.isParked && !locked.find(l => l.mint === t.mint)).length;
  const sessionMin  = Math.round((Date.now() - sessionStartRef.current) / 60000);
  const topCyclers  = Object.entries(parkCycleRef.current).sort(([,a],[,b]) => b.count - a.count).slice(0,7);
  const recentLocks = Object.values(lockHistoryRef.current).slice(-8).reverse();

  // budget bar values
  const spentDollars    = spendCents / 100;
  const budgetBarColor  = IS_MOCK_MODE
    ? (spentDollars < 5 ? "#39ff14" : spentDollars < 20 ? "#ffd700" : "#ff073a")
    : (spendCents < BUDGET_USD * 50 ? "#39ff14" : spendCents < BUDGET_USD * 80 ? "#ffd700" : "#ff073a");
  const budgetBarPct    = IS_MOCK_MODE
    ? Math.min(100, (spentDollars / BUDGET_USD) * 100)           // fills up in mock
    : Math.max(0, ((BUDGET_USD - spentDollars) / BUDGET_USD) * 100); // depletes in live

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", background:"#040412", color:"#8888aa", fontFamily:"'Share Tech Mono',monospace", fontSize:"11px", position:"relative" }}>

      {/* ── HEADER ── */}
      <div style={{ display:"flex", alignItems:"center", gap:"10px", padding:"7px 12px", borderBottom:"1px solid rgba(0,255,255,0.08)", background:"rgba(0,255,255,0.02)", flexShrink:0, flexWrap:"wrap" }}>

        {/* title */}
        <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:"10px", color:"#00ffff", letterSpacing:"3px", fontWeight:900, whiteSpace:"nowrap" }}>
          ◈ INTELLIGENCE OFFICE
        </div>

        {/* session stats */}
        <div style={{ fontSize:"9px", color:"#222240", letterSpacing:"1px", whiteSpace:"nowrap" }}>
          {sessionMin}m · {sessionStats.snapshots} snaps · {sessionStats.flags} flags
        </div>

        {/* ── BUDGET BAR ── */}
        <div style={{ display:"flex", alignItems:"center", gap:"8px", flex:"1 1 200px", minWidth:0 }}>
          <div style={{ flex:1, height:"6px", background:"rgba(255,255,255,0.04)", borderRadius:"3px", overflow:"hidden", minWidth:60, position:"relative" }}>
            <div style={{
              position:"absolute", left:0, top:0, bottom:0,
              width:`${budgetBarPct}%`,
              background:`linear-gradient(90deg,${budgetBarColor}88,${budgetBarColor})`,
              borderRadius:"3px",
              transition:"width 1s ease, background 1s ease",
              boxShadow:budgetBarPct > 2 ? `0 0 6px ${budgetBarColor}60` : "none",
            }} />
            {[25,50,75].map(t => (
              <div key={t} style={{ position:"absolute", left:`${t}%`, top:0, bottom:0, width:1, background:"rgba(0,0,0,0.4)" }} />
            ))}
          </div>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", flexShrink:0, lineHeight:1.2 }}>
            {IS_MOCK_MODE ? <>
              <span style={{ fontFamily:"Orbitron,sans-serif", fontSize:"9px", fontWeight:700, color:budgetBarColor, whiteSpace:"nowrap" }}>
                ~${spentDollars.toFixed(2)} est.
              </span>
              <span style={{ fontSize:"8px", color:"#333355", whiteSpace:"nowrap" }}>would cost</span>
            </> : <>
              <span style={{ fontFamily:"Orbitron,sans-serif", fontSize:"9px", fontWeight:700, color:budgetBarColor, whiteSpace:"nowrap" }}>
                ${Math.max(0, BUDGET_USD - spentDollars).toFixed(2)} left
              </span>
              <span style={{ fontSize:"8px", color:"#333355", whiteSpace:"nowrap" }}>
                ~{Math.round(Math.max(0, BUDGET_USD - spentDollars) / 0.04)}h remain
              </span>
            </>}
          </div>
          <button
            onClick={() => { spendRef.current = 0; saveSpendCents(0, IS_MOCK_MODE); setSpendCents(0); if(offlineStatus==="out_of_credits") setOfflineStatus(null); }}
            title={IS_MOCK_MODE ? "Reset mock cost estimate" : "Reset budget counter after topping up"}
            style={{ background:"none", border:"1px solid #1a1a33", color:"#222240", fontSize:"8px", padding:"2px 5px", borderRadius:"2px", cursor:"pointer", fontFamily:"Orbitron,sans-serif", flexShrink:0 }}>↺</button>
        </div>

        {/* ── CONTROLS ── */}
        <div style={{ display:"flex", gap:"6px", alignItems:"center", flexWrap:"wrap" }}>
          <select value={snapshotSecs} onChange={e => setSnapshotSecs(Number(e.target.value))}
            style={{ background:"#0a0a1a", border:"1px solid rgba(0,255,255,0.15)", color:"#00ffff", fontSize:"9px", padding:"2px 5px", borderRadius:"3px", cursor:"pointer", fontFamily:"'Share Tech Mono',monospace" }}>
            <option value={15}>15s</option><option value={30}>30s</option><option value={60}>60s</option><option value={120}>2m</option>
          </select>
          <button onClick={() => setAutoWatch(v => !v)}
            style={{ background:autoWatch ? "rgba(57,255,20,0.08)" : "rgba(255,255,255,0.02)", border:`1px solid ${autoWatch ? "#39ff14" : "rgba(255,255,255,0.08)"}`, color:autoWatch ? "#39ff14" : "#444466", fontSize:"9px", padding:"3px 9px", borderRadius:"3px", cursor:"pointer", fontFamily:"Orbitron,sans-serif", fontWeight:700, letterSpacing:"1px" }}>
            {autoWatch ? "● WATCHING" : "○ AUTO-WATCH"}
          </button>
          <button onClick={snapNow} disabled={isLoading}
            style={{ background:"rgba(0,255,255,0.04)", border:"1px solid rgba(0,255,255,0.18)", color:"#00ffff", fontSize:"9px", padding:"3px 9px", borderRadius:"3px", cursor:isLoading ? "default" : "pointer", fontFamily:"Orbitron,sans-serif", fontWeight:700, letterSpacing:"1px", opacity:isLoading ? 0.4 : 1 }}>
            SNAP NOW
          </button>
          <button onClick={exportDebrief}
            style={{ background:"rgba(191,0,255,0.04)", border:"1px solid rgba(191,0,255,0.25)", color:"#bf00ff", fontSize:"9px", padding:"3px 9px", borderRadius:"3px", cursor:"pointer", fontFamily:"Orbitron,sans-serif", fontWeight:700, letterSpacing:"1px" }}>
            DEBRIEF
          </button>
          <button onClick={() => { setObservations([]); conversationRef.current = []; }}
            style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)", color:"#333355", fontSize:"9px", padding:"3px 9px", borderRadius:"3px", cursor:"pointer", fontFamily:"Orbitron,sans-serif", fontWeight:700, letterSpacing:"1px" }}>
            CLEAR
          </button>

          {/* ── LIVE / MOCK INDICATOR ── */}
          <div style={{ display:"flex", alignItems:"center", gap:"5px", padding:"3px 8px", background:IS_MOCK_MODE ? "rgba(255,7,58,0.06)" : "rgba(57,255,20,0.06)", border:`1px solid ${IS_MOCK_MODE ? "rgba(255,7,58,0.25)" : "rgba(57,255,20,0.25)"}`, borderRadius:"3px" }}>
            <div style={{
              width:6, height:6, borderRadius:"50%",
              background:IS_MOCK_MODE ? "#ff073a" : "#39ff14",
              boxShadow:`0 0 6px ${IS_MOCK_MODE ? "#ff073a" : "#39ff14"}`,
              animation:"pulse 1.8s ease-in-out infinite",
            }} />
            <span style={{ fontFamily:"Orbitron,sans-serif", fontSize:"8px", fontWeight:700, letterSpacing:"1px", color:IS_MOCK_MODE ? "#ff073a" : "#39ff14" }}>
              {IS_MOCK_MODE ? "MOCK" : "LIVE"}
            </span>
          </div>
        </div>
      </div>

      {/* ── MAIN BODY ── */}
      <div style={{ flex:1, display:"flex", overflow:"hidden", minHeight:0 }}>

        {/* ── FEED ── */}
        <div style={{ flex:1, overflow:"auto", padding:"10px", display:"flex", flexDirection:"column", gap:"8px" }}>
          {observations.length === 0 && (
            <div style={{ color:"#1a1a33", textAlign:"center", paddingTop:"50px", lineHeight:"2.2" }}>
              <div style={{ fontFamily:"Orbitron,sans-serif", color:IS_MOCK_MODE?"#ff073a":"#00ffff", opacity:0.15, fontSize:"22px", marginBottom:"12px" }}>◈</div>
              <div style={{ color:"#1a1a2a" }}>{IS_MOCK_MODE ? "MOCK MODE ACTIVE — full simulation, zero API cost" : "Intelligence office online."}</div>
              <div>Hit AUTO-WATCH to start monitoring on a timer.</div>
              <div>SNAP NOW for an immediate full system read.</div>
              <div>Or ask anything in the input below.</div>
              {IS_MOCK_MODE && <div style={{ marginTop:"16px", fontSize:"10px", color:"#1a1a2a" }}>Cost meter shows estimated spend if running on live API.</div>}
            </div>
          )}
          {observations.map(obs => (
            <div key={obs.id} style={{
              background: obs.isMock ? "rgba(255,7,58,0.03)" : obs.type==="error" ? "rgba(255,7,58,0.04)" : obs.type==="system" ? "rgba(191,0,255,0.04)" : "rgba(255,255,255,0.015)",
              border:`1px solid ${obs.isMock ? "rgba(255,7,58,0.12)" : obs.type==="error" ? "rgba(255,7,58,0.18)" : obs.type==="system" ? "rgba(191,0,255,0.18)" : obs.type==="watch" ? "rgba(0,255,255,0.08)" : "rgba(255,215,0,0.1)"}`,
              borderLeft:`2px solid ${obs.isMock ? "#ff073a" : obs.type==="watch" ? "#00ffff" : obs.type==="chat" ? "#ffd700" : obs.type==="system" ? "#bf00ff" : "#ff2244"}`,
              borderRadius:"4px", padding:"9px 11px",
            }}>
              <div style={{ display:"flex", gap:"8px", marginBottom:"7px", alignItems:"center" }}>
                <span style={{ fontFamily:"Orbitron,sans-serif", fontSize:"8px", color:obs.isMock?"#ff073a":obs.type==="watch"?"#00ffff":obs.type==="chat"?"#ffd700":"#bf00ff", letterSpacing:"1px", flexShrink:0 }}>{obs.time}</span>
                {obs.isMock && <span style={{ fontSize:"8px", background:"rgba(255,7,58,0.1)", border:"1px solid rgba(255,7,58,0.25)", color:"#ff073a", padding:"1px 5px", borderRadius:"2px", fontFamily:"Orbitron,sans-serif", letterSpacing:"1px", flexShrink:0 }}>MOCK</span>}
                {obs.snap && <span style={{ fontSize:"9px", color:"#222240" }}>SNAP#{obs.snap}</span>}
                {obs.query && <span style={{ fontSize:"10px", color:"#555577", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{obs.query.length>80?obs.query.slice(0,80)+"…":obs.query}</span>}
                {obs.flags > 0 && <span style={{ marginLeft:"auto", fontSize:"9px", color:"#444466", flexShrink:0 }}>{obs.flags} flags</span>}
                {obs.costCents > 0 && <span style={{ fontSize:"8px", color:"#222240", flexShrink:0, marginLeft:obs.flags>0?"4px":"auto" }}>{obs.isMock?"~":""}${(obs.costCents/100).toFixed(3)}</span>}
              </div>
              <div>{renderReply(obs.reply)}</div>
            </div>
          ))}
          {isLoading && (
            <div style={{ background:"rgba(0,255,255,0.02)", border:"1px solid rgba(0,255,255,0.08)", borderLeft:`2px solid ${IS_MOCK_MODE?"#ff073a":"#00ffff"}`, borderRadius:"4px", padding:"9px 11px", color:IS_MOCK_MODE?"#ff073a":"#00ffff", fontFamily:"Orbitron,sans-serif", fontSize:"9px", letterSpacing:"2px" }}>
              ◈ {IS_MOCK_MODE ? "SIMULATING ANALYSIS..." : "ANALYZING SYSTEM STATE..."}
            </div>
          )}
          <div ref={feedEndRef} />
        </div>

        {/* ── SIDEBAR ── */}
        <div style={{ width:"168px", borderLeft:"1px solid rgba(0,255,255,0.06)", padding:"10px 8px", overflow:"auto", flexShrink:0, display:"flex", flexDirection:"column", gap:"14px" }}>
          <SideBlock title="FIELD STATE" color="#00ffff">
            <SideRow label="TOKENS"  value={tokens.length}                               color="#c0c0e0" />
            <SideRow label="FIELD"   value={field}                                        color="#8888aa" />
            <SideRow label="LOCKED"  value={locked.length}                               color="#39ff14" />
            <SideRow label="PARKED"  value={parked}                                       color="#333355" />
            <SideRow label="DB"      value={tokens.filter(t=>t.fromDB).length}           color="#444466" />
          </SideBlock>
          <SideBlock title="MARKET" color="#ffd700">
            <SideRow label="TEMP"    value={marketTemp?.temp||"—"}                       color="#ffd700" />
            <SideRow label="BULL"    value={`${Math.round(marketTemp?.bullPressure||0)}%`} color="#39ff14" />
            <SideRow label="BEAR"    value={`${Math.round(marketTemp?.bearPressure||0)}%`} color="#ff073a" />
          </SideBlock>
          <SideBlock title="INTELLIGENCE" color="#bf00ff">
            <SideRow label="CLUSTERS"  value={intel?.clusters?.length||0}                  color="#bf00ff" />
            <SideRow label="HOT"       value={intel?.hotClusterTokens?.size||0}            color="#ff00ff" />
            <SideRow label="FLAGS"     value={intel?.devFlags?Object.keys(intel.devFlags).length:0} color="#ff073a" />
            <SideRow label="PRINTS"    value={intel?.tokenDNA?.winnerFingerprints?.length||0} color="#666688" />
          </SideBlock>
          <SideBlock title="FLASH 30s" color="#ff073a">
            {(flashBoard30s||[]).slice(0,5).map((t,i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"1px 0" }}>
                <span style={{ color:"#666688", overflow:"hidden", maxWidth:"90px", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.name}</span>
                <span style={{ color:"#39ff14", fontSize:"10px", flexShrink:0 }}>+{Math.round(t.change30s||0)}%</span>
              </div>
            ))}
            {!(flashBoard30s?.length) && <div style={{ color:"#1a1a33" }}>no movers</div>}
          </SideBlock>
          <SideBlock title={IS_MOCK_MODE ? "EST. COST" : "BUDGET"} color={IS_MOCK_MODE ? "#ff073a" : "#ffd700"}>
            {IS_MOCK_MODE ? <>
              <SideRow label="THIS SESSION" value={`~$${spentDollars.toFixed(2)}`} color="#ff073a" />
              <SideRow label="PER SNAP"     value={`~$${(MOCK_CALL_COST_CENTS/100).toFixed(3)}`} color="#666688" />
              <SideRow label="30s/HR"       value={`~$${(MOCK_CALL_COST_CENTS*120/100).toFixed(2)}`} color="#444466" />
              <div style={{ marginTop:4, height:4, background:"rgba(255,255,255,0.04)", borderRadius:2, overflow:"hidden" }}>
                <div style={{ width:`${Math.min(100,(spentDollars/BUDGET_USD)*100)}%`, height:"100%", background:"#ff073a", borderRadius:2, transition:"width 1s ease", boxShadow:"0 0 4px #ff073a60" }} />
              </div>
              <div style={{ fontSize:9, color:"#222240", marginTop:2 }}>of $50 est. baseline</div>
            </> : <>
              <SideRow label="SPENT"  value={`$${spentDollars.toFixed(2)}`}                          color="#666688" />
              <SideRow label="LEFT"   value={`$${Math.max(0,BUDGET_USD-spentDollars).toFixed(2)}`}   color={budgetBarColor} />
              <div style={{ marginTop:4, height:4, background:"rgba(255,255,255,0.04)", borderRadius:2, overflow:"hidden" }}>
                <div style={{ width:`${budgetBarPct}%`, height:"100%", background:budgetBarColor, borderRadius:2, transition:"width 1s ease", boxShadow:`0 0 4px ${budgetBarColor}60` }} />
              </div>
              <div style={{ fontSize:9, color:"#222240", marginTop:2, textAlign:"right" }}>of ${BUDGET_USD} budget</div>
            </>}
          </SideBlock>
          <SideBlock title="PARK CYCLERS" color="#ffd700">
            {topCyclers.map(([mint,v]) => (
              <div key={mint} style={{ display:"flex", justifyContent:"space-between", padding:"1px 0" }}>
                <span style={{ color:"#666688", overflow:"hidden", maxWidth:"90px", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{v.name}</span>
                <span style={{ color:v.count>=10?"#ff2244":v.count>=5?"#ffd700":"#555577", fontSize:"10px", flexShrink:0, fontFamily:"Orbitron,sans-serif", fontWeight:700 }}>{v.count}×</span>
              </div>
            ))}
            {topCyclers.length===0 && <div style={{ color:"#1a1a33" }}>none yet</div>}
          </SideBlock>
          <SideBlock title="LOCK LOG" color="#39ff14">
            {recentLocks.slice(0,7).map((h,i) => {
              const pct = h.mcapAtLock > 0 ? Math.round(((h.peakMcap-h.mcapAtLock)/h.mcapAtLock)*100) : 0;
              return (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"1px 0" }}>
                  <span style={{ color:"#666688", overflow:"hidden", maxWidth:"86px", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{h.name}</span>
                  <span style={{ color:h.status==="WIN"?"#39ff14":h.status==="CRASHED"?"#ff2244":"#555577", fontSize:"10px", flexShrink:0 }}>
                    {h.status==="ACTIVE" ? "●" : `${pct>0?"+":""}${pct}%`}
                  </span>
                </div>
              );
            })}
            {recentLocks.length===0 && <div style={{ color:"#1a1a33" }}>no locks yet</div>}
          </SideBlock>
        </div>
      </div>

      {/* ── CHAT INPUT ── */}
      <div style={{ borderTop:"1px solid rgba(0,255,255,0.07)", padding:"7px 10px", display:"flex", gap:"7px", background:"rgba(0,0,0,0.3)", flexShrink:0 }}>
        <input
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          onKeyDown={e => e.key==="Enter" && handleSend()}
          placeholder={IS_MOCK_MODE ? "ask anything — mock mode answers from real session data..." : "ask anything — why did X park? is the lock score firing correctly?..."}
          style={{ flex:1, background:"rgba(255,255,255,0.02)", border:`1px solid rgba(${IS_MOCK_MODE?"255,7,58":"0,255,255"},0.12)`, borderRadius:"3px", padding:"6px 9px", color:"#c0c0e0", fontSize:"11px", fontFamily:"'Share Tech Mono',monospace", outline:"none" }}
        />
        <button onClick={handleSend} disabled={isLoading || !chatInput.trim()}
          style={{ background:IS_MOCK_MODE?"rgba(255,7,58,0.06)":"rgba(0,255,255,0.06)", border:`1px solid ${IS_MOCK_MODE?"rgba(255,7,58,0.2)":"rgba(0,255,255,0.2)"}`, color:IS_MOCK_MODE?"#ff073a":"#00ffff", fontSize:"9px", padding:"6px 13px", borderRadius:"3px", cursor:isLoading||!chatInput.trim()?"default":"pointer", fontFamily:"Orbitron,sans-serif", fontWeight:700, letterSpacing:"1px", opacity:isLoading||!chatInput.trim()?0.35:1, flexShrink:0 }}>
          ASK
        </button>
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}

// ─────────────────────────────────────────────
// SIDEBAR HELPERS
// ─────────────────────────────────────────────
function SideBlock({ title, color, children }) {
  return (
    <div>
      <div style={{ fontFamily: "Orbitron, sans-serif", fontSize: "7px", letterSpacing: "2px", color, marginBottom: "5px", borderBottom: `1px solid ${color}20`, paddingBottom: "3px", fontWeight: 700 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>{children}</div>
    </div>
  );
}

function SideRow({ label, value, color = "#8888aa" }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ color: "#333355", fontSize: "10px" }}>{label}</span>
      <span style={{ color, fontFamily: "Orbitron, sans-serif", fontSize: "10px", fontWeight: 700 }}>{value}</span>
    </div>
  );
}
