import { useState, useEffect, useRef, useCallback } from "react";
import { useVectorBrain, queryMemories, formatMemoriesForContext, getBrainStatusDisplay } from "./useVectorBrain";

// ─────────────────────────────────────────────
// PURE HELPERS — function declarations for TDZ safety
// ─────────────────────────────────────────────

function fmtK(n) {
  if (!n || n < 0) return "$0";
  if (n >= 1000000) return "$" + (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return "$" + (n / 1000).toFixed(1) + "K";
  return "$" + Math.round(n);
}

function fmtPct(n) {
  if (n === null || n === undefined) return "—";
  return (n > 0 ? "+" : "") + Math.round(n) + "%";
}

function fmtAge(ms) {
  if (!ms || ms < 0) return "0s";
  var s = Math.round(ms / 1000);
  if (s < 60) return s + "s";
  var m = Math.round(s / 60);
  if (m < 60) return m + "m";
  return Math.floor(m / 60) + "h" + (m % 60) + "m";
}

function claudeGetKeyStatus(key) {
  return !key ? "no_key" : key.startsWith("sk-ant-") ? "ready" : "invalid";
}

function fmtVol(n) {
  if (!n || n < 0) return "$0";
  if (n >= 1000000) return "$" + (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return "$" + (n / 1000).toFixed(0) + "K";
  return "$" + Math.round(n);
}

// ─────────────────────────────────────────────
// AUTO-ANALYSIS ENGINE — computes real observations from live data
// No API key needed. Runs client-side. Everyone gets the same intelligence.
// ─────────────────────────────────────────────

function analyzeField(tokens, tradeData, sigScores, lockedTokens, intel, flash30) {
  var obs = [];
  var lockedAddrs = new Set((lockedTokens || []).map(function(t) { return t.addr; }));

  // ── SMART MONEY CONVERGENCE ──
  tokens.forEach(function(t) {
    if (!t.alive) return;
    var td = tradeData[t.addr] || {};
    var smartCount = td.smartWallets ? td.smartWallets.size : (td.smartMoneyHits || 0);
    if (smartCount >= 2) {
      obs.push({
        type: "convergence", sev: smartCount >= 5 ? "critical" : smartCount >= 3 ? "high" : "medium",
        icon: "\u{1F3AF}", text: t.name + " \u2014 " + smartCount + " smart wallets converging",
        sub: fmtK(t.mcap) + " mcap \u00b7 signal \u25C8" + Math.round(sigScores[t.addr] || 0),
        addr: t.addr, score: smartCount * 30 + (sigScores[t.addr] || 0),
      });
    }
  });

  // ── ELITE SIGNALS ──
  tokens.forEach(function(t) {
    if (!t.alive) return;
    var sig = Math.round(sigScores[t.addr] || 0);
    if (sig >= 88) {
      obs.push({
        type: "signal", sev: "critical", icon: "\u25C8",
        text: t.name + " \u2014 GOLD \u25C8" + sig,
        sub: fmtK(t.mcap) + " mcap \u00b7 " + (t.holders || 0) + " holders" + (lockedAddrs.has(t.addr) ? " \u00b7 LOCKED" : ""),
        addr: t.addr, score: sig + 60,
      });
    } else if (sig >= 72) {
      obs.push({
        type: "signal", sev: "high", icon: "\u25C8",
        text: t.name + " \u2014 CYAN \u25C8" + sig,
        sub: fmtK(t.mcap) + " mcap",
        addr: t.addr, score: sig + 20,
      });
    }
  });

  // ── ACCELERATION (flash movers) ──
  (flash30 || []).forEach(function(f) {
    var chg = Math.round(f.gain || 0);
    if (Math.abs(chg) >= 15) {
      obs.push({
        type: chg > 0 ? "acceleration" : "dump", sev: Math.abs(chg) >= 40 ? "critical" : "high",
        icon: chg > 0 ? "\u26A1" : "\uD83D\uDCC9",
        text: f.name + " " + (chg > 0 ? "+" : "") + chg + "% in 30s",
        sub: chg > 0 ? "Momentum building" : "Rapid sell-off",
        score: Math.abs(chg) + 20,
      });
    }
  });

  // ── DEV FLAGS ──
  if (intel?.devFlags) {
    var flagCount = 0;
    Object.entries(intel.devFlags).forEach(function(entry) {
      if (flagCount >= 4) return;
      var addr = entry[0], flag = entry[1];
      var tok = tokens.find(function(t) { return t.addr === addr || t.deployer === addr; });
      if (tok && tok.alive) {
        flagCount++;
        obs.push({
          type: "dev_flag", sev: "warning", icon: "\uD83D\uDEA9",
          text: (tok.name || addr.slice(0, 8)) + " \u2014 deployer flagged",
          sub: flag.reason || "Suspicious history",
          addr: tok.addr, score: 35,
        });
      }
    });
  }

  // ── CLUSTER STRIKES ──
  (intel?.clusters || []).slice(0, 3).forEach(function(c) {
    var tokNames = (c.tokens || []).slice(0, 3).map(function(m) {
      var tok = tokens.find(function(t) { return t.addr === m; });
      return tok ? tok.name : m.slice(0, 6);
    });
    obs.push({
      type: "cluster", sev: (c.strength || 0) > 70 ? "critical" : "high",
      icon: "\uD83D\uDD78", text: (c.wallets?.length || 0) + " wallets coordinating \u2014 str:" + Math.round(c.strength || 0),
      sub: "Tokens: " + tokNames.join(", "),
      score: (c.strength || 0) * 0.5 + 25,
    });
  });

  // ── LOCK P&L ──
  (lockedTokens || []).forEach(function(t) {
    var cur = tokens.find(function(x) { return x.addr === t.addr; });
    var curMcap = cur ? (cur.mcap || 0) : (t.mcap || 0);
    var entry = t.lockPrice || t.mcap || 0;
    var pnl = entry > 0 ? ((curMcap - entry) / entry * 100) : 0;
    if (Math.abs(pnl) >= 10) {
      obs.push({
        type: pnl > 0 ? "lock_gain" : "lock_loss", sev: Math.abs(pnl) >= 30 ? "critical" : "medium",
        icon: pnl > 0 ? "\uD83D\uDCC8" : "\uD83D\uDCC9",
        text: t.name + " " + fmtPct(pnl) + " from lock",
        sub: fmtK(entry) + " \u2192 " + fmtK(curMcap),
        addr: t.addr, score: Math.abs(pnl) * 0.5 + 15,
      });
    }
  });

  // ── BUNDLE DETECTION ──
  tokens.forEach(function(t) {
    if (!t.alive || !t.bundleDetected) return;
    if ((t.bundleSize || 0) >= 3) {
      obs.push({
        type: "bundle", sev: (t.bundleSize || 0) >= 5 ? "critical" : "warning",
        icon: "\uD83D\uDCE6", text: t.name + " \u2014 bundle (" + t.bundleSize + " wallets)",
        sub: fmtK(t.mcap) + " \u00b7 watch for coordinated dump",
        addr: t.addr, score: (t.bundleSize || 0) * 8 + 20,
      });
    }
  });

  // ── HIGH RISK (mint auth, top holder) ──
  tokens.forEach(function(t) {
    if (!t.alive) return;
    if (t.mintAuth) {
      obs.push({
        type: "risk", sev: "warning", icon: "\u26A0",
        text: t.name + " \u2014 mint authority ENABLED",
        sub: "Supply can be inflated",
        addr: t.addr, score: 25,
      });
    }
    if ((t.topHolderPct || 0) >= 30) {
      obs.push({
        type: "risk", sev: "warning", icon: "\uD83D\uDC0B",
        text: t.name + " \u2014 top holder " + Math.round(t.topHolderPct) + "%",
        sub: "Concentrated supply",
        addr: t.addr, score: 22,
      });
    }
  });

  return obs.sort(function(a, b) { return b.score - a.score; }).slice(0, 40);
}

// ─────────────────────────────────────────────
// WOLF PACK DETECTOR — finds coordinated wallet teams
// ─────────────────────────────────────────────

function detectPacks(clusters, tokens, tradeData, sigScores) {
  var packs = [];
  (clusters || []).forEach(function(c) {
    if (!c.wallets || c.wallets.length < 2) return;

    var packTokens = (c.tokens || []).map(function(mint) {
      var tok = tokens.find(function(t) { return t.addr === mint; });
      if (!tok) return null;
      var td = tradeData[mint] || {};
      return {
        name: tok.name || mint.slice(0, 8), addr: mint,
        mcap: tok.mcap || 0, peakMcap: tok.peakMcap || tok.mcap || 0,
        signal: Math.round(sigScores[mint] || 0),
        smartHits: td.smartMoneyHits || (td.smartWallets ? td.smartWallets.size : 0),
        alive: tok.alive, holders: td.holders || tok.holders || 0,
      };
    }).filter(Boolean);

    if (packTokens.length === 0) return;

    var avgMcap = packTokens.reduce(function(a, t) { return a + t.mcap; }, 0) / packTokens.length;
    var avgSig = packTokens.reduce(function(a, t) { return a + t.signal; }, 0) / packTokens.length;
    var totalSmart = packTokens.reduce(function(a, t) { return a + t.smartHits; }, 0);
    var wins = packTokens.filter(function(t) { return t.mcap >= 8000 || (t.peakMcap > t.mcap * 1.5); }).length;

    packs.push({
      walletCount: c.wallets.length, tokens: packTokens, wallets: c.wallets || [],
      strength: Math.round(c.strength || 0), avgMcap: avgMcap,
      avgSignal: Math.round(avgSig), totalSmart: totalSmart,
      age: c.detectedAt ? Date.now() - c.detectedAt : null,
      heat: avgMcap >= 20000 && avgSig >= 50 ? "HOT" : avgMcap >= 8000 ? "WARM" : "COLD",
      winRate: packTokens.length > 0 ? Math.round(wins / packTokens.length * 100) : 0,
    });
  });
  return packs.sort(function(a, b) { return b.avgMcap - a.avgMcap; }).slice(0, 6);
}

// ─────────────────────────────────────────────
// MOCK PORTFOLIO — localStorage persistence
// ─────────────────────────────────────────────

var PORTFOLIO_KEY = "degen_mock_portfolio";

function loadPortfolio() {
  try { return JSON.parse(localStorage.getItem(PORTFOLIO_KEY)) || []; }
  catch (e) { return []; }
}

function savePortfolio(items) {
  try { localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(items)); } catch (e) {}
}

// ─────────────────────────────────────────────
// SNAPSHOT BUILDER — for Claude API context
// ─────────────────────────────────────────────

function buildSnapshot(tokensRef, tradeDataRef, sigScoresRef, lockedTokens, intel, flash30, marketTemp, sessionMin) {
  var tokens = tokensRef?.current || [];
  var td = tradeDataRef?.current || {};
  var sigs = sigScoresRef?.current || {};
  var locked = lockedTokens || [];
  var lockedAddrs = new Set(locked.map(function(t) { return t.addr; }));

  var topTokens = tokens.filter(function(t) { return t.alive; })
    .sort(function(a, b) { return (sigs[b.addr] || 0) - (sigs[a.addr] || 0); })
    .slice(0, 20).map(function(t) {
      var data = td[t.addr] || {};
      var buys = data.buyTimes?.length || 0, sells = data.sellTimes?.length || 0;
      return {
        name: t.name, addr8: t.addr?.slice(0, 8), mcap: Math.round(t.mcap || 0),
        signal: Math.round(sigs[t.addr] || 0), holders: data.holders || 0,
        smartHits: data.smartMoneyHits || 0,
        buyPct: (buys + sells) > 0 ? Math.round(buys / (buys + sells) * 100) : 0,
        locked: lockedAddrs.has(t.addr), migrated: !!t.migrated,
      };
    });

  return {
    sessionMin: sessionMin, total: tokens.length,
    alive: tokens.filter(function(t) { return t.alive; }).length,
    locked: locked.length,
    market: { temp: marketTemp?.temp || "?", score: marketTemp?.score || 50, bull: marketTemp?.bullPressure || 0, bear: marketTemp?.bearPressure || 0 },
    tokens: topTokens,
    flash30: (flash30 || []).slice(0, 6).map(function(t) { return { name: t.name, chg: Math.round(t.gain || 0) }; }),
    clusters: (intel?.clusters || []).length,
    devFlags: intel?.devFlags ? Object.keys(intel.devFlags).length : 0,
    snipeWindow: intel?.snipeWindow || null,
  };
}

// ─────────────────────────────────────────────
// LOCAL CHAT — answers questions from live data, no API needed
// ─────────────────────────────────────────────

function localChat(question, tokens, tradeData, sigScores, lockedTokens, intel) {
  var q = (question || "").toLowerCase();
  var locked = lockedTokens || [];

  if (/lock|portfolio|position|hold|pnl|profit|loss/.test(q)) {
    if (locked.length === 0) return "No active locks. Lock tokens from the battlefield to track here.";
    var lines = locked.map(function(t) {
      var cur = tokens.find(function(x) { return x.addr === t.addr; });
      var curMcap = cur ? (cur.mcap || 0) : (t.mcap || 0);
      var entry = t.lockPrice || t.mcap || 0;
      var pnl = entry > 0 ? ((curMcap - entry) / entry * 100) : 0;
      return t.name + ": " + fmtK(entry) + " \u2192 " + fmtK(curMcap) + " (" + fmtPct(pnl) + ") \u00b7 " + fmtAge(Date.now() - (t.lockTime || Date.now()));
    });
    return "PORTFOLIO \u2014 " + locked.length + " active\n\n" + lines.join("\n");
  }

  if (/smart|wallet|whale|money|winner/.test(q)) {
    var smartToks = tokens.filter(function(t) {
      if (!t.alive) return false;
      var td = tradeData[t.addr] || {};
      return (td.smartWallets ? td.smartWallets.size : (td.smartMoneyHits || 0)) >= 1;
    }).sort(function(a, b) {
      return ((tradeData[b.addr] || {}).smartMoneyHits || 0) - ((tradeData[a.addr] || {}).smartMoneyHits || 0);
    });
    if (smartToks.length === 0) return "No smart money activity detected yet.";
    var lines = smartToks.slice(0, 10).map(function(t) {
      var td = tradeData[t.addr] || {};
      return t.name + " \u2014 " + (td.smartMoneyHits || 0) + " hits, " + fmtK(t.mcap) + ", \u25C8" + Math.round(sigScores[t.addr] || 0);
    });
    return "SMART MONEY \u2014 " + smartToks.length + " tokens\n\n" + lines.join("\n");
  }

  if (/signal|score|top|best|hot|elite/.test(q)) {
    var top = tokens.filter(function(t) { return t.alive; })
      .map(function(t) { return { name: t.name, sig: Math.round(sigScores[t.addr] || 0), mcap: t.mcap }; })
      .filter(function(t) { return t.sig > 0; })
      .sort(function(a, b) { return b.sig - a.sig; }).slice(0, 12);
    if (top.length === 0) return "No signal scores yet. Need trade activity.";
    var lines = top.map(function(t) { return "\u25C8" + t.sig + " " + t.name + " \u2014 " + fmtK(t.mcap); });
    return "TOP SIGNALS\n\n" + lines.join("\n");
  }

  if (/cluster|pack|team|group|coordin|wolf/.test(q)) {
    var clusters = intel?.clusters || [];
    if (clusters.length === 0) return "No wallet clusters detected.";
    var lines = clusters.slice(0, 5).map(function(c, i) {
      var tokNames = (c.tokens || []).slice(0, 3).map(function(m) {
        var tok = tokens.find(function(t) { return t.addr === m; });
        return tok ? tok.name : m.slice(0, 6);
      });
      return "Pack " + (i + 1) + ": " + (c.wallets?.length || 0) + " wallets, str:" + Math.round(c.strength || 0) + " \u2192 " + tokNames.join(", ");
    });
    return "WOLF PACKS \u2014 " + clusters.length + " detected\n\n" + lines.join("\n");
  }

  if (/risk|rug|danger|safe|bundle|scam|flag/.test(q)) {
    var risky = tokens.filter(function(t) {
      return t.alive && (t.bundleDetected || t.mintAuth || (t.topHolderPct || 0) >= 25);
    });
    var devFlagCount = intel?.devFlags ? Object.keys(intel.devFlags).length : 0;
    if (risky.length === 0 && devFlagCount === 0) return "No high-risk tokens or dev flags this session.";
    var lines = risky.slice(0, 10).map(function(t) {
      var flags = [];
      if (t.bundleDetected) flags.push("BUNDLE(" + (t.bundleSize || 0) + ")");
      if (t.mintAuth) flags.push("MINT AUTH");
      if ((t.topHolderPct || 0) >= 25) flags.push("TOP " + Math.round(t.topHolderPct) + "%");
      return t.name + " \u2014 " + flags.join(", ");
    });
    return "RISK SCAN \u2014 " + risky.length + " flagged, " + devFlagCount + " dev flags\n\n" + lines.join("\n");
  }

  // Default overview
  var alive = tokens.filter(function(t) { return t.alive; }).length;
  var avgSig = tokens.length > 0 ? Math.round(tokens.reduce(function(a, t) { return a + (sigScores[t.addr] || 0); }, 0) / tokens.length) : 0;
  return "SESSION OVERVIEW\n\n" + tokens.length + " tokens \u00b7 " + alive + " alive \u00b7 " + locked.length + " locked\nAvg signal: \u25C8" + avgSig + "\nClusters: " + (intel?.clusters?.length || 0) + "\nDev flags: " + (intel?.devFlags ? Object.keys(intel.devFlags).length : 0) + "\n\nAsk about: locks, smart money, signals, wolf packs, risk";
}


// ─────────────────────────────────────────────
// SYSTEM PROMPT — for optional Claude API
// ─────────────────────────────────────────────

var SYSTEM_PROMPT = "You are the intelligence officer inside degen-LIVE \u2014 a real-time Solana memecoin battlefield. Analyze live token data to find alpha, identify risks, and surface actionable intelligence.\n\nYou receive JSON snapshots. Be SURGICAL \u2014 name specific tokens, mcap values, wallet counts.\n\nPrefixes:\n\uD83D\uDD34 CRITICAL \u2014 immediate risk or major opportunity\n\uD83D\uDFE1 WARNING \u2014 watch closely\n\uD83D\uDFE2 ALPHA \u2014 actionable pattern or edge\n\uD83D\uDCA1 INSIGHT \u2014 notable observation\n\uD83D\uDCCA DATA \u2014 metrics\n\nFocus: smart money convergence, wolf pack coordination, signal breakouts, dev dumps, lock timing.";


// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────

export default function ClaudeRoom({
  tokensRef, tokens, lockedTokens, tradeDataRef, signalScoresRef,
  intel, flashBoard30s, flashBoard1m, marketTemp, isActive, onSelectToken,
}) {
  // ── Config ──
  var ANTHROPIC_KEY = null;
  // var ANTHROPIC_KEY = "sk-ant-api03-...";  // uncomment with your key for Claude chat
  var CLAUDE_MODEL = "claude-sonnet-4-20250514";
  var IS_API = claudeGetKeyStatus(ANTHROPIC_KEY) === "ready";

  // ── Brain ──
  var { brainStatus, memCount } = useVectorBrain({ tokens: tokens || [] });
  var brainDisplay = getBrainStatusDisplay(brainStatus.status, brainStatus.lastSeen);

  // ── State ──
  var [observations, setObservations] = useState([]);
  var [chatMessages, setChatMessages] = useState([]);
  var [chatInput, setChatInput] = useState("");
  var [isLoading, setIsLoading] = useState(false);
  var [autoScan, setAutoScan] = useState(true);
  var [scanSecs, setScanSecs] = useState(10);
  var [inspectToken, setInspectToken] = useState(null);
  var [mockPortfolio, setMockPortfolio] = useState(loadPortfolio);
  var [expandedPack, setExpandedPack] = useState(null);
  var scanCount = useRef(0);
  var sessionStart = useRef(Date.now());
  var feedEnd = useRef(null);
  var conversationRef = useRef([]);

  // ── Internal token inspect (stays in Office) ──
  var handleInspect = useCallback(function(tok) {
    setInspectToken(tok);
  }, []);

  // ── Mock Portfolio CRUD ──
  var addToMockPortfolio = useCallback(function(tok) {
    if (!tok || !tok.addr) return;
    setMockPortfolio(function(prev) {
      if (prev.find(function(p) { return p.addr === tok.addr; })) return prev;
      var next = prev.concat([{
        addr: tok.addr, name: tok.name || tok.addr.slice(0, 8),
        entryMcap: tok.mcap || 0, entryTime: Date.now(),
        athMcap: tok.mcap || 0, athTime: Date.now(),
        platform: tok.platform || "?",
      }]);
      savePortfolio(next);
      return next;
    });
  }, []);

  var removeFromPortfolio = useCallback(function(addr) {
    setMockPortfolio(function(prev) {
      var next = prev.filter(function(p) { return p.addr !== addr; });
      savePortfolio(next);
      return next;
    });
  }, []);

  // ── Listen for portfolio adds from battlefield ──
  useEffect(function() {
    function handler(e) { if (e.detail?.addr) addToMockPortfolio(e.detail); }
    window.addEventListener("degen-portfolio-add", handler);
    return function() { window.removeEventListener("degen-portfolio-add", handler); };
  }, [addToMockPortfolio]);

  useEffect(function() {
    feedEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // ── AUTO-SCAN ──
  useEffect(function() {
    if (!autoScan || !isActive) return;
    function scan() {
      var toks = tokensRef?.current || [];
      var td = tradeDataRef?.current || {};
      var sigs = signalScoresRef?.current || {};
      var obs = analyzeField(toks, td, sigs, lockedTokens || [], intel, flashBoard30s);
      scanCount.current++;
      setObservations(obs);

      // Update ATH for mock portfolio
      setMockPortfolio(function(prev) {
        var changed = false;
        var next = prev.map(function(p) {
          var cur = toks.find(function(t) { return t.addr === p.addr; });
          if (cur && (cur.mcap || 0) > (p.athMcap || 0)) {
            changed = true;
            return Object.assign({}, p, { athMcap: cur.mcap, athTime: Date.now() });
          }
          return p;
        });
        if (changed) savePortfolio(next);
        return changed ? next : prev;
      });
    }
    scan();
    var iv = setInterval(scan, scanSecs * 1000);
    return function() { clearInterval(iv); };
  }, [autoScan, scanSecs, isActive]);

  // ── CHAT ──
  var handleChat = useCallback(async function() {
    if (!chatInput.trim() || isLoading) return;
    var q = chatInput.trim();
    setChatInput("");
    setChatMessages(function(prev) { return prev.concat([{ role: "user", text: q, time: new Date().toLocaleTimeString() }]); });

    if (!IS_API) {
      var toks = tokensRef?.current || [];
      var td = tradeDataRef?.current || {};
      var sigs = signalScoresRef?.current || {};
      var reply = localChat(q, toks, td, sigs, lockedTokens, intel);
      setChatMessages(function(prev) { return prev.concat([{ role: "assistant", text: reply, time: new Date().toLocaleTimeString() }]); });
      return;
    }

    setIsLoading(true);
    try {
      var memories = await queryMemories(q, 15);
      var brainCtx = formatMemoriesForContext(memories);
      var sessionMin = Math.round((Date.now() - sessionStart.current) / 60000);
      var snap = buildSnapshot(tokensRef, tradeDataRef, signalScoresRef, lockedTokens, intel, flashBoard30s, marketTemp, sessionMin);
      var userMsg = "QUESTION: " + q + "\n\nSNAPSHOT:\n" + JSON.stringify(snap, null, 1);
      var messages = conversationRef.current.concat([{ role: "user", content: userMsg }]);

      var res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 1000, system: SYSTEM_PROMPT + brainCtx, messages: messages }),
      });

      var data = await res.json();
      var reply = data.content?.[0]?.text || "[no response]";
      conversationRef.current = messages.concat([{ role: "assistant", content: reply }]).slice(-16);
      setChatMessages(function(prev) { return prev.concat([{ role: "assistant", text: reply, time: new Date().toLocaleTimeString(), fromClaude: true }]); });
    } catch (err) {
      setChatMessages(function(prev) { return prev.concat([{ role: "error", text: "API error: " + err.message, time: new Date().toLocaleTimeString() }]); });
    } finally {
      setIsLoading(false);
    }
  }, [chatInput, isLoading, IS_API, lockedTokens, intel, flashBoard30s, marketTemp]);

  // ── DEBRIEF ──
  var exportDebrief = useCallback(function() {
    var lines = [
      "\u2550\u2550\u2550 INTELLIGENCE DEBRIEF \u2550\u2550\u2550",
      "Session: " + Math.round((Date.now() - sessionStart.current) / 60000) + "min \u00b7 " + scanCount.current + " scans",
      new Date().toLocaleString(), "",
      "\u2500\u2500 OBSERVATIONS \u2500\u2500",
    ];
    observations.forEach(function(o) { lines.push(o.icon + " " + o.text); if (o.sub) lines.push("   " + o.sub); });
    if (chatMessages.length > 0) {
      lines.push("", "\u2500\u2500 CHAT \u2500\u2500");
      chatMessages.forEach(function(m) { lines.push("[" + m.time + "] " + (m.role === "user" ? "Q: " : "A: ") + m.text); });
    }
    navigator.clipboard.writeText(lines.join("\n"));
    setChatMessages(function(prev) { return prev.concat([{ role: "system", text: "Debrief copied \u2014 " + observations.length + " observations", time: new Date().toLocaleTimeString() }]); });
  }, [observations, chatMessages]);

  // ── DERIVED DATA ──
  var toks = tokensRef?.current || [];
  var locked = lockedTokens || [];
  var sigs = signalScoresRef?.current || {};
  var td = tradeDataRef?.current || {};
  var sessionMin = Math.round((Date.now() - sessionStart.current) / 60000);

  // Portfolio P&L (from mock portfolio, not locks)
  var portfolio = mockPortfolio.map(function(p) {
    var cur = toks.find(function(x) { return x.addr === p.addr; });
    var curMcap = cur ? (cur.mcap || 0) : 0;
    var pnl = p.entryMcap > 0 ? ((curMcap - p.entryMcap) / p.entryMcap * 100) : 0;
    var athPnl = p.entryMcap > 0 ? ((p.athMcap - p.entryMcap) / p.entryMcap * 100) : 0;
    var athX = p.entryMcap > 0 ? (p.athMcap / p.entryMcap) : 0;
    return {
      name: p.name, addr: p.addr, entryMcap: p.entryMcap, entryTime: p.entryTime,
      current: curMcap, pnl: pnl, athMcap: p.athMcap, athPnl: athPnl, athX: athX,
      held: Date.now() - (p.entryTime || Date.now()),
      signal: Math.round(sigs[p.addr] || 0), alive: cur ? cur.alive : false,
    };
  });

  // Top signals
  var topSignals = toks.filter(function(t) { return t.alive; })
    .map(function(t) {
      var data = td[t.addr] || {};
      var buys = data.buyTimes?.length || 0, sells = data.sellTimes?.length || 0;
      return {
        name: t.name || t.addr?.slice(0, 8), addr: t.addr,
        signal: Math.round(sigs[t.addr] || 0), mcap: t.mcap || 0,
        smartHits: data.smartMoneyHits || (data.smartWallets ? data.smartWallets.size : 0),
        holders: data.holders || t.holders || 0,
        buyPct: (buys + sells) > 0 ? Math.round(buys / (buys + sells) * 100) : 0,
        vol: data.totalVol || t.vol || 0,
        age: data.launchTime ? Date.now() - data.launchTime : null,
        isLocked: locked.some(function(l) { return l.addr === t.addr; }),
        migrated: !!t.migrated,
      };
    })
    .filter(function(t) { return t.signal > 0; })
    .sort(function(a, b) { return b.signal - a.signal; }).slice(0, 12);

  // Wolf packs
  var wolfPacks = detectPacks(intel?.clusters || [], toks, td, sigs);

  // Smart money tokens
  var smartTokens = toks.filter(function(t) { return t.alive; })
    .map(function(t) {
      var data = td[t.addr] || {};
      return {
        name: t.name || t.addr?.slice(0, 8), addr: t.addr,
        hits: data.smartMoneyHits || (data.smartWallets ? data.smartWallets.size : 0),
        mcap: t.mcap || 0, signal: Math.round(sigs[t.addr] || 0),
      };
    })
    .filter(function(t) { return t.hits >= 1; })
    .sort(function(a, b) { return b.hits - a.hits; }).slice(0, 10);

  // Market
  var bull = Math.round(marketTemp?.bullPressure || 0);
  var bear = Math.round(marketTemp?.bearPressure || 0);
  var tempScore = marketTemp?.score ?? 50;
  var tempLabel = marketTemp?.label || "NEUTRAL";

  // Risk tokens
  var riskTokens = toks.filter(function(t) {
    return t.alive && (t.bundleDetected || t.mintAuth || (t.topHolderPct || 0) >= 25 || (t.riskScore || 0) >= 70);
  }).slice(0, 8);

  // Stats
  var aliveCount = toks.filter(function(t) { return t.alive; }).length;
  var avgSignal = toks.length > 0 ? Math.round(toks.reduce(function(a, t) { return a + (sigs[t.addr] || 0); }, 0) / toks.length) : 0;
  var devFlagCount = intel?.devFlags ? Object.keys(intel.devFlags).length : 0;

  // ═══════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", background:"#040412", color:"#8888aa", fontFamily:"'Share Tech Mono',monospace", fontSize:"11px", position:"relative" }}>

      {/* ═══ HEADER ═══ */}
      <div style={{ display:"flex", alignItems:"center", gap:"8px", padding:"6px 12px", borderBottom:"1px solid rgba(0,255,255,0.08)", background:"rgba(0,255,255,0.015)", flexShrink:0, flexWrap:"wrap" }}>
        <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:"10px", color:"#00ffff", letterSpacing:"3px", fontWeight:900, whiteSpace:"nowrap" }}>{"\u25C8"} INTELLIGENCE OFFICE</div>
        <div style={{ fontSize:"9px", color:"#667799", whiteSpace:"nowrap" }}>{sessionMin}m {"\u00b7"} {aliveCount} alive {"\u00b7"} {locked.length} locked {"\u00b7"} scan #{scanCount.current}</div>

        <div style={{ display:"flex", gap:"5px", alignItems:"center", marginLeft:"auto", flexWrap:"wrap" }}>
          <select value={scanSecs} onChange={function(e) { setScanSecs(Number(e.target.value)); }}
            style={{ background:"#0a0a1a", border:"1px solid rgba(0,255,255,0.12)", color:"#00ffff", fontSize:"9px", padding:"2px 4px", borderRadius:"3px", cursor:"pointer", fontFamily:"'Share Tech Mono',monospace" }}>
            <option value={5}>5s</option><option value={10}>10s</option><option value={15}>15s</option><option value={30}>30s</option>
          </select>
          <Btn active={autoScan} color={autoScan?"#39ff14":"#667799"} onClick={function(){setAutoScan(function(v){return !v;});}}>{autoScan?"\u25CF SCANNING":"\u25CB AUTO-SCAN"}</Btn>
          <Btn color="#bf00ff" onClick={exportDebrief}>DEBRIEF</Btn>
          <Btn color="#667799" onClick={function(){setChatMessages([]);setObservations([]);}}>CLEAR</Btn>

          {/* Brain */}
          <div style={{ display:"flex", alignItems:"center", gap:"4px", padding:"3px 7px", background:"rgba(255,255,255,0.02)", border:"1px solid "+brainDisplay.color+"30", borderRadius:"3px" }}>
            <div style={{ width:5, height:5, borderRadius:"50%", background:brainDisplay.color, boxShadow:"0 0 5px "+brainDisplay.color, animation:"pulse 1.8s ease-in-out infinite" }} />
            <span style={{ fontFamily:"Orbitron,sans-serif", fontSize:"8px", fontWeight:700, color:brainDisplay.color }}>{brainDisplay.label}</span>
          </div>

          {IS_API && <div style={{ display:"flex", alignItems:"center", gap:"4px", padding:"3px 7px", background:"rgba(57,255,20,0.06)", border:"1px solid rgba(57,255,20,0.2)", borderRadius:"3px" }}>
            <div style={{ width:5, height:5, borderRadius:"50%", background:"#39ff14" }} />
            <span style={{ fontFamily:"Orbitron,sans-serif", fontSize:"8px", fontWeight:700, color:"#39ff14" }}>CLAUDE</span>
          </div>}
        </div>
      </div>

      {/* ═══ BODY ═══ */}
      <div style={{ flex:1, display:"flex", overflow:"hidden", minHeight:0 }}>

        {/* ══ LEFT: INTELLIGENCE FEED ══ */}
        <div style={{ width:300, flexShrink:0, display:"flex", flexDirection:"column", borderRight:"1px solid rgba(0,255,255,0.06)", overflow:"hidden" }}>
          <div style={{ flex:1, overflow:"auto", padding:"8px", display:"flex", flexDirection:"column", gap:"4px" }}>

            {observations.length === 0 && chatMessages.length === 0 && (
              <div style={{ color:"#1e1e3a", textAlign:"center", paddingTop:"40px", fontSize:"10px", lineHeight:"2.2" }}>
                <div style={{ fontFamily:"Orbitron,sans-serif", color:"#00ffff", opacity:0.12, fontSize:"20px", marginBottom:"10px" }}>{"\u25C8"}</div>
                <div>Intelligence engine active.</div>
                <div>Scanning {aliveCount} tokens every {scanSecs}s.</div>
              </div>
            )}

            {observations.length > 0 && (
              <div style={{ marginBottom:8 }}>
                <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:"8px", color:"#00ffff", letterSpacing:"2px", marginBottom:6, opacity:0.6 }}>LIVE ANALYSIS {"\u2014"} {observations.length} findings</div>
                {observations.map(function(o, i) {
                  var color = o.sev === "critical" ? "#ff073a" : o.sev === "high" ? "#ffd700" : o.sev === "warning" ? "#ffaa00" : "#8888aa";
                  return (
                    <div key={i} style={{ padding:"4px 6px", borderLeft:"2px solid "+color, marginBottom:3, background:"rgba(255,255,255,0.012)" }}>
                      <div style={{ color:color, fontSize:"10px" }}>{o.icon} {o.text}</div>
                      {o.sub && <div style={{ color:"#7788aa", fontSize:"9px", marginTop:1 }}>{o.sub}</div>}
                    </div>
                  );
                })}
              </div>
            )}

            {chatMessages.map(function(m, i) {
              var isUser = m.role === "user";
              var isSystem = m.role === "system";
              var isError = m.role === "error";
              var bc = isUser ? "#ffd700" : isError ? "#ff073a" : isSystem ? "#bf00ff" : m.fromClaude ? "#00ffff" : "#39ff14";
              return (
                <div key={i} style={{ padding:"6px 8px", borderLeft:"2px solid "+bc, background:isUser?"rgba(255,215,0,0.02)":"rgba(255,255,255,0.01)", borderRadius:"2px" }}>
                  <div style={{ fontSize:"8px", color:bc, fontFamily:"Orbitron,sans-serif", marginBottom:3 }}>
                    {m.time} {isUser?"YOU":isError?"ERROR":isSystem?"SYSTEM":m.fromClaude?"CLAUDE":"INTEL"}
                  </div>
                  {m.text.split("\n").map(function(line, j) {
                    return <div key={j} style={{ color:isUser?"#c0c0e0":isError?"#ff073a":"#8888aa", fontSize:"10px", lineHeight:"1.6", minHeight:"1em" }}>{line||"\u00a0"}</div>;
                  })}
                </div>
              );
            })}

            {isLoading && <div style={{ border:"1px solid rgba(0,255,255,0.1)", borderLeft:"2px solid #00ffff", borderRadius:"3px", padding:"8px", color:"#00ffff", fontFamily:"Orbitron,sans-serif", fontSize:"9px", letterSpacing:"2px" }}>{"\u25C8"} ANALYZING...</div>}
            <div ref={feedEnd} />
          </div>

          {/* Chat input */}
          <div style={{ borderTop:"1px solid rgba(0,255,255,0.06)", padding:"6px 8px", display:"flex", gap:"6px", background:"rgba(0,0,0,0.25)", flexShrink:0 }}>
            <input value={chatInput} onChange={function(e){setChatInput(e.target.value);}} onKeyDown={function(e){if(e.key==="Enter")handleChat();}}
              placeholder={IS_API?"ask Claude...":"ask about tokens, signals, risk..."}
              style={{ flex:1, background:"rgba(255,255,255,0.02)", border:"1px solid rgba(0,255,255,0.1)", borderRadius:"3px", padding:"5px 8px", color:"#c0c0e0", fontSize:"10px", fontFamily:"'Share Tech Mono',monospace", outline:"none" }} />
            <button onClick={handleChat} disabled={isLoading||!chatInput.trim()}
              style={{ background:"rgba(0,255,255,0.06)", border:"1px solid rgba(0,255,255,0.18)", color:"#00ffff", fontSize:"9px", padding:"5px 10px", borderRadius:"3px", cursor:(isLoading||!chatInput.trim())?"default":"pointer", fontFamily:"Orbitron,sans-serif", fontWeight:700, letterSpacing:"1px", opacity:(isLoading||!chatInput.trim())?0.3:1 }}>ASK</button>
          </div>
        </div>

        {/* ══ CENTER: ANALYSIS GRID ══ */}
        <div style={{ flex:1, overflow:"auto", padding:"10px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px", alignContent:"start", minWidth:0 }}>

          {/* MOCK PORTFOLIO */}
          <Panel title="PORTFOLIO" color="#39ff14" count={portfolio.length}>
            {portfolio.length === 0 && <Empty>Click a coin on the battlefield {"\u2192"} Add to Portfolio</Empty>}
            {portfolio.map(function(p, i) {
              var col = p.pnl > 5 ? "#39ff14" : p.pnl < -5 ? "#ff073a" : "#8899bb";
              return (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:"6px", padding:"4px 0", borderBottom:"1px solid rgba(255,255,255,0.03)" }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                      <TokName name={p.name} addr={p.addr} toks={toks} onSelect={handleInspect} />
                      {!p.alive && p.current === 0 && <span style={{ fontSize:"7px", color:"#555", background:"rgba(255,255,255,0.03)", padding:"0 3px", borderRadius:2 }}>STALE</span>}
                    </div>
                    <div style={{ fontSize:"8px", color:"#8899bb" }}>
                      {fmtK(p.entryMcap)} {"\u2192"} {fmtK(p.current)} {"\u00b7"} {fmtAge(p.held)}
                    </div>
                    <div style={{ fontSize:"7px", color:"#667799" }}>
                      ATH {fmtK(p.athMcap)} ({p.athX >= 1 ? p.athX.toFixed(1)+"x" : "—"})
                      {p.signal > 0 && <span> {"\u00b7"} {"\u25C8"}{p.signal}</span>}
                    </div>
                  </div>
                  <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:"12px", color:col, fontWeight:900, flexShrink:0, textAlign:"right" }}>
                    {fmtPct(p.pnl)}
                    {p.athPnl > 10 && <div style={{ fontSize:"7px", color:"#ffd700", fontWeight:400 }}>ATH {fmtPct(p.athPnl)}</div>}
                  </div>
                  <span onClick={function() { removeFromPortfolio(p.addr); }}
                    style={{ fontSize:"10px", color:"#ff073a", cursor:"pointer", opacity:0.5, flexShrink:0, padding:"2px" }}
                    title="Remove from portfolio">{"\u2715"}</span>
                </div>
              );
            })}
          </Panel>

          {/* TOP SIGNALS */}
          <Panel title="TOP SIGNALS" color="#ffd700" count={topSignals.length}>
            {topSignals.length === 0 && <Empty>Waiting for signal data</Empty>}
            {topSignals.map(function(t, i) {
              var sc = t.signal >= 88 ? "#ffd700" : t.signal >= 72 ? "#00ffff" : t.signal >= 50 ? "#8888aa" : "#7788aa";
              return (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:"6px", padding:"3px 0", borderBottom:"1px solid rgba(255,255,255,0.03)" }}>
                  <span style={{ fontFamily:"Orbitron,sans-serif", fontSize:"11px", color:sc, fontWeight:900, width:32, flexShrink:0, textAlign:"right" }}>{"\u25C8"}{t.signal}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                      <TokName name={t.name} addr={t.addr} toks={toks} onSelect={handleInspect} />
                      {t.isLocked && <span style={{fontSize:"9px"}}>{"\uD83D\uDD12"}</span>}
                      {t.migrated && <span style={{fontSize:"9px"}}>{"\uD83C\uDF09"}</span>}
                    </div>
                    <div style={{ fontSize:"8px", color:"#8899bb" }}>{fmtK(t.mcap)} {"\u00b7"} {t.smartHits}sw {"\u00b7"} {t.buyPct}% buys {"\u00b7"} {t.holders}w {"\u00b7"} {fmtVol(t.vol)}vol</div>
                  </div>
                </div>
              );
            })}
          </Panel>

          {/* FLASH 30s MOVERS */}
          <Panel title="FLASH 30s" color="#ff073a">
            {!(flashBoard30s?.length) && <Empty>No flash movers</Empty>}
            {(flashBoard30s || []).slice(0, 8).map(function(t, i) {
              var pct = Math.round(t.gain || 0);
              var maxPct = Math.max(1, ...(flashBoard30s || []).slice(0, 8).map(function(x) { return Math.abs(x.gain || 0); }));
              var barW = Math.min(100, Math.abs(pct) / maxPct * 100);
              var col = pct > 20 ? "#39ff14" : pct > 5 ? "#ffd700" : pct < -10 ? "#ff073a" : "#8899bb";
              return (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:"6px", padding:"2px 0" }}>
                  <span style={{ width:70, flexShrink:0 }}><TokName name={t.name} addr={t.addr} toks={toks} onSelect={handleInspect} /></span>
                  <span style={{ fontSize:"8px", color:"#667799", width:40, flexShrink:0, textAlign:"center" }}>{fmtK(t.mcap)}</span>
                  <div style={{ flex:1, height:8, background:"rgba(255,255,255,0.03)", borderRadius:3, overflow:"hidden" }}>
                    <div style={{ width:barW+"%", height:"100%", background:"linear-gradient(90deg,"+col+"60,"+col+")", borderRadius:3, transition:"width 0.8s ease" }} />
                  </div>
                  <span style={{ fontFamily:"Orbitron,sans-serif", fontSize:"9px", color:col, fontWeight:700, width:44, textAlign:"right", flexShrink:0 }}>{pct>0?"+":""}{pct}%</span>
                </div>
              );
            })}
          </Panel>

          {/* MARKET */}
          <Panel title="MARKET" color="#ffd700">
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"20px", padding:"6px 0" }}>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:"8px", color:"#39ff14", fontWeight:700 }}>{bull}%</div>
                <div style={{ width:22, height:55, background:"rgba(57,255,20,0.06)", border:"1px solid rgba(57,255,20,0.15)", borderRadius:"11px", overflow:"hidden", display:"flex", flexDirection:"column", justifyContent:"flex-end" }}>
                  <div style={{ width:"100%", height:bull+"%", background:"linear-gradient(0deg,#39ff14,#39ff1480)", borderRadius:"0 0 9px 9px" }} />
                </div>
                <div style={{ fontSize:"7px", color:"#2a4a2a", marginTop:2 }}>BULL</div>
              </div>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:"24px", color:tempScore>65?"#ff073a":tempScore>40?"#ffd700":"#00aaff", fontWeight:900 }}>{tempScore}</div>
                <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:"9px", color:tempScore>65?"#ff073a":tempScore>40?"#ffd700":"#4488ff", fontWeight:700 }}>{tempLabel}</div>
              </div>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:"8px", color:"#ff073a", fontWeight:700 }}>{bear}%</div>
                <div style={{ width:22, height:55, background:"rgba(255,7,58,0.06)", border:"1px solid rgba(255,7,58,0.15)", borderRadius:"11px", overflow:"hidden", display:"flex", flexDirection:"column", justifyContent:"flex-end" }}>
                  <div style={{ width:"100%", height:bear+"%", background:"linear-gradient(0deg,#ff073a,#ff073a80)", borderRadius:"0 0 9px 9px" }} />
                </div>
                <div style={{ fontSize:"7px", color:"#4a2a2a", marginTop:2 }}>BEAR</div>
              </div>
            </div>
          </Panel>

          {/* SESSION — full width */}
          <Panel title="SESSION" color="#00ffff" style={{ gridColumn:"1 / -1" }}>
            <div style={{ display:"flex", gap:"12px", justifyContent:"center", padding:"4px 0", flexWrap:"wrap" }}>
              {[
                { label:"TOKENS", val:aliveCount, color:"#00ffff" },
                { label:"LOCKED", val:locked.length, color:"#39ff14" },
                { label:"SCANS", val:scanCount.current, color:"#bf00ff" },
                { label:"AVG \u25C8", val:avgSignal, color:avgSignal>=50?"#ffd700":"#8899bb" },
                { label:"DEV FLAGS", val:devFlagCount, color:devFlagCount>0?"#ff073a":"#667799" },
                { label:"CLUSTERS", val:(intel?.clusters||[]).length, color:(intel?.clusters||[]).length>0?"#bf00ff":"#667799" },
                { label:"SMART $", val:smartTokens.length, color:smartTokens.length>0?"#39ff14":"#667799" },
              ].map(function(s) {
                return (
                  <div key={s.label} style={{ textAlign:"center", minWidth:48 }}>
                    <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:"16px", color:s.color, fontWeight:900 }}>{s.val}</div>
                    <div style={{ fontSize:"7px", color:"#667799", letterSpacing:"1px" }}>{s.label}</div>
                  </div>
                );
              })}
            </div>
          </Panel>

          {/* RISK WIRE — full width */}
          <Panel title="RISK WIRE" color="#ff073a" style={{ gridColumn:"1 / -1" }} count={riskTokens.length + devFlagCount}>
            {riskTokens.length === 0 && devFlagCount === 0 && <Empty>No threats detected</Empty>}
            {riskTokens.map(function(t, i) {
              var flags = [];
              if (t.bundleDetected) flags.push("\uD83D\uDCE6 BUNDLE(" + (t.bundleSize||0) + ")");
              if (t.mintAuth) flags.push("\u26A0 MINT AUTH");
              if ((t.topHolderPct||0) >= 25) flags.push("\uD83D\uDC0B TOP " + Math.round(t.topHolderPct) + "%");
              if ((t.riskScore||0) >= 70) flags.push("\u2620 RISK " + t.riskScore);
              return (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"3px 0", borderBottom:"1px solid rgba(255,255,255,0.03)" }}>
                  <TokName name={t.name||t.addr?.slice(0,8)} addr={t.addr} toks={toks} onSelect={handleInspect} />
                  <span style={{ fontSize:"9px", color:"#ff073a" }}>{flags.join(" \u00b7 ")}</span>
                </div>
              );
            })}
            {devFlagCount > 0 && <div style={{ fontSize:"9px", color:"#ff073a", marginTop:4, opacity:0.7 }}>{devFlagCount} deployer{devFlagCount>1?"s":""} flagged for suspicious history</div>}
          </Panel>

        </div>

        {/* ══ RIGHT: DEEP INTEL ══ */}
        <div style={{ width:300, flexShrink:0, borderLeft:"1px solid rgba(0,255,255,0.06)", overflow:"auto", padding:"10px", display:"flex", flexDirection:"column", gap:"14px" }}>

          {/* WOLF PACKS — click to expand */}
          <Side title="WOLF PACKS" color="#bf00ff">
            {wolfPacks.length === 0 && <Empty>No coordinated packs detected</Empty>}
            {wolfPacks.map(function(p, i) {
              var hc = p.heat === "HOT" ? "#ff073a" : p.heat === "WARM" ? "#ffd700" : "#8899bb";
              var isExpanded = expandedPack === i;
              return (
                <div key={i} style={{ padding:"5px 6px", background:"rgba(191,0,255,0.03)", border:"1px solid rgba(191,0,255,"+(isExpanded?"0.3":"0.1")+")", borderRadius:3, marginBottom:4, cursor:"pointer" }}
                  onClick={function() { setExpandedPack(isExpanded ? null : i); }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontFamily:"Orbitron,sans-serif", fontSize:"10px", color:"#bf00ff", fontWeight:700 }}>{p.walletCount}{"\uD83D\uDC3A"} {"\u00b7"} str:{p.strength}</span>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ fontSize:"8px", color:p.winRate>=50?"#39ff14":"#ff073a", fontFamily:"Orbitron,sans-serif", fontWeight:700 }}>{p.winRate}% W</span>
                      <span style={{ fontSize:"8px", color:hc, fontFamily:"Orbitron,sans-serif", fontWeight:700 }}>{p.heat}</span>
                      <span style={{ fontSize:"8px", color:"#667799" }}>{isExpanded ? "\u25B2" : "\u25BC"}</span>
                    </div>
                  </div>
                  {!isExpanded && <div style={{ fontSize:"9px", color:"#8899bb", marginTop:2, display:"flex", flexWrap:"wrap", gap:"4px" }}>{p.tokens.slice(0,4).map(function(t, j){return <TokName key={j} name={t.name} addr={t.addr} toks={toks} onSelect={handleInspect} />;})}{p.tokens.length>4 && <span style={{fontSize:"8px",color:"#667799"}}>+{p.tokens.length-4}</span>}</div>}
                  {!isExpanded && <div style={{ fontSize:"8px", color:"#667799", marginTop:1 }}>avg {fmtK(p.avgMcap)} {"\u00b7"} {"\u25C8"}{p.avgSignal} {"\u00b7"} {p.totalSmart}sw</div>}

                  {/* EXPANDED DRILL-DOWN */}
                  {isExpanded && (
                    <div onClick={function(e) { e.stopPropagation(); }} style={{ marginTop:6, borderTop:"1px solid rgba(191,0,255,0.15)", paddingTop:5 }}>
                      <div style={{ fontSize:"8px", color:"#bf00ff", marginBottom:4, fontFamily:"Orbitron,sans-serif", letterSpacing:"1px" }}>
                        {p.tokens.length} COINS {"\u00b7"} {p.walletCount} WALLETS {"\u00b7"} {p.winRate}% WIN RATE
                      </div>
                      {p.tokens.map(function(t, j) {
                        var peakX = t.mcap > 0 && t.peakMcap > 0 ? (t.peakMcap / Math.max(t.mcap * 0.5, 1)).toFixed(1) : "—";
                        var isAlive = t.alive !== false;
                        return (
                          <div key={j} style={{ display:"flex", alignItems:"center", gap:4, padding:"3px 0", borderBottom:"1px solid rgba(255,255,255,0.02)" }}>
                            <span style={{ width:6, height:6, borderRadius:"50%", background:isAlive?"#39ff14":"#ff073a", flexShrink:0 }} />
                            <div style={{ flex:1, minWidth:0 }}>
                              <TokName name={t.name} addr={t.addr} toks={toks} onSelect={handleInspect} />
                              <div style={{ fontSize:"7px", color:"#667799" }}>{fmtK(t.mcap)} {"\u00b7"} peak {fmtK(t.peakMcap)} {"\u00b7"} {"\u25C8"}{t.signal}</div>
                            </div>
                            <span style={{ fontFamily:"Orbitron,sans-serif", fontSize:"9px", color:t.mcap>=8000?"#39ff14":"#ff073a", fontWeight:700, flexShrink:0 }}>{fmtK(t.mcap)}</span>
                          </div>
                        );
                      })}
                      {p.wallets && p.wallets.length > 0 && (
                        <div style={{ marginTop:4, fontSize:"7px", color:"#667799" }}>
                          <div style={{ color:"#bf00ff", fontSize:"7px", fontFamily:"Orbitron,sans-serif", marginBottom:2 }}>WALLETS</div>
                          {p.wallets.slice(0, 6).map(function(w, k) {
                            return <div key={k} style={{ fontFamily:"'Share Tech Mono',monospace", color:"#556677", fontSize:"7px" }}>{(typeof w === "string" ? w : w.addr || "").slice(0, 8)}...{(typeof w === "string" ? w : w.addr || "").slice(-6)}</div>;
                          })}
                          {p.wallets.length > 6 && <div style={{ color:"#444" }}>+{p.wallets.length - 6} more</div>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </Side>

          {/* SMART MONEY */}
          <Side title="SMART MONEY" color="#39ff14">
            {smartTokens.length === 0 && <Empty>No smart money activity</Empty>}
            {smartTokens.map(function(t, i) {
              return (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"3px 0", borderBottom:"1px solid rgba(255,255,255,0.03)" }}>
                  <div>
                    <TokName name={t.name} addr={t.addr} toks={toks} onSelect={handleInspect} />
                    <div style={{ fontSize:"8px", color:"#667799" }}>{fmtK(t.mcap)} {"\u00b7"} {"\u25C8"}{t.signal}</div>
                  </div>
                  <span style={{ fontFamily:"Orbitron,sans-serif", fontSize:"12px", color:"#39ff14", fontWeight:900 }}>{t.hits}{"\u00D7"}</span>
                </div>
              );
            })}
          </Side>

          {/* SNIPE WINDOW */}
          {intel?.snipeWindow && (
            <Side title="SNIPE WINDOW" color="#ffd700">
              <div style={{ textAlign:"center", padding:"6px 0" }}>
                <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:"16px", color:"#ffd700", fontWeight:900 }}>
                  {fmtK(intel.snipeWindow.low)} {"\u2013"} {fmtK(intel.snipeWindow.high)}
                </div>
                <div style={{ fontSize:"8px", color:"#667799", marginTop:2 }}>
                  {intel.snipeWindow.count||0} winners {"\u00b7"} {(intel.snipeWindow.avgMultiple||0).toFixed(1)}x avg
                </div>
              </div>
            </Side>
          )}

          {/* CLUSTER TOKENS */}
          <Side title="CLUSTER TOKENS" color="#ff00ff">
            {!(intel?.hotClusterTokens?.size > 0) && <Empty>None active</Empty>}
            {intel?.hotClusterTokens?.size > 0 && [...intel.hotClusterTokens].slice(0, 8).map(function(addr, i) {
              var tok = toks.find(function(t) { return t.addr === addr; });
              if (!tok) return null;
              return (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"2px 0", fontSize:"10px" }}>
                  <TokName name={tok.name||addr.slice(0,8)} addr={addr} toks={toks} onSelect={handleInspect} />
                  <span style={{ color:"#ff00ff", fontFamily:"Orbitron,sans-serif", fontSize:"9px", fontWeight:700 }}>{fmtK(tok.mcap)}</span>
                </div>
              );
            })}
          </Side>

          {/* TOKEN DNA */}
          {intel?.tokenDNA?.winnerFingerprints?.length > 0 && (
            <Side title="TOKEN DNA" color="#ffd700">
              <div style={{ fontSize:"9px", color:"#8899bb", marginBottom:4 }}>{intel.tokenDNA.winnerFingerprints.length} winner fingerprints loaded</div>
              {intel.tokenDNA.matches && Object.entries(intel.tokenDNA.matches).slice(0, 5).map(function(entry, i) {
                var addr = entry[0], match = entry[1];
                var tok = toks.find(function(t) { return t.addr === addr; });
                if (!tok) return null;
                return (
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"2px 0", borderBottom:"1px solid rgba(255,255,255,0.03)" }}>
                    <TokName name={tok.name||addr.slice(0,8)} addr={addr} toks={toks} onSelect={handleInspect} />
                    <span style={{ fontFamily:"Orbitron,sans-serif", fontSize:"9px", color:"#ffd700", fontWeight:700 }}>{Math.round(match.similarity||match.score||0)}%</span>
                  </div>
                );
              })}
            </Side>
          )}

        </div>
      </div>

      {/* ═══ TOKEN INSPECT OVERLAY ═══ */}
      {inspectToken && (function() {
        var tok = inspectToken;
        var data = td[tok.addr] || {};
        var sig = Math.round(sigs[tok.addr] || 0);
        var buys = data.buyTimes?.length || tok.buys || 0;
        var sells = data.sellTimes?.length || tok.sells || 0;
        var smartHits = data.smartMoneyHits || (data.smartWallets ? data.smartWallets.size : 0) || 0;
        var inPort = mockPortfolio.some(function(p) { return p.addr === tok.addr; });
        var portEntry = mockPortfolio.find(function(p) { return p.addr === tok.addr; });
        var dexUrl = "https://dexscreener.com/solana/" + tok.addr + "?embed=1&theme=dark&trades=0&info=0";

        return (
          <div style={{ position:"absolute", top:0, left:0, right:0, bottom:0, zIndex:50, background:"rgba(4,4,18,0.97)", display:"flex", flexDirection:"column", overflow:"hidden" }}>
            {/* Header */}
            <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 14px", borderBottom:"1px solid rgba(0,255,255,0.12)", background:"rgba(0,255,255,0.02)", flexShrink:0, flexWrap:"wrap" }}>
              <span style={{ fontFamily:"Orbitron,sans-serif", fontSize:"13px", color:"#00ffff", fontWeight:900, letterSpacing:"2px" }}>{"\u25C9"} {tok.name || tok.addr?.slice(0,8)}</span>
              {tok.alive !== false && <span style={{ fontSize:"8px", color:"#39ff14", background:"rgba(57,255,20,0.1)", padding:"1px 5px", borderRadius:3 }}>{"\u25CF"} LIVE</span>}
              {tok.migrated && <span style={{ fontSize:"8px", color:"#39ff14", fontWeight:700 }}>{"\uD83C\uDF09"} MIG</span>}
              <span onClick={function(){navigator.clipboard.writeText(tok.addr);}} style={{ fontSize:"9px", color:"#667799", cursor:"pointer" }} title={tok.addr}>{"\uD83D\uDCCB"} {tok.addr?.slice(0,6)}...{tok.addr?.slice(-4)}</span>
              <div style={{ marginLeft:"auto", display:"flex", gap:6, alignItems:"center" }}>
                {!inPort && (
                  <button onClick={function(){ addToMockPortfolio(tok); }}
                    style={{ background:"rgba(57,255,20,0.06)", border:"1px solid rgba(57,255,20,0.3)", color:"#39ff14", fontSize:"9px", padding:"3px 8px", borderRadius:3, cursor:"pointer", fontFamily:"Orbitron,sans-serif", fontWeight:700 }}>
                    + PORTFOLIO
                  </button>
                )}
                {inPort && <span style={{ fontSize:"8px", color:"#39ff14", fontFamily:"Orbitron,sans-serif" }}>{"\u2713"} IN PORTFOLIO</span>}
                <button onClick={function(){ setInspectToken(null); }}
                  style={{ background:"rgba(255,7,58,0.06)", border:"1px solid rgba(255,7,58,0.25)", color:"#ff073a", fontSize:"12px", padding:"2px 8px", borderRadius:3, cursor:"pointer", fontWeight:700 }}>{"\u2715"}</button>
              </div>
            </div>

            {/* Body: chart + stats */}
            <div style={{ flex:1, display:"flex", overflow:"hidden", minHeight:0 }}>
              {/* Chart */}
              <div style={{ flex:1, minWidth:0, position:"relative" }}>
                <iframe src={dexUrl} title="chart" style={{ width:"100%", height:"100%", border:"none", background:"#0a0a1a" }} allow="clipboard-write" />
              </div>

              {/* Stats sidebar */}
              <div style={{ width:240, flexShrink:0, borderLeft:"1px solid rgba(0,255,255,0.08)", overflow:"auto", padding:"10px", display:"flex", flexDirection:"column", gap:8 }}>
                {/* Core stats */}
                <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:"7px", color:"#00ffff", letterSpacing:"2px", marginBottom:2 }}>STATS</div>
                {[
                  { l:"MCAP", v:fmtK(tok.mcap||0), c:"#00ffff" },
                  { l:"SIGNAL", v:sig > 0 ? "\u25C8"+sig+"/100" : "—", c:sig>=88?"#ffd700":sig>=72?"#00ffff":"#8899bb" },
                  { l:"SMART $", v:smartHits > 0 ? smartHits+"x" : "0", c:smartHits>=2?"#39ff14":"#8899bb" },
                  { l:"HOLDERS", v:data.holders||tok.holders||"—", c:(data.holders||tok.holders||0)>100?"#39ff14":"#8899bb" },
                  { l:"BUYS/SELLS", v:buys+"/"+sells, c:"#8899bb" },
                  { l:"BUY %", v:(buys+sells)>0?Math.round(buys/(buys+sells)*100)+"%":"—", c:(buys+sells)>0&&buys/(buys+sells)>0.6?"#39ff14":"#8899bb" },
                  { l:"VOL", v:fmtVol(data.totalVol||tok.vol||0), c:"#ffd700" },
                  { l:"FRESH %", v:(tok.freshPct||0)+"%", c:(tok.freshPct||0)>75?"#ff073a":"#39ff14" },
                  { l:"DEV %", v:tok.devWallet!=null?tok.devWallet.toFixed(1)+"%":"—", c:(tok.devWallet||0)>15?"#ff073a":"#39ff14" },
                ].map(function(s) {
                  return (
                    <div key={s.l} style={{ display:"flex", justifyContent:"space-between", padding:"2px 0", borderBottom:"1px solid rgba(255,255,255,0.02)" }}>
                      <span style={{ fontSize:"8px", color:"#667799" }}>{s.l}</span>
                      <span style={{ fontSize:"10px", color:s.c, fontFamily:"Orbitron,sans-serif", fontWeight:700 }}>{s.v}</span>
                    </div>
                  );
                })}

                {/* Risk flags */}
                {(tok.bundleDetected || tok.mintAuth || (tok.riskScore||0)>=50) && (
                  <div>
                    <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:"7px", color:"#ff073a", letterSpacing:"2px", marginBottom:4, marginTop:4 }}>RISK FLAGS</div>
                    {tok.bundleDetected && <div style={{ fontSize:"9px", color:"#ff073a" }}>{"\uD83D\uDCE6"} Bundle detected ({tok.bundleSize||"?"} wallets)</div>}
                    {tok.mintAuth && <div style={{ fontSize:"9px", color:"#ff073a" }}>{"\u26A0"} Mint authority active</div>}
                    {(tok.riskScore||0)>=50 && <div style={{ fontSize:"9px", color:"#ff073a" }}>{"\u2620"} Risk score: {tok.riskScore}</div>}
                    {(tok.topHolderPct||0)>=20 && <div style={{ fontSize:"9px", color:"#ff6600" }}>{"\uD83D\uDC0B"} Top holder: {Math.round(tok.topHolderPct)}%</div>}
                  </div>
                )}

                {/* Portfolio entry if in port */}
                {portEntry && (
                  <div>
                    <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:"7px", color:"#39ff14", letterSpacing:"2px", marginBottom:4, marginTop:4 }}>YOUR POSITION</div>
                    <div style={{ fontSize:"9px", color:"#8899bb" }}>Entry: {fmtK(portEntry.entryMcap)}</div>
                    <div style={{ fontSize:"9px", color:"#8899bb" }}>Current: {fmtK(tok.mcap||0)}</div>
                    <div style={{ fontSize:"9px", color:((tok.mcap||0)>portEntry.entryMcap)?"#39ff14":"#ff073a", fontWeight:700 }}>
                      P&L: {portEntry.entryMcap > 0 ? fmtPct(((tok.mcap||0) - portEntry.entryMcap) / portEntry.entryMcap * 100) : "—"}
                    </div>
                    <div style={{ fontSize:"9px", color:"#ffd700" }}>ATH: {fmtK(portEntry.athMcap)} ({portEntry.entryMcap>0?(portEntry.athMcap/portEntry.entryMcap).toFixed(1)+"x":"—"})</div>
                    <div style={{ fontSize:"8px", color:"#667799" }}>Held: {fmtAge(Date.now() - (portEntry.entryTime || Date.now()))}</div>
                  </div>
                )}

                {/* Intel overlays */}
                {intel?.hotClusterTokens?.has(tok.addr) && (
                  <div style={{ fontSize:"9px", color:"#bf00ff", marginTop:4 }}>{"\uD83D\uDD17"} Active in wallet cluster</div>
                )}
                {intel?.devFlags?.[tok.deployer] && (
                  <div style={{ fontSize:"9px", color:intel.devFlags[tok.deployer].flagged?"#ff073a":"#39ff14", marginTop:2 }}>
                    {intel.devFlags[tok.deployer].flagged ? "\uD83D\uDEA9" : "\u2705"} Dev: {intel.devFlags[tok.deployer].tier}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      <style>{"\
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }\
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Share+Tech+Mono&display=swap');\
      "}</style>
    </div>
  );
}


// ─────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────

function Panel({ title, color, children, style, count }) {
  return (
    <div style={{ background:"rgba(255,255,255,0.015)", border:"1px solid "+color+"18", borderTop:"2px solid "+color+"40", borderRadius:4, padding:"8px 10px", ...(style||{}) }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
        <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:"8px", letterSpacing:"2px", color:color, fontWeight:700, opacity:0.8 }}>{title}</div>
        {count != null && <span style={{ fontFamily:"Orbitron,sans-serif", fontSize:"9px", color:color, fontWeight:700 }}>{count}</span>}
      </div>
      {children}
    </div>
  );
}

function Side({ title, color, children }) {
  return (
    <div>
      <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:"7px", letterSpacing:"2px", color:color, marginBottom:5, borderBottom:"1px solid "+color+"20", paddingBottom:3, fontWeight:700 }}>{title}</div>
      <div style={{ display:"flex", flexDirection:"column", gap:2 }}>{children}</div>
    </div>
  );
}

function Empty({ children }) {
  return <div style={{ fontSize:"9px", color:"#1e1e3a", textAlign:"center", padding:"8px 0" }}>{children}</div>;
}

function TokName({ name, addr, toks, onSelect }) {
  return (
    <span onClick={function() {
      if (!onSelect || !addr) return;
      var tok = (toks || []).find(function(t) { return t.addr === addr; });
      if (tok) onSelect(tok);
    }}
    style={{ cursor: onSelect && addr ? "pointer" : "default", fontSize:"10px", color:"#c0c0e0", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", borderBottom: onSelect && addr ? "1px dotted rgba(0,255,255,0.2)" : "none" }}
    title={addr || ""}>{name}</span>
  );
}

function Btn({ children, onClick, color, active }) {
  return (
    <button onClick={onClick}
      style={{ background:active?"rgba(57,255,20,0.08)":"rgba(255,255,255,0.02)", border:"1px solid "+(color||"#667799")+"40", color:color||"#667799", fontSize:"9px", padding:"3px 8px", borderRadius:"3px", cursor:"pointer", fontFamily:"Orbitron,sans-serif", fontWeight:700, letterSpacing:"1px" }}>
      {children}
    </button>
  );
}
