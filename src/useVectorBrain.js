// ─── useVectorBrain.js ───
// Shared trading brain — stores memories to Supabase, retrieves for Claude context
// Free: no embedding API. Uses keyword/recency retrieval — works great for trading data.
// Heartbeat system shows friends when Cosmo is live vs offline.

var SB_URL = "https://yrmjphhfgduysoftnuxv.supabase.co";
var SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlybWpwaGhmZ2R1eXNvZnRudXh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MzI5MzAsImV4cCI6MjA4ODMwODkzMH0.scHhvTGiABJDybgbjgjilw8XuxOfmWPsqo4iytMZmio";

var SB_HEADERS = {
  'Content-Type': 'application/json',
  'apikey': SB_KEY,
  'Authorization': 'Bearer ' + SB_KEY,
};

// ─── SESSION ID ───
var _sessionId = null;
function getSessionId() {
  if (!_sessionId) _sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2);
  return _sessionId;
}

// ─── HEARTBEAT ───
export async function pingHeartbeat(memCount) {
  try {
    await fetch(SB_URL + '/rest/v1/brain_heartbeat', {
      method: 'POST',
      headers: Object.assign({}, SB_HEADERS, { 'Prefer': 'resolution=merge-duplicates' }),
      body: JSON.stringify({ id: 1, last_seen: new Date().toISOString(), memories_this_session: memCount || 0 }),
    });
  } catch (e) {}
}

export async function getHeartbeat() {
  try {
    var res = await fetch(SB_URL + '/rest/v1/brain_heartbeat?id=eq.1', { headers: SB_HEADERS });
    var data = await res.json();
    return data[0] || null;
  } catch (e) { return null; }
}

// ─── WRITE MEMORY ───
export async function writeMemory({ type, tokenAddr, tokenName, content, data }) {
  try {
    await fetch(SB_URL + '/rest/v1/memories', {
      method: 'POST',
      headers: SB_HEADERS,
      body: JSON.stringify({
        type: type,
        token_addr: tokenAddr || null,
        token_name: tokenName || null,
        content: content,
        data: data || {},
        session_id: getSessionId(),
      }),
    });
  } catch (e) {}
}

// ─── QUERY MEMORIES ───
// Fetches relevant memories based on query keywords + always includes recent ones
export async function queryMemories(queryText, limit) {
  limit = limit || 15;
  try {
    var q = (queryText || '').toLowerCase();

    // Keyword → type mapping
    var typeFilters = [];
    if (/lock|position|hold|entry/.test(q))            typeFilters.push('lock', 'unlock');
    if (/smart|wallet|whale|money/.test(q))            typeFilters.push('smart_wallet');
    if (/signal|score|elite|neural/.test(q))           typeFilters.push('signal');
    if (/rug|dead|died|outcome|result|exit|sold/.test(q)) typeFilters.push('outcome');
    if (/pattern|trend|cluster|history/.test(q))       typeFilters.push('pattern');

    // Always get recent memories
    var recentRes = await fetch(
      SB_URL + '/rest/v1/memories?order=created_at.desc&limit=' + limit,
      { headers: SB_HEADERS }
    );
    var recent = await recentRes.json();
    if (!Array.isArray(recent)) recent = [];

    // If type filters matched, also pull type-specific memories
    var typed = [];
    if (typeFilters.length > 0) {
      var typeRes = await fetch(
        SB_URL + '/rest/v1/memories?type=in.(' + typeFilters.join(',') + ')&order=created_at.desc&limit=8',
        { headers: SB_HEADERS }
      );
      typed = await typeRes.json();
      if (!Array.isArray(typed)) typed = [];
    }

    // Merge + dedup by id
    var seen = new Set();
    var merged = typed.concat(recent).filter(function(m) {
      if (!m || !m.id || seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });

    return merged.slice(0, limit);
  } catch (e) { return []; }
}

// ─── FORMAT FOR CLAUDE CONTEXT ───
export function formatMemoriesForContext(memories) {
  if (!memories || !memories.length) return '';
  var lines = memories.map(function(m) {
    var ago = Math.round((Date.now() - new Date(m.created_at)) / 60000);
    var timeStr = ago < 60 ? ago + 'm ago' : Math.round(ago / 60) + 'h ago';
    return '[' + timeStr + '] ' + m.content;
  });
  return '\n\n## Session Brain (' + memories.length + ' memories)\n' + lines.join('\n');
}

// ─── BRAIN STATUS LABEL ───
export function getBrainStatusDisplay(status, lastSeen) {
  if (status === 'live')    return { label: '🟢 BRAIN LIVE', color: '#39ff14' };
  if (status === 'offline') return { label: '🔴 BRAIN OFFLINE', color: '#ff4444' };
  if (!lastSeen)            return { label: '⚫ BRAIN UNKNOWN', color: '#888' };
  var minsAgo = Math.round((Date.now() - new Date(lastSeen)) / 60000);
  var timeStr = minsAgo < 60 ? minsAgo + 'm' : Math.round(minsAgo / 60) + 'h ' + (minsAgo % 60) + 'm';
  return { label: '🟡 BRAIN STALE — last update ' + timeStr + ' ago', color: '#ffaa00' };
}

// ─── REACT HOOK ───
import { useEffect, useRef, useState } from 'react';

export function useVectorBrain({ tokens }) {
  var [brainStatus, setBrainStatus] = useState({ status: 'checking', lastSeen: null, sessionMems: 0 });
  var memCount = useRef(0);
  var firedKeys = useRef(new Set());

  // Heartbeat ping every 30s
  useEffect(function() {
    pingHeartbeat(memCount.current);
    var iv = setInterval(function() { pingHeartbeat(memCount.current); }, 30000);
    return function() { clearInterval(iv); };
  }, []);

  // Brain status check every 60s
  useEffect(function() {
    function check() {
      getHeartbeat().then(function(hb) {
        if (!hb) { setBrainStatus({ status: 'offline', lastSeen: null, sessionMems: 0 }); return; }
        var msSince = Date.now() - new Date(hb.last_seen).getTime();
        var status = msSince < 90000 ? 'live' : msSince < 14400000 ? 'stale' : 'offline';
        setBrainStatus({ status: status, lastSeen: hb.last_seen, sessionMems: hb.memories_this_session || 0 });
      });
    }
    check();
    var iv = setInterval(check, 60000);
    return function() { clearInterval(iv); };
  }, []);

  // Write memories on notable events
  useEffect(function() {
    if (!tokens || !tokens.length) return;
    tokens.forEach(function(t) {

      // Lock event
      if (t.isLocked) {
        var lockKey = 'lock_' + t.addr;
        if (!firedKeys.current.has(lockKey)) {
          firedKeys.current.add(lockKey);
          writeMemory({
            type: 'lock',
            tokenAddr: t.addr,
            tokenName: t.name,
            content: 'LOCKED ' + t.name + ' at $' + Math.round((t.mcap || 0) / 1000) + 'K mcap — ' +
              (t.smartWalletCount || 0) + ' smart wallets, signal ' + (t.signalScore || 0) + '/100, ' +
              'vol $' + Math.round((t.volume || 0) / 1000) + 'K, grade ' + (t.deployGrade || '?'),
            data: { mcap: t.mcap, smartWallets: t.smartWalletCount, signal: t.signalScore, vol: t.volume },
          });
          memCount.current++;
        }
      }

      // Elite signal (≥88 score, ≥$8K mcap) — throttle to once per 5min per token
      if ((t.signalScore || 0) >= 88 && (t.mcap || 0) >= 8000) {
        var sigKey = 'sig_' + t.addr + '_' + Math.floor(Date.now() / 300000);
        if (!firedKeys.current.has(sigKey)) {
          firedKeys.current.add(sigKey);
          writeMemory({
            type: 'signal',
            tokenAddr: t.addr,
            tokenName: t.name,
            content: 'ELITE SIGNAL ' + t.name + ' — score ' + t.signalScore + '/100, mcap $' +
              Math.round((t.mcap || 0) / 1000) + 'K, ' + (t.smartWalletCount || 0) + ' smart wallets',
            data: { score: t.signalScore, mcap: t.mcap },
          });
          memCount.current++;
        }
      }

      // Smart wallet cluster (2+ wallets) — once per unique count change
      if ((t.smartWalletCount || 0) >= 2) {
        var swKey = 'sw_' + t.addr + '_' + t.smartWalletCount;
        if (!firedKeys.current.has(swKey)) {
          firedKeys.current.add(swKey);
          writeMemory({
            type: 'smart_wallet',
            tokenAddr: t.addr,
            tokenName: t.name,
            content: 'SMART MONEY ' + t.name + ' — ' + t.smartWalletCount +
              ' smart wallets buying, mcap $' + Math.round((t.mcap || 0) / 1000) + 'K',
            data: { count: t.smartWalletCount, mcap: t.mcap },
          });
          memCount.current++;
        }
      }
    });

    // Prune firedKeys if huge
    if (firedKeys.current.size > 1000) {
      var arr = Array.from(firedKeys.current);
      firedKeys.current = new Set(arr.slice(-600));
    }
  }, [tokens]);

  return { brainStatus: brainStatus, memCount: memCount.current };
}
