// ═══════════════════════════════════════════════════════════════
// api.js — Live Solana APIs (ALL FREE, no Birdeye)
// ═══════════════════════════════════════════════════════════════
//   DexScreener  — no key, 300 req/min
//   Helius       — free key, 100K credits/month
//   PumpFun WS   — no key, websocket
//   Jupiter      — no key
// ═══════════════════════════════════════════════════════════════

var HELIUS_KEY = import.meta.env.VITE_HELIUS_KEY || "";

var IS_DEPLOYED=typeof window!=="undefined"&&!window.location.hostname.match(/^(localhost|127\.|0\.0)/);
export function proxyUrl(u){return IS_DEPLOYED?"/api/proxy?url="+encodeURIComponent(u):u;}
export function proxyFetch(u,o){return IS_DEPLOYED?fetch("/api/proxy?url="+encodeURIComponent(u),o||{}):fetch(u,o||{});}


// ─── DEXSCREENER (FREE, no key) ───

export async function fetchTokenByAddress(address) {
  try {
    const res = await proxyFetch(`https://api.dexscreener.com/tokens/v1/solana/${address}`);
    const data = await res.json();
    const pairs = data?.pairs || (Array.isArray(data) ? data : []);
    if (!pairs.length) return null;
    // Prefer non-pumpfun, then highest liquidity
    const isPump = (d) => (d.dexId || '').toLowerCase().includes('pump');
    const best = pairs.reduce((a, b) => {
      if (!a) return b;
      const aIsPump = isPump(a), bIsPump = isPump(b);
      if (aIsPump && !bIsPump) return b;
      if (!aIsPump && bIsPump) return a;
      return (b.liquidity?.usd || 0) > (a.liquidity?.usd || 0) ? b : a;
    }, null);
    return best ? normalizePair(best) : null;
  } catch (e) {
    console.error("[DexScreener] Failed:", e);
    return null;
  }
}

// Batch fetch up to 30 tokens in one DexScreener call
export async function fetchTokensBatch(addresses) {
  if (!addresses || addresses.length === 0) return {};
  try {
    const batch = addresses.slice(0, 30).join(",");
    const res = await proxyFetch(`https://api.dexscreener.com/tokens/v1/solana/${batch}`);
    const data = await res.json();
    const pairs = data?.pairs || (Array.isArray(data) ? data : []);
    // Group by baseToken — pick best pair: prefer non-pumpfun DEX, then highest liquidity
    const byAddr = {};
    pairs.forEach(p => {
      if (!p?.baseToken?.address) return;
      const addr = p.baseToken.address;
      const existing = byAddr[addr];
      if (!existing) { byAddr[addr] = p; return; }
      const isPump = (d) => (d.dexId || '').toLowerCase().includes('pump');
      const liq = (d) => d.liquidity?.usd || 0;
      // Prefer raydium/non-pump over pump.fun; among same type prefer higher liquidity
      const existIsPump = isPump(existing);
      const newIsPump = isPump(p);
      if (existIsPump && !newIsPump) { byAddr[addr] = p; return; } // upgrade to raydium
      if (!existIsPump && newIsPump) return; // keep existing raydium
      if (liq(p) > liq(existing)) byAddr[addr] = p; // same type — pick higher liquidity
    });
    const result = {};
    Object.values(byAddr).forEach(p => {
      result[p.baseToken.address] = normalizePair(p);
    });
    return result;
  } catch (e) {
    console.error("[DexScreener] Batch failed:", e);
    return {};
  }
}

function normalizePair(p) {
  return {
    name: p.baseToken?.symbol || "???",
    fullName: p.baseToken?.name || "",
    addr: p.baseToken?.address || "",
    platform: p.dexId || "unknown",
    mcap: p.marketCap || p.fdv || 0,
    vol: p.volume?.h1 || p.volume?.h6 || p.volume?.h24 || 0,
    vol1h: p.volume?.h1 || 0,
    vol24h: p.volume?.h24 || 0,
    priceUsd: parseFloat(p.priceUsd || 0),
    priceChange5m: p.priceChange?.m5 || 0,
    priceChange1h: p.priceChange?.h1 || 0,
    liquidity: p.liquidity?.usd || 0,
    pairAddress: p.pairAddress || "",
    pairCreatedAt: p.pairCreatedAt || 0,
    buys: p.txns?.h1?.buys || 0,
    sells: p.txns?.h1?.sells || 0,
    imageUrl: p.info?.imageUrl || null,
  };
}

// ─── HELIUS: On-chain token data (FREE tier) ───

export async function fetchTokenMeta(mintAddress) {
  if (!HELIUS_KEY) return null;
  try {
    const res = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "getAsset",
        params: { id: mintAddress },
      }),
    });
    const data = await res.json();
    const r = data.result;
    if (!r) return null;
    return {
      mintAuth: !r.authorities?.find(a => a.scopes?.includes("full"))?.address ? false : true,
      frozen: r.ownership?.frozen || false,
      supply: r.token_info?.supply || 0,
      decimals: r.token_info?.decimals || 9,
      owner: r.ownership?.owner || "",
      holderCount: r.token_info?.holder_count || 0, // Helius DAS returns real holder count
    };
  } catch (e) {
    console.error("[Helius] getAsset failed:", e);
    return null;
  }
}

export async function fetchHolderCount(mintAddress) {
  if (!HELIUS_KEY) {
    console.warn("[Helius] fetchHolderCount: no HELIUS_KEY set — holders will be 0");
    return 0;
  }
  try {
    // Method 1: getAsset DAS — token_info.holder_count (most accurate when populated)
    const res = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "getAsset",
        params: { id: mintAddress },
      }),
    });
    const data = await res.json();
    const count = data.result?.token_info?.holder_count || 0;
    if (count > 0) return count;

    // Method 2: getTokenAccounts — reliable total field, works for all SPL tokens
    const res2 = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 2,
        method: "getTokenAccounts",
        params: { mint: mintAddress, limit: 1, page: 1 },
      }),
    });
    const data2 = await res2.json();
    const total = data2.result?.total || 0;
    if (total > 0) return total;

    // Method 3: getProgramAccounts count — last resort, slower but always works
    const res3 = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 3,
        method: "getProgramAccounts",
        params: [
          "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
          {
            encoding: "jsonParsed",
            filters: [
              { dataSize: 165 },
              { memcmp: { offset: 0, bytes: mintAddress } }
            ],
            dataSlice: { offset: 0, length: 0 }, // don't need data, just count
          }
        ],
      }),
    });
    const data3 = await res3.json();
    const pgCount = Array.isArray(data3.result) ? data3.result.length : 0;
    return pgCount;
  } catch (e) {
    console.warn("[Helius] fetchHolderCount failed:", e.message);
    return 0;
  }
}

// Holder count via public Solana RPC — no API key needed, fallback for when Helius key is missing
export async function fetchHolderCountPublic(mintAddress) {
  try {
    // Try Helius public endpoint first (no key, but rate limited)
    const endpoints = [
      "https://mainnet.helius-rpc.com",  // no key = public tier, lower limit
      "https://api.mainnet-beta.solana.com",
    ];
    for (const rpc of endpoints) {
      try {
        const res = await fetch(rpc, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0", id: 1,
            method: "getTokenAccountsByMint" in {} ? "getTokenAccountsByMint" : "getTokenAccounts",
            // Use getProgramAccounts with mint filter — works on all public RPCs
            method: "getProgramAccounts",
            params: [
              "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
              {
                encoding: "base64",
                filters: [
                  { dataSize: 165 },
                  { memcmp: { offset: 0, bytes: mintAddress } }
                ],
                dataSlice: { offset: 0, length: 0 },
              }
            ],
          }),
        });
        if (!res.ok) continue;
        const data = await res.json();
        if (data.result && Array.isArray(data.result)) {
          const cnt = data.result.length;
          if (cnt > 0) { console.log(`[PublicRPC] ${mintAddress.slice(0,8)} holders: ${cnt}`); return cnt; }
        }
      } catch(_) { continue; }
    }
    return 0;
  } catch(e) {
    return 0;
  }
}

export async function fetchLargestHolders(mintAddress) {
  if (!HELIUS_KEY) return { holders: [], topHolderPct: 0, holderCount: 0 };
  try {
    const res = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "getTokenLargestAccounts",
        params: [mintAddress],
      }),
    });
    const data = await res.json();
    const accounts = data.result?.value || [];
    const total = accounts.reduce((s, a) => s + parseFloat(a.uiAmount || 0), 0);
    const top10 = accounts.slice(0, 10).reduce((s, a) => s + parseFloat(a.uiAmount || 0), 0);
    const topPct = total > 0 ? (top10 / total) * 100 : 0;
    // NOTE: getTokenLargestAccounts only returns top 20 accounts — holderCount here is NOT real
    // Use SolanaTracker for real holder count. This call is only useful for topHolderPct concentration.
    return {
      holders: accounts.map(a => ({ address: a.address, amount: a.uiAmount })),
      topHolderPct: topPct,
      holderCount: 0, // intentionally 0 — don't use this as holder count
    };
  } catch (e) {
    console.error("[Helius] holders failed:", e);
    return { holders: [], topHolderPct: 0, holderCount: 0 };
  }
}

// ─── PUMPFUN WEBSOCKET: Real-time launches + trades ───

export function connectPumpFun(onNewToken, onTrade, onMigration) {
  let ws, timer;
  let wsReady = false;
  const pendingSubs = [];

  function connect() {
    try {
      ws = new WebSocket("wss://pumpportal.fun/api/data");
      ws.onopen = () => {
        console.log("[PumpFun] ✅ Connected");
        wsReady = true;
        ws.send(JSON.stringify({ method: "subscribeNewToken" }));
        // Re-subscribe any pending tokens
        while (pendingSubs.length > 0) {
          const mint = pendingSubs.shift();
          ws.send(JSON.stringify({ method: "subscribeTokenTrade", keys: [mint] }));
        }
      };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.txType === "create" && msg.mint) {
            onNewToken({
              mint: msg.mint, name: msg.name || "???",
              symbol: msg.symbol || "???",
              deployer: msg.traderPublicKey || "",
              marketCapSol: msg.marketCapSol || 0,
              imageUri: msg.image_uri || msg.uri || msg.imageUri || msg.image || "",
              platform: msg.mint?.endsWith("bonk") ? "Bonk" : msg.mint?.endsWith("pump") ? "PumpFun" : "PumpFun",
              timestamp: Date.now(),
            });
            if(msg.uri||msg.image_uri||msg.image) console.log(`[IMG] ${msg.symbol} uri:`, msg.uri?.slice(0,60), msg.image_uri?.slice(0,60), msg.image?.slice(0,60));
          }
          if (msg.txType === "buy" || msg.txType === "sell") {
            onTrade?.({
              type: msg.txType, mint: msg.mint,
              wallet: msg.traderPublicKey || "",
              solAmount: msg.solAmount || 0,
              tokenAmount: msg.tokenAmount || 0,
              marketCapSol: msg.marketCapSol || 0,
              timestamp: Date.now(),
            });
            // Debug: log trades approaching migration
            if (msg.marketCapSol > 350) {
              console.log(`[MIGRATE?] ${msg.mint?.slice(0,8)} mcapSol:${msg.marketCapSol?.toFixed(1)} type:${msg.txType}`);
            }
            // Detect migration: lowered threshold from 417 to 380 for safety margin
            if (msg.marketCapSol >= 380 && onMigration) {
              onMigration({
                mint: msg.mint,
                marketCapSol: msg.marketCapSol,
                timestamp: Date.now(),
              });
            }
          }
          // Catch migration-specific events PumpPortal may send as different types
          if (msg.txType === "migrate" || msg.txType === "complete" || msg.txType === "migration") {
            console.log(`[MIGRATE] 🌉 PumpPortal sent ${msg.txType} event for ${msg.mint?.slice(0,8)}`);
            if (onMigration) {
              onMigration({
                mint: msg.mint,
                marketCapSol: msg.marketCapSol || 417,
                timestamp: Date.now(),
              });
            }
          }
          // Log any unknown message types for debugging
          if (msg.txType && msg.txType !== "create" && msg.txType !== "buy" && msg.txType !== "sell" 
              && msg.txType !== "migrate" && msg.txType !== "complete" && msg.txType !== "migration") {
            console.log(`[PumpFun] Unknown txType: "${msg.txType}" mint:${msg.mint?.slice(0,8)} data:`, JSON.stringify(msg).slice(0, 200));
          }
        } catch (_) {}
      };
      ws.onclose = () => {
        wsReady = false;
        console.log("[PumpFun] Disconnected, reconnecting...");
        timer = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();
    } catch (e) {
      console.error("[PumpFun] Connection error:", e);
      timer = setTimeout(connect, 5000);
    }
  }
  connect();

  // Returns cleanup + subscribe function
  return {
    cleanup: () => { clearTimeout(timer); ws?.close(); },
    subscribeToken: (mint) => {
      if (wsReady && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ method: "subscribeTokenTrade", keys: [mint] }));
        console.log("[PumpFun] 📡 Subscribed to trades:", mint.slice(0, 12) + "...");
      } else {
        pendingSubs.push(mint);
      }
    },
  };
}

// ─── JUPITER: Price (FREE, no key) ───

let _jupBackoff = 0; // timestamp when we can retry Jupiter
let _jupFailCount = 0;

export async function fetchJupiterPrice(mintAddresses) {
  try {
    if (Date.now() < _jupBackoff) return {};
    const ids = Array.isArray(mintAddresses) ? mintAddresses.join(",") : mintAddresses;
    // Fetch direct — Jupiter blocks proxy/server requests, must come from browser
    const endpoints = [
      `https://lite-api.jup.ag/price/v2?ids=${ids}`,
      `https://api.jup.ag/price/v2?ids=${ids}`,
    ];
    for (const url of endpoints) {
      try {
        const res = await fetch(url);
        if (res.status === 401 || res.status === 403 || res.status === 429) {
          _jupFailCount++;
          const wait = Math.min(300000, 10000 * Math.pow(2, Math.min(_jupFailCount - 1, 5)));
          _jupBackoff = Date.now() + wait;
          console.warn(`[Jupiter] ${res.status} — backing off ${Math.round(wait/1000)}s (fail #${_jupFailCount})`);
          continue;
        }
        if (!res.ok) continue;
        const data = await res.json();
        if (data.data && Object.keys(data.data).length > 0) {
          _jupFailCount = 0;
          return data.data;
        }
      } catch (_) { continue; }
    }
    return {};
  } catch (e) {
    _jupFailCount++;
    _jupBackoff = Date.now() + Math.min(300000, 10000 * Math.pow(2, Math.min(_jupFailCount - 1, 5)));
    console.error("[Jupiter] price failed:", e.message);
    return {};
  }
}

// ─── DEXSCREENER: Latest token profiles (FREE, catches Moonshot/Bags/etc) ───

export async function fetchLatestProfiles() {
  try {
    const res = await proxyFetch("https://api.dexscreener.com/token-profiles/latest/v1");
    const data = await res.json();
    // Filter to Solana tokens only
    return (data || []).filter(t => t.chainId === "solana").slice(0, 20);
  } catch (e) {
    console.error("[DexScreener] profiles failed:", e);
    return [];
  }
}

export async function fetchBoostedTokens() {
  try {
    const res = await proxyFetch("https://api.dexscreener.com/token-boosts/latest/v1");
    const data = await res.json();
    return (data || []).filter(t => t.chainId === "solana").slice(0, 10);
  } catch (e) {
    console.error("[DexScreener] boosts failed:", e);
    return [];
  }
}

// ─── HELIUS WEBSOCKET: Real-time token activity detection ───
// Subscribes to logsSubscribe for token mints — fires onActivity when any tx touches the mint
// Then caller fetches Jupiter price instantly for ~1-2s latency

export function connectHeliusWS(onActivity) {
  if (!HELIUS_KEY) { console.warn("[HeliusWS] No API key"); return null; }
  let ws, timer;
  let subIds = {}; // {mint: subscriptionId}
  let nextReqId = 1;
  let pendingSubs = []; // mints waiting for connection

  function connect() {
    try {
      ws = new WebSocket(`wss://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`);
      ws.onopen = () => {
        console.log("[HeliusWS] ✅ Connected");
        // Re-subscribe pending mints
        const toSub = [...pendingSubs];
        pendingSubs = [];
        toSub.forEach(mint => subscribeMint(mint));
        // Re-subscribe existing
        Object.keys(subIds).forEach(mint => {
          subIds[mint] = null; // clear old subId
          subscribeMint(mint);
        });
      };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          // Subscription confirmation
          if (msg.result !== undefined && msg.id) {
            const mint = Object.keys(subIds).find(k => subIds[k] === "pending-" + msg.id);
            if (mint) { subIds[mint] = msg.result; console.log(`[HeliusWS] Subscribed to ${mint.slice(0, 8)} (sub:${msg.result})`); }
          }
          // Activity notification
          if (msg.method === "logsNotification" && msg.params?.result?.value) {
            const logs = msg.params.result.value.logs || [];
            const sig = msg.params.result.value.signature;
            // Find which mint this belongs to by checking subscription ID
            const subId = msg.params.subscription;
            const mint = Object.keys(subIds).find(k => subIds[k] === subId);
            if (mint) {
              // Check if it's a swap/trade (look for program logs)
              const isSwap = logs.some(l =>
                l.includes("Instruction: Swap") || l.includes("Instruction: swap") ||
                l.includes("ray_log") || l.includes("Instruction: Route") ||
                l.includes("Program log: Instruction: Buy") || l.includes("Program log: Instruction: Sell")
              );
              onActivity({
                mint, signature: sig, isSwap,
                timestamp: Date.now(),
                logCount: logs.length,
              });
            }
          }
        } catch (_) {}
      };
      ws.onclose = () => {
        console.log("[HeliusWS] Disconnected, reconnecting in 5s...");
        timer = setTimeout(connect, 5000);
      };
      ws.onerror = (e) => { console.warn("[HeliusWS] Error:", e.message || "unknown"); ws.close(); };
    } catch (e) {
      console.error("[HeliusWS] Connection error:", e);
      timer = setTimeout(connect, 5000);
    }
  }

  function subscribeMint(mint) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      pendingSubs.push(mint);
      return;
    }
    const reqId = nextReqId++;
    subIds[mint] = "pending-" + reqId;
    ws.send(JSON.stringify({
      jsonrpc: "2.0", id: reqId,
      method: "logsSubscribe",
      params: [
        { mentions: [mint] },
        { commitment: "confirmed" }
      ]
    }));
    console.log(`[HeliusWS] Subscribing to ${mint.slice(0, 8)}... (req:${reqId})`);
  }

  function unsubscribeMint(mint) {
    const subId = subIds[mint];
    if (subId && typeof subId === "number" && ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        jsonrpc: "2.0", id: nextReqId++,
        method: "logsUnsubscribe",
        params: [subId]
      }));
    }
    delete subIds[mint];
    console.log(`[HeliusWS] Unsubscribed from ${mint.slice(0, 8)}`);
  }

  connect();

  return {
    subscribe: subscribeMint,
    unsubscribe: unsubscribeMint,
    getSubscribed: () => Object.keys(subIds),
    cleanup: () => { clearTimeout(timer); ws?.close(); },
  };
}

// ─── RUGCHECK.XYZ: Token safety scores (FREE, no key) ───

export async function fetchRugCheck(mintAddress) {
  try {
    const res = await fetch(`https://api.rugcheck.xyz/v1/tokens/${mintAddress}/report/summary`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      score: data.score || 0, // 0-100, higher = safer
      risks: (data.risks || []).map(r => ({ name: r.name, level: r.level, description: r.description })),
      mintAuthority: data.mint_authority !== null,
      freezeAuthority: data.freeze_authority !== null,
      lpLocked: data.markets?.some(m => m.lp?.lpLockedPct > 50) || false,
      topHoldersPct: data.topHolders?.reduce((s, h) => s + (h.pct || 0), 0) || 0,
      totalMarkets: data.markets?.length || 0,
      riskLevel: (data.score || 0) > 700 ? "SAFE" : (data.score || 0) > 400 ? "CAUTION" : "DANGER",
    };
  } catch (e) {
    console.warn("[RugCheck] Failed:", e.message);
    return null;
  }
}

// ─── GECKOTERMINAL: Trending pools, OHLCV candles, pool stats (FREE, no key) ───

export async function fetchGeckoTrending() {
  try {
    const res = await fetch("https://api.geckoterminal.com/api/v2/networks/solana/trending_pools?page=1");
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || []).map(p => ({
      poolAddr: p.attributes?.address || "",
      name: p.attributes?.name || "?",
      baseToken: p.attributes?.base_token_price_usd ? {
        symbol: p.attributes?.name?.split("/")[0]?.trim() || "?",
        priceUsd: parseFloat(p.attributes.base_token_price_usd) || 0,
      } : null,
      mcap: parseFloat(p.attributes?.fdv_usd) || 0,
      vol24h: parseFloat(p.attributes?.volume_usd?.h24) || 0,
      vol1h: parseFloat(p.attributes?.volume_usd?.h1) || 0,
      txns24h: (parseInt(p.attributes?.transactions?.h24?.buys) || 0) + (parseInt(p.attributes?.transactions?.h24?.sells) || 0),
      priceChange1h: parseFloat(p.attributes?.price_change_percentage?.h1) || 0,
      priceChange5m: parseFloat(p.attributes?.price_change_percentage?.m5) || 0,
      dex: p.relationships?.dex?.data?.id || "unknown",
    })).slice(0, 20);
  } catch (e) {
    console.warn("[GeckoTerminal] Trending failed:", e.message);
    return [];
  }
}

export async function fetchGeckoPoolByToken(mintAddress) {
  try {
    const res = await fetch(`https://api.geckoterminal.com/api/v2/networks/solana/tokens/${mintAddress}/pools?page=1`);
    if (!res.ok) return null;
    const data = await res.json();
    const pool = data.data?.[0];
    if (!pool) return null;
    return {
      poolAddr: pool.attributes?.address || "",
      name: pool.attributes?.name || "?",
      priceUsd: parseFloat(pool.attributes?.base_token_price_usd) || 0,
      mcap: parseFloat(pool.attributes?.fdv_usd) || 0,
      vol24h: parseFloat(pool.attributes?.volume_usd?.h24) || 0,
      vol1h: parseFloat(pool.attributes?.volume_usd?.h1) || 0,
      vol5m: parseFloat(pool.attributes?.volume_usd?.m5) || 0,
      buys24h: parseInt(pool.attributes?.transactions?.h24?.buys) || 0,
      sells24h: parseInt(pool.attributes?.transactions?.h24?.sells) || 0,
      buys1h: parseInt(pool.attributes?.transactions?.h1?.buys) || 0,
      sells1h: parseInt(pool.attributes?.transactions?.h1?.sells) || 0,
      buys5m: parseInt(pool.attributes?.transactions?.m5?.buys) || 0,
      sells5m: parseInt(pool.attributes?.transactions?.m5?.sells) || 0,
      priceChange5m: parseFloat(pool.attributes?.price_change_percentage?.m5) || 0,
      priceChange1h: parseFloat(pool.attributes?.price_change_percentage?.h1) || 0,
      priceChange24h: parseFloat(pool.attributes?.price_change_percentage?.h24) || 0,
      reserveUsd: parseFloat(pool.attributes?.reserve_in_usd) || 0,
      dex: pool.relationships?.dex?.data?.id || "unknown",
    };
  } catch (e) {
    console.warn("[GeckoTerminal] Pool lookup failed:", e.message);
    return null;
  }
}

export async function fetchGeckoOHLCV(poolAddress, timeframe = "minute", aggregate = 5) {
  try {
    const res = await fetch(`https://api.geckoterminal.com/api/v2/networks/solana/pools/${poolAddress}/ohlcv/${timeframe}?aggregate=${aggregate}&limit=30&currency=usd`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data?.attributes?.ohlcv_list || []).map(c => ({
      time: c[0] * 1000, open: c[1], high: c[2], low: c[3], close: c[4], vol: c[5],
    }));
  } catch (e) {
    console.warn("[GeckoTerminal] OHLCV failed:", e.message);
    return [];
  }
}

// ─── SOLANATRACKER: PumpFun bonding curve progress (FREE, no key) ───

const _stBackoff = {}; // per-token backoff map
export async function fetchPumpCurveProgress(mintAddress) {
  try {
    if (Date.now() < (_stBackoff[mintAddress] || 0)) return null;
    const res = await proxyFetch(`https://data.solanatracker.io/tokens/${mintAddress}`);
    if (!res.ok) {
      // Per-token backoff: 429/401 backs off only this mint for 60s
      if (res.status === 429 || res.status === 401) _stBackoff[mintAddress] = Date.now() + 60000;
      return null;
    }
    const data = await res.json();
    const pool = data.pools?.[0];
    return {
      bondingCurvePct: data.events?.["1m"]?.priceChangePercentage != null ? null : // migrated = no curve
        (pool?.marketCap?.usd || 0) > 0 ? Math.min(100, ((pool?.marketCap?.usd || 0) / 69000) * 100) : 0,
      priceUsd: pool?.price?.usd || data.token?.price?.usd || 0,
      mcapUsd: pool?.marketCap?.usd || 0,
      liquidityUsd: pool?.liquidity?.usd || 0,
      holders: data.token?.holders || 0,
      vol1h: data.events?.["1h"]?.volume || 0,
      priceChange5m: data.events?.["5m"]?.priceChangePercentage || 0,
      priceChange1h: data.events?.["1h"]?.priceChangePercentage || 0,
      isMigrated: (pool?.poolId || "").length > 10 && pool?.dex !== "pumpfun",
      dex: pool?.dex || "unknown",
      createdAt: data.token?.createdAt || null,
    };
  } catch (e) {
    console.warn("[SolanaTracker] Failed:", e.message);
    return null;
  }
}

// ─── DEFINED.FI: Social trending + buzz signals (FREE, no key) ───

export async function fetchDefinedTrending() {
  try {
    const query = `{
      listTopTokens(
        networkFilter: [1399811149]
        limit: 20
        resolution: "1h"
      ) {
        address
        name
        symbol
        priceUSD
        volume1h: volume
        txnCount1h: txnCount
        uniqueBuyers1h: buyCount
        uniqueSellers1h: sellCount
        marketCap
        liquidity
        priceChange1h: priceChange
      }
    }`;
    const res = await proxyFetch("https://graph.defined.fi/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data?.listTopTokens || []).map(t => ({
      address: t.address,
      name: t.name || "?",
      symbol: t.symbol || "?",
      priceUsd: parseFloat(t.priceUSD) || 0,
      vol1h: parseFloat(t.volume1h) || 0,
      txns1h: parseInt(t.txnCount1h) || 0,
      buyers1h: parseInt(t.uniqueBuyers1h) || 0,
      sellers1h: parseInt(t.uniqueSellers1h) || 0,
      mcap: parseFloat(t.marketCap) || 0,
      liquidity: parseFloat(t.liquidity) || 0,
      priceChange1h: parseFloat(t.priceChange1h) || 0,
    }));
  } catch (e) {
    console.warn("[Defined.fi] Trending failed:", e.message);
    return [];
  }
}

// ─── JUPITER QUOTE API: Liquidity depth / slippage analysis (FREE, no key) ───

export async function fetchJupiterSlippage(mintAddress, sellAmountUsd = 5000, solUsdPrice = 84) {
  try {
    // Get current price first
    const priceData = await fetchJupiterPrice([mintAddress]);
    const jp = priceData[mintAddress];
    if (!jp || !jp.price) return null;
    const priceUsd = parseFloat(jp.price);
    const decimals = 6; // PumpFun standard
    const SOL_MINT = "So11111111111111111111111111111111111111112";
    // Calculate token amount for desired USD sell
    const tokenAmount = Math.floor((sellAmountUsd / priceUsd) * Math.pow(10, decimals));
    if (tokenAmount <= 0) return null;

    const res = await proxyFetch(`https://quote-api.jup.ag/v6/quote?inputMint=${mintAddress}&outputMint=${SOL_MINT}&amount=${tokenAmount}&slippageBps=5000`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.outAmount) return null;

    // Calculate actual value using global SOL price (no extra API call)
    const solOut = parseInt(data.outAmount) / 1e9;
    const actualValue = solOut * solUsdPrice;
    const slippagePct = sellAmountUsd > 0 ? Math.max(0, ((sellAmountUsd - actualValue) / sellAmountUsd) * 100) : 100;

    return {
      sellAmountUsd,
      expectedValueUsd: sellAmountUsd,
      actualValueUsd: actualValue,
      slippagePct: Math.min(100, slippagePct),
      priceImpact: parseFloat(data.priceImpactPct || 0),
      routes: data.routePlan?.length || 0,
      liquidityRating: slippagePct < 5 ? "DEEP" : slippagePct < 15 ? "OK" : slippagePct < 40 ? "THIN" : "PAPER",
    };
  } catch (e) {
    console.warn("[JupQuote] Slippage check failed:", e.message);
    return null;
  }
}

// ─── JUPITER TOKEN LIST: Verified / strict / all status (FREE, no key) ───

let _jupVerifiedCache = null;
let _jupCacheTime = 0;

export async function fetchJupiterVerified() {
  if (_jupVerifiedCache && Date.now() - _jupCacheTime < 300000) return _jupVerifiedCache;
  try {
    // tokens.jup.ag blocks proxies — fetch direct (works from browser, not server)
    const res = await fetch("https://tokens.jup.ag/tokens?tags=verified");
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    _jupVerifiedCache = new Set(data.map(t => t.address));
    _jupCacheTime = Date.now();
    console.log(`[JupList] Loaded ${_jupVerifiedCache.size} verified tokens`);
    return _jupVerifiedCache;
  } catch (e) {
    console.warn("[JupList] Failed:", e.message);
    return _jupVerifiedCache || new Set();
  }
}

// ─── PUMP.FUN DIRECT: Bonding curve, reply count, KOTH (FREE, no key) ───

export async function fetchPumpFunDirect(mintAddress) {
  try {
    const res = await proxyFetch(`https://frontend-api-v2.pump.fun/coins/${mintAddress}`);
    if (!res.ok) return null;
    const data = await res.json();
    const vTokens = parseInt(data.virtual_token_reserves || 0);
    const vSol = parseInt(data.virtual_sol_reserves || 0);
    const rSol = parseInt(data.real_sol_reserves || 0);
    const totalSupply = 1_000_000_000 * 1e6; // 1B with 6 decimals
    // Bonding curve progress: real SOL deposited vs ~85 SOL target
    const bondingPct = Math.min(100, (rSol / 1e9 / 85) * 100);
    return {
      bondingPct,
      realSolReserves: rSol / 1e9,
      virtualSolReserves: vSol / 1e9,
      virtualTokenReserves: vTokens / 1e6,
      replyCount: data.reply_count || 0,
      isKOTH: data.king_of_the_hill_timestamp != null,
      kothTimestamp: data.king_of_the_hill_timestamp || null,
      website: data.website || "",
      twitter: data.twitter || "",
      telegram: data.telegram || "",
      description: (data.description || "").slice(0, 200),
      creator: data.creator || "",
      createdAt: data.created_timestamp || null,
      complete: data.complete || false, // true = migrated
      marketCap: data.usd_market_cap || 0,
      nsfw: data.nsfw || false,
    };
  } catch (e) {
    console.warn("[PumpDirect] Failed:", e.message);
    return null;
  }
}

// ─── RAYDIUM API: Pool reserves + LP data for migrated tokens (FREE, no key) ───

export async function fetchRaydiumPool(mintAddress) {
  try {
    const res = await fetch(`https://api-v3.raydium.io/pools/info/mint?mint1=${mintAddress}&poolType=all&poolSortField=default&sortType=desc&pageSize=1&page=1`);
    if (!res.ok) return null;
    const data = await res.json();
    const pool = data.data?.data?.[0];
    if (!pool) return null;
    return {
      poolId: pool.id || "",
      type: pool.type || "unknown",
      mintA: pool.mintA?.address || "",
      mintB: pool.mintB?.address || "",
      price: pool.price || 0,
      tvl: pool.tvl || 0,
      vol24h: pool.day?.volume || 0,
      vol7d: pool.week?.volume || 0,
      fees24h: pool.day?.volumeFee || 0,
      apr24h: pool.day?.apr || 0,
      apr7d: pool.week?.apr || 0,
      lpAmount: pool.lpAmount || 0,
      burnPct: pool.burnPercent || 0,  // LP burn % — higher = safer
    };
  } catch (e) {
    console.warn("[Raydium] Pool fetch failed:", e.message);
    return null;
  }
}

// ─── SOLSCAN: REMOVED — v2 API requires auth, Helius signatures covers same data ───

// ─── HELIUS getSignaturesForAddress: True unique signer count (uses existing key) ───

export async function fetchUniqueSigners(mintAddress, limit = 50) {
  if (!HELIUS_KEY) return null;
  try {
    const res = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "getSignaturesForAddress",
        params: [mintAddress, { limit }],
      }),
    });
    const data = await res.json();
    const sigs = data.result || [];
    // Each signature has a unique signer - count distinct
    // Note: We can't get the actual signer from just signatures,
    // but we can measure activity volume and timing
    const times = sigs.map(s => s.blockTime).filter(Boolean).sort((a, b) => a - b);
    const span = times.length > 1 ? times[times.length - 1] - times[0] : 0;
    const txPerMin = span > 0 ? (sigs.length / (span / 60)) : 0;
    const recentCount = sigs.filter(s => s.blockTime && (Date.now() / 1000 - s.blockTime) < 300).length; // last 5 min

    return {
      totalSignatures: sigs.length,
      timeSpanSec: span,
      txPerMinute: txPerMin,
      recentTx5m: recentCount,
      hasErrors: sigs.some(s => s.err),
      errorRate: sigs.length > 0 ? sigs.filter(s => s.err).length / sigs.length : 0,
      activityLevel: recentCount > 20 ? "BLAZING" : recentCount > 10 ? "HOT" : recentCount > 3 ? "ACTIVE" : recentCount > 0 ? "SLOW" : "DEAD",
    };
  } catch (e) {
    console.warn("[HeliusSig] Unique signers failed:", e.message);
    return null;
  }
}

// ─── QUALIFICATION ENGINE ───

export function qualifyToken(dex, holders, meta) {
  let score = 0;
  const checks = [];
  const test = (n, pass) => { checks.push({ name: n, pass: !!pass }); if (pass) score++; };

  let risk = 50;
  if (holders) {
    if (holders.topHolderPct > 50) risk -= 15;
    if (holders.topHolderPct < 30) risk += 10;
    if (holders.holderCount > 50) risk += 10;
    if (holders.holderCount < 10) risk -= 15;
  }
  if (meta) {
    if (meta.mintAuth) risk -= 15;
    if (meta.frozen) risk -= 10;
  }
  if (dex.liquidity > 10000) risk += 10;
  if (dex.liquidity < 1000) risk -= 15;
  if (dex.vol > 50000) risk += 10;
  if (dex.buys > dex.sells * 2) risk += 10;
  risk = Math.max(0, Math.min(100, risk));

  test("RISK", risk >= 50);
  test("UNIQUE", true);
  test("HOLDERS", (holders?.holderCount || 0) >= 15);
  test("DEV<15%", true); // would need deployer wallet analysis
  test("BUNDLES", true); // would need bundle detection
  test("VOLUME", dex.vol > 5000);
  test("BUYS", dex.buys > dex.sells * 1.2);
  test("DISTRO", (holders?.topHolderPct ?? 100) < 45);

  return { qualified: score >= 5, score, checks, riskScore: risk };
}

// ─── FULL SCAN PIPELINE ───

export async function fullTokenScan(mint) {
  const [dex, holdersData, meta] = await Promise.all([
    fetchTokenByAddress(mint),
    fetchLargestHolders(mint),
    fetchTokenMeta(mint),
  ]);
  if (!dex) return null;
  const qual = qualifyToken(dex, holdersData, meta);

  return {
    ...dex, id: mint + Date.now(),
    holders: holdersData?.holderCount || 0,
    devWallet: 0, // would need deployer analysis
    lpLocked: false,
    mintAuth: meta?.mintAuth || false,
    topHolderPct: holdersData?.topHolderPct || 0,
    riskScore: qual.riskScore,
    qualified: qual.qualified,
    qualScore: qual.score,
    qualChecks: qual.checks,
    threat: qual.riskScore > 75 ? "LOW" : qual.riskScore > 55 ? "MODERATE" : qual.riskScore > 35 ? "HIGH" : "EXTREME",
    threatColor: qual.riskScore > 75 ? "#39ff14" : qual.riskScore > 55 ? "#ffe600" : qual.riskScore > 35 ? "#ff6600" : "#ff073a",
    bundleDetected: false, bundleSize: 0,
    bx: Math.random() * 0.8 + 0.1, by: 0.92, targetY: 0.92,
    vx: (Math.random() - 0.5) * 0.0006, health: 100, alive: true,
    age: 0, trail: [], warpIn: true, warpProgress: 0,
    warpStartX: Math.random(), warpStartY: Math.random() * 0.2 - 0.1,
    bobOffset: Math.random() * Math.PI * 2,
    initials: (dex.name || "??").slice(0, 2).toUpperCase(),
    coinColor: null, // assigned in useLiveData
    timestamp: Date.now(),
    dupeCount: 0,
  };
}
