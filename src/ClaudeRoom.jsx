import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────
// PURE HELPER FUNCTIONS
// Only function declarations here — no var/const/let at module level
// This prevents esbuild TDZ reordering bugs in production bundles
// ─────────────────────────────────────────────

function claudeLoadSpend(mock) {
  try { return parseFloat(localStorage.getItem(mock ? "degen_claude_mock_est_cents" : "degen_claude_spend_cents") || "0") || 0; }
  catch (e) { return 0; }
}
function claudeSaveSpend(v, mock) {
  try { localStorage.setItem(mock ? "degen_claude_mock_est_cents" : "degen_claude_spend_cents", String(v)); } catch(e) {}
}
function claudeCalcCostCents(inputTok, outputTok) {
  return ((inputTok / 1000000) * 3.00 + (outputTok / 1000000) * 15.00) * 100;
}
function claudeGetKeyStatus(key) {
  return !key ? "no_key" : key.startsWith("sk-ant-") ? "ready" : "invalid";
}

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
    const clusterLine = clustered.length > 0
      ? `🟡 Hot cluster tokens (${clustered.length}): ${clustered.map(t => t.name).join(", ")}\nWatch for coordinated dump — cluster wallets tend to exit together.`
      : "🟢 No active hot clusters.";
    const smartLine = smartToks.length > 0
      ? `Smart money hits: ${smartToks.slice(0,4).map(t => `${t.name}(${t.smartMoney}x)`).join(", ")}` +
        (smartToks[0] && smartToks[0].status !== "LOCKED"
          ? `\n💡 ${smartToks[0].name} has ${smartToks[0].smartMoney}x smart hits but isn't locked — check if qualScore is failing on another factor.`
          : "")
      : "No significant smart money activity.";
    return `📊 MOCK ANALYSIS — WALLET INTELLIGENCE\n\n${clusterLine}\n\n${smartLine}`;
  }

  if (q.includes("cost") || q.includes("price") || q.includes("expensive") || q.includes("cheap")) {
    const spent = (snap._mockSpendCents || 0) / 100;
    return `📊 MOCK COST PROJECTION

Est. per auto-watch call: $${(1.935/100).toFixed(4)}
At 30s intervals: ~$${(1.935 * 120 / 100).toFixed(2)}/hr
At 60s intervals: ~$${(1.935 * 60 / 100).toFixed(2)}/hr

$50 budget → ~${Math.round(5000 / (1.935 * 120))}hrs at 30s · ~${Math.round(5000 / (1.935 * 60))}hrs at 60s

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

  return lines.join("\n");
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
  // ── All config lives here — safe from esbuild TDZ ──
  var ANTHROPIC_KEY = null;
  // var ANTHROPIC_KEY = "sk-ant-api03-...";
  var CLAUDE_MODEL          = "claude-sonnet-4-20250514";
  var BUDGET_USD            = 50;
  var MOCK_CALL_COST_CENTS  = 1.935;
  var IS_MOCK_MODE          = claudeGetKeyStatus(ANTHROPIC_KEY) !== "ready";

  var SYSTEM_PROMPT = `You are the intelligence officer embedded inside degen-LIVE — a real-time Solana memecoin trading dashboard built by Cosmo. You have a dedicated office inside the dashboard and watch live token data to diagnose problems, identify patterns, and suggest improvements.

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
- Be SURGICAL. Name specific tokens, specific mcap values, specific wallet win counts.
- Cross-reference rules above when diagnosing park/lock behavior.
- If lock performance is poor, identify whether it's bundle inflation, trajectory noise, or threshold mismatch.
- Track patterns ACROSS snapshots — diagnose change over time.
- If you see the same token flagged repeatedly across snapshots, escalate your assessment.`;

  const [observations, setObservations]   = useState([]);
  const [chatInput, setChatInput]         = useState("");
  const [isLoading, setIsLoading]         = useState(false);
  const [autoWatch, setAutoWatch]         = useState(false);
  const [snapshotSecs, setSnapshotSecs]   = useState(30);
  const [sessionStats, setSessionStats]   = useState({ snapshots: 0, flags: 0 });
  const [spendCents, setSpendCents]       = useState(() => claudeLoadSpend(IS_MOCK_MODE));
  const spendRef = useRef(claudeLoadSpend(IS_MOCK_MODE)); // always in sync for writes
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
      claudeSaveSpend(newSpend, true);
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
      const callCents = claudeCalcCostCents(usage.input_tokens || 0, usage.output_tokens || 0);
      const newSpend = spendRef.current + callCents;
      spendRef.current = newSpend;
      claudeSaveSpend(newSpend, false);
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
  }, [IS_MOCK_MODE, offlineStatus]);

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

  // ─── TELEMETRY DERIVED VALUES ──────────────
  const tokens       = tokensRef?.current || [];
  const locked       = lockedTokens || [];
  const sigScores    = signalScoresRef?.current || {};
  const parked       = tokens.filter(t => t.isParked).length;
  const field        = tokens.filter(t => !t.isParked && !locked.find(l => l.mint === t.mint)).length;
  const fromDB       = tokens.filter(t => t.fromDB).length;
  const sessionMin   = Math.round((Date.now() - sessionStartRef.current) / 60000);
  const topCyclers   = Object.entries(parkCycleRef.current).sort(([,a],[,b]) => b.count - a.count).slice(0, 8);
  const recentLocks  = Object.values(lockHistoryRef.current).sort((a,b) => (b.lockedAt||0)-(a.lockedAt||0)).slice(0, 10);
  const spentDollars = spendCents / 100;
  const budgetColor  = IS_MOCK_MODE
    ? (spentDollars < 5 ? "#39ff14" : spentDollars < 20 ? "#ffd700" : "#ff073a")
    : (spendCents < BUDGET_USD * 50 ? "#39ff14" : spendCents < BUDGET_USD * 80 ? "#ffd700" : "#ff073a");
  const budgetPct    = IS_MOCK_MODE
    ? Math.min(100, (spentDollars / BUDGET_USD) * 100)
    : Math.max(0, ((BUDGET_USD - spentDollars) / BUDGET_USD) * 100);

  // signal score distribution
  const sigBuckets = [0,0,0,0,0]; // <25, 25-50, 50-70, 70-88, 88+
  tokens.forEach(t => {
    const s = sigScores[t.mint] || 0;
    if (s >= 88) sigBuckets[4]++;
    else if (s >= 70) sigBuckets[3]++;
    else if (s >= 50) sigBuckets[2]++;
    else if (s >= 25) sigBuckets[1]++;
    else sigBuckets[0]++;
  });
  const sigMax = Math.max(1, ...sigBuckets);
  const sigAvg  = tokens.length ? Math.round(tokens.reduce((a,t) => a + (sigScores[t.mint]||0), 0) / tokens.length) : 0;

  // lock outcomes
  const lockVals  = Object.values(lockHistoryRef.current);
  const lockWins  = lockVals.filter(h => h.status==="WIN").length;
  const lockCrash = lockVals.filter(h => h.status==="CRASHED").length;
  const lockFlat  = lockVals.filter(h => h.status==="FLAT").length;
  const lockActive= lockVals.filter(h => h.status==="ACTIVE").length;

  // market temp
  const bull  = Math.round(marketTemp?.bullPressure || 0);
  const bear  = Math.round(marketTemp?.bearPressure || 0);
  const tempScore = marketTemp?.score ?? 50;
  const tempLabel = marketTemp?.label || "—";
  const tempHistory = tempHistoryRef.current;
  const sigHistory  = sigHistoryRef.current;

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", background:"#040412", color:"#8888aa", fontFamily:"'Share Tech Mono',monospace", fontSize:"11px", position:"relative" }}>

      {/* ── HEADER ── */}
      <div style={{ display:"flex", alignItems:"center", gap:"8px", padding:"6px 12px", borderBottom:"1px solid rgba(0,255,255,0.08)", background:"rgba(0,255,255,0.015)", flexShrink:0, flexWrap:"wrap" }}>
        <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:"10px", color:"#00ffff", letterSpacing:"3px", fontWeight:900, whiteSpace:"nowrap" }}>◈ INTELLIGENCE OFFICE</div>
        <div style={{ fontSize:"9px", color:"#1e1e3a", letterSpacing:"1px", whiteSpace:"nowrap" }}>{sessionMin}m · {sessionStats.snapshots} snaps · {sessionStats.flags} flags</div>

        <div style={{ display:"flex", alignItems:"center", gap:"6px", flex:"1 1 140px", minWidth:0 }}>
          <div style={{ flex:1, height:"5px", background:"rgba(255,255,255,0.03)", borderRadius:"3px", overflow:"hidden", minWidth:50, position:"relative" }}>
            <div style={{ position:"absolute", left:0, top:0, bottom:0, width:`${budgetPct}%`, background:`linear-gradient(90deg,${budgetColor}88,${budgetColor})`, borderRadius:"3px", transition:"width 1s ease", boxShadow:budgetPct > 2 ? `0 0 5px ${budgetColor}50` : "none" }} />
          </div>
          <span style={{ fontFamily:"Orbitron,sans-serif", fontSize:"8px", fontWeight:700, color:budgetColor, whiteSpace:"nowrap" }}>
            {IS_MOCK_MODE ? `~$${spentDollars.toFixed(2)} est.` : `$${Math.max(0,BUDGET_USD-spentDollars).toFixed(2)} left`}
          </span>
          <button onClick={() => { spendRef.current=0; claudeSaveSpend(0,IS_MOCK_MODE); setSpendCents(0); if(offlineStatus==="out_of_credits") setOfflineStatus(null); }}
            style={{ background:"none", border:"1px solid #1a1a33", color:"#222240", fontSize:"8px", padding:"2px 4px", borderRadius:"2px", cursor:"pointer", fontFamily:"Orbitron,sans-serif", flexShrink:0 }}>↺</button>
        </div>

        <div style={{ display:"flex", gap:"5px", alignItems:"center", flexWrap:"wrap" }}>
          <select value={snapshotSecs} onChange={e => setSnapshotSecs(Number(e.target.value))}
            style={{ background:"#0a0a1a", border:"1px solid rgba(0,255,255,0.12)", color:"#00ffff", fontSize:"9px", padding:"2px 4px", borderRadius:"3px", cursor:"pointer", fontFamily:"'Share Tech Mono',monospace" }}>
            <option value={15}>15s</option><option value={30}>30s</option><option value={60}>60s</option><option value={120}>2m</option>
          </select>
          <button onClick={() => setAutoWatch(v => !v)} style={{ background:autoWatch?"rgba(57,255,20,0.08)":"rgba(255,255,255,0.02)", border:`1px solid ${autoWatch?"#39ff14":"rgba(255,255,255,0.06)"}`, color:autoWatch?"#39ff14":"#333355", fontSize:"9px", padding:"3px 8px", borderRadius:"3px", cursor:"pointer", fontFamily:"Orbitron,sans-serif", fontWeight:700, letterSpacing:"1px" }}>{autoWatch?"● WATCHING":"○ AUTO-WATCH"}</button>
          <button onClick={snapNow} disabled={isLoading} style={{ background:"rgba(0,255,255,0.04)", border:"1px solid rgba(0,255,255,0.15)", color:"#00ffff", fontSize:"9px", padding:"3px 8px", borderRadius:"3px", cursor:isLoading?"default":"pointer", fontFamily:"Orbitron,sans-serif", fontWeight:700, letterSpacing:"1px", opacity:isLoading?0.4:1 }}>SNAP NOW</button>
          <button onClick={exportDebrief} style={{ background:"rgba(191,0,255,0.04)", border:"1px solid rgba(191,0,255,0.2)", color:"#bf00ff", fontSize:"9px", padding:"3px 8px", borderRadius:"3px", cursor:"pointer", fontFamily:"Orbitron,sans-serif", fontWeight:700, letterSpacing:"1px" }}>DEBRIEF</button>
          <button onClick={() => { setObservations([]); conversationRef.current=[]; }} style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.05)", color:"#2a2a44", fontSize:"9px", padding:"3px 8px", borderRadius:"3px", cursor:"pointer", fontFamily:"Orbitron,sans-serif", fontWeight:700, letterSpacing:"1px" }}>CLEAR</button>
          <div style={{ display:"flex", alignItems:"center", gap:"4px", padding:"3px 7px", background:IS_MOCK_MODE?"rgba(255,7,58,0.06)":"rgba(57,255,20,0.06)", border:`1px solid ${IS_MOCK_MODE?"rgba(255,7,58,0.2)":"rgba(57,255,20,0.2)"}`, borderRadius:"3px" }}>
            <div style={{ width:5, height:5, borderRadius:"50%", background:IS_MOCK_MODE?"#ff073a":"#39ff14", boxShadow:`0 0 5px ${IS_MOCK_MODE?"#ff073a":"#39ff14"}`, animation:"pulse 1.8s ease-in-out infinite" }} />
            <span style={{ fontFamily:"Orbitron,sans-serif", fontSize:"8px", fontWeight:700, letterSpacing:"1px", color:IS_MOCK_MODE?"#ff073a":"#39ff14" }}>{IS_MOCK_MODE?"MOCK":"LIVE"}</span>
          </div>
        </div>
      </div>

      {/* ── MAIN 3-COLUMN BODY ── */}
      <div style={{ flex:1, display:"flex", overflow:"hidden", minHeight:0 }}>

        {/* ══ COL 1: AI FEED (280px) ══ */}
        <div style={{ width:280, flexShrink:0, display:"flex", flexDirection:"column", borderRight:"1px solid rgba(0,255,255,0.06)", overflow:"hidden" }}>
          <div style={{ flex:1, overflow:"auto", padding:"8px", display:"flex", flexDirection:"column", gap:"6px" }}>
            {observations.length === 0 && (
              <div style={{ color:"#1a1a2a", textAlign:"center", paddingTop:"40px", lineHeight:"2.2", fontSize:"10px" }}>
                <div style={{ fontFamily:"Orbitron,sans-serif", color:IS_MOCK_MODE?"#ff073a":"#00ffff", opacity:0.12, fontSize:"20px", marginBottom:"10px" }}>◈</div>
                <div>{IS_MOCK_MODE?"MOCK MODE — zero API cost":"Intelligence office online."}</div>
                <div>AUTO-WATCH or SNAP NOW to begin.</div>
              </div>
            )}
            {observations.map(obs => (
              <div key={obs.id} style={{ background:obs.isMock?"rgba(255,7,58,0.025)":obs.type==="error"?"rgba(255,7,58,0.04)":obs.type==="system"?"rgba(191,0,255,0.04)":"rgba(255,255,255,0.012)", border:`1px solid ${obs.isMock?"rgba(255,7,58,0.1)":obs.type==="error"?"rgba(255,7,58,0.15)":obs.type==="system"?"rgba(191,0,255,0.15)":obs.type==="watch"?"rgba(0,255,255,0.07)":"rgba(255,215,0,0.08)"}`, borderLeft:`2px solid ${obs.isMock?"#ff073a":obs.type==="watch"?"#00ffff":obs.type==="chat"?"#ffd700":obs.type==="system"?"#bf00ff":"#ff2244"}`, borderRadius:"3px", padding:"7px 9px" }}>
                <div style={{ display:"flex", gap:"6px", marginBottom:"5px", alignItems:"center", flexWrap:"wrap" }}>
                  <span style={{ fontFamily:"Orbitron,sans-serif", fontSize:"8px", color:obs.isMock?"#ff073a":obs.type==="watch"?"#00ffff":obs.type==="chat"?"#ffd700":"#bf00ff", letterSpacing:"1px", flexShrink:0 }}>{obs.time}</span>
                  {obs.isMock&&<span style={{ fontSize:"7px", background:"rgba(255,7,58,0.1)", border:"1px solid rgba(255,7,58,0.2)", color:"#ff073a", padding:"1px 4px", borderRadius:"2px", fontFamily:"Orbitron,sans-serif" }}>MOCK</span>}
                  {obs.snap&&<span style={{ fontSize:"8px", color:"#1e1e3a" }}>#{obs.snap}</span>}
                  {obs.query&&<span style={{ fontSize:"9px", color:"#444466", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"100%" }}>{obs.query.length>60?obs.query.slice(0,60)+"…":obs.query}</span>}
                  {obs.costCents>0&&<span style={{ marginLeft:"auto", fontSize:"7px", color:"#1e1e3a", flexShrink:0 }}>{obs.isMock?"~":""}${(obs.costCents/100).toFixed(3)}</span>}
                </div>
                <div>{renderReply(obs.reply)}</div>
              </div>
            ))}
            {isLoading&&<div style={{ border:`1px solid rgba(${IS_MOCK_MODE?"255,7,58":"0,255,255"},0.1)`, borderLeft:`2px solid ${IS_MOCK_MODE?"#ff073a":"#00ffff"}`, borderRadius:"3px", padding:"8px 10px", color:IS_MOCK_MODE?"#ff073a":"#00ffff", fontFamily:"Orbitron,sans-serif", fontSize:"9px", letterSpacing:"2px" }}>◈ {IS_MOCK_MODE?"SIMULATING...":"ANALYZING..."}</div>}
            <div ref={feedEndRef} />
          </div>

          {/* chat input — bottom of col 1 */}
          <div style={{ borderTop:"1px solid rgba(0,255,255,0.06)", padding:"6px 8px", display:"flex", gap:"6px", background:"rgba(0,0,0,0.25)", flexShrink:0 }}>
            <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSend()}
              placeholder="ask anything..." style={{ flex:1, background:"rgba(255,255,255,0.02)", border:`1px solid rgba(${IS_MOCK_MODE?"255,7,58":"0,255,255"},0.1)`, borderRadius:"3px", padding:"5px 8px", color:"#c0c0e0", fontSize:"10px", fontFamily:"'Share Tech Mono',monospace", outline:"none" }} />
            <button onClick={handleSend} disabled={isLoading||!chatInput.trim()}
              style={{ background:IS_MOCK_MODE?"rgba(255,7,58,0.06)":"rgba(0,255,255,0.06)", border:`1px solid ${IS_MOCK_MODE?"rgba(255,7,58,0.2)":"rgba(0,255,255,0.18)"}`, color:IS_MOCK_MODE?"#ff073a":"#00ffff", fontSize:"9px", padding:"5px 10px", borderRadius:"3px", cursor:isLoading||!chatInput.trim()?"default":"pointer", fontFamily:"Orbitron,sans-serif", fontWeight:700, letterSpacing:"1px", opacity:isLoading||!chatInput.trim()?0.3:1, flexShrink:0 }}>ASK</button>
          </div>
        </div>

        {/* ══ COL 2: TELEMETRY DASHBOARD (flex: 1) ══ */}
        <div style={{ flex:1, overflow:"auto", padding:"10px", display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gridTemplateRows:"auto auto auto auto", gap:"8px", alignContent:"start", minWidth:0 }}>

          {/* ── MARKET THERMOMETER ── */}
          <TileBlock title="MARKET TEMP" color="#ffd700">
            <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"center", gap:"12px", padding:"4px 0" }}>
              {/* Bull thermometer */}
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"3px" }}>
                <span style={{ fontFamily:"Orbitron,sans-serif", fontSize:"8px", color:"#39ff14", fontWeight:700 }}>{bull}%</span>
                <div style={{ width:18, height:80, background:"rgba(57,255,20,0.06)", border:"1px solid rgba(57,255,20,0.15)", borderRadius:"9px 9px 4px 4px", overflow:"hidden", position:"relative", display:"flex", flexDirection:"column", justifyContent:"flex-end" }}>
                  <div style={{ width:"100%", height:`${bull}%`, background:"linear-gradient(0deg,#39ff14,#39ff1480)", transition:"height 1s ease", boxShadow:"0 0 6px #39ff1440", borderRadius:"0 0 3px 3px" }} />
                </div>
                <span style={{ fontSize:"8px", color:"#2a4a2a" }}>BULL</span>
              </div>
              {/* Temp arc gauge center */}
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"4px" }}>
                <svg width="72" height="44" viewBox="0 0 72 44">
                  {/* bg arc */}
                  <path d="M 8 40 A 28 28 0 0 1 64 40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" strokeLinecap="round"/>
                  {/* value arc */}
                  <path d={`M 8 40 A 28 28 0 0 1 ${8 + (56 * Math.min(tempScore,100)/100 * Math.cos(Math.PI - Math.PI * Math.min(tempScore,100)/100))} ${40 - 28 * Math.sin(Math.PI * Math.min(tempScore,100)/100)}`}
                    fill="none"
                    stroke={tempScore>65?"#ff073a":tempScore>40?"#ffd700":"#00aaff"}
                    strokeWidth="6" strokeLinecap="round"/>
                  {/* simplified: use dasharray trick */}
                  <text x="36" y="38" textAnchor="middle" fontFamily="Orbitron,sans-serif" fontSize="13" fontWeight="900"
                    fill={tempScore>65?"#ff073a":tempScore>40?"#ffd700":"#00aaff"}>{tempScore}</text>
                </svg>
                <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:"9px", fontWeight:700, color:tempScore>65?"#ff073a":tempScore>40?"#ffd700":"#4488ff", letterSpacing:"1px", marginTop:-4 }}>{tempLabel}</div>
              </div>
              {/* Bear thermometer */}
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"3px" }}>
                <span style={{ fontFamily:"Orbitron,sans-serif", fontSize:"8px", color:"#ff073a", fontWeight:700 }}>{bear}%</span>
                <div style={{ width:18, height:80, background:"rgba(255,7,58,0.06)", border:"1px solid rgba(255,7,58,0.15)", borderRadius:"9px 9px 4px 4px", overflow:"hidden", position:"relative", display:"flex", flexDirection:"column", justifyContent:"flex-end" }}>
                  <div style={{ width:"100%", height:`${bear}%`, background:"linear-gradient(0deg,#ff073a,#ff073a80)", transition:"height 1s ease", boxShadow:"0 0 6px #ff073a40", borderRadius:"0 0 3px 3px" }} />
                </div>
                <span style={{ fontSize:"8px", color:"#4a2a2a" }}>BEAR</span>
              </div>
            </div>
            {/* sparkline */}
            {tempHistory.length > 2 && (
              <div style={{ marginTop:4 }}>
                <div style={{ fontSize:"8px", color:"#1e1e3a", marginBottom:2 }}>TEMP HISTORY</div>
                <svg width="100%" height="28" viewBox={`0 0 ${tempHistory.length} 28`} preserveAspectRatio="none">
                  <polyline
                    points={tempHistory.map((p,i) => `${i},${28 - (p.score/100)*26}`).join(" ")}
                    fill="none" stroke="#ffd700" strokeWidth="0.8" opacity="0.7"/>
                </svg>
              </div>
            )}
          </TileBlock>

          {/* ── TOKEN FLOW ── */}
          <TileBlock title="TOKEN FLOW" color="#00ffff">
            <div style={{ display:"flex", flexDirection:"column", gap:"6px", padding:"4px 0" }}>
              {[
                { label:"FIELD",  val:field,           max:tokens.length||1, color:"#00ffff" },
                { label:"LOCKED", val:locked.length,   max:tokens.length||1, color:"#39ff14" },
                { label:"PARKED", val:parked,           max:tokens.length||1, color:"#ffd700" },
                { label:"DB",     val:fromDB,           max:tokens.length||1, color:"#444466" },
              ].map(({label,val,max,color}) => (
                <div key={label}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
                    <span style={{ fontSize:"9px", color:"#333355" }}>{label}</span>
                    <span style={{ fontFamily:"Orbitron,sans-serif", fontSize:"9px", color, fontWeight:700 }}>{val}</span>
                  </div>
                  <div style={{ height:6, background:"rgba(255,255,255,0.03)", borderRadius:3, overflow:"hidden" }}>
                    <div style={{ width:`${Math.min(100,(val/max)*100)}%`, height:"100%", background:`linear-gradient(90deg,${color}60,${color})`, borderRadius:3, transition:"width 0.8s ease", boxShadow:`0 0 4px ${color}40` }} />
                  </div>
                </div>
              ))}
              <div style={{ marginTop:4, padding:"4px 6px", background:"rgba(255,255,255,0.02)", borderRadius:3, display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:"9px", color:"#1e1e3a" }}>TOTAL</span>
                <span style={{ fontFamily:"Orbitron,sans-serif", fontSize:"11px", color:"#c0c0e0", fontWeight:900 }}>{tokens.length}</span>
              </div>
            </div>
          </TileBlock>

          {/* ── SIGNAL DISTRIBUTION ── */}
          <TileBlock title="SIGNAL DISTRIBUTION" color="#bf00ff">
            <div style={{ display:"flex", alignItems:"flex-end", gap:"4px", height:64, padding:"4px 0 0 0" }}>
              {[
                { label:"0-24",  val:sigBuckets[0], color:"#333355" },
                { label:"25-49", val:sigBuckets[1], color:"#555577" },
                { label:"50-69", val:sigBuckets[2], color:"#7744aa" },
                { label:"70-87", val:sigBuckets[3], color:"#00ffff" },
                { label:"88+",   val:sigBuckets[4], color:"#ffd700" },
              ].map(({label,val,color}) => (
                <div key={label} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
                  <span style={{ fontFamily:"Orbitron,sans-serif", fontSize:"8px", color, fontWeight:700 }}>{val}</span>
                  <div style={{ width:"100%", height:`${Math.max(3,(val/sigMax)*50)}px`, background:`linear-gradient(0deg,${color}60,${color})`, borderRadius:"2px 2px 0 0", transition:"height 0.8s ease", boxShadow:`0 0 4px ${color}40`, minHeight:3 }} />
                </div>
              ))}
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:2 }}>
              {["0","25","50","70","88+"].map(l => <span key={l} style={{ fontSize:"7px", color:"#1e1e3a" }}>{l}</span>)}
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:6, padding:"4px 6px", background:"rgba(191,0,255,0.04)", borderRadius:3 }}>
              <span style={{ fontSize:"9px", color:"#333355" }}>AVG SIGNAL</span>
              <span style={{ fontFamily:"Orbitron,sans-serif", fontSize:"13px", color:sigAvg>=70?"#ffd700":sigAvg>=50?"#00ffff":"#444466", fontWeight:900 }}>{sigAvg}</span>
            </div>
            {sigHistory.length > 2 && (
              <div style={{ marginTop:4 }}>
                <svg width="100%" height="22" viewBox={`0 0 ${sigHistory.length} 22`} preserveAspectRatio="none">
                  <polyline points={sigHistory.map((p,i) => `${i},${22-(p.avg/100)*20}`).join(" ")} fill="none" stroke="#bf00ff" strokeWidth="0.8" opacity="0.6"/>
                </svg>
              </div>
            )}
          </TileBlock>

          {/* ── LOCK OUTCOMES ── */}
          <TileBlock title="LOCK OUTCOMES" color="#39ff14">
            <div style={{ display:"flex", gap:"10px", alignItems:"center", padding:"4px 0" }}>
              {/* Donut SVG */}
              <DonutChart
                slices={[
                  { val:lockWins,   color:"#39ff14", label:"WIN" },
                  { val:lockCrash,  color:"#ff073a", label:"CRASH" },
                  { val:lockFlat,   color:"#555577", label:"FLAT" },
                  { val:lockActive, color:"#00ffff", label:"LIVE" },
                ]}
                total={lockVals.length}
                size={68}
              />
              {/* legend */}
              <div style={{ flex:1, display:"flex", flexDirection:"column", gap:"5px" }}>
                {[
                  { label:"WIN",   val:lockWins,   color:"#39ff14" },
                  { label:"CRASH", val:lockCrash,  color:"#ff073a" },
                  { label:"FLAT",  val:lockFlat,   color:"#555577" },
                  { label:"LIVE",  val:lockActive, color:"#00ffff" },
                ].map(({label,val,color}) => (
                  <div key={label} style={{ display:"flex", gap:5, alignItems:"center" }}>
                    <div style={{ width:8, height:8, borderRadius:2, background:color, flexShrink:0, boxShadow:`0 0 4px ${color}60` }} />
                    <span style={{ fontSize:"9px", color:"#333355", flex:1 }}>{label}</span>
                    <span style={{ fontFamily:"Orbitron,sans-serif", fontSize:"10px", color, fontWeight:700 }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
            {lockVals.length === 0 && <div style={{ fontSize:"9px", color:"#1e1e3a", textAlign:"center", padding:"8px 0" }}>no locks this session</div>}
          </TileBlock>

          {/* ── FLASH MOVERS ── */}
          <TileBlock title="FLASH 30s MOVERS" color="#ff073a" style={{ gridColumn:"2 / 4" }}>
            <div style={{ display:"flex", flexDirection:"column", gap:"4px", padding:"2px 0" }}>
              {(flashBoard30s||[]).slice(0,6).map((t,i) => {
                const pct = Math.round(t.change30s||0);
                const maxPct = Math.max(1, ...(flashBoard30s||[]).slice(0,6).map(x => Math.abs(x.change30s||0)));
                const barW = Math.min(100, (Math.abs(pct)/maxPct)*100);
                const col = pct > 20 ? "#39ff14" : pct > 5 ? "#ffd700" : pct < -10 ? "#ff073a" : "#555577";
                return (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                    <span style={{ fontSize:"10px", color:"#666688", width:80, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flexShrink:0 }}>{t.name}</span>
                    <div style={{ flex:1, height:10, background:"rgba(255,255,255,0.03)", borderRadius:3, overflow:"hidden" }}>
                      <div style={{ width:`${barW}%`, height:"100%", background:`linear-gradient(90deg,${col}60,${col})`, borderRadius:3, transition:"width 0.8s ease", boxShadow:`0 0 4px ${col}40` }} />
                    </div>
                    <span style={{ fontFamily:"Orbitron,sans-serif", fontSize:"9px", color:col, fontWeight:700, width:44, textAlign:"right", flexShrink:0 }}>{pct>0?"+":""}{pct}%</span>
                  </div>
                );
              })}
              {!(flashBoard30s?.length) && <div style={{ fontSize:"9px", color:"#1e1e3a", textAlign:"center", padding:"8px 0" }}>no flash movers yet</div>}
            </div>
          </TileBlock>

          {/* ── INTELLIGENCE GAUGES ── */}
          <TileBlock title="INTELLIGENCE" color="#bf00ff">
            <div style={{ display:"flex", flexDirection:"column", gap:"7px", padding:"4px 0" }}>
              {[
                { label:"CLUSTERS",  val:intel?.clusters?.length||0,                         max:10,  color:"#bf00ff" },
                { label:"HOT TOKENS",val:intel?.hotClusterTokens?.size||0,                    max:20,  color:"#ff00ff" },
                { label:"DEV FLAGS", val:intel?.devFlags?Object.keys(intel.devFlags).length:0,max:20,  color:"#ff073a" },
                { label:"PRINTS",    val:intel?.tokenDNA?.winnerFingerprints?.length||0,       max:50,  color:"#ffd700" },
              ].map(({label,val,max,color}) => (
                <div key={label}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
                    <span style={{ fontSize:"9px", color:"#2a2a44" }}>{label}</span>
                    <span style={{ fontFamily:"Orbitron,sans-serif", fontSize:"9px", color, fontWeight:700 }}>{val}</span>
                  </div>
                  <div style={{ height:5, background:"rgba(255,255,255,0.03)", borderRadius:3, overflow:"hidden" }}>
                    <div style={{ width:`${Math.min(100,(val/max)*100)}%`, height:"100%", background:`linear-gradient(90deg,${color}50,${color})`, borderRadius:3, transition:"width 0.8s ease", boxShadow:`0 0 3px ${color}40` }} />
                  </div>
                </div>
              ))}
            </div>
          </TileBlock>
        </div>

        {/* ══ COL 3: INTEL SIDEBAR (300px) ══ */}
        <div style={{ width:300, flexShrink:0, borderLeft:"1px solid rgba(0,255,255,0.06)", overflow:"auto", padding:"10px", display:"flex", flexDirection:"column", gap:"14px" }}>

          {/* PARK CYCLERS */}
          <SideBlock title="PARK CYCLERS" color="#ffd700">
            {topCyclers.length===0 && <div style={{ fontSize:"10px", color:"#1a1a33" }}>none yet</div>}
            {topCyclers.map(([mint,v]) => {
              const sev = v.count>=10?"#ff2244":v.count>=6?"#ffd700":v.count>=3?"#888855":"#444455";
              return (
                <div key={mint} style={{ display:"flex", alignItems:"center", gap:"6px", padding:"3px 0", borderBottom:"1px solid rgba(255,255,255,0.03)" }}>
                  <span style={{ fontFamily:"Orbitron,sans-serif", fontSize:"11px", color:sev, fontWeight:900, width:28, flexShrink:0 }}>{v.count}×</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:"10px", color:"#8888aa", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{v.name}</div>
                    {v.mcap>0 && <div style={{ fontSize:"8px", color:"#333355" }}>${v.mcap>=1000?`${(v.mcap/1000).toFixed(1)}K`:v.mcap}</div>}
                  </div>
                  <div style={{ width:36, height:5, background:"rgba(255,255,255,0.03)", borderRadius:2, overflow:"hidden", flexShrink:0 }}>
                    <div style={{ width:`${Math.min(100,(v.count/15)*100)}%`, height:"100%", background:sev, borderRadius:2 }} />
                  </div>
                </div>
              );
            })}
          </SideBlock>

          {/* LOCK LOG */}
          <SideBlock title="LOCK HISTORY" color="#39ff14">
            {recentLocks.length===0 && <div style={{ fontSize:"10px", color:"#1a1a33" }}>no locks yet</div>}
            {recentLocks.map((h,i) => {
              const entryPct = h.mcapAtLock>0 ? Math.round(((h.peakMcap-h.mcapAtLock)/h.mcapAtLock)*100) : 0;
              const exitPct  = h.exitPct ?? entryPct;
              const col = h.status==="WIN"?"#39ff14":h.status==="CRASHED"?"#ff073a":h.status==="ACTIVE"?"#00ffff":"#555577";
              return (
                <div key={i} style={{ padding:"5px 0", borderBottom:"1px solid rgba(255,255,255,0.03)" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontSize:"10px", color:"#8888aa", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:130 }}>{h.name}</span>
                    <span style={{ fontFamily:"Orbitron,sans-serif", fontSize:"10px", color:col, fontWeight:700, flexShrink:0 }}>
                      {h.status==="ACTIVE"?"● LIVE":`${exitPct>0?"+":""}${exitPct}%`}
                    </span>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", marginTop:2 }}>
                    <span style={{ fontSize:"8px", color:"#1e1e3a" }}>entry ${h.mcapAtLock>=1000?`${(h.mcapAtLock/1000).toFixed(1)}K`:Math.round(h.mcapAtLock)}</span>
                    <span style={{ fontSize:"8px", color:"#1e1e3a" }}>peak ${h.peakMcap>=1000?`${(h.peakMcap/1000).toFixed(1)}K`:Math.round(h.peakMcap)}</span>
                  </div>
                  <div style={{ marginTop:3, height:3, background:"rgba(255,255,255,0.03)", borderRadius:2, overflow:"hidden" }}>
                    <div style={{ width:`${Math.min(100,Math.max(0,(entryPct+40)/(120)*100))}%`, height:"100%", background:col, borderRadius:2, transition:"width 0.8s ease" }} />
                  </div>
                </div>
              );
            })}
          </SideBlock>

          {/* CLUSTERS */}
          <SideBlock title="CLUSTER ACTIVITY" color="#bf00ff">
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
              <span style={{ fontSize:"10px", color:"#333355" }}>active clusters</span>
              <span style={{ fontFamily:"Orbitron,sans-serif", fontSize:"14px", color:"#bf00ff", fontWeight:900 }}>{intel?.clusters?.length||0}</span>
            </div>
            {(intel?.clusters||[]).slice(0,4).map((c,i) => (
              <div key={i} style={{ padding:"4px 6px", background:"rgba(191,0,255,0.04)", borderRadius:3, marginBottom:4, border:"1px solid rgba(191,0,255,0.08)" }}>
                <div style={{ fontSize:"9px", color:"#8888aa" }}>{c.wallets?.length||0}w · str:{Math.round(c.strength||0)}</div>
              </div>
            ))}
            {!(intel?.clusters?.length) && <div style={{ fontSize:"10px", color:"#1a1a33" }}>no clusters detected</div>}
          </SideBlock>

          {/* SNIPE WINDOW */}
          {intel?.snipeWindow && (
            <SideBlock title="SNIPE WINDOW" color="#ffd700">
              <div style={{ padding:"4px 0" }}>
                {intel.snipeWindow.optimalMcap && (
                  <div style={{ textAlign:"center", marginBottom:6 }}>
                    <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:"16px", color:"#ffd700", fontWeight:900 }}>
                      ${Math.round(intel.snipeWindow.optimalMcap/1000)}K
                    </div>
                    <div style={{ fontSize:"8px", color:"#333355" }}>optimal entry mcap</div>
                  </div>
                )}
                {intel.snipeWindow.rangeMin && intel.snipeWindow.rangeMax && (
                  <div style={{ fontSize:"9px", color:"#555566", textAlign:"center" }}>
                    ${Math.round(intel.snipeWindow.rangeMin/1000)}K – ${Math.round(intel.snipeWindow.rangeMax/1000)}K range
                  </div>
                )}
              </div>
            </SideBlock>
          )}

          {/* HOT CLUSTER TOKENS */}
          <SideBlock title="HOT CLUSTER TOKENS" color="#ff00ff">
            {intel?.hotClusterTokens?.size > 0
              ? [...intel.hotClusterTokens].slice(0,6).map((mint,i) => {
                  const tok = tokens.find(t => t.mint===mint);
                  return tok ? (
                    <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"2px 0", fontSize:"10px" }}>
                      <span style={{ color:"#8888aa", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:140 }}>{tok.name||mint.slice(0,8)}</span>
                      <span style={{ color:"#ff00ff", fontFamily:"Orbitron,sans-serif", fontSize:"9px", fontWeight:700 }}>${tok.mcap>=1000?`${(tok.mcap/1000).toFixed(1)}K`:Math.round(tok.mcap||0)}</span>
                    </div>
                  ) : null;
                })
              : <div style={{ fontSize:"10px", color:"#1a1a33" }}>none active</div>
            }
          </SideBlock>

        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Share+Tech+Mono&display=swap');
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────
// CHART & TILE HELPERS
// ─────────────────────────────────────────────
function TileBlock({ title, color, children, style }) {
  return (
    <div style={{ background:"rgba(255,255,255,0.01)", border:`1px solid ${color}14`, borderTop:`2px solid ${color}30`, borderRadius:4, padding:"8px 10px", ...style }}>
      <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:"8px", letterSpacing:"2px", color, marginBottom:6, fontWeight:700, opacity:0.8 }}>{title}</div>
      {children}
    </div>
  );
}

function DonutChart({ slices, total, size = 64 }) {
  const r = size * 0.38;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const tot = total || slices.reduce((a,s) => a+s.val, 0) || 1;

  let offset = 0;
  const paths = slices.map((s, i) => {
    const dash = (s.val / tot) * circumference;
    const gap  = circumference - dash;
    const path = (
      <circle key={i} cx={cx} cy={cy} r={r}
        fill="none" stroke={s.val>0?s.color:"transparent"}
        strokeWidth={size*0.14}
        strokeDasharray={`${dash} ${gap}`}
        strokeDashoffset={-offset}
        style={{ transition:"stroke-dasharray 1s ease" }}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
    );
    offset += dash;
    return path;
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink:0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={size*0.14}/>
      {paths}
      <text x={cx} y={cy+4} textAnchor="middle" fontFamily="Orbitron,sans-serif" fontSize={size*0.18} fontWeight="900" fill="#c0c0e0">{tot}</text>
    </svg>
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
