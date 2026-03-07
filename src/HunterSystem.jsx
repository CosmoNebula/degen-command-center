// ═══════════════════════════════════════════════════════════════
// HunterSystem.jsx — Degen Hunter RPG v2
// Supabase-backed profiles, 200+ items, full stat system
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback, useRef } from "react";

var _HS_SB_URL = "https://yrmjphhfgduysoftnuxv.supabase.co";
var _HS_SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlybWpwaGhmZ2R1eXNvZnRudXh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MzI5MzAsImV4cCI6MjA4ODMwODkzMH0.scHhvTGiABJDybgbjgjilw8XuxOfmWPsqo4iytMZmio";


import { STATS, RARITIES, ITEMS, LEVEL_TITLES, getLevelTitle, getLevel, xpForLevel, xpForNextLevel, calcGearScore, calcTotalStats, rollLoot } from './HunterData.js';

async function sbLoad(name){
  const r=await fetch(`${_HS_SB_URL}/rest/v1/hunter_profiles?name=eq.${encodeURIComponent(name)}&limit=1`,{headers:{apikey:_HS_SB_KEY,Authorization:`Bearer ${_HS_SB_KEY}`}});
  const d=await r.json();return Array.isArray(d)&&d.length>0?d[0]:null;
}
async function sbSave(p){
  const r=await fetch(`${_HS_SB_URL}/rest/v1/hunter_profiles?on_conflict=name`,{
    method:"POST",headers:{apikey:_HS_SB_KEY,Authorization:`Bearer ${_HS_SB_KEY}`,"Content-Type":"application/json",Prefer:"resolution=merge-duplicates"},
    body:JSON.stringify([{...p,updated_at:new Date().toISOString()}])});
  return r.ok;
}

function PixelChar({equipped,rank,scale=1}){
  const color=rank?.color||"#00ffff";const S=scale;const px=n=>`${n*S}px`;
  const helm=equipped.helmet?ITEMS.find(i=>i.id===equipped.helmet):null;
  const chest=equipped.chest?ITEMS.find(i=>i.id===equipped.chest):null;
  const legs=equipped.legs?ITEMS.find(i=>i.id===equipped.legs):null;
  const weapon=equipped.weapon?ITEMS.find(i=>i.id===equipped.weapon):null;
  const offhand=equipped.offhand?ITEMS.find(i=>i.id===equipped.offhand):null;
  const hc=helm?RARITIES[helm.rarity]?.color:"#444";
  const cc=chest?RARITIES[chest.rarity]?.color:"#2a2a4a";
  const lc=legs?RARITIES[legs.rarity]?.color:"#1a1a3a";
  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",position:"relative",width:px(80),height:px(170),flexShrink:0}}>
      <div style={{position:"absolute",bottom:0,left:"50%",transform:"translateX(-50%)",width:px(60),height:px(10),borderRadius:"50%",background:`radial-gradient(ellipse,${color}40,transparent 70%)`,filter:"blur(4px)"}}/>
      <div style={{width:px(34),height:px(22),marginTop:px(4),borderRadius:`${px(3)} ${px(3)} ${px(2)} ${px(2)}`,background:`linear-gradient(180deg,${hc}cc,${hc}88)`,border:`${px(1)} solid ${hc}`,boxShadow:`0 0 ${px(8)} ${hc}60`,display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>
        <div style={{width:px(22),height:px(8),borderRadius:px(2),background:"linear-gradient(135deg,rgba(0,255,255,0.6),rgba(0,100,200,0.8))",border:`${px(1)} solid rgba(0,255,255,0.5)`,boxShadow:`0 0 ${px(6)} rgba(0,255,255,0.8)`}}/>
        {helm&&<div style={{position:"absolute",top:-px(1),right:-px(4),fontSize:px(10)}}>{helm.icon}</div>}
      </div>
      <div style={{width:px(10),height:px(5),background:`${cc}aa`}}/>
      <div style={{display:"flex",alignItems:"flex-start",gap:px(2)}}>
        <div style={{width:px(14),height:px(20),marginTop:px(2),borderRadius:`${px(6)} ${px(2)} ${px(2)} ${px(6)}`,background:`linear-gradient(135deg,${cc},${cc}88)`,border:`${px(1)} solid ${cc}`,boxShadow:`-${px(2)} 0 ${px(6)} ${cc}40`}}/>
        <div style={{width:px(36),height:px(42),borderRadius:px(3),background:`linear-gradient(180deg,${cc}ee,${cc}99)`,border:`${px(1)} solid ${cc}`,boxShadow:`0 0 ${px(10)} ${cc}50`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:px(3),position:"relative"}}>
          <div style={{width:px(12),height:px(12),borderRadius:"50%",background:`radial-gradient(circle,${color}ee,${color}44)`,border:`${px(1)} solid ${color}`,boxShadow:`0 0 ${px(8)} ${color}`}}/>
          {[0,1,2].map(i=><div key={i} style={{width:px(20),height:px(1.5),background:`linear-gradient(90deg,transparent,${color}60,transparent)`}}/>)}
          {chest&&<div style={{position:"absolute",bottom:px(2),fontSize:px(9)}}>{chest.icon}</div>}
        </div>
        <div style={{width:px(14),height:px(20),marginTop:px(2),borderRadius:`${px(2)} ${px(6)} ${px(6)} ${px(2)}`,background:`linear-gradient(135deg,${cc}88,${cc})`,border:`${px(1)} solid ${cc}`,boxShadow:`${px(2)} 0 ${px(6)} ${cc}40`}}/>
      </div>
      <div style={{display:"flex",alignItems:"flex-start",gap:px(2)}}>
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:px(2)}}>
          <div style={{width:px(12),height:px(28),borderRadius:px(3),background:`linear-gradient(180deg,${cc}cc,${cc}66)`,border:`${px(1)} solid ${cc}44`}}/>
          <div style={{fontSize:px(14)}}>{weapon?.icon||"✊"}</div>
        </div>
        <div style={{width:px(36),height:px(14),borderRadius:`0 0 ${px(3)} ${px(3)}`,background:`linear-gradient(180deg,${cc}88,${lc}cc)`,border:`${px(1)} solid ${cc}44`,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{width:px(14),height:px(6),borderRadius:px(2),background:"rgba(255,215,64,0.25)",border:`${px(1)} solid rgba(255,215,64,0.4)`}}/>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:px(2)}}>
          <div style={{width:px(12),height:px(28),borderRadius:px(3),background:`linear-gradient(180deg,${cc}cc,${cc}66)`,border:`${px(1)} solid ${cc}44`}}/>
          <div style={{fontSize:px(14)}}>{offhand?.icon||"🛡️"}</div>
        </div>
      </div>
      <div style={{display:"flex",gap:px(4),marginTop:px(1)}}>
        {[0,1].map(i=>(
          <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
            <div style={{width:px(16),height:px(28),borderRadius:`${px(3)} ${px(3)} 0 0`,background:`linear-gradient(180deg,${lc}ee,${lc}88)`,border:`${px(1)} solid ${lc}`,boxShadow:`0 0 ${px(5)} ${lc}40`}}/>
            <div style={{width:px(19),height:px(10),borderRadius:`0 0 ${px(4)} ${px(4)}`,background:`linear-gradient(180deg,${lc}cc,${lc}55)`,border:`${px(1)} solid ${lc}88`}}>
              {legs&&i===1&&<div style={{fontSize:px(7),textAlign:"center",lineHeight:px(10)}}>{legs.icon}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ItemCard({item,equipped,onEquip,onUnequip,size="normal"}){
  const [hov,setHov]=useState(false);
  const r=RARITIES[item.rarity];const isEq=equipped[item.slot]===item.id;const isItem=item.slot==="item";
  return(
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      onClick={()=>!isItem&&(isEq?onUnequip(item.slot):onEquip(item))}
      style={{position:"relative",width:size==="sm"?40:54,height:size==="sm"?40:54,borderRadius:4,cursor:isItem?"default":"pointer",
        background:isEq?`${r.color}22`:"rgba(255,255,255,0.04)",
        border:`2px solid ${isEq?r.color:hov?r.color+"88":r.color+"33"}`,
        boxShadow:isEq?`0 0 12px ${r.color}60,inset 0 0 8px ${r.color}20`:hov?`0 0 8px ${r.color}40`:"none",
        display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:1,
        transition:"all 0.15s",transform:hov?"scale(1.06)":"scale(1)"}}>
      <div style={{fontSize:size==="sm"?17:22}}>{item.icon}</div>
      {size!=="sm"&&<div style={{fontSize:6,color:r.color,fontWeight:700,fontFamily:"'Orbitron'",textAlign:"center",maxWidth:50,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis",letterSpacing:0.3}}>{item.name.split(" ").slice(0,2).join(" ")}</div>}
      {isEq&&<div style={{position:"absolute",top:1,right:2,fontSize:7,color:r.color}}>✓</div>}
      {hov&&(
        <div style={{position:"absolute",bottom:"112%",left:"50%",transform:"translateX(-50%)",background:"rgba(5,3,14,0.98)",border:`1px solid ${r.color}70`,borderRadius:5,padding:"8px 10px",zIndex:999,width:190,pointerEvents:"none",boxShadow:`0 4px 24px rgba(0,0,0,0.9),0 0 16px ${r.color}30`}}>
          <div style={{fontSize:8,fontWeight:900,color:r.color,fontFamily:"'Orbitron'",letterSpacing:1,marginBottom:2}}>{r.label}{item.power?` · ⚡${item.power} PWR`:""}</div>
          <div style={{fontSize:11,fontWeight:700,color:"#e0e0ff",marginBottom:4}}>{item.icon} {item.name}</div>
          <div style={{fontSize:9,color:"#aaa",marginBottom:5,lineHeight:1.5}}>{item.desc}</div>
          {item.stats&&Object.keys(item.stats).length>0&&(
            <div style={{borderTop:"1px solid #222",paddingTop:4,marginBottom:4}}>
              {Object.entries(item.stats).map(([k,v])=>(
                <div key={k} style={{fontSize:9,display:"flex",justifyContent:"space-between",color:v>0?"#39ff14":"#ff073a"}}>
                  <span>{STATS[k]?.icon} {STATS[k]?.label||k}</span>
                  <span style={{fontWeight:700,fontFamily:"'Share Tech Mono'"}}>{v>0?"+":""}{v}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{fontSize:8,color:r.color+"88",fontStyle:"italic",marginBottom:3}}>{item.flavor}</div>
          {!isItem&&<div style={{fontSize:7,color:"#555"}}>{isEq?"Click to unequip":"Click to equip"}</div>}
        </div>
      )}
    </div>
  );
}

function XPBar({xp,color}){
  const lvl=getLevel(xp);const curr=xpForLevel(lvl);const next=xpForNextLevel(lvl);
  const pct=lvl>=100?100:Math.min(100,((xp-curr)/(next-curr))*100);
  const title=getLevelTitle(lvl);
  return(
    <div style={{width:"100%"}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3,alignItems:"center"}}>
        <span style={{fontSize:9,color:title.color,fontFamily:"'Orbitron'",fontWeight:900,letterSpacing:1}}>{title.icon} LVL {lvl} · {title.title}</span>
        <span style={{fontSize:8,color:"#5a5a7a",fontFamily:"'Share Tech Mono'"}}>{xp.toLocaleString()} XP</span>
      </div>
      <div style={{height:6,background:"rgba(255,255,255,0.05)",borderRadius:3,border:"1px solid rgba(255,255,255,0.05)",overflow:"hidden"}}>
        <div style={{height:"100%",width:pct+"%",borderRadius:3,transition:"width 0.5s ease",background:`linear-gradient(90deg,${color}80,${color})`,boxShadow:`0 0 8px ${color}80`}}/>
      </div>
    </div>
  );
}

function CreateLoad({onCreated,onLoaded,NEON}){
  const [mode,setMode]=useState(null);
  const [name,setName]=useState("");const [pin,setPin]=useState("");
  const [loading,setLoading]=useState(false);const [error,setError]=useState("");
  const inp={background:"rgba(255,255,255,0.06)",border:"1px solid rgba(0,255,255,0.3)",borderRadius:4,color:"#e0e0ff",fontFamily:"'Share Tech Mono'",fontSize:13,padding:"8px 10px",width:"100%",outline:"none",boxSizing:"border-box"};
  const handleCreate=async()=>{
    if(!name.trim())return setError("Name required");
    if(pin.length!==4||!/^\d{4}$/.test(pin))return setError("PIN must be 4 digits");
    setLoading(true);setError("");
    const existing=await sbLoad(name.trim());
    if(existing){setLoading(false);return setError("Name taken. Choose another.");}
    const p={name:name.trim(),pin,xp:0,kills:0,level:1,gear_score:0,equipped:{},
      inventory:["i_rug_spray","i_cope_juice","i_wojak_tears","i_moon_ticket","i_paper_bag","h_bag","c_cardboard","l_pajamas","w_foam","o_tinfoil"],stats:{}};
    const ok=await sbSave(p);setLoading(false);
    if(ok)onCreated(p);else setError("Failed to save. Try again.");
  };
  const handleLoad=async()=>{
    if(!name.trim())return setError("Name required");
    if(pin.length!==4)return setError("4-digit PIN required");
    setLoading(true);setError("");
    const p=await sbLoad(name.trim());setLoading(false);
    if(!p)return setError("Hunter not found.");
    if(p.pin!==pin)return setError("Wrong PIN.");
    onLoaded(p);
  };
  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",padding:"20px 16px",gap:12}}>
      <div style={{textAlign:"center",marginBottom:8}}>
        <div style={{fontSize:32}}>⚔️</div>
        <div style={{fontSize:14,fontWeight:900,color:"#ffd740",fontFamily:"'Orbitron'",letterSpacing:2,textShadow:"0 0 16px #ffd740"}}>DEGEN HUNTER</div>
        <div style={{fontSize:9,color:"#5a5a7a",fontFamily:"'Orbitron'",letterSpacing:1,marginTop:2}}>CROSS-DEVICE PROFILE SYSTEM</div>
      </div>
      {!mode&&(
        <div style={{display:"flex",flexDirection:"column",gap:8,width:"100%"}}>
          <button onClick={()=>setMode("create")} style={{padding:"12px",borderRadius:4,cursor:"pointer",fontFamily:"'Orbitron'",fontSize:11,fontWeight:900,letterSpacing:1,background:"linear-gradient(135deg,rgba(57,255,20,0.15),rgba(57,255,20,0.05))",border:"1px solid #39ff14",color:"#39ff14",boxShadow:"0 0 16px rgba(57,255,20,0.2)"}}>✦ CREATE NEW HUNTER</button>
          <button onClick={()=>setMode("load")} style={{padding:"12px",borderRadius:4,cursor:"pointer",fontFamily:"'Orbitron'",fontSize:11,fontWeight:900,letterSpacing:1,background:"linear-gradient(135deg,rgba(0,255,255,0.15),rgba(0,255,255,0.05))",border:"1px solid #00ffff",color:"#00ffff",boxShadow:"0 0 16px rgba(0,255,255,0.2)"}}>◈ LOAD EXISTING HUNTER</button>
        </div>
      )}
      {mode&&(
        <div style={{display:"flex",flexDirection:"column",gap:10,width:"100%"}}>
          <div style={{fontSize:11,color:mode==="create"?"#39ff14":"#00ffff",fontFamily:"'Orbitron'",fontWeight:900,letterSpacing:1}}>{mode==="create"?"✦ CREATE HUNTER":"◈ LOAD HUNTER"}</div>
          <div>
            <div style={{fontSize:8,color:"#5a5a7a",marginBottom:4,fontFamily:"'Orbitron'",letterSpacing:1}}>HUNTER NAME</div>
            <input value={name} onChange={e=>setName(e.target.value.slice(0,20))} placeholder="Enter name..." style={inp} maxLength={20}/>
          </div>
          <div>
            <div style={{fontSize:8,color:"#5a5a7a",marginBottom:4,fontFamily:"'Orbitron'",letterSpacing:1}}>4-DIGIT PIN {mode==="create"?"(remember this!)":""}</div>
            <input value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,"").slice(0,4))} placeholder="••••" type="password" maxLength={4} style={inp}/>
          </div>
          {error&&<div style={{fontSize:10,color:"#ff073a",fontFamily:"'Share Tech Mono'"}}>{error}</div>}
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>{setMode(null);setError("");setName("");setPin("");}} style={{flex:1,padding:"8px",borderRadius:4,cursor:"pointer",fontFamily:"'Orbitron'",fontSize:9,background:"rgba(255,255,255,0.04)",border:"1px solid #333",color:"#5a5a7a"}}>BACK</button>
            <button onClick={mode==="create"?handleCreate:handleLoad} disabled={loading} style={{flex:2,padding:"8px",borderRadius:4,cursor:"pointer",fontFamily:"'Orbitron'",fontSize:10,fontWeight:900,letterSpacing:1,background:mode==="create"?"linear-gradient(135deg,rgba(57,255,20,0.2),rgba(57,255,20,0.08))":"linear-gradient(135deg,rgba(0,255,255,0.2),rgba(0,255,255,0.08))",border:`1px solid ${mode==="create"?"#39ff14":"#00ffff"}`,color:mode==="create"?"#39ff14":"#00ffff",opacity:loading?0.5:1}}>{loading?"⟳ CONNECTING...":(mode==="create"?"✦ CREATE":"◈ LOAD")}</button>
          </div>
          {mode==="create"&&<div style={{fontSize:8,color:"#333",fontFamily:"'Share Tech Mono'",textAlign:"center",lineHeight:1.5}}>Character saves to Supabase. Access from any device with your name + PIN.</div>}
        </div>
      )}
    </div>
  );
}

function StatsPanel({equipped}){
  const totals=calcTotalStats(equipped);
  return(
    <div style={{display:"flex",flexDirection:"column",gap:4}}>
      {Object.entries(STATS).map(([k,def])=>{
        const val=totals[k]||0;
        const bar=Math.max(0,Math.min(100,val*3+50));
        return(
          <div key={k} style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:10,width:14}}>{def.icon}</span>
            <span style={{fontSize:8,color:"#5a5a7a",fontFamily:"'Orbitron'",width:98,letterSpacing:0.3,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{def.label}</span>
            <div style={{flex:1,height:4,background:"rgba(255,255,255,0.05)",borderRadius:2,overflow:"hidden"}}>
              <div style={{height:"100%",width:bar+"%",background:val>=0?`linear-gradient(90deg,${def.color}60,${def.color})`:`linear-gradient(90deg,#ff073a60,#ff073a)`,borderRadius:2,transition:"width 0.3s"}}/>
            </div>
            <span style={{fontSize:9,fontWeight:700,fontFamily:"'Share Tech Mono'",width:24,textAlign:"right",color:val>0?"#39ff14":val<0?"#ff073a":"#5a5a7a"}}>{val>0?"+":""}{val}</span>
          </div>
        );
      })}
    </div>
  );
}

export function HunterPanel({hunterXP,hunterKills,killStreak,NEON={cyan:"#00ffff",dimText:"#5a5a7a",text:"#e0e0ff"}}){
  const [profile,setProfile]=useState(()=>{try{const s=localStorage.getItem("degen_hunter_v2");return s?JSON.parse(s):null;}catch{return null;}});
  const [view,setView]=useState("char");
  const [invTab,setInvTab]=useState("GEAR");
  const [saving,setSaving]=useState(false);const [saveMsg,setSaveMsg]=useState("");
  const saveTimerRef=useRef(null);

  useEffect(()=>{
    if(!profile)return;
    const updated={...profile,xp:hunterXP,kills:hunterKills,level:getLevel(hunterXP),gear_score:calcGearScore(profile.equipped||{})};
    setProfile(updated);try{localStorage.setItem("degen_hunter_v2",JSON.stringify(updated));}catch{}
  },[hunterXP,hunterKills]);

  useEffect(()=>{
    if(!profile)return;
    const t=setInterval(async()=>{
      await sbSave({...profile,xp:hunterXP,kills:hunterKills,level:getLevel(hunterXP),gear_score:calcGearScore(profile.equipped||{})});
    },120000);return()=>clearInterval(t);
  },[profile,hunterXP,hunterKills]);

  const saveNow=async()=>{
    if(!profile||saving)return;setSaving(true);
    const updated={...profile,xp:hunterXP,kills:hunterKills,level:getLevel(hunterXP),gear_score:calcGearScore(profile.equipped||{})};
    const ok=await sbSave(updated);setSaving(false);
    setSaveMsg(ok?"✅ SAVED":"❌ FAILED");clearTimeout(saveTimerRef.current);
    saveTimerRef.current=setTimeout(()=>setSaveMsg(""),2500);
  };
  const handleCreated=(p)=>{setProfile(p);try{localStorage.setItem("degen_hunter_v2",JSON.stringify(p));}catch{}};
  const handleLoaded=(p)=>{setProfile(p);try{localStorage.setItem("degen_hunter_v2",JSON.stringify(p));}catch{}};
  const logout=()=>{setProfile(null);try{localStorage.removeItem("degen_hunter_v2");}catch{}};
  const equip=(item)=>{
    if(!profile)return;
    const eq={...profile.equipped,[item.slot]:item.id};
    const updated={...profile,equipped:eq,gear_score:calcGearScore(eq)};
    setProfile(updated);try{localStorage.setItem("degen_hunter_v2",JSON.stringify(updated));}catch{}
  };
  const unequip=(slot)=>{
    if(!profile)return;
    const eq={...profile.equipped};delete eq[slot];
    const updated={...profile,equipped:eq,gear_score:calcGearScore(eq)};
    setProfile(updated);try{localStorage.setItem("degen_hunter_v2",JSON.stringify(updated));}catch{}
  };
  const addToInventory=(itemId)=>{
    if(!profile)return;
    const inv=[...(profile.inventory||[]),itemId].slice(-100);
    const updated={...profile,inventory:inv};
    setProfile(updated);try{localStorage.setItem("degen_hunter_v2",JSON.stringify(updated));}catch{}
    return updated;
  };

  if(!profile)return<CreateLoad onCreated={handleCreated} onLoaded={handleLoaded} NEON={NEON}/>;

  const equipped=profile.equipped||{};const inventory=profile.inventory||[];
  const level=getLevel(hunterXP);const rank=getLevelTitle(level);
  const gearScore=calcGearScore(equipped);
  const gearItems=inventory.map(id=>ITEMS.find(i=>i.id===id)).filter(Boolean).filter(i=>i.slot!=="item");
  const miscItems=inventory.map(id=>ITEMS.find(i=>i.id===id)).filter(Boolean).filter(i=>i.slot==="item");
  const SLOTS=["helmet","chest","legs","weapon","offhand"];
  const SLOT_ICONS={helmet:"⛑️",chest:"🧥",legs:"👖",weapon:"⚔️",offhand:"🛡️"};

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",background:"rgba(5,3,14,0.95)"}}>
      <div style={{padding:"6px 8px",borderBottom:"1px solid rgba(255,215,64,0.15)",flexShrink:0}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:11,fontWeight:900,color:rank.color,fontFamily:"'Orbitron'",letterSpacing:1}}>{rank.icon} {profile.name}</div>
            <div style={{fontSize:8,color:"#5a5a7a",marginTop:1}}>LVL {level} · {rank.title} · ⚡{gearScore} GS · 💀{hunterKills} KILLS</div>
          </div>
          <div style={{display:"flex",gap:4,alignItems:"center"}}>
            {saveMsg&&<span style={{fontSize:8,color:saveMsg.includes("✅")?"#39ff14":"#ff073a",fontFamily:"'Share Tech Mono'"}}>{saveMsg}</span>}
            <button onClick={saveNow} disabled={saving} style={{background:"none",border:"1px solid rgba(255,215,64,0.3)",color:"#ffd740",padding:"2px 7px",borderRadius:3,cursor:"pointer",fontSize:8,fontFamily:"'Orbitron'"}}>{saving?"⟳":"💾"} SAVE</button>
            <button onClick={logout} style={{background:"none",border:"1px solid #333",color:"#5a5a7a",padding:"2px 7px",borderRadius:3,cursor:"pointer",fontSize:8}}>✕</button>
          </div>
        </div>
        <div style={{marginTop:6}}><XPBar xp={hunterXP} color={rank.color}/></div>
      </div>
      <div style={{display:"flex",borderBottom:"1px solid #111",flexShrink:0}}>
        {[["char","⚔️ CHAR"],["stats","📊 STATS"],["inventory","🎒 INV"],["loadout","🛡️ LOAD"]].map(([v,l])=>(
          <button key={v} onClick={()=>setView(v)} style={{flex:1,padding:"4px 2px",background:view===v?"rgba(255,215,64,0.08)":"transparent",border:"none",borderBottom:view===v?"2px solid #ffd740":"2px solid transparent",color:view===v?"#ffd740":"#5a5a7a",cursor:"pointer",fontSize:7,fontFamily:"'Orbitron'",letterSpacing:0.3}}>{l}</button>
        ))}
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"8px"}}>
        {view==="char"&&(
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:10}}>
            <div style={{position:"relative",padding:"16px 0 28px",background:"radial-gradient(ellipse at center,rgba(0,0,60,0.6),transparent 70%)",width:"100%",display:"flex",justifyContent:"center"}}>
              <PixelChar equipped={equipped} rank={rank} scale={1.3}/>
            </div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"center"}}>
              {SLOTS.map(slot=>{
                const item=equipped[slot]?ITEMS.find(i=>i.id===equipped[slot]):null;
                return(
                  <div key={slot} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                    <div style={{fontSize:6,color:"#5a5a7a",fontFamily:"'Orbitron'"}}>{slot.toUpperCase()}</div>
                    {item?<ItemCard item={item} equipped={equipped} onEquip={equip} onUnequip={unequip}/>:
                      <div style={{width:54,height:54,border:"1px dashed #222",borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",color:"#333",fontSize:18}}>{SLOT_ICONS[slot]}</div>}
                  </div>
                );
              })}
            </div>
            <div style={{display:"flex",gap:6,width:"100%"}}>
              {[["💀","KILLS",hunterKills,"#ff073a"],["⚡","GEAR",gearScore,"#ffd740"],["🔥","STREAK",killStreak,"#ff9500"]].map(([ic,lb,v,c])=>(
                <div key={lb} style={{flex:1,background:"rgba(255,255,255,0.03)",border:`1px solid ${c}20`,borderRadius:4,padding:"5px",textAlign:"center"}}>
                  <div style={{fontSize:14,fontWeight:900,color:c,fontFamily:"'Orbitron'"}}>{v}</div>
                  <div style={{fontSize:7,color:"#5a5a7a",fontFamily:"'Orbitron'"}}>{lb}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {view==="stats"&&<StatsPanel equipped={equipped}/>}
        {view==="inventory"&&(
          <div>
            <div style={{display:"flex",borderBottom:"1px solid #111",marginBottom:8}}>
              {["GEAR","ITEMS"].map(t=>(
                <button key={t} onClick={()=>setInvTab(t)} style={{flex:1,padding:"4px",background:invTab===t?"rgba(255,215,64,0.08)":"transparent",border:"none",borderBottom:invTab===t?"2px solid #ffd740":"2px solid transparent",color:invTab===t?"#ffd740":"#5a5a7a",cursor:"pointer",fontSize:8,fontFamily:"'Orbitron'"}}>
                  {t} ({t==="GEAR"?gearItems.length:miscItems.length})
                </button>
              ))}
            </div>
            {invTab==="GEAR"&&(
              <div>
                {gearItems.length===0&&<div style={{color:"#5a5a7a",fontSize:10,textAlign:"center",padding:20,fontStyle:"italic"}}>No gear yet. Open treasure chests on the battlefield.</div>}
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {gearItems.map((item,i)=><ItemCard key={item.id+i} item={item} equipped={equipped} onEquip={equip} onUnequip={unequip}/>)}
                </div>
              </div>
            )}
            {invTab==="ITEMS"&&(
              <div>
                {miscItems.length===0&&<div style={{color:"#5a5a7a",fontSize:10,textAlign:"center",padding:20,fontStyle:"italic"}}>No items yet.</div>}
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {miscItems.map((item,i)=><ItemCard key={item.id+i} item={item} equipped={equipped} onEquip={equip} onUnequip={unequip}/>)}
                </div>
              </div>
            )}
          </div>
        )}
        {view==="loadout"&&(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <div style={{fontSize:8,color:"#5a5a7a",fontFamily:"'Orbitron'",textAlign:"center"}}>GEAR SCORE: <span style={{color:"#ffd740",fontSize:11}}>⚡{gearScore}</span></div>
            <div style={{display:"flex",justifyContent:"center"}}><PixelChar equipped={equipped} rank={rank} scale={1.5}/></div>
            <div style={{marginTop:24,display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center"}}>
              {SLOTS.map(slot=>{
                const item=equipped[slot]?ITEMS.find(i=>i.id===equipped[slot]):null;
                const r=item?RARITIES[item.rarity]:null;
                return(
                  <div key={slot} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                    <div style={{fontSize:7,color:"#5a5a7a",fontFamily:"'Orbitron'",letterSpacing:0.5}}>{slot.toUpperCase()}</div>
                    {item?<ItemCard item={item} equipped={equipped} onEquip={equip} onUnequip={unequip}/>:
                      <div style={{width:54,height:54,border:"1px dashed #222",borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",color:"#333",fontSize:18}}>{SLOT_ICONS[slot]}</div>}
                    {item&&<div style={{fontSize:7,color:r?.color,fontFamily:"'Orbitron'"}}>⚡{Math.round((item.power||0)*(RARITIES[item.rarity]?.mult||1))} GS</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function TreasureChestOverlay({chests,onOpen}){
  return(
    <>
      {chests.map(chest=>{
        const r=RARITIES[chest.rarity];
        return(
          <div key={chest.id} onClick={()=>onOpen(chest.id)}
            style={{position:"absolute",left:`${chest.x*100}%`,top:`${chest.y*100}%`,transform:"translate(-50%,-50%)",cursor:"pointer",zIndex:30,animation:"chestBob 2s ease-in-out infinite",filter:`drop-shadow(0 0 8px ${r.color})`}}>
            <div style={{fontSize:chest.rarity==="mythic"?28:chest.rarity==="legendary"?26:22,lineHeight:1}}>🎁</div>
            <div style={{fontSize:6,color:r.color,fontFamily:"'Orbitron'",textAlign:"center",fontWeight:900,letterSpacing:0.5,textShadow:`0 0 6px ${r.color}`}}>{chest.rarity.toUpperCase()}</div>
          </div>
        );
      })}
    </>
  );
}

export function useChestSystem(){
  const [chests,setChests]=useState([]);
  const timer=useRef(null);
  useEffect(()=>{
    const spawn=()=>{
      const r=Math.random();
      const rarity=r<0.01?"mythic":r<0.04?"legendary":r<0.12?"epic":r<0.28?"rare":r<0.50?"uncommon":"common";
      const chest={id:Date.now(),x:0.08+Math.random()*0.84,y:0.08+Math.random()*0.84,rarity,spawnedAt:Date.now()};
      setChests(p=>[...p,chest]);
      setTimeout(()=>setChests(p=>p.filter(c=>c.id!==chest.id)),45000);
      timer.current=setTimeout(spawn,60000+Math.random()*120000);
    };
    timer.current=setTimeout(spawn,25000);return()=>clearTimeout(timer.current);
  },[]);
  const openChest=useCallback((chestId,onLoot)=>{
    const chest=chests.find(c=>c.id===chestId);if(!chest)return;
    setChests(p=>p.filter(c=>c.id!==chestId));
    const luck=chest.rarity==="mythic"?5:chest.rarity==="legendary"?4:chest.rarity==="epic"?3:chest.rarity==="rare"?2:chest.rarity==="uncommon"?1:0;
    const item=rollLoot(luck);
    const xpMap={mythic:500,legendary:200,epic:80,rare:35,uncommon:15,common:5};
    onLoot&&onLoot(item,xpMap[chest.rarity]||5,chest.rarity);
  },[chests]);
  return{chests,openChest};
}

export function HunterLeaderboard({NEON={cyan:"#00ffff",dimText:"#5a5a7a",text:"#e0e0ff"},formatNum}){
  const [cat,setCat]=useState("xp");const [data,setData]=useState([]);const [loading,setLoading]=useState(false);
  const CATS=[
    {id:"xp",         label:"🏆 Highest Level",    color:"#ffd740",order:"xp.desc"},
    {id:"kills",      label:"💀 Most Kills",        color:"#ff073a",order:"kills.desc"},
    {id:"gear_score", label:"⚡ Best Gear Score",   color:"#bf00ff",order:"gear_score.desc"},
  ];
  useEffect(()=>{
    const c=CATS.find(x=>x.id===cat);if(!c)return;setLoading(true);
    fetch(`${_HS_SB_URL}/rest/v1/hunter_profiles?order=${c.order}&limit=50&select=name,xp,kills,level,gear_score,equipped`,{headers:{apikey:_HS_SB_KEY,Authorization:`Bearer ${_HS_SB_KEY}`}})
      .then(r=>r.json()).then(rows=>{setData(Array.isArray(rows)?rows:[]);setLoading(false);}).catch(()=>setLoading(false));
  },[cat]);
  const selCat=CATS.find(c=>c.id===cat);
  const fmtVal=(row)=>cat==="xp"?`LVL ${row.level||1} · ${(row.xp||0).toLocaleString()} XP`:cat==="kills"?`${row.kills||0} 💀`:`⚡ ${row.gear_score||0} GS`;
  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{padding:"4px 6px",borderBottom:"1px solid #1a1a2e",flexShrink:0}}>
        {CATS.map(c=>(
          <button key={c.id} onClick={()=>setCat(c.id)} style={{display:"block",width:"100%",textAlign:"left",padding:"4px 8px",marginBottom:2,background:cat===c.id?`${c.color}18`:"rgba(255,255,255,0.02)",border:`1px solid ${cat===c.id?c.color:"#333"}`,borderRadius:3,color:cat===c.id?c.color:NEON.dimText,cursor:"pointer",fontSize:10,fontWeight:cat===c.id?900:400,fontFamily:cat===c.id?"'Orbitron'":"inherit"}}>{c.label}</button>
        ))}
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"4px 6px"}}>
        {loading&&<div style={{color:NEON.dimText,fontSize:10,textAlign:"center",padding:16}}>⟳ LOADING...</div>}
        {!loading&&data.map((row,i)=>{
          const rank=i+1;const rc=rank===1?"#ffd740":rank===2?"#aaa":rank===3?"#cd7f32":NEON.dimText;
          const lt=getLevelTitle(row.level||1);
          return(
            <div key={row.name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 5px",marginBottom:1,borderRadius:3,background:rank===1?`${selCat?.color}08`:"transparent",borderLeft:`2px solid ${rank<=3?rc:"#222"}`}}>
              <div style={{display:"flex",alignItems:"center",gap:5}}>
                <span style={{fontSize:10,fontWeight:900,color:rc,width:16,textAlign:"right",fontFamily:"'Orbitron'"}}>{rank}</span>
                <span style={{fontSize:9}}>{lt.icon}</span>
                <span style={{fontSize:11,fontWeight:700,color:NEON.text}}>{row.name}</span>
              </div>
              <span style={{fontSize:10,fontWeight:700,color:selCat?.color,fontFamily:"'Share Tech Mono'"}}>{fmtVal(row)}</span>
            </div>
          );
        })}
        {!loading&&data.length===0&&<div style={{color:NEON.dimText,fontSize:10,textAlign:"center",padding:16,fontStyle:"italic"}}>No hunters yet. Be the first.</div>}
      </div>
    </div>
  );
}



