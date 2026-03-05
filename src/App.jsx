import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLiveData } from "./useLiveData";
import { fetchTokenByAddress, proxyUrl } from "./api";

const NEON = {
  magenta:"#ff00ff",cyan:"#00ffff",green:"#39ff14",red:"#ff073a",
  orange:"#ff6600",yellow:"#ffe600",purple:"#bf00ff",pink:"#ff6eb4",
  bg:"#05030e",text:"#e0e0ff",dimText:"#5a5a7a",
  panelBg:"rgba(8,6,20,0.85)",panelBorder:"rgba(255,0,255,0.2)",
};
const PLATFORMS=["PumpFun","Bonk","Moonshot","Raydium","Meteora","Orca"];
const PLATFORM_COLORS={PumpFun:"#39ff14",Bonk:"#ff6600",Moonshot:"#ff00ff",Raydium:"#00bfff",
  Meteora:"#ffd740",Orca:"#7c4dff",DexScreener:"#00ffcc",Jupiter:"#448aff"};
const NAMES_A=["DOGE","PEPE","BONK","WIF","MOON","ELON","TRUMP","GIGA","CHAD","SIGMA","BASED","COPE","FROG","CAT","APE","BULL","SEND","COOK","NUKE","PUMP","WAGMI","HODL","YOLO","LAMBO","REKT","FOMO","SHILL","BAG","MINT","FLIP"];
const NAMES_B=["INU","COIN","TOKEN","SOL","MOON","ROCKET","KING","LORD","GOD","MASTER","VERSE","CHAIN","SWAP","FI","DAO","X","AI","GPT","BOT","MEME","2.0","CLASSIC","GOLD","DIAMOND","HANDS","GANG","ARMY","NATION","WORLD","MAX"];
const WHALE_NAMES=["0xDegen_Larry","SolWhale.sol","NightTrader_9","CryptoMom420","PumpSlayer","ApeKing.sol","DegenSensei","LiqHunter_X","MoonBoi.sol","ShadowBuyer"];
const COIN_COLORS=[
  {bg:"#ff6b35",fg:"#fff",rim:"#cc5528"},{bg:"#00d4aa",fg:"#fff",rim:"#00a885"},
  {bg:"#7c4dff",fg:"#fff",rim:"#6237cc"},{bg:"#ff4081",fg:"#fff",rim:"#cc3367"},
  {bg:"#448aff",fg:"#fff",rim:"#366ecc"},{bg:"#ffd740",fg:"#222",rim:"#ccac33"},
  {bg:"#69f0ae",fg:"#111",rim:"#54c08b"},{bg:"#ff5252",fg:"#fff",rim:"#cc4141"},
  {bg:"#40c4ff",fg:"#fff",rim:"#339dcc"},{bg:"#b388ff",fg:"#fff",rim:"#8f6dcc"},
  {bg:"#ff9100",fg:"#fff",rim:"#cc7400"},{bg:"#00e5ff",fg:"#111",rim:"#00b7cc"},
  {bg:"#e040fb",fg:"#fff",rim:"#b333c9"},{bg:"#76ff03",fg:"#111",rim:"#5ecc02"},
  {bg:"#ff6e40",fg:"#fff",rim:"#b34828"},{bg:"#18ffff",fg:"#111",rim:"#10b0b0"},
];

function rand(a,b){return Math.random()*(b-a)+a}
function randInt(a,b){return Math.floor(rand(a,b))}
function pick(a){return a[randInt(0,a.length)]}
function formatNum(n){if(n>=1e6)return(n/1e6).toFixed(1)+"M";if(n>=1e3)return(n/1e3).toFixed(1)+"K";return n.toFixed(0)}
function formatAddr(a){return a.slice(0,4)+"..."+a.slice(-4)}
function genAddr(){const c="0123456789abcdef";let s="";for(let i=0;i<40;i++)s+=c[randInt(0,16)];return s}

function qualifiesForBattlefield(t){
  let p=0;const ch=[];
  const test=(n,c)=>{ch.push({name:n,pass:!!c});if(c)p++};
  test("RISK",t.riskScore>=50);test("UNIQUE",t.dupeCount===0);test("HOLDERS",t.holders>=30);
  test("DEV<15%",t.devWallet<15);test("BUNDLES",!t.bundleDetected||t.bundleSize<8);
  test("VOLUME",t.vol>10000);test("BUYS",t.buys>t.sells*1.5);test("DISTRO",t.topHolderPct<35);
  return{qualified:p>=6,score:p,checks:ch};
}

function generateToken(existingNames=[]){
  let name=pick(NAMES_A)+pick(NAMES_B);
  const dupeCount=existingNames.filter(n=>n===name).length;
  const holders=randInt(3,800),vol=rand(500,500000),devWallet=rand(0,35);
  const lpLocked=Math.random()>0.4,mintAuth=Math.random()>0.6;
  const bundleDetected=Math.random()>0.65,bundleSize=bundleDetected?randInt(2,25):0;
  const mcap=rand(5000,2000000),platform=pick(PLATFORMS);
  const buys=randInt(5,500),sells=randInt(0,buys),topHolderPct=rand(5,60);
  const priceChange=rand(-50,500);
  let riskScore=50;
  if(devWallet>20)riskScore-=20;if(devWallet>10)riskScore-=10;if(!lpLocked)riskScore-=15;
  if(mintAuth)riskScore-=15;if(holders<20)riskScore-=10;if(holders>200)riskScore+=15;
  if(vol>100000)riskScore+=10;if(bundleDetected&&bundleSize>10)riskScore-=20;
  if(dupeCount>0)riskScore-=25;if(topHolderPct>40)riskScore-=15;
  if(buys>sells*3)riskScore+=10;if(priceChange>100)riskScore+=10;
  riskScore=Math.max(0,Math.min(100,riskScore));
  let threat="EXTREME",threatColor=NEON.red;
  if(riskScore>75){threat="LOW";threatColor=NEON.green}
  else if(riskScore>55){threat="MODERATE";threatColor=NEON.yellow}
  else if(riskScore>35){threat="HIGH";threatColor=NEON.orange}
  const token={id:Date.now()+Math.random(),name,platform,holders,vol,devWallet,lpLocked,mintAuth,
    bundleDetected,bundleSize,mcap,buys,sells,topHolderPct,priceChange,riskScore,threat,threatColor,
    addr:genAddr(),dupeCount,timestamp:Date.now(),
    bx:rand(0.1,0.9),by:0.95,targetY:0.95,vx:rand(-0.0003,0.0003),health:100,alive:true,
    age:0,trail:[],warpIn:true,warpProgress:0,warpStartX:rand(0,1),warpStartY:rand(-0.1,0.1),
    coinColor:pick(COIN_COLORS),bobOffset:rand(0,Math.PI*2),initials:name.slice(0,2).toUpperCase()};
  const q=qualifiesForBattlefield(token);
  token.qualified=q.qualified;token.qualScore=q.score;token.qualChecks=q.checks;
  return token;
}
function generateWhaleAlert(){
  return{id:Date.now()+Math.random(),wallet:pick(WHALE_NAMES),
    action:Math.random()>0.3?"BUY":"SELL",token:pick(NAMES_A)+pick(NAMES_B),
    amount:rand(500,50000),timestamp:Date.now()};
}

const INTEL_TYPES=[
  {type:"deployer",icon:"🔗",color:NEON.orange,gen:()=>`Same deployer launched ${pick(NAMES_A)+pick(NAMES_B)} and ${pick(NAMES_A)+pick(NAMES_B)} within ${randInt(2,8)} min`},
  {type:"rug_pattern",icon:"🔴",color:NEON.red,gen:()=>`${pick(NAMES_A)+pick(NAMES_B)} matches rug pattern: LP unlocked + dev ${randInt(15,35)}% + ${randInt(8,20)} bundle TXs`},
  {type:"volume",icon:"📊",color:NEON.cyan,gen:()=>`${pick(NAMES_A)+pick(NAMES_B)} volume spike +${randInt(150,800)}% in ${randInt(30,120)}s — ${randInt(15,60)} buys`},
  {type:"whale",icon:"🐋",color:NEON.purple,gen:()=>`${randInt(2,5)} tracked wallets bought ${pick(NAMES_A)+pick(NAMES_B)} within ${randInt(1,5)} min — $${formatNum(rand(5000,80000))} total`},
  {type:"sniper",icon:"🎯",color:NEON.green,gen:()=>`Sniper wallet ${pick(WHALE_NAMES)} entered ${pick(NAMES_A)+pick(NAMES_B)} at launch — block ${randInt(1,3)}`},
  {type:"lp",icon:"🔓",color:NEON.yellow,gen:()=>`${pick(NAMES_A)+pick(NAMES_B)} LP lock expires in ${randInt(1,24)}h — $${formatNum(rand(10000,200000))} at risk`},
  {type:"copycat",icon:"👀",color:NEON.pink,gen:()=>`Copycat detected: ${pick(NAMES_A)+pick(NAMES_B)} name/ticker matches trending ${pick(NAMES_A)} token`},
  {type:"mint",icon:"⚠",color:NEON.red,gen:()=>`${pick(NAMES_A)+pick(NAMES_B)} mint authority NOT revoked — infinite supply risk`},
  {type:"momentum",icon:"🚀",color:NEON.green,gen:()=>`${pick(NAMES_A)+pick(NAMES_B)} crossed $${formatNum(rand(100000,1000000))} mcap — ${randInt(5,20)} min old, ${randInt(100,800)} holders`},
  {type:"dump",icon:"📉",color:NEON.red,gen:()=>`Dev wallet for ${pick(NAMES_A)+pick(NAMES_B)} sold ${randInt(20,60)}% of holdings — $${formatNum(rand(5000,50000))} dumped`},
];
function generateIntelEvent(){
  const tmpl=pick(INTEL_TYPES);
  return{id:Date.now()+Math.random(),type:tmpl.type,icon:tmpl.icon,color:tmpl.color,
    text:tmpl.gen(),timestamp:Date.now(),priority:Math.random()>0.7?"HIGH":"NORMAL"};
}

// ═══════════════ CHERRY BLOSSOMS ═══════════════
function CherryBlossoms(){
  const canvasRef=useRef(null);const petalsRef=useRef([]);
  useEffect(()=>{
    for(let i=0;i<30;i++)petalsRef.current.push({x:rand(0,1),y:rand(-0.1,1),vx:rand(-0.0003,0.0003),
      vy:rand(0.0003,0.001),rot:rand(0,Math.PI*2),rotV:rand(-0.02,0.02),size:rand(3,6),
      opacity:rand(0.1,0.3),wobble:rand(0,Math.PI*2),wobbleSpeed:rand(0.01,0.03)});
    const canvas=canvasRef.current;if(!canvas)return;
    const ctx=canvas.getContext("2d");let raf;
    function resize(){canvas.width=canvas.offsetWidth;canvas.height=canvas.offsetHeight}
    resize();
    function draw(){
      const W=canvas.width,H=canvas.height;ctx.clearRect(0,0,W,H);
      petalsRef.current.forEach(p=>{
        p.x+=p.vx+Math.sin(p.wobble)*0.0002;p.y+=p.vy;p.rot+=p.rotV;p.wobble+=p.wobbleSpeed;
        if(p.y>1.05){p.y=-0.05;p.x=rand(0,1)}
        if(p.x<-0.05)p.x=1.05;if(p.x>1.05)p.x=-0.05;
        ctx.save();ctx.translate(p.x*W,p.y*H);ctx.rotate(p.rot);
        ctx.fillStyle=`rgba(255,180,220,${p.opacity})`;
        ctx.beginPath();ctx.moveTo(0,-p.size);
        ctx.bezierCurveTo(p.size*0.8,-p.size*0.3,p.size*0.5,p.size*0.5,0,p.size*0.3);
        ctx.bezierCurveTo(-p.size*0.5,p.size*0.5,-p.size*0.8,-p.size*0.3,0,-p.size);
        ctx.fill();ctx.restore()});
      raf=requestAnimationFrame(draw)}
    draw();return()=>cancelAnimationFrame(raf)},[]);
  return <canvas ref={canvasRef} style={{position:"fixed",top:0,left:0,width:"100%",height:"100%",pointerEvents:"none",zIndex:90}}/>;
}

// ═══════════════ GLASS PANEL ═══════════════
function GlassPanel({children,accent=NEON.magenta,style={},className=""}){
  return(
    <div className={className} style={{
      background:`linear-gradient(165deg,rgba(15,10,30,0.92) 0%,rgba(8,6,18,0.96) 100%)`,
      border:`1px solid ${accent}18`,borderRadius:8,position:"relative",overflow:"hidden",
      boxShadow:`0 4px 24px rgba(0,0,0,0.4),0 0 1px ${accent}30,inset 0 1px 0 rgba(255,255,255,0.03)`,...style}}>
      {/* Top edge light */}
      <div style={{position:"absolute",top:0,left:"8%",right:"8%",height:1,
        background:`linear-gradient(90deg,transparent,${accent}40,transparent)`}}/>
      {/* Corner dots */}
      {[[0,0],[null,0],[0,null],[null,null]].map(([l,t],i)=>(
        <div key={i} style={{position:"absolute",width:3,height:3,borderRadius:"50%",background:`${accent}30`,
          ...(l===0?{left:6}:{right:6}),...(t===0?{top:6}:{bottom:6})}}/>))}
      {children}
    </div>);
}

// ═══════════════ STAT CHIP ═══════════════
function StatChip({label,value,color,large}){
  return(
    <div style={{textAlign:"center",padding:large?"0 12px":"0 6px"}}>
      <div style={{fontSize:large?18:14,fontWeight:900,color,fontFamily:"'Orbitron',sans-serif",
        letterSpacing:1,lineHeight:1.1}}>{value}</div>
      <div style={{fontSize:16,color:NEON.dimText,letterSpacing:2,marginTop:2}}>{label}</div>
    </div>);
}

// ═══════════════ PANEL HEADER ═══════════════
function PanelHeader({title,accent=NEON.magenta,right,subtitle}){
  return(
    <div style={{padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",
      borderBottom:`1px solid ${accent}10`,
      background:`linear-gradient(180deg,${accent}06,transparent)`}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <div style={{width:5,height:5,borderRadius:"50%",background:accent,boxShadow:`0 0 6px ${accent}60`}}/>
        <span style={{fontSize:14,fontWeight:700,color:accent,fontFamily:"'Orbitron',sans-serif",
          letterSpacing:2}}>{title}</span>
        {subtitle&&<span style={{fontSize:14,color:NEON.dimText,opacity:0.6}}>{subtitle}</span>}
      </div>
      {right}
    </div>);
}

// ═══════════════ RADAR ═══════════════
function RadarScope({pings}){
  const canvasRef=useRef(null);const angleRef=useRef(0);const pingsRef=useRef([]);const lastPingCount=useRef(0);
  useEffect(()=>{
    if(pings.length>lastPingCount.current){
      // New pings arrived — add them with their color
      const newOnes=pings.slice(lastPingCount.current);
      newOnes.forEach(p=>{pingsRef.current.push({angle:angleRef.current+rand(-0.5,0.5),opacity:1,radius:0,color:p.color||NEON.green})});
    }
    lastPingCount.current=pings.length;
  },[pings.length]);
  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return;
    const ctx=canvas.getContext("2d");const size=160;canvas.width=size;canvas.height=size;
    const cx=size/2,cy=size/2,r=70;let raf;
    function draw(){
      ctx.clearRect(0,0,size,size);
      ctx.strokeStyle="rgba(0,255,255,0.06)";ctx.lineWidth=1;
      [0.33,0.66,1].forEach(s=>{ctx.beginPath();ctx.arc(cx,cy,r*s,0,Math.PI*2);ctx.stroke()});
      ctx.strokeStyle="rgba(0,255,255,0.04)";ctx.beginPath();
      ctx.moveTo(cx-r,cy);ctx.lineTo(cx+r,cy);ctx.moveTo(cx,cy-r);ctx.lineTo(cx,cy+r);ctx.stroke();
      angleRef.current+=0.02;const a=angleRef.current;
      ctx.strokeStyle=NEON.cyan;ctx.lineWidth=1.5;ctx.shadowColor=NEON.cyan;ctx.shadowBlur=10;
      ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);ctx.stroke();
      for(let i=0;i<20;i++){const ta=a-(i*0.04);const al=0.2*(1-i/20);
        ctx.strokeStyle=`rgba(0,255,255,${al})`;ctx.lineWidth=1;ctx.shadowBlur=0;
        ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(ta)*r,cy+Math.sin(ta)*r);ctx.stroke()}
      pingsRef.current=pingsRef.current.filter(p2=>p2.opacity>0);
      pingsRef.current.forEach(p2=>{p2.radius+=1.5;p2.opacity-=0.015;
        // Parse color to rgba
        const pc=p2.color;const hexToRgb=h=>{const m=h.match(/^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
          return m?`${parseInt(m[1],16)},${parseInt(m[2],16)},${parseInt(m[3],16)}`:"57,255,20"};
        const rgb=hexToRgb(pc);
        ctx.strokeStyle=`rgba(${rgb},${p2.opacity})`;ctx.lineWidth=2;ctx.shadowColor=pc;ctx.shadowBlur=12;
        ctx.beginPath();ctx.arc(cx,cy,Math.max(0.1,Math.min(p2.radius,r)),0,Math.PI*2);ctx.stroke();
        if(p2.opacity>0.3){const bx2=cx+Math.cos(p2.angle+rand(-0.5,0.5))*rand(20,r-10);
          const by2=cy+Math.sin(p2.angle+rand(-0.5,0.5))*rand(20,r-10);
          ctx.fillStyle=`rgba(${rgb},${p2.opacity})`;ctx.shadowBlur=15;
          ctx.beginPath();ctx.arc(bx2,by2,2.5,0,Math.PI*2);ctx.fill()}});
      ctx.shadowBlur=0;ctx.fillStyle=NEON.cyan;ctx.shadowColor=NEON.cyan;ctx.shadowBlur=8;
      ctx.beginPath();ctx.arc(cx,cy,2.5,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
      raf=requestAnimationFrame(draw)}
    draw();return()=>cancelAnimationFrame(raf)},[]);
  return <canvas ref={canvasRef} style={{width:160,height:160}}/>;
}

// ═══════════════ BATTLEFIELD ═══════════════
function BattlefieldMap({tokens,lockedTokens,onSelect,selectedId,onKillFeed,onAlienUpdate,onMenuToggle,whaleTrigger,dolphinTrigger}){
  const canvasRef=useRef(null);const tokensRef=useRef([]);const frameRef=useRef(0);
  const explosionsRef=useRef([]);const fogRef=useRef([]);const lockedRef=useRef([]);
  const selectedRef=useRef(null);const warpTrailsRef=useRef([]);
  const alienRef=useRef([
    {x:0.2,y:0.07,state:"patrol",target:null,shootTimer:0,laserEnd:null,patrolTarget:null,
     name:"JEET HUNTER",kills:0,tier:0,color:"#00ffcc",accent:"#00ffcc"},
    {x:0.5,y:0.10,state:"patrol",target:null,shootTimer:0,laserEnd:null,patrolTarget:null,
     name:"RUG DESTROYER",kills:0,tier:0,color:"#ff00ff",accent:"#ff00ff"},
    {x:0.8,y:0.06,state:"patrol",target:null,shootTimer:0,laserEnd:null,patrolTarget:null,
     name:"SCAM ANNIHILATOR",kills:0,tier:0,color:"#ff6600",accent:"#ff6600"},
  ]);
  // Upgrade tiers: kills needed, weapon name, visual changes
  const ALIEN_TIERS=[
    {kills:0,weapon:"LASER",shootFrames:18,beams:1,size:1,glow:8},
    {kills:30,weapon:"RAPID FIRE",shootFrames:10,beams:1,size:1.1,glow:12},
    {kills:70,weapon:"TWIN LASER",shootFrames:12,beams:2,size:1.2,glow:15},
    {kills:120,weapon:"PLASMA CANNON",shootFrames:14,beams:1,size:1.35,glow:20,plasma:true},
    {kills:180,weapon:"MULTI-SHOT",shootFrames:8,beams:3,size:1.5,glow:25},
    {kills:250,weapon:"NUKE",shootFrames:20,beams:1,size:1.7,glow:35,nuke:true},
  ];
  const onKillFeedRef=useRef(onKillFeed);const onSelectRef=useRef(onSelect);const onAlienUpdateRef=useRef(onAlienUpdate);
  const onMenuRef=useRef(onMenuToggle);
    const imgCache=useRef({}); // { tokenId: { img: HTMLImageElement, loaded: bool } }

  // ═══ EASTER EGGS: Fat Monkey & J-Ai-C Mothership ═══
  const aiAvatarRef=useRef({
    x:0.5,y:0.45,targetX:0.5,targetY:0.45,state:"observing",
    focusToken:null,focusTimer:0,breathPhase:0,scanY:0,
    particles:[],thoughtBubble:null,walkSpeed:0.003,
    lastThought:0,blinkTimer:0,blinking:false,
    observeTimer:0,observeTarget:null,
    neuralPulse:0,moodColor:[0,200,255],moodTarget:[0,200,255],
    dataStreams:[],cloakPhase:0,gestureArm:0,gestureTarget:0,
    eyeGlow:1,headTilt:0,floatPhase:0,thinkTimer:0,
    orbitals:[],auraParticles:[],
    chatBubble:null,chatTimer:0,chatTarget:null,
    replyBubble:null,replyTimer:0,
    crewBubble:null,crewTimer:0,crewName:null,crewSlot:0,
    chatCooldown:0,morphMode:"normal",morphFrame:0,
  });
  const fatMonkeyRef=useRef({active:false,x:-0.1,frame:0,smokeRings:[],musicNotes:[],nextSpawn:Date.now()+rand(180,420)*1000,walkDir:1,smokeTimer:0,tripActive:false,tripFrame:0,tripMsg:false,tripMsgFrame:0,
    vortexActive:false,vortexFrame:0,swirlAngles:[0,0,0,0,0,0],suckedIn:[false,false,false,false,false,false]});
  const jaycShipRef=useRef({active:false,y:-0.3,frame:0,bills:[],aliens:[],nextSpawn:Date.now()+rand(240,480)*1000,opacity:0});
  const jayCRef=useRef({onGround:false,beamPhase:0,x:0.55,y:0.95,flexPhase:0,targetY:0.95,beamUp:false,opacity:0,beltHolder:"claude"});
  const lightModeRef=useRef({active:false,frame:0,maxFrames:180});
  const titleFlashRef=useRef({active:false,frame:0});
  // New easter egg refs
  const whaleRef=useRef({active:false,x:-0.15,y:0.5,frame:0,tokenName:""});
  // ═══ MULTI-CREATURE SYSTEM: dolphins, tiered whales, golden whales ═══
  const whalesRef=useRef([]); // array of whale objects
  const dolphinsRef=useRef([]); // array of dolphin pod objects
    const moonCelebRef=useRef({active:false,frame:0,particles:[],tokenName:""});
  const sessionBestRef=useRef({id:null,name:"",mcap:0});
  const shootingStarsRef=useRef([]);
  const goldenHourRef=useRef({active:false,opacity:0});
  const satoshiRef=useRef({active:false,x:0.5,y:0.5,nextSpawn:Date.now()+rand(300,600)*1000,frame:0,opacity:0,boosted:false});
  const marketTideRef=useRef({level:0.5,target:0.5});

  useEffect(()=>{lockedRef.current=lockedTokens},[lockedTokens]);
  useEffect(()=>{selectedRef.current=selectedId},[selectedId]);
  useEffect(()=>{onKillFeedRef.current=onKillFeed},[onKillFeed]);
  useEffect(()=>{onAlienUpdateRef.current=onAlienUpdate},[onAlienUpdate]);
  useEffect(()=>{onSelectRef.current=onSelect},[onSelect]);
  useEffect(()=>{onMenuRef.current=onMenuToggle},[onMenuToggle]);
  
  useEffect(()=>{
    tokens.filter(t=>t.qualified||t.migrated).forEach(t=>{
      const existing=tokensRef.current.find(e=>e.id===t.id);
      if(!existing){
        const copy={...t};
        tokensRef.current.push(copy);
        // Load token image — try metadata JSON, then direct CDN fallback
        const mintAddr=t.addr||"";
        if(!imgCache.current[t.id]){
          imgCache.current[t.id]={img:null,loaded:false};
          const loadImg=(url)=>{
            const img=new Image();img.crossOrigin="anonymous";
            img.onload=()=>{imgCache.current[t.id]={img,loaded:true}};
            img.onerror=()=>{};
            img.src=proxyUrl(url);
          };
          if(t.imageUri){
            // Try fetching uri as metadata JSON
            fetch(proxyUrl(t.imageUri),{mode:"cors"}).then(r=>{
              const ct=r.headers.get("content-type")||"";
              if(ct.includes("json"))return r.json();
              // It's probably already an image
              loadImg(t.imageUri);
              throw new Error("direct");
            }).then(meta=>{
              const imgUrl=meta.image||meta.image_uri||meta.imageUrl||"";
              if(imgUrl)loadImg(imgUrl);
            }).catch(()=>{});
          }
          // Also try pump.fun CDN as backup
          if(mintAddr){
            setTimeout(()=>{
              if(imgCache.current[t.id]?.loaded)return; // already got it
              loadImg(`https://pump.fun/coin/${mintAddr}/image`);
            },2000);
          }
        }
        if(t.laserIn){
          // Migration entry — laser handles the animation
          copy.warpIn=false;copy.alive=true;copy.laserFired=true;
        } else {
          // Normal entry — just place at bottom
          copy.warpIn=false;copy.by=0.95;copy.bx=rand(0.08,0.92);
          onKillFeedRef.current?.({type:"deploy",name:t.name,text:`⚡ ${t.name} — NEW CHALLENGER`})
        }
      } else {
        // Sync live data from state so progression uses real-time mcap/vol
        existing.mcap=t.mcap;existing.vol=t.vol;existing.buys=t.buys;existing.sells=t.sells;
        existing.holders=t.holders;existing.qualified=t.qualified;existing.qualScore=t.qualScore;
        existing.devWallet=t.devWallet;existing.topHolderPct=t.topHolderPct;
        existing.riskScore=t.riskScore;existing.threat=t.threat;existing.threatColor=t.threatColor;
        existing.migrated=t.migrated;existing.addr=t.addr;
        // Revival sync — if state says alive but ref says dead, revive on ref
        if(t.alive&&!existing.alive){existing.alive=true;existing.health=t.health||45;existing.by=0.92;existing.bx=rand(0.08,0.92);}
        if(!t.alive&&existing.alive){existing.alive=false;existing.deathTime=Date.now();}
        // Edge signals for health
        existing.freshPct=t.freshPct;existing.velocity=t.velocity;existing.accelerating=t.accelerating;
        existing.smallBuyRatio=t.smallBuyRatio;existing.retentionPct=t.retentionPct;
        existing.serialDeployer=t.serialDeployer;existing.staleSec=t.staleSec;
        existing.isStale=t.isStale;existing.isDead=t.isDead;existing.sellDumping=t.sellDumping;
        // New intel
        existing.bundleDetected=t.bundleDetected;existing.bundleSize=t.bundleSize;
        existing.hasSmartMoney=t.hasSmartMoney;existing.smartWalletCount=t.smartWalletCount;
        existing.narrativeMatch=t.narrativeMatch;existing.narrativeWord=t.narrativeWord;
        existing.deployerGrade=t.deployerGrade;existing.migratedAt=t.migratedAt;
        // Enrichment data
        existing.liquidity=t.liquidity;existing.mintAuth=t.mintAuth;existing.frozen=t.frozen;
        existing.dexEnriched=t.dexEnriched;existing.jupEnriched=t.jupEnriched;existing.heliusEnriched=t.heliusEnriched;
        existing.priceUsd=t.priceUsd;
        // Load DexScreener image if we got one and haven't loaded yet
        if(t.imageUri&&!imgCache.current[t.id]){
          imgCache.current[t.id]={img:null,loaded:false};
          const loadImg2=(url)=>{
            const img=new Image();img.crossOrigin="anonymous";
            img.onload=()=>{imgCache.current[t.id]={img,loaded:true}};
            img.onerror=()=>{};
            img.src=proxyUrl(url);
          };
          if(t.imageUri.startsWith("http"))loadImg2(t.imageUri);
        }
        if(t.laserIn&&!existing.laserFired){
          existing.laserIn=true;existing.laserProgress=0;existing.warpIn=false;
          existing.alive=true;existing.health=95;existing.laserFired=true;
          existing.laserTargetX=t.laserTargetX||(0.3+Math.random()*0.4);
          existing.laserTargetY=t.laserTargetY||0.5;
          existing.targetY=existing.laserTargetY;
          existing.bx=1.02;existing.by=0.18;
        }
        // Always mark laserFired if token has migrated to prevent re-fire
        if(t.migrated)existing.laserFired=true;
      }});
    if(tokensRef.current.length>150)tokensRef.current=tokensRef.current.slice(-150);
  },[tokens]);

  useEffect(()=>{for(let i=0;i<45;i++)fogRef.current.push({x:rand(0,1),y:rand(0.7,1.05),vx:rand(-0.0004,0.0004),size:rand(30,90),opacity:rand(0.02,0.06)})},[]);

  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return;
    const ctx=canvas.getContext("2d");let raf;
    function resize(){canvas.width=canvas.offsetWidth*2;canvas.height=canvas.offsetHeight*2;ctx.scale(2,2)}
    resize();
    let crashCount=0,lastCrashTime=0;
    function draw(){
     try{
      const W=canvas.width/2,H=canvas.height/2;
      ctx.clearRect(0,0,W,H);frameRef.current++;const f=frameRef.current;
      const locked=lockedRef.current;const selId=selectedRef.current;

      // Trench gradient
      const tG=ctx.createLinearGradient(0,H*0.7,0,H);
      tG.addColorStop(0,"transparent");tG.addColorStop(1,"rgba(255,0,100,0.05)");
      ctx.fillStyle=tG;ctx.fillRect(0,H*0.7,W,H*0.3);
      // Moon zone
      const mG=ctx.createLinearGradient(0,0,0,H*0.18);
      mG.addColorStop(0,"rgba(255,230,0,0.04)");mG.addColorStop(1,"transparent");
      ctx.fillStyle=mG;ctx.fillRect(0,0,W,H*0.18);

      // Hex grid
      ctx.strokeStyle="rgba(255,0,255,0.015)";ctx.lineWidth=0.5;
      const hR=45;
      for(let gx=-1;gx<W/hR/1.5+1;gx++)for(let gy=-1;gy<H/hR/1.7+1;gy++){
        const ox=gy%2===0?0:hR*0.87,cx2=gx*hR*1.74+ox+hR,cy2=gy*hR*1.5+hR;
        ctx.beginPath();for(let i=0;i<6;i++){const a2=Math.PI/3*i-Math.PI/6;
          const px2=cx2+hR*0.8*Math.cos(a2),py2=cy2+hR*0.8*Math.sin(a2);
          i===0?ctx.moveTo(px2,py2):ctx.lineTo(px2,py2)}ctx.closePath();ctx.stroke()}

      // Zone labels — custom spacing: pit is massive, zones shrink higher up
      [{y:0.10,l:"◈ THE MOON — $300K+ ◈",c:"rgba(255,230,0,0.8)",sc:"#ffe600",bold:true},
       {y:0.20,l:"ORBIT — $100K+",c:"rgba(57,255,20,0.6)",sc:"#39ff14"},
       {y:0.32,l:"THE CLIMB — $50K+",c:"rgba(0,255,255,0.6)",sc:"#00ffff"},
       {y:0.47,l:"NO MAN'S LAND — $20K+",c:"rgba(255,102,0,0.6)",sc:"#ff6600"},
       {y:0.63,l:"⚔ THE TRENCHES — $10K+ ⚔",c:"rgba(255,7,58,0.6)",sc:"#ff073a"},
       {y:0.95,l:"— THE PIT — $5K —",c:"rgba(255,0,100,0.35)",sc:"#ff0064"}].forEach(z=>{
        ctx.strokeStyle=z.c.replace(/[\d.]+\)$/,"0.2)");ctx.lineWidth=0.5;ctx.setLineDash([8,12]);
        ctx.beginPath();ctx.moveTo(0,z.y*H);ctx.lineTo(W,z.y*H);ctx.stroke();ctx.setLineDash([]);
        ctx.font=z.bold?"bold 14px 'Orbitron'":"bold 11px 'Orbitron'";ctx.fillStyle=z.c;ctx.shadowColor=z.sc;ctx.shadowBlur=12;
        ctx.fillText(z.l,8,z.y*H-4);ctx.shadowBlur=0});

      // War fog
      fogRef.current.forEach(fog=>{fog.x+=fog.vx;if(fog.x<-0.1)fog.x=1.1;if(fog.x>1.1)fog.x=-0.1;
        const grd=ctx.createRadialGradient(fog.x*W,fog.y*H,0,fog.x*W,fog.y*H,fog.size);
        grd.addColorStop(0,`rgba(255,0,100,${fog.opacity*0.5})`);grd.addColorStop(0.5,`rgba(100,0,50,${fog.opacity*0.2})`);
        grd.addColorStop(1,"transparent");ctx.fillStyle=grd;
        ctx.fillRect(fog.x*W-fog.size,fog.y*H-fog.size,fog.size*2,fog.size*2)});

      // Moon
      const moonX=W/2,moonY=H*0.07,moonR=28+Math.sin(f*0.01)*2;
      const mglow=ctx.createRadialGradient(moonX,moonY,0,moonX,moonY,moonR*5);
      mglow.addColorStop(0,"rgba(255,230,0,0.1)");mglow.addColorStop(0.3,"rgba(255,200,0,0.03)");
      mglow.addColorStop(1,"transparent");ctx.fillStyle=mglow;
      ctx.fillRect(moonX-moonR*5,moonY-moonR*5,moonR*10,moonR*10);
      ctx.save();ctx.translate(moonX,moonY);ctx.rotate(f*0.005);
      ctx.fillStyle="rgba(255,230,0,0.18)";ctx.shadowColor=NEON.yellow;ctx.shadowBlur=30;
      ctx.beginPath();ctx.arc(0,0,moonR,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle="rgba(255,230,0,0.5)";ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(0,0,moonR,0,Math.PI*2);ctx.stroke();
      ctx.fillStyle="rgba(255,230,0,0.06)";
      [[-8,-5,4],[9,3,3.5],[-3,9,3],[6,-7,2]].forEach(([a,b,c])=>{ctx.beginPath();ctx.arc(a,b,c,0,Math.PI*2);ctx.fill()});
      ctx.strokeStyle="rgba(255,230,0,0.12)";ctx.lineWidth=0.5;ctx.setLineDash([3,6]);
      ctx.beginPath();ctx.ellipse(0,0,moonR+16,moonR+9,f*0.01,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
      // Moon click reserved for future interaction — no text
      ctx.textBaseline="alphabetic";
      ctx.shadowBlur=0;ctx.restore();
      ctx.font="bold 14px 'Orbitron'";ctx.fillStyle=`rgba(255,230,0,${0.3+Math.sin(f*0.03)*0.15})`;
      ctx.textAlign="center";ctx.fillText("🌙 MOON",moonX,moonY+moonR+14);ctx.textAlign="left";

      // Radial pulse
      const pR=Math.max(1,(f%180)/180*Math.max(W,H)*0.5);
      ctx.strokeStyle=`rgba(255,0,255,${0.02*(1-(f%180)/180)})`;ctx.lineWidth=1;
      ctx.beginPath();ctx.arc(W/2,H/2,pR,0,Math.PI*2);ctx.stroke();

      // Warp trails
      warpTrailsRef.current=warpTrailsRef.current.filter(w=>w.life>0);
      warpTrailsRef.current.forEach(w=>{w.life-=0.03;
        ctx.fillStyle=`rgba(0,255,255,${w.life*0.4})`;ctx.shadowColor=NEON.cyan;ctx.shadowBlur=8;
        ctx.beginPath();ctx.arc(w.x*W,w.y*H,Math.max(0.5,2*w.life),0,Math.PI*2);ctx.fill();ctx.shadowBlur=0});

      // Explosions
      explosionsRef.current=explosionsRef.current.filter(e=>e.life>0);
      explosionsRef.current.forEach(ex=>{ex.life-=0.015;
        const exR=Math.max(1,(1-ex.life)*60);
        ctx.strokeStyle=`rgba(255,7,58,${ex.life*0.6})`;ctx.lineWidth=2;ctx.shadowColor=NEON.red;ctx.shadowBlur=15;
        ctx.beginPath();ctx.arc(ex.x*W,ex.y*H,exR,0,Math.PI*2);ctx.stroke();
        if(ex.life>0.7){ctx.fillStyle=`rgba(255,200,50,${(ex.life-0.7)*3})`;
          ctx.beginPath();ctx.arc(ex.x*W,ex.y*H,Math.max(1,(1-ex.life)*30),0,Math.PI*2);ctx.fill()}
        ex.particles.forEach(p3=>{p3.x+=p3.vx;p3.y+=p3.vy;p3.vy+=0.0001;
          ctx.fillStyle=`rgba(255,7,58,${ex.life})`;
          ctx.beginPath();ctx.arc(p3.x*W,p3.y*H,Math.max(0.3,2*ex.life),0,Math.PI*2);ctx.fill()});
        ctx.shadowBlur=0});

      // Tokens — render only top 40 visually, but update ALL data
      const MAX_VISUAL=40;
      const visualSet=new Set();
      const aliveAll=tokensRef.current.filter(t=>t.alive&&(t.mcap||0)>=5000);
      // Priority: locked first, then migrated, then by mcap descending
      aliveAll.sort((a,b)=>{
        const aLk=lockedRef.current.find(l=>l.id===a.id)?1:0;
        const bLk=lockedRef.current.find(l=>l.id===b.id)?1:0;
        if(aLk!==bLk)return bLk-aLk;
        if(a.laserIn&&!b.laserIn)return -1;if(b.laserIn&&!a.laserIn)return 1;
        if(a.migrated&&!b.migrated)return -1;if(b.migrated&&!a.migrated)return 1;
        // Momentum score: mcap + volume + holders + acceleration
        const aScore=(a.mcap||0)+(a.vol||0)*2+(a.holders||0)*100+(a.accelerating?50000:0)+(a.qualScore||0)*5000;
        const bScore=(b.mcap||0)+(b.vol||0)*2+(b.holders||0)*100+(b.accelerating?50000:0)+(b.qualScore||0)*5000;
        return bScore-aScore;
      });
      aliveAll.slice(0,MAX_VISUAL).forEach(t=>visualSet.add(t.id));

      tokensRef.current.forEach(t=>{
        if(!t.alive)return;t.age++;
        const isVisual=visualSet.has(t.id);
        if(t.warpIn){t.warpIn=false;t.by=0.95;t.bx=rand(0.08,0.92);}

        // GREEN LASER for migrated tokens — shoots from RADAR to battlefield
        if(t.laserIn){
          if(!t.laserProgress)t.laserProgress=0;
          t.laserProgress+=0.018;
          const landX=t.laserTargetX||0.5,landY=t.laserTargetY||0.5;
          if(t.laserProgress>=1){t.laserIn=false;t.laserProgress=1;
            t.bx=landX;t.by=landY;
            for(let i=0;i<12;i++)warpTrailsRef.current.push({x:landX+rand(-0.03,0.03),y:landY+rand(-0.03,0.03),life:1});
            onKillFeedRef.current?.({type:"migration",name:t.name,text:`🌉 ${t.name} GRADUATED — DEPLOYED TO BATTLEFIELD`})}
          const lp=t.laserProgress,ep=1-Math.pow(1-lp,3);
          // Origin: radar panel area (top-right)
          const startX=1.02,startY=0.18;
          const curX=startX+(landX-startX)*ep,curY=startY+(landY-startY)*ep;
          // Main laser beam
          const beamAlpha=(1-lp)*0.9;
          ctx.strokeStyle=`rgba(57,255,20,${beamAlpha})`;ctx.lineWidth=2;
          ctx.shadowColor="#39ff14";ctx.shadowBlur=20;
          ctx.beginPath();ctx.moveTo(startX*W,startY*H);ctx.lineTo(curX*W,curY*H);ctx.stroke();
          // Outer glow beam
          ctx.strokeStyle=`rgba(57,255,20,${beamAlpha*0.3})`;ctx.lineWidth=8;
          ctx.beginPath();ctx.moveTo(startX*W,startY*H);ctx.lineTo(curX*W,curY*H);ctx.stroke();
          // Leading dot with pulse
          const dotSize=Math.max(2,5*(1-lp)+3)+Math.sin(lp*20)*1.5;
          ctx.fillStyle="#39ff14";ctx.beginPath();ctx.arc(curX*W,curY*H,dotSize,0,Math.PI*2);ctx.fill();
          // Sparkle particles along beam
          for(let i=0;i<4;i++){
            const sp=Math.random();
            const sparkX=startX+(curX-startX)*sp,sparkY=startY+(curY-startY)*sp+rand(-0.015,0.015);
            ctx.fillStyle=`rgba(57,255,20,${Math.random()*0.5})`;
            ctx.beginPath();ctx.arc(sparkX*W,sparkY*H,rand(0.5,2),0,Math.PI*2);ctx.fill();
          }
          ctx.shadowBlur=0;t.bx=curX;t.by=curY;return}

        if(f%30===0){
          // Runners with real momentum are harder to kill
          const buyPressure=t.buys>0?t.buys/(t.buys+t.sells+1):0.5;
          const hasVolume=t.vol>500;
          const isMooning=t.mcap>20000&&hasVolume&&buyPressure>0.5;
          const isRunner=t.mcap>40000&&hasVolume&&buyPressure>0.55;
          const isMigrated=t.migrated===true;

          // ─── EDGE SIGNAL HEALTH MODIFIERS ───
          // Every metric contributes to edge quality
          // eq ranges 0 (death sentence) to 1 (unkillable)
          let eq=0.5;

          // Fresh wallets: established buyers = good, all fresh = coordinated
          const fresh=t.freshPct||50;
          if(fresh<40)eq+=0.08; else if(fresh>80)eq-=0.12;

          // Holder retention: diamond hands vs early dump
          const retain=t.retentionPct||50;
          if(retain>70)eq+=0.1; else if(retain<30)eq-=0.1;

          // Buy velocity & acceleration: momentum = life
          if(t.accelerating)eq+=0.08;
          if((t.velocity||0)>=5)eq+=0.04;
          if((t.velocity||0)===0&&t.buys>5)eq-=0.06; // was active, now dead = dying

          // Staleness: no recent trades = dying
          // MIGRATED tokens get 5-minute grace period — PumpPortal goes silent but they're alive on Raydium
          const stale=t.staleSec||0;
          const migGrace=t.migrated&&t.migratedAt&&(Date.now()-t.migratedAt<600000);
          if(!migGrace){
            if(t.isDead)eq-=0.25;          // 3+ min no trades = flatline
            else if(t.isStale)eq-=0.12;    // 1+ min no trades = fading
          }

          // Active sell dumping
          if(t.sellDumping)eq-=0.15;     // sells overwhelming buys

          // Retail buy ratio: organic small buys = healthy
          const retail=t.smallBuyRatio||50;
          if(retail>60)eq+=0.06; else if(retail<20)eq-=0.06;

          // Serial deployer: reputation matters
          if(t.serialDeployer)eq-=0.12;

          // On-chain red flags from Helius
          if(t.mintAuth)eq-=0.15;      // can mint more tokens
          if(t.frozen)eq-=0.2;         // can freeze holders

          // Dev wallet %: big dev bag = risky
          const dev=t.devWallet||0;
          if(dev<5)eq+=0.06; else if(dev>20)eq-=0.08; else if(dev>35)eq-=0.15;

          // Top holder concentration: one whale = fragile
          const topH=t.topHolderPct||0;
          if(topH<25)eq+=0.06; else if(topH>50)eq-=0.1; else if(topH>40)eq-=0.05;

          // Holder count: more unique holders = more resilient
          const h=t.holders||1;
          if(h>30)eq+=0.08; else if(h>15)eq+=0.04; else if(h<5)eq-=0.06;

          // Buy/sell pressure: more buys than sells = healthy
          if(buyPressure>0.65)eq+=0.08; else if(buyPressure<0.35)eq-=0.1;

          // Vol/mcap ratio: real volume backing the cap
          const vmRatio=t.mcap>0?t.vol/t.mcap:0;
          if(vmRatio>0.05)eq+=0.05; else if(vmRatio<0.01&&t.mcap>10000)eq-=0.08;

          eq=Math.max(0.1,Math.min(1,eq));

          // ─── DEATH TIERS: granular by mcap + momentum ───
          const mc3=t.mcap||0;
          const rising=t.accelerating||(buyPressure>0.55&&hasVolume);
          let baseDeath;

          if(isMigrated){
            // === MIGRATED TOKENS: extremely resilient ===
            // They only die if they fall back into the trenches (<$10K) AND have no traction
            if(mc3>=10000){
              baseDeath=0; // invulnerable above $10K — they earned their spot
              // Heal migrated tokens that are doing well
              if(mc3>=20000&&buyPressure>0.4)t.health=Math.min(100,t.health+rand(1,4));
              else t.health=Math.min(100,Math.max(40,t.health+rand(0,2)));
            }else{
              // Below $10K — trenches rules apply, they can die
              baseDeath=0.04;
            }
          }
          else if(mc3>100000&&hasVolume)baseDeath=0.002;        // orbit = nearly immune
          else if(mc3>50000&&hasVolume)baseDeath=0.004;         // the climb
          else if(mc3>20000&&hasVolume)baseDeath=0.008;         // no man's land w/ vol
          else if(mc3>20000)baseDeath=0.02;                     // no man's land no vol
          else if(mc3>10000&&rising)baseDeath=0.01;             // trenches + climbing
          else if(mc3>10000&&hasVolume)baseDeath=0.025;         // trenches w/ volume
          else if(mc3>10000)baseDeath=0.04;                     // trenches stalling
          else if(mc3>7000&&rising)baseDeath=0.04;              // climbing out of pit
          else baseDeath=0.08;                                  // the pit — brutal

          // Edge quality modifier
          const deathChance=baseDeath*(1.5-eq);
          const luck=Math.random();
          // Shield: migrated above $10K = absolute shield. Or actively climbing with good fundamentals
          const shielded=(isMigrated&&mc3>=10000)||(mc3>10000&&rising&&eq>0.55);
          if(luck<deathChance&&t.health>20&&!shielded){
            // Only alien-kill visible tokens ($5K+), invisible ones just die quietly
            if((t.mcap||0)<5000){
              t.health=0;t.alive=false;t.deathTime=Date.now();
            } else {
            const freeAlien=alienRef.current.find(aa=>aa.state==="patrol");
            if(freeAlien){
              freeAlien.state="hunting";freeAlien.target={id:t.id,x:t.bx,y:t.by,name:t.name,addr:t.addr};
              freeAlien.shootTimer=0;
            } else {
              // All aliens busy — instant kill
              t.health=0;t.alive=false;t.deathTime=Date.now();
              explosionsRef.current.push({x:t.bx,y:t.by,life:1,
                particles:Array.from({length:15},()=>({x:t.bx,y:t.by,vx:rand(-0.008,0.008),vy:rand(-0.008,0.004)}))});
              onKillFeedRef.current?.({type:"rug",name:t.name,text:`💀 ${t.name} RUGGED — ELIMINATED`,addr:t.addr});
            }
            } // end visible-only alien targeting
          }else if(t.isDead&&!migGrace&&!(isMigrated&&mc3>=10000)){
            // 3+ min no trades — forced rapid drain, no healing possible
            // But migrated tokens above $10K are protected
            t.health=Math.max(0,t.health-rand(12,25));
          }else if(t.isStale&&!migGrace&&!(isMigrated&&mc3>=10000)){
            // 1+ min no trades — slow drain, minimal healing
            t.health=Math.max(0,t.health-rand(3,8));
          }else if(migGrace||(isMigrated&&mc3>=10000)){
            // Migrated grace OR migrated above $10K — hold health steady, slight heal
            t.health=Math.min(100,Math.max(40,t.health+rand(0,2)));
          }else if(t.sellDumping&&!(isMigrated&&mc3>=10000)){
            // Active dump — taking heavy damage
            t.health=Math.max(0,t.health-rand(5,12));
          }else if(luck<0.25){
            // Damage scales with tier — higher mcap = less damage
            const tierMult=mc3>50000?0.3:mc3>20000?0.5:mc3>10000?0.7:1;
            const dmg=rand(2,10)*tierMult*(1.3-eq);
            t.health=Math.max(0,t.health-dmg);
          }else if(luck<0.6){
            t.health=Math.min(100,t.health+rand(2,6)*(0.7+eq));
          }else{
            t.health=Math.min(100,t.health+rand(4,12)*eq);
          }
          }

        // Progression: mcap-based, volume confirms legitimacy
        const volRatio=t.mcap>0?t.vol/t.mcap:0;
        const volGate=Math.min(1,volRatio/0.03); // full credit at 3% vol/mcap
        // Piecewise progression: pit ($5-10K) gets 1/3 of field, zones shrink upward
        // mcap breakpoints → Y positions (0=top, 1=bottom)
        const mc=t.mcap||0;
        const zones=[[5000,0.95],[10000,0.63],[20000,0.47],[50000,0.32],[100000,0.20],[300000,0.08]];
        let targetFromMcap=0.95;
        if(mc>=300000)targetFromMcap=-0.08; // OFF SCREEN ABOVE — they mooned
        else{for(let i=0;i<zones.length-1;i++){
          if(mc>=zones[i][0]&&mc<zones[i+1][0]){
            const pct=(mc-zones[i][0])/(zones[i+1][0]-zones[i][0]);
            targetFromMcap=zones[i][1]+(zones[i+1][1]-zones[i][1])*pct;break;}}}
        const gatedProgress=targetFromMcap+(0.95-targetFromMcap)*(1-Math.max(volGate,t.migrated?0.8:t.qualified?0.3:0));
        const canMove=t.migrated||(t.buys>=1&&t.vol>50);
        t.targetY=Math.max(-0.1,Math.min(0.95,canMove?gatedProgress:0.95)); // allow negative Y (off screen)
        const moveSpeed=t.migrated?0.015:0.005;
        t.by+=(t.targetY-t.by)*moveSpeed;t.bx+=t.vx;if(t.bx<0.05||t.bx>0.95)t.vx*=-1;
        if(f%4===0){t.trail.push({x:t.bx,y:t.by,life:1});if(t.trail.length>20)t.trail.shift()}
        if(t.by<0.12&&!t.mooned){t.mooned=true;
          onKillFeedRef.current?.({type:"moon",name:t.name,text:`🚀 ${t.name} HIT THE MOON! 🌙`});
          // Trigger golden moon celebration
          if(!moonCelebRef.current.active){
            moonCelebRef.current={active:true,frame:0,particles:[],tokenName:t.name};
          }
        }
        // If token comes back from moon, unmark
        if(t.by>0.15&&t.mooned&&mc<280000)t.mooned=false;
        // Skip rendering if off screen
        if(t.by<-0.05)return;
        // Skip visual rendering for non-priority tokens (data still updates above)
        if(!isVisual)return;

        const px=Math.round(t.bx*W),py=Math.round(t.by*H);const isLk=locked.find(l=>l.id===t.id);const isSel=t.id===selId;
        const color=t.health>70?NEON.green:t.health>40?NEON.yellow:t.health>20?NEON.orange:NEON.red;
        const bob=Math.round(Math.sin(f*0.03+t.bobOffset)*2);const cc=t.coinColor;const cr=12;

        // Trail - tiny dots
        t.trail.forEach(tr=>{tr.life-=0.015;if(tr.life<=0)return;
          ctx.fillStyle=t.health>50?`rgba(57,255,20,${tr.life*0.1})`:`rgba(255,7,58,${tr.life*0.1})`;
          ctx.beginPath();ctx.arc(tr.x*W,tr.y*H,1,0,Math.PI*2);ctx.fill()});
        t.trail=t.trail.filter(tr=>tr.life>0);

        // Lock
        if(isLk){ctx.strokeStyle=`rgba(255,230,0,${0.5+Math.sin(f*0.06)*0.2})`;ctx.lineWidth=1;
          ctx.save();ctx.translate(px,py+bob);ctx.rotate(f*0.015);
          ctx.setLineDash([4,3]);ctx.beginPath();ctx.arc(0,0,14,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.restore()}
        if(isSel){ctx.strokeStyle=`rgba(0,255,255,${0.5+Math.sin(f*0.08)*0.3})`;ctx.lineWidth=1;
          ctx.beginPath();ctx.arc(px,py+bob,15,0,Math.PI*2);ctx.stroke()}

        // BUNDLE WARNING — pulsing red glow ring
        if(t.bundleDetected&&(t.bundleSize||0)>0){
          const pulseA=0.3+Math.sin(f*0.12)*0.25;
          ctx.save();ctx.shadowColor="#ff073a";ctx.shadowBlur=12+Math.sin(f*0.08)*6;
          ctx.strokeStyle=`rgba(255,7,58,${pulseA})`;ctx.lineWidth=2;
          ctx.beginPath();ctx.arc(px,py+bob,cr+5,0,Math.PI*2);ctx.stroke();ctx.restore();
          // Red ⚠B + count label on RIGHT
          const bLabel="⚠B"+(t.bundleSize||"");
          ctx.font="bold 8px 'Orbitron',sans-serif";ctx.fillStyle="#ff073a";
          ctx.shadowColor="#ff073a";ctx.shadowBlur=6;
          ctx.fillText(bLabel,px+cr+4,py+bob-cr);
          ctx.shadowBlur=0;
        }

        // SMART MONEY — orange glow + $ label on LEFT
        if(t.hasSmartMoney&&(t.smartWalletCount||0)>0&&!(t.bundleDetected&&(t.bundleSize||0)>0)){
          ctx.save();ctx.shadowColor="#ff9500";ctx.shadowBlur=8;
          ctx.strokeStyle=`rgba(255,149,0,${0.3+Math.sin(f*0.1)*0.15})`;ctx.lineWidth=1.5;
          ctx.beginPath();ctx.arc(px,py+bob,cr+4,0,Math.PI*2);ctx.stroke();ctx.restore();
        }
        if((t.smartWalletCount||0)>0){
          const swc=t.smartWalletCount;
          ctx.font="bold 9px 'Orbitron',sans-serif";ctx.fillStyle="#ff9500";
          ctx.shadowColor="#ff9500";ctx.shadowBlur=6;
          ctx.fillText("$"+swc,px-cr-ctx.measureText("$"+swc).width-4,py+bob-cr+2);
          ctx.shadowBlur=0;
        }

        // BONDING CURVE PROGRESS — arc ring around pre-migration tokens
        if(t.bondingPct>20&&!t.migrated){
          const arcPct=Math.min(1,t.bondingPct/100);
          const arcColor=t.bondingPct>80?"#39ff14":t.bondingPct>60?"#00ccff":"#666";
          const arcAlpha=t.bondingPct>80?(0.6+Math.sin(f*0.15)*0.3):0.35;
          ctx.save();ctx.translate(px,py+bob);ctx.rotate(-Math.PI/2);
          ctx.strokeStyle=arcColor;ctx.globalAlpha=arcAlpha;ctx.lineWidth=2;
          ctx.beginPath();ctx.arc(0,0,cr+7,0,Math.PI*2*arcPct);ctx.stroke();
          ctx.globalAlpha=1;ctx.restore();
          if(t.bondingPct>80){
            ctx.font="bold 7px 'Orbitron'";ctx.fillStyle="#39ff14";
            ctx.textAlign="center";ctx.fillText(t.bondingPct.toFixed(0)+"%",px,py+bob+cr+10);ctx.textAlign="left";
          }
        }

        // MULTI-TREND GLOW — gold shimmer for tokens trending on multiple platforms
        if(t.trendScore>=2){
          const tGlow=0.15+Math.sin(f*0.06)*0.1;
          ctx.save();ctx.shadowColor="#ffd740";ctx.shadowBlur=15+Math.sin(f*0.08)*8;
          ctx.strokeStyle=`rgba(255,215,64,${tGlow})`;ctx.lineWidth=1;
          ctx.beginPath();ctx.arc(px,py+bob,cr+9,0,Math.PI*2);ctx.stroke();ctx.restore();
        }

        // KOTH CROWN — tiny pixel crown above token
        if(t.isKOTH){
          ctx.font="bold 10px sans-serif";ctx.textAlign="center";
          ctx.fillStyle=`rgba(255,215,64,${0.7+Math.sin(f*0.08)*0.3})`;
          ctx.shadowColor="#ffd740";ctx.shadowBlur=8;
          ctx.fillText("👑",px,py+bob-cr-4);ctx.shadowBlur=0;ctx.textAlign="left";
        }

        // PAPER LIQUIDITY WARNING — red dashed ring
        if(t.liquidityRating==="PAPER"&&t.mcap>10000){
          ctx.save();ctx.setLineDash([3,3]);
          ctx.strokeStyle=`rgba(255,7,58,${0.4+Math.sin(f*0.1)*0.2})`;ctx.lineWidth=1;
          ctx.beginPath();ctx.arc(px,py+bob,cr+6,0,Math.PI*2);ctx.stroke();
          ctx.setLineDash([]);ctx.restore();
        }

        // JUPITER VERIFIED — small green check below
        if(t.jupVerified){
          ctx.font="bold 7px 'Orbitron'";ctx.textAlign="center";
          ctx.fillStyle="rgba(57,255,20,0.6)";
          ctx.fillText("✓",px,py+bob+cr+8);ctx.textAlign="left";
        }

        // Coin: image if loaded, else colored circle + initial
        const cached=imgCache.current[t.id];
        if(cached&&cached.loaded&&cached.img){
          // Draw image clipped to circle
          ctx.save();
          ctx.beginPath();ctx.arc(px,py+bob,cr,0,Math.PI*2);ctx.clip();
          try{ctx.drawImage(cached.img,px-cr,py+bob-cr,cr*2,cr*2)}catch(e){}
          ctx.restore();
          // Rim
          ctx.strokeStyle=cc.rim;ctx.lineWidth=1.5;
          ctx.beginPath();ctx.arc(px,py+bob,cr,0,Math.PI*2);ctx.stroke();
        } else {
          ctx.fillStyle=cc.bg;
          ctx.beginPath();ctx.arc(px,py+bob,cr,0,Math.PI*2);ctx.fill();
          ctx.strokeStyle=cc.rim;ctx.lineWidth=1.5;
          ctx.beginPath();ctx.arc(px,py+bob,cr,0,Math.PI*2);ctx.stroke();
          ctx.font="bold 14px 'Orbitron',sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";
          ctx.fillStyle=cc.fg;ctx.fillText(t.initials.charAt(0),px,py+bob);
        }

        // Thin health color ring
        ctx.strokeStyle=`${color}50`;ctx.lineWidth=1;
        ctx.beginPath();ctx.arc(px,py+bob,cr+2,0,Math.PI*2);ctx.stroke();

        // Moon dots
        if(t.by<0.15)for(let oi=0;oi<3;oi++){const oa=f*0.04+oi*(Math.PI*2/3);
          ctx.fillStyle="rgba(255,230,0,0.5)";ctx.beginPath();
          ctx.arc(px+Math.cos(oa)*12,py+bob+Math.sin(oa)*12,1.5,0,Math.PI*2);ctx.fill()}

        // HP bar — 2px tall, tight
        const hbW=16,hbY=py+bob+cr+3;
        ctx.fillStyle="rgba(255,255,255,0.04)";ctx.fillRect(px-hbW/2,hbY,hbW,2);
        ctx.fillStyle=color;ctx.fillRect(px-hbW/2,hbY,Math.max(0,hbW*(t.health/100)),2);

        // HOLDERS — blue H count below health bar
        if((t.holders||0)>0){
          const hLabel="H"+t.holders;
          ctx.font="bold 7px 'Orbitron',sans-serif";ctx.fillStyle="#00bfff";
          ctx.shadowColor="#00bfff";ctx.shadowBlur=4;
          ctx.textAlign="center";ctx.fillText(hLabel,px,hbY+10);
          ctx.textAlign="left";ctx.shadowBlur=0;
        }

        // Name — small, above
        ctx.font="10px 'Share Tech Mono'";
        ctx.fillStyle=isLk?NEON.yellow:isSel?NEON.cyan:`rgba(224,224,255,0.4)`;
        ctx.textAlign="center";ctx.textBaseline="alphabetic";
        ctx.fillText(t.name,px,py+bob-cr-3);
        ctx.textAlign="left";ctx.textBaseline="alphabetic";
      });
      // Clean up truly dead tokens from ref only if they've been dead 2+ min
      const nowClean=Date.now();
      tokensRef.current=tokensRef.current.filter(t=>{
        if(t.alive)return true;
        if(t.migrated)return true; // keep migrated for revival
        if(nowClean-(t.deathTime||t.timestamp||0)<30000)return true;
        return false;
      });

      
      // ═══ ALIEN FLEET — TIERED WEAPON SYSTEM ═══
      alienRef.current.forEach((a,ai)=>{
        // Compute tier
        let tier=0;
        for(let i=ALIEN_TIERS.length-1;i>=0;i--){if(a.kills>=ALIEN_TIERS[i].kills){tier=i;break;}}
        a.tier=tier;
        const T=ALIEN_TIERS[tier];
        const sz=T.size;

        const zoneMinX=ai*0.3+0.05,zoneMaxX=ai*0.3+0.32;
        if(a.state==="patrol"){
          if(!a.patrolTarget||Math.abs(a.x-a.patrolTarget.x)<0.01){
            a.patrolTarget={x:rand(zoneMinX,zoneMaxX),y:rand(0.04,0.18)};
          }
          a.x+=(a.patrolTarget.x-a.x)*0.008;
          a.y+=(a.patrolTarget.y-a.y)*0.008;
        } else if(a.state==="hunting"&&a.target){
          const tgt=a.target;
          const liveT=tokensRef.current.find(t2=>t2.id===tgt.id);
          if(liveT){tgt.x=liveT.bx;tgt.y=liveT.by;}
          const aimX=tgt.x,aimY=Math.max(0.04,tgt.y-0.12);
          const huntSpeed=0.04+(tier*0.008); // faster hunting at higher tiers
          a.x+=(aimX-a.x)*huntSpeed;a.y+=(aimY-a.y)*huntSpeed;
          if(Math.abs(a.x-aimX)<0.03&&Math.abs(a.y-aimY)<0.03){
            a.state="shooting";a.shootTimer=0;
            a.laserEnd={x:tgt.x,y:tgt.y};
          }
          if(!liveT){a.state="patrol";a.target=null;}
        } else if(a.state==="shooting"){
          a.shootTimer++;
          const killFrame=Math.floor(T.shootFrames*0.8);
          if(a.laserEnd&&a.shootTimer<T.shootFrames){
            const flicker=0.7+Math.sin(a.shootTimer*3)*0.3;
            const sx=a.x*W,sy=(a.y+0.02)*H,ex=a.laserEnd.x*W,ey=a.laserEnd.y*H;

            // ─── WEAPON VISUALS BY TIER ───
            if(T.nuke){
              // NUKE: massive expanding beam
              const nukeWidth=2+a.shootTimer*0.8;
              const nukeAlpha=Math.max(0.2,1-a.shootTimer/T.shootFrames);
              ctx.strokeStyle=`rgba(255,${100+randInt(0,100)},0,${nukeAlpha})`;ctx.lineWidth=nukeWidth;
              ctx.shadowColor="#ff4400";ctx.shadowBlur=40;
              ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(ex,ey);ctx.stroke();
              ctx.strokeStyle=`rgba(255,255,200,${nukeAlpha*0.5})`;ctx.lineWidth=nukeWidth*0.4;
              ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(ex,ey);ctx.stroke();
              // Screen shake effect via random sparks everywhere
              for(let i=0;i<5;i++){
                ctx.fillStyle=`rgba(255,${randInt(100,255)},0,${Math.random()*0.6})`;
                ctx.beginPath();ctx.arc(ex+rand(-40,40),ey+rand(-40,40),rand(2,5),0,Math.PI*2);ctx.fill();
              }
            } else if(T.plasma){
              // PLASMA: thick wavering beam with electric arcs
              const pw=4+Math.sin(a.shootTimer*5)*2;
              ctx.strokeStyle=`rgba(${a.color==='#ff00ff'?'255,0,255':a.color==='#ff6600'?'255,102,0':'0,255,204'},${flicker})`;
              ctx.lineWidth=pw;ctx.shadowColor=a.color;ctx.shadowBlur=25;
              ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(ex,ey);ctx.stroke();
              // Electric arcs
              for(let i=0;i<3;i++){
                const mx2=(sx+ex)/2+rand(-20,20),my2=(sy+ey)/2+rand(-20,20);
                ctx.strokeStyle=`rgba(255,255,255,${Math.random()*0.4})`;ctx.lineWidth=0.5;
                ctx.beginPath();ctx.moveTo(sx,sy);ctx.quadraticCurveTo(mx2,my2,ex,ey);ctx.stroke();
              }
            } else {
              // STANDARD / RAPID / TWIN / MULTI beams
              for(let b=0;b<T.beams;b++){
                const spread=(b-(T.beams-1)/2)*8;
                ctx.strokeStyle=`rgba(255,0,80,${flicker})`;ctx.lineWidth=T.beams>2?1.5:2;
                ctx.shadowColor="#ff0050";ctx.shadowBlur=T.glow;
                ctx.beginPath();ctx.moveTo(sx+spread,sy);ctx.lineTo(ex+spread*0.5,ey);ctx.stroke();
                ctx.strokeStyle=`rgba(255,100,150,${flicker*0.3})`;ctx.lineWidth=T.beams>2?3:5;
                ctx.beginPath();ctx.moveTo(sx+spread,sy);ctx.lineTo(ex+spread*0.5,ey);ctx.stroke();
              }
            }
            ctx.shadowBlur=0;
            // Impact sparks
            const sparkCount=T.nuke?8:T.plasma?4:2;
            for(let i=0;i<sparkCount;i++){
              ctx.fillStyle=`rgba(255,${randInt(50,200)},0,${Math.random()*0.8})`;
              ctx.beginPath();ctx.arc((a.laserEnd.x+rand(-0.02,0.02))*W,(a.laserEnd.y+rand(-0.02,0.02))*H,rand(1,T.nuke?5:3),0,Math.PI*2);ctx.fill();
            }
          }
          if(a.shootTimer===killFrame){
            const victim=tokensRef.current.find(t2=>t2.id===a.target?.id);
            if(victim&&victim.alive){
              // Only kill if still weak — if it recovered, abort
              if(victim.health>60&&(victim.mcap||0)>15000){
                // Token recovered — abort kill, alien returns to patrol
                a.state="patrol";a.target=null;a.laserEnd=null;
              } else {
              // Alien kills are REAL — token dies on impact
              victim.health=0;victim.alive=false;victim.deathTime=Date.now();
              a.kills++;
              onKillFeedRef.current?.({type:"rug",name:victim.name,text:`💀 ${a.name} ELIMINATED ${victim.name}`,addr:victim.addr});
              const partCount=T.nuke?40:T.plasma?25:20;
              const partSpeed=T.nuke?0.02:0.01;
              explosionsRef.current.push({x:victim.bx,y:victim.by,life:T.nuke?1.5:1,
                particles:Array.from({length:partCount},()=>({x:victim.bx,y:victim.by,vx:rand(-partSpeed,partSpeed),vy:rand(-partSpeed,partSpeed*0.6)}))});
              // Check for tier up
              const nextTier=ALIEN_TIERS[tier+1];
              if(nextTier&&a.kills>=nextTier.kills){
                onKillFeedRef.current?.({type:"system",name:a.name,
                  text:`⬆ ${a.name} UPGRADED — ${nextTier.weapon} UNLOCKED!`});
              }
              }
            }
          }
          if(a.shootTimer>T.shootFrames+8){a.state="patrol";a.target=null;a.laserEnd=null;}
        }

        // ─── DRAW SHIP (scales with tier) ───
        const ax=a.x*W,ay=a.y*H,bob2=Math.sin(f*0.08+ai*2.1)*2;
        const bw=12*sz,bh=5*sz,dw=6*sz,dh=5*sz;
        ctx.save();
        // Tier 3+ wing extensions
        if(tier>=3){
          ctx.fillStyle=`${a.color}40`;
          ctx.beginPath();ctx.moveTo(ax-bw-4,ay+bob2+2);ctx.lineTo(ax-bw+2,ay+bob2-3);
          ctx.lineTo(ax-bw+6,ay+bob2+2);ctx.fill();
          ctx.beginPath();ctx.moveTo(ax+bw+4,ay+bob2+2);ctx.lineTo(ax+bw-2,ay+bob2-3);
          ctx.lineTo(ax+bw-6,ay+bob2+2);ctx.fill();
        }
        // Ship body
        ctx.fillStyle=`${a.color}dd`;
        ctx.shadowColor=a.color;ctx.shadowBlur=a.state==="shooting"?T.glow*1.5:T.glow;
        ctx.beginPath();ctx.ellipse(ax,ay+bob2,bw,bh,0,0,Math.PI*2);ctx.fill();
        // Dome
        ctx.fillStyle=`${a.color}99`;
        ctx.beginPath();ctx.ellipse(ax,ay+bob2-4*sz,dw,dh,0,Math.PI,0);ctx.fill();
        // Cockpit
        ctx.fillStyle=a.state==="shooting"?"rgba(255,0,80,0.9)":a.color;
        ctx.beginPath();ctx.arc(ax,ay+bob2-4*sz,2.5*sz,0,Math.PI*2);ctx.fill();
        // Thrusters (more at higher tiers)
        const thrusterCount=Math.min(4,2+Math.floor(tier/2));
        for(let ti=0;ti<thrusterCount;ti++){
          const tx2=ax+((ti-(thrusterCount-1)/2)*5*sz);
          ctx.fillStyle=`${a.color}${Math.floor((0.3+Math.sin(f*0.15+ai+ti)*0.3)*255).toString(16).padStart(2,'0')}`;
          ctx.beginPath();ctx.arc(tx2,ay+bob2+3*sz,1.5*sz,0,Math.PI*2);ctx.fill();
          // Thruster trail at tier 4+
          if(tier>=4){
            ctx.fillStyle=`${a.color}20`;
            ctx.beginPath();ctx.arc(tx2,ay+bob2+6*sz,2*sz*Math.random(),0,Math.PI*2);ctx.fill();
          }
        }
        // Tier 5 (NUKE) aura ring
        if(tier>=5){
          ctx.strokeStyle=`${a.color}${Math.floor((0.15+Math.sin(f*0.05)*0.1)*255).toString(16).padStart(2,'0')}`;
          ctx.lineWidth=1;
          ctx.beginPath();ctx.arc(ax,ay+bob2,bw+8+Math.sin(f*0.1)*3,0,Math.PI*2);ctx.stroke();
        }
        // Name tag
        ctx.font="bold 7px 'Orbitron'";ctx.fillStyle=`${a.color}90`;ctx.textAlign="center";
        ctx.fillText(a.name,ax,ay+bob2+10*sz);ctx.textAlign="left";
        ctx.shadowBlur=0;ctx.restore();
      });

      // ═══════════ EASTER EGG: FAT MONKEY ═══════════
      const fm=fatMonkeyRef.current;const now2=Date.now();
      if(!fm.active&&now2>fm.nextSpawn&&!jaycShipRef.current.active){
        fm.active=true;fm.x=-0.12;fm.frame=0;fm.smokeRings=[];fm.walkDir=1;
        fm.smokeTimer=0;fm.startTime=now2;fm.musicNotes=[];
        onKillFeedRef.current?.({type:"system",text:"🐒 FAT MONKEY & THE GRATEFUL DEAD HAVE ENTERED THE BATTLEFIELD 🌹🎶💨"});
      }
      if(fm.active){
        fm.frame++;fm.smokeTimer++;
        // Meeting detection — when Claude monkey and FM get close
        const claudeX=aiAvatarRef.current.x;
        if(!fm.tripActive&&Math.abs(fm.x-claudeX)<0.12&&fm.frame>30){
          fm.tripActive=true;fm.tripFrame=0;fm.walkDir=0; // stop walking
          onKillFeedRef.current?.({type:"system",text:"🍄🌈 THE TRIP HAS BEGUN... LUCY IN THE SKY WITH DIAMONDS 💎✨🌀"});
        }
        if(fm.tripActive){
          fm.tripFrame++;
          if(fm.tripFrame>600&&!fm.vortexActive){// ~10 seconds of trip → start vortex
            fm.vortexActive=true;fm.vortexFrame=0;
            fm.swirlAngles=[0,1,2,3,4,5].map(i=>i*Math.PI*2/6);
            fm.suckedIn=[false,false,false,false,false,false];
          }
          if(fm.vortexActive){
            fm.vortexFrame++;
            // Suck in band members one by one every 60 frames, FM last
            const suckOrder=[1,2,3,4,0,5]; // JERRY,BOB,PHIL,BILLY,MICKEY order, FM(5) last
            suckOrder.forEach((slot,si)=>{
              if(!fm.suckedIn[slot]&&fm.vortexFrame>si*70+40) fm.suckedIn[slot]=true;
            });
            // After all sucked in, end event
            if(fm.vortexFrame>480){
              fm.tripActive=false;fm.vortexActive=false;fm.walkDir=0;fm.tripMsg=true;fm.tripMsgFrame=0;
              fm.active=false;fm.nextSpawn=now2+rand(900,1500)*1000;
              onKillFeedRef.current?.({type:"system",text:"◈ Claude: ...was that real? where did everyone go? 🌀😵"});
            }
          }
        }else{
          fm.x+=0.002*fm.walkDir;
        }
        // 8-BIT PIXEL ART MONKEY — side profile, slim, retro style
        const feetY=0.93*H,headY=0.68*H;
        const mH=feetY-headY;
        const mx=fm.x*W;
        const px=Math.round(mH/25); // pixel size scales with height
        const bob=Math.round(Math.sin(fm.frame*0.1)*1)*px;
        const stride=fm.frame;
        const legPhase=Math.floor(stride/8)%4; // 4-frame walk cycle
        ctx.save();
        ctx.imageSmoothingEnabled=false; // crispy pixels

        // Helper: draw pixel at grid position (0,0 = head top-left)
        const P=(gx,gy,col)=>{ctx.fillStyle=col;ctx.fillRect(mx+gx*px,headY+gy*px+bob,px,px)};

        // === HEAD (side profile facing right) — rows 0-7 ===
        const fur="#8B5E3C",face="#D4A574",dark="#3a2010";
        // Fur outline
        [3,4,5,6].forEach(x=>P(x,0,fur)); // top of head
        [2,3,4,5,6,7].forEach(x=>P(x,1,fur));
        [1,2,7,8].forEach(x=>P(x,2,fur)); // sides
        [3,4,5,6].forEach(x=>P(x,2,face)); // face interior
        [1,2,8].forEach(x=>P(x,3,fur));
        [3,4,5,6,7].forEach(x=>P(x,3,face));
        [1,2].forEach(x=>P(x,4,fur));
        [3,4,5,6,7,8].forEach(x=>P(x,4,face)); // snout extends right
        P(5,3,"#fff");P(6,3,dark); // eye white + pupil (half-lid cool)
        P(5,2,fur); // lid over eye — cool squint
        [2,3].forEach(x=>P(x,5,fur)); // jaw
        [4,5,6,7].forEach(x=>P(x,5,face));
        P(8,4,dark); // nostril
        P(7,5,dark); // smirk corner
        [3,4,5,6].forEach(x=>P(x,6,fur)); // chin
        P(1,3,fur);P(1,4,fur);P(0,3,fur); // ear
        P(0,4,"#C4956A"); // inner ear

        // === HEADPHONE (left side) — black Beats ===
        P(-1,2,"#111");P(-1,3,"#111");P(-1,4,"#111"); // ear cup
        P(0,2,"#222"); // cup inner
        P(-1,1,"#111");P(0,1,"#111");P(1,1,"#111"); // partial headband
        P(2,0,"#111");P(3,0,"#222"); // headband top
        // Red b logo
        P(-1,3,"#cc0000");

        // === JOINT (sticking out right from mouth) ===
        P(8,5,"#e8dcc8");P(9,5,"#e8dcc8");P(10,4,"#e8dcc8"); // joint angled up
        P(11,4,"#ff4400"); // ember
        ctx.fillStyle="#ff6600";ctx.shadowColor="#ff6600";ctx.shadowBlur=6;
        ctx.fillRect(mx+11*px,headY+4*px+bob,px,px);ctx.shadowBlur=0;

        // === BODY / TIE-DYE SHIRT — rows 7-13 ===
        const dyeColors=["#cc2200","#dd6600","#cc0","#009900","#0044cc","#6600aa"];
        for(let row=7;row<=13;row++){
          const rowW=row<9?[3,4,5,6,7]:[3,4,5,6];
          rowW.forEach((x,xi)=>{P(x,row,dyeColors[(row+xi)%dyeColors.length])});
        }
        // Steal Your Face skull on shirt (small)
        P(4,9,"#fff");P(5,9,"#fff");P(6,9,"#fff");
        P(4,10,"#fff");P(5,10,"#cc0000");P(6,10,"#fff"); // lightning bolt center
        P(5,11,"#fff");

        // === ARMS (pixel sticks, swinging) ===
        const armSwing=legPhase<2?0:1;
        // Back arm (behind, darker)
        P(3,8,"#6B3410");P(3-armSwing,9,"#6B3410");P(3-armSwing,10,"#6B3410");P(3-armSwing,11,"#5a2d0a");
        // Front arm
        P(7,8,"#8B5E3C");P(7+armSwing,9,"#8B5E3C");P(7+armSwing,10,"#8B5E3C");P(7+armSwing,11,"#6B3410");

        // === LEGS (4-frame walk cycle) — rows 14-18 ===
        const legCol="#6B3410",shoeCol="#222";
        if(legPhase===0){
          // Both legs neutral
          [4,5].forEach(x=>{P(x,14,legCol);P(x,15,legCol);P(x,16,legCol);P(x,17,legCol);P(x,18,shoeCol)});
        }else if(legPhase===1){
          // Front leg forward, back leg back
          [4].forEach(x=>{P(x,14,legCol);P(x,15,legCol);P(x+1,16,legCol);P(x+1,17,legCol);P(x+1,18,shoeCol)});
          [6].forEach(x=>{P(x,14,legCol);P(x,15,legCol);P(x-1,16,legCol);P(x-1,17,legCol);P(x-1,18,shoeCol)});
        }else if(legPhase===2){
          // Passing — legs together
          P(5,14,legCol);P(5,15,legCol);P(5,16,legCol);P(5,17,legCol);P(5,18,shoeCol);
          P(4,14,legCol);P(4,15,legCol);P(4,16,legCol);P(4,17,legCol);P(4,18,shoeCol);
        }else{
          // Back leg forward, front leg back
          [4].forEach(x=>{P(x,14,legCol);P(x,15,legCol);P(x-1,16,legCol);P(x-1,17,legCol);P(x-1,18,shoeCol)});
          [6].forEach(x=>{P(x,14,legCol);P(x,15,legCol);P(x+1,16,legCol);P(x+1,17,legCol);P(x+1,18,shoeCol)});
        }

        // === SMOKE from joint ===
        for(let sw=0;sw<3;sw++){
          const sa=fm.frame*0.06+sw*2.5;
          const smokeA=0.2+Math.sin(sa)*0.1;
          ctx.fillStyle=`rgba(180,180,180,${smokeA})`;
          ctx.fillRect(mx+(12+Math.round(Math.sin(sa+sw)*2))*px,headY+(3-sw*2)*px+bob,px*2,px);
        }

        // === MUSIC NOTES (green, from headphone) ===
        if(fm.frame%15===0){
          fm.musicNotes.push({x:mx-1*px,y:headY+2*px,vy:-1.5-rand(0,1),vx:rand(-0.8,0.8),
            opacity:1,size:12+rand(0,6),note:["♪","♫","♬","♩"][randInt(0,4)],life:55});
        }
        fm.musicNotes.forEach(n=>{
          n.y+=n.vy;n.x+=n.vx+Math.sin(n.life*0.12)*0.6;n.life--;n.opacity=Math.min(1,n.life/16);
          const nc=n.color||"rgba(57,255,20,1)";
          ctx.font=`bold ${n.size}px sans-serif`;
          ctx.fillStyle=nc.startsWith("rgba")?nc:`${nc}${Math.round(n.opacity*255).toString(16).padStart(2,"0")}`;
          ctx.shadowColor=nc.startsWith("rgba")?"#39ff14":nc;ctx.shadowBlur=6;
          ctx.textAlign="center";ctx.fillText(n.note,n.x,n.y);ctx.textAlign="left";ctx.shadowBlur=0;
        });
        fm.musicNotes=fm.musicNotes.filter(n=>n.life>0);

        // ═══ THE GRATEFUL DEAD — pixel monkey band trailing behind Fat Monkey ═══
        const bandMembers=[
          {name:"JERRY",fur:"#7a5a3c",hair:"#aaa",hairStyle:"curly",beard:"#999",glasses:true,
           shirt:["#111","#222","#333"],instrument:"guitar",offset:-8,bobOff:0.3},
          {name:"BOB",fur:"#8B5E3C",hair:"#6b4422",hairStyle:"shaggy",beard:null,glasses:false,
           shirt:["#cc0000","#ff4400","#cc2200"],instrument:"guitar",offset:-15,bobOff:0.7},
          {name:"PHIL",fur:"#7a5540",hair:"#8a7060",hairStyle:"bald",beard:null,glasses:true,
           shirt:["#2244aa","#3355bb","#2244aa"],instrument:"bass",offset:-22,bobOff:1.1},
          {name:"BILLY",fur:"#8a6a4c",hair:"#5a3a1a",hairStyle:"short",beard:"#5a3a1a",glasses:false,
           shirt:["#fff","#eee","#ddd"],instrument:"drums",offset:-29,bobOff:1.5},
          {name:"MICKEY",fur:"#7a5a3c",hair:"#2a1a0a",hairStyle:"curly",beard:"#3a2a1a",glasses:false,
           shirt:["#009944","#00aa55","#008833"],instrument:"percussion",offset:-36,bobOff:1.9},
        ];

        bandMembers.forEach((mem,mi)=>{
          const bx=mx+mem.offset*px; // trail behind Fat Monkey
          const bp=Math.round(px*0.7); // slightly smaller pixels
          const bBob=Math.round(Math.sin(fm.frame*0.1+mem.bobOff)*1)*bp;
          const bHeadY=headY+3*bp; // slightly lower
          const bStride=fm.frame;
          const bLeg=Math.floor((bStride+mi*3)/8)%4;
          const BPx=(gx,gy,col)=>{ctx.fillStyle=col;ctx.fillRect(bx+gx*bp,bHeadY+gy*bp+bBob,bp,bp)};
          const face="#D4A574",dk="#3a2010";

          // Head
          [3,4,5,6].forEach(x=>BPx(x,0,mem.fur));
          [2,3,4,5,6,7].forEach(x=>BPx(x,1,mem.fur));
          [1,2,7,8].forEach(x=>BPx(x,2,mem.fur));
          [3,4,5,6].forEach(x=>BPx(x,2,face));
          [1,2,8].forEach(x=>BPx(x,3,mem.fur));
          [3,4,5,6,7].forEach(x=>BPx(x,3,face));
          [1,2].forEach(x=>BPx(x,4,mem.fur));
          [3,4,5,6,7,8].forEach(x=>BPx(x,4,face));
          BPx(5,3,"#fff");BPx(6,3,dk); // eye

          // Hair styles
          if(mem.hairStyle==="curly"){
            [2,3,4,5,6,7].forEach(x=>BPx(x,-1,mem.hair));
            [1,2,7,8].forEach(x=>BPx(x,0,mem.hair));
            BPx(1,1,mem.hair);BPx(8,1,mem.hair); // sides
          }else if(mem.hairStyle==="shaggy"){
            [3,4,5,6].forEach(x=>BPx(x,-1,mem.hair));
            BPx(1,1,mem.hair);BPx(1,2,mem.hair);BPx(8,1,mem.hair);BPx(8,2,mem.hair);BPx(8,3,mem.hair);
          }else if(mem.hairStyle==="bald"){
            [4,5].forEach(x=>BPx(x,-1,face)); // shiny dome
            BPx(1,2,mem.hair);BPx(1,3,mem.hair);BPx(8,2,mem.hair);BPx(8,3,mem.hair); // sides only
          }else if(mem.hairStyle==="short"){
            [3,4,5,6].forEach(x=>BPx(x,-1,mem.hair));
            BPx(2,0,mem.hair);BPx(7,0,mem.hair);
          }

          // Glasses
          if(mem.glasses){
            BPx(4,3,"#333");BPx(5,3,"#88bbff");BPx(6,3,"#111");BPx(7,3,"#333"); // frames
          }

          // Beard
          if(mem.beard){
            [3,4,5,6,7].forEach(x=>BPx(x,5,mem.beard));
            [4,5,6].forEach(x=>BPx(x,6,mem.beard));
            if(mem.name==="JERRY"){[3,4,5,6,7].forEach(x=>BPx(x,7,mem.beard));[4,5,6].forEach(x=>BPx(x,8,mem.beard));} // Jerry's big beard
          }else{
            [3,4,5,6].forEach(x=>BPx(x,5,face)); // chin
          }
          BPx(8,4,dk);BPx(7,5,dk); // nose/mouth

          // Tie-dye/colored shirt
          for(let row=7+(mem.beard&&mem.name==="JERRY"?2:0);row<=13;row++){
            [3,4,5,6,7].forEach((x,xi)=>BPx(x,row,mem.shirt[(row+xi)%mem.shirt.length]));
          }

          // Arms + instrument
          const aSwing=bLeg<2?0:1;
          if(mem.instrument==="guitar"||mem.instrument==="bass"){
            // Arm holding neck
            BPx(7,8,mem.fur);BPx(8+aSwing,9,mem.fur);BPx(9+aSwing,10,mem.fur);
            // Guitar/bass body
            const gc=mem.instrument==="bass"?"#8B4513":"#cc6633";
            BPx(9,11,gc);BPx(10,11,gc);BPx(9,12,gc);BPx(10,12,gc);
            // Neck
            BPx(10,9,"#d4a060");BPx(11,8,"#d4a060");BPx(12,7,"#d4a060");
            // Strum hand
            BPx(3,9,mem.fur);BPx(3-aSwing,10,mem.fur);
          }else if(mem.instrument==="drums"){
            // Drumsticks
            const dBeat=Math.sin(fm.frame*0.2+1.5)>0;
            BPx(3,8,mem.fur);BPx(2,9+(!dBeat?0:1),"#d4a060");BPx(1,10+(!dBeat?0:1),"#d4a060");
            BPx(7,8,mem.fur);BPx(8,9+(dBeat?0:1),"#d4a060");BPx(9,10+(dBeat?0:1),"#d4a060");
            // Snare drum (floating, carried)
            BPx(4,13,"#888");BPx(5,13,"#aaa");BPx(6,13,"#888");
            BPx(4,14,"#666");BPx(5,14,"#888");BPx(6,14,"#666");
          }else if(mem.instrument==="percussion"){
            // Congas/bongos
            const pBeat=Math.sin(fm.frame*0.25)>0;
            BPx(3,8,mem.fur);BPx(3,9+(pBeat?0:1),mem.fur); // hitting
            BPx(7,8,mem.fur);BPx(7,9+(!pBeat?0:1),mem.fur);
            // Bongo drums
            BPx(4,12,"#8B4513");BPx(5,12,"#a0522d");BPx(6,12,"#8B4513");
            BPx(4,13,"#6b3410");BPx(5,13,"#8B4513");BPx(6,13,"#6b3410");
          }

          // Legs
          const lc=mem.fur,sc="#222";
          if(bLeg===0||bLeg===2){
            [4,5].forEach(x=>{BPx(x,14,lc);BPx(x,15,lc);BPx(x,16,lc);BPx(x,17,sc)});
          }else if(bLeg===1){
            BPx(4,14,lc);BPx(4,15,lc);BPx(5,16,lc);BPx(5,17,sc);
            BPx(6,14,lc);BPx(6,15,lc);BPx(5,16,lc);BPx(4,17,sc);
          }else{
            BPx(4,14,lc);BPx(4,15,lc);BPx(3,16,lc);BPx(3,17,sc);
            BPx(6,14,lc);BPx(6,15,lc);BPx(7,16,lc);BPx(7,17,sc);
          }

          // Spawn notes from each musician
          if(fm.frame%22===mi*4){
            const noteCol=mem.instrument==="drums"?"#ffd740":mem.instrument==="bass"?"#ff6b35":"#39ff14";
            fm.musicNotes.push({x:bx+4*bp,y:bHeadY-bp,vy:-1.2-rand(0,0.8),vx:rand(-0.5,0.5),
              opacity:1,size:9+rand(0,4),note:["♪","♫","♬"][randInt(0,3)],life:40,color:noteCol});
          }
        });

        // Update note rendering to use per-note color
        // (handled above — notes already rendered)

        // === NAME TAG ===
        ctx.imageSmoothingEnabled=true;
        ctx.font="bold 10px 'Orbitron'";ctx.fillStyle="#ffd740";ctx.shadowColor="#ffd740";ctx.shadowBlur=6;
        ctx.textAlign="center";ctx.fillText("FAT MONKEY & THE GRATEFUL DEAD",mx-12*px,feetY+12);
        ctx.textAlign="left";ctx.shadowBlur=0;
        ctx.restore();

        // Blow smoke rings every ~80 frames
        if(fm.smokeTimer>80){fm.smokeTimer=0;
          fm.smokeRings.push({x:fm.x+0.03,y:0.63,radius:8,opacity:1,life:90});}
        // Animate smoke rings
        fm.smokeRings.forEach(ring=>{
          ring.radius+=1.2;ring.opacity-=0.01;ring.life--;ring.x+=0.003;ring.y-=0.002;
          const rx=ring.x*W,ry=ring.y*H;
          ctx.strokeStyle=`rgba(200,200,200,${ring.opacity*0.5})`;ctx.lineWidth=3;
          ctx.shadowColor="rgba(200,200,200,0.4)";ctx.shadowBlur=8;
          ctx.beginPath();ctx.arc(rx,ry,ring.radius,0,Math.PI*2);ctx.stroke();
          // Inner ring for thickness
          ctx.strokeStyle=`rgba(220,220,220,${ring.opacity*0.3})`;ctx.lineWidth=1.5;
          ctx.beginPath();ctx.arc(rx,ry,ring.radius*0.7,0,Math.PI*2);ctx.stroke();
          ctx.shadowBlur=0;
          // VISUAL ONLY — smoke rings don't kill tokens anymore
        });
        fm.smokeRings=fm.smokeRings.filter(r=>r.life>0);

        // ═══════════ THE TRIP — PSYCHEDELIC SEQUENCE ═══════════
        if(fm.tripActive){
          const tf=fm.tripFrame;
          const tripAlpha=Math.min(1,tf/30); // fade in
          ctx.save();

          // ── FULL SCREEN TIE-DYE BACKGROUND ──
          const tdTime=tf*0.02;
          for(let ty=0;ty<H;ty+=8){
            for(let tx=0;tx<W;tx+=8){
              const dist3=Math.sqrt((tx-W/2)**2+(ty-H/2)**2)/Math.max(W,H);
              const angle2=Math.atan2(ty-H/2,tx-W/2);
              const swirl=angle2+dist3*8+tdTime*3;
              const wave=Math.sin(swirl)*0.5+0.5;
              const wave2=Math.sin(swirl*1.7+2)*0.5+0.5;
              const wave3=Math.sin(swirl*0.6+4)*0.5+0.5;
              const r=Math.round(wave*255);
              const g=Math.round(wave2*180);
              const b2=Math.round(wave3*255);
              ctx.fillStyle=`rgba(${r},${g},${b2},${tripAlpha*0.35})`;
              ctx.fillRect(tx,ty,8,8);
            }
          }

          // ── KALEIDOSCOPE MANDALA ──
          const cx2=W/2,cy2=H/2;
          for(let ring=0;ring<5;ring++){
            const rr=(ring+1)*Math.min(W,H)*0.08+Math.sin(tf*0.03+ring)*20;
            for(let seg=0;seg<12;seg++){
              const sa=seg*Math.PI/6+tf*0.01*(ring%2===0?1:-1);
              const sx=cx2+Math.cos(sa)*rr;
              const sy=cy2+Math.sin(sa)*rr;
              const hue=(seg*30+ring*60+tf*2)%360;
              ctx.fillStyle=`hsla(${hue},100%,60%,${tripAlpha*0.4})`;
              ctx.beginPath();ctx.arc(sx,sy,12+ring*4+Math.sin(tf*0.05)*5,0,Math.PI*2);ctx.fill();
            }
          }

          // ── FLOATING MUSHROOMS ──
          for(let mi=0;mi<8;mi++){
            const mx2=((mi*137+tf*0.3)%(W+100))-50;
            const my2=H*0.3+Math.sin(tf*0.02+mi*2.1)*H*0.25;
            const ms=20+Math.sin(tf*0.04+mi)*8;
            const mHue=(tf*3+mi*45)%360;
            ctx.save();ctx.translate(mx2,my2);ctx.rotate(Math.sin(tf*0.015+mi)*0.3);
            // Cap
            ctx.fillStyle=`hsla(${mHue},80%,50%,${tripAlpha*0.7})`;
            ctx.beginPath();ctx.ellipse(0,-ms*0.3,ms,ms*0.6,0,Math.PI,0);ctx.fill();
            // Spots
            for(let sp=0;sp<3;sp++){
              ctx.fillStyle=`rgba(255,255,255,${tripAlpha*0.6})`;
              ctx.beginPath();ctx.arc((-1+sp)*ms*0.3,-ms*0.4,ms*0.12,0,Math.PI*2);ctx.fill();
            }
            // Stem
            ctx.fillStyle=`rgba(255,240,220,${tripAlpha*0.7})`;
            ctx.fillRect(-ms*0.15,-ms*0.3,ms*0.3,ms*0.7);
            ctx.restore();
          }

          // ── LUCY IN THE SKY — diamonds raining down ──
          for(let di=0;di<12;di++){
            const dx3=((di*89+tf*1.5)%(W+60))-30;
            const dy3=((di*73+tf*2)%(H+60))-30;
            const ds=8+Math.sin(tf*0.06+di)*4;
            const dHue=(tf*4+di*30)%360;
            ctx.save();ctx.translate(dx3,dy3);ctx.rotate(tf*0.03+di);
            ctx.fillStyle=`hsla(${dHue},90%,70%,${tripAlpha*0.6})`;
            ctx.shadowColor=`hsla(${dHue},100%,80%,0.8)`;ctx.shadowBlur=15;
            // Diamond shape
            ctx.beginPath();ctx.moveTo(0,-ds);ctx.lineTo(ds*0.6,0);ctx.lineTo(0,ds*0.4);ctx.lineTo(-ds*0.6,0);ctx.closePath();ctx.fill();
            ctx.shadowBlur=0;ctx.restore();
          }

          // ── FRACTAL SPIRALS ──
          for(let sp=0;sp<3;sp++){
            const scx=W*(0.2+sp*0.3);
            const scy=H*(0.3+Math.sin(tf*0.01+sp*2)*0.2);
            ctx.strokeStyle=`hsla(${(tf*5+sp*120)%360},100%,65%,${tripAlpha*0.3})`;
            ctx.lineWidth=2;
            ctx.beginPath();
            for(let t2=0;t2<80;t2++){
              const sa2=t2*0.15+tf*0.02;
              const sr=t2*1.5+Math.sin(tf*0.03)*10;
              const spx=scx+Math.cos(sa2)*sr;
              const spy=scy+Math.sin(sa2)*sr;
              t2===0?ctx.moveTo(spx,spy):ctx.lineTo(spx,spy);
            }
            ctx.stroke();
          }

          // ── BREATHING CONCENTRIC RINGS ──
          for(let ri2=0;ri2<8;ri2++){
            const rr2=(ri2+1)*30+Math.sin(tf*0.04+ri2*0.8)*20;
            const rHue=(tf*3+ri2*45)%360;
            ctx.strokeStyle=`hsla(${rHue},100%,60%,${tripAlpha*0.25})`;
            ctx.lineWidth=3+Math.sin(tf*0.05+ri2)*2;
            ctx.beginPath();ctx.arc(cx2,cy2,rr2,0,Math.PI*2);ctx.stroke();
          }

          // ── PEACE SIGNS & DEAD BEARS floating ──
          const tripSymbols=["☮","✿","☯","🐻","💀","🌹","♾","👁","🍄","💎"];
          for(let si=0;si<15;si++){
            const sx2=((si*97+tf*0.8+Math.sin(si*3+tf*0.01)*50)%(W+40))-20;
            const sy2=((si*131+tf*0.5+Math.cos(si*2+tf*0.015)*40)%(H+40))-20;
            const sHue=(tf*2+si*25)%360;
            ctx.font=`${16+Math.sin(tf*0.04+si)*6}px serif`;
            ctx.fillStyle=`hsla(${sHue},100%,70%,${tripAlpha*0.7})`;
            ctx.fillText(tripSymbols[si%tripSymbols.length],sx2,sy2);
          }

          // ── MORPHING COLOR WAVES at edges ──
          for(let ew=0;ew<4;ew++){
            const ewY=ew*H/4;
            const ewGrad=ctx.createLinearGradient(0,ewY,W,ewY+H/4);
            const h1=(tf*4+ew*90)%360;
            const h2=(tf*4+ew*90+180)%360;
            ewGrad.addColorStop(0,`hsla(${h1},100%,50%,${tripAlpha*0.1})`);
            ewGrad.addColorStop(0.5,`hsla(${(h1+h2)/2},100%,70%,${tripAlpha*0.15})`);
            ewGrad.addColorStop(1,`hsla(${h2},100%,50%,${tripAlpha*0.1})`);
            ctx.fillStyle=ewGrad;
            ctx.fillRect(0,ewY,W,H/4);
          }

          // ── BATS — "WE CAN'T STOP HERE THIS IS BAT COUNTRY" ──
          for(let bi2=0;bi2<10;bi2++){
            const bx2=((bi2*113+tf*2.5)%(W+200))-100;
            const by2=H*0.15+Math.sin(tf*0.03+bi2*1.7)*H*0.2+Math.cos(tf*0.05+bi2*0.9)*H*0.1;
            const bSize=12+Math.sin(tf*0.07+bi2)*5;
            const wingFlap=Math.sin(tf*0.15+bi2*2)*0.6;
            ctx.save();ctx.translate(bx2,by2);
            ctx.fillStyle=`rgba(30,0,40,${tripAlpha*0.8})`;
            // Body
            ctx.beginPath();ctx.ellipse(0,0,bSize*0.3,bSize*0.15,0,0,Math.PI*2);ctx.fill();
            // Left wing
            ctx.beginPath();ctx.moveTo(-bSize*0.2,0);
            ctx.quadraticCurveTo(-bSize*0.6,-bSize*(0.4+wingFlap),-bSize,bSize*0.1*wingFlap);
            ctx.quadraticCurveTo(-bSize*0.5,bSize*0.1,-bSize*0.2,0);ctx.fill();
            // Right wing
            ctx.beginPath();ctx.moveTo(bSize*0.2,0);
            ctx.quadraticCurveTo(bSize*0.6,-bSize*(0.4+wingFlap),bSize,bSize*0.1*wingFlap);
            ctx.quadraticCurveTo(bSize*0.5,bSize*0.1,bSize*0.2,0);ctx.fill();
            // Eyes — tiny red dots
            ctx.fillStyle=`rgba(255,0,0,${tripAlpha*0.9})`;
            ctx.fillRect(-bSize*0.12,-bSize*0.05,2,2);
            ctx.fillRect(bSize*0.08,-bSize*0.05,2,2);
            ctx.restore();
          }

          // ── PINK ELEPHANTS ON PARADE ──
          for(let pe=0;pe<4;pe++){
            const peX=((pe*W/3+tf*1.2)%(W+160))-80;
            const peY=H*0.6+Math.sin(tf*0.015+pe*1.5)*H*0.15;
            const peS=25+Math.sin(tf*0.02+pe)*8;
            const peWobble=Math.sin(tf*0.04+pe)*0.15;
            ctx.save();ctx.translate(peX,peY);ctx.rotate(peWobble);
            const pCol=`hsla(${320+pe*15},70%,70%,${tripAlpha*0.6})`;
            // Body
            ctx.fillStyle=pCol;
            ctx.beginPath();ctx.ellipse(0,0,peS,peS*0.65,0,0,Math.PI*2);ctx.fill();
            // Head
            ctx.beginPath();ctx.ellipse(peS*0.8,-peS*0.3,peS*0.45,peS*0.4,0,0,Math.PI*2);ctx.fill();
            // Trunk — wavy
            ctx.strokeStyle=pCol;ctx.lineWidth=peS*0.15;
            ctx.beginPath();ctx.moveTo(peS*1.15,-peS*0.35);
            ctx.quadraticCurveTo(peS*1.4,-peS*0.6+Math.sin(tf*0.06+pe)*peS*0.3,peS*1.6,-peS*0.2+Math.sin(tf*0.08+pe)*peS*0.2);
            ctx.stroke();
            // Ear
            ctx.fillStyle=`hsla(${330+pe*15},80%,80%,${tripAlpha*0.5})`;
            ctx.beginPath();ctx.ellipse(peS*0.5,-peS*0.5,peS*0.3,peS*0.4,0,0,Math.PI*2);ctx.fill();
            // Legs — stubby
            ctx.fillStyle=pCol;
            [-0.5,-0.15,0.15,0.5].forEach(lx=>{
              ctx.fillRect(lx*peS-peS*0.06,peS*0.45,peS*0.12,peS*0.4);
            });
            // Googly eye
            ctx.fillStyle=`rgba(255,255,255,${tripAlpha*0.9})`;
            ctx.beginPath();ctx.arc(peS*1,-peS*0.35,peS*0.12,0,Math.PI*2);ctx.fill();
            ctx.fillStyle=`rgba(0,0,0,${tripAlpha*0.9})`;
            ctx.beginPath();ctx.arc(peS*1.02+Math.sin(tf*0.1)*2,-peS*0.35,peS*0.06,0,Math.PI*2);ctx.fill();
            // Sparkle trail
            for(let ss2=0;ss2<3;ss2++){
              ctx.fillStyle=`hsla(${(tf*5+ss2*120+pe*90)%360},100%,80%,${tripAlpha*0.4})`;
              ctx.fillRect(-peS*0.8-ss2*12+Math.sin(tf*0.1+ss2)*5,Math.sin(tf*0.06+ss2*2)*8,5,5);
            }
            ctx.restore();
          }

          // ── MELTING CLOCKS (Dali style) ──
          for(let mc3=0;mc3<3;mc3++){
            const clkX=W*(0.15+mc3*0.35)+Math.sin(tf*0.01+mc3)*30;
            const clkY=H*(0.25+mc3*0.15)+Math.sin(tf*0.015+mc3*2)*20;
            const clkS=20+Math.sin(tf*0.03)*5;
            ctx.save();ctx.translate(clkX,clkY);
            // Melted clock body — stretched oval
            const melt=Math.sin(tf*0.02+mc3)*0.4;
            ctx.scale(1+melt*0.3,1-melt*0.2);
            ctx.fillStyle=`hsla(${(tf*2+mc3*120)%360},60%,80%,${tripAlpha*0.4})`;
            ctx.beginPath();ctx.ellipse(0,0,clkS,clkS*0.8,melt*0.5,0,Math.PI*2);ctx.fill();
            ctx.strokeStyle=`rgba(0,0,0,${tripAlpha*0.3})`;ctx.lineWidth=1;
            ctx.stroke();
            // Clock hands — spinning
            const hr=tf*0.01+mc3*2;
            const mn=tf*0.08+mc3;
            ctx.strokeStyle=`rgba(0,0,0,${tripAlpha*0.5})`;ctx.lineWidth=2;
            ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(hr)*clkS*0.5,Math.sin(hr)*clkS*0.4);ctx.stroke();
            ctx.lineWidth=1;
            ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(mn)*clkS*0.7,Math.sin(mn)*clkS*0.6);ctx.stroke();
            ctx.restore();
          }

          // ── THIRD EYE — giant pulsing eye in the sky ──
          {
            const eyeCx=W/2+Math.sin(tf*0.008)*W*0.1;
            const eyeCy=H*0.18+Math.sin(tf*0.012)*20;
            const eyeS2=40+Math.sin(tf*0.025)*15;
            const irisHue=(tf*2)%360;
            const pupilPulse=0.3+Math.sin(tf*0.06)*0.15;
            ctx.save();ctx.globalAlpha=tripAlpha*0.5;
            // Outer glow
            const eyeGlow=ctx.createRadialGradient(eyeCx,eyeCy,eyeS2*0.2,eyeCx,eyeCy,eyeS2*1.5);
            eyeGlow.addColorStop(0,`hsla(${irisHue},100%,70%,0.3)`);eyeGlow.addColorStop(1,"transparent");
            ctx.fillStyle=eyeGlow;ctx.fillRect(eyeCx-eyeS2*2,eyeCy-eyeS2*2,eyeS2*4,eyeS2*4);
            // Eye white
            ctx.fillStyle=`rgba(255,255,255,0.8)`;
            ctx.beginPath();ctx.ellipse(eyeCx,eyeCy,eyeS2,eyeS2*0.5,0,0,Math.PI*2);ctx.fill();
            // Iris
            ctx.fillStyle=`hsla(${irisHue},100%,50%,0.9)`;
            ctx.beginPath();ctx.arc(eyeCx,eyeCy,eyeS2*pupilPulse,0,Math.PI*2);ctx.fill();
            // Pupil
            ctx.fillStyle="rgba(0,0,0,0.9)";
            ctx.beginPath();ctx.arc(eyeCx,eyeCy,eyeS2*pupilPulse*0.4,0,Math.PI*2);ctx.fill();
            // Pupil reflection
            ctx.fillStyle="rgba(255,255,255,0.7)";
            ctx.beginPath();ctx.arc(eyeCx-eyeS2*0.08,eyeCy-eyeS2*0.08,eyeS2*0.06,0,Math.PI*2);ctx.fill();
            ctx.restore();
          }

          // ── FLYING RAINBOW WHALES ──
          for(let fw=0;fw<2;fw++){
            const fwX=((fw*W/2+tf*1.8)%(W+300))-150;
            const fwY=H*(0.3+fw*0.25)+Math.sin(tf*0.02+fw*3)*H*0.08;
            const fwS=30+fw*10;
            const fwHue=(tf*3+fw*180)%360;
            ctx.save();ctx.translate(fwX,fwY);
            ctx.fillStyle=`hsla(${fwHue},80%,60%,${tripAlpha*0.45})`;
            // Body
            ctx.beginPath();ctx.ellipse(0,0,fwS*1.2,fwS*0.5,0,0,Math.PI*2);ctx.fill();
            // Tail
            ctx.beginPath();ctx.moveTo(-fwS*1.1,0);
            ctx.lineTo(-fwS*1.7,-fwS*0.4);ctx.lineTo(-fwS*1.7,fwS*0.4);ctx.closePath();ctx.fill();
            // Eye
            ctx.fillStyle=`rgba(255,255,255,${tripAlpha*0.8})`;
            ctx.beginPath();ctx.arc(fwS*0.7,-fwS*0.1,fwS*0.12,0,Math.PI*2);ctx.fill();
            // Rainbow trail
            for(let rt=0;rt<6;rt++){
              ctx.fillStyle=`hsla(${(fwHue+rt*60)%360},100%,70%,${tripAlpha*0.2})`;
              ctx.fillRect(-fwS*1.2-rt*15,(-3+rt)*3,12,4);
            }
            ctx.restore();
          }

          // ── DRIPPING REALITY — edges melting ──
          for(let dr=0;dr<20;dr++){
            const dx4=dr*W/20;
            const dLen=30+Math.sin(tf*0.03+dr*0.7)*20+Math.sin(tf*0.07+dr*1.3)*10;
            const dHue2=(tf*2+dr*18)%360;
            const dGrad=ctx.createLinearGradient(dx4,0,dx4,dLen);
            dGrad.addColorStop(0,`hsla(${dHue2},100%,60%,${tripAlpha*0.3})`);
            dGrad.addColorStop(1,"transparent");
            ctx.fillStyle=dGrad;
            ctx.fillRect(dx4,0,W/20,dLen);
            // Bottom drips
            const dLen2=20+Math.sin(tf*0.04+dr*1.1)*15;
            const dGrad2=ctx.createLinearGradient(dx4,H-dLen2,dx4,H);
            dGrad2.addColorStop(0,"transparent");
            dGrad2.addColorStop(1,`hsla(${(dHue2+180)%360},100%,60%,${tripAlpha*0.25})`);
            ctx.fillStyle=dGrad2;
            ctx.fillRect(dx4,H-dLen2,W/20,dLen2);
          }

          // ── VORTEX END SEQUENCE ──
          if(fm.vortexActive){
            const vf=fm.vortexFrame;
            const vcx=W/2,vcy=H/2;
            const vortexR=40+vf*0.4+Math.sin(vf*0.1)*10;
            // Portal glow rings
            for(let vr=0;vr<4;vr++){
              const vGrad=ctx.createRadialGradient(vcx,vcy,0,vcx,vcy,vortexR*(1+vr*0.6));
              vGrad.addColorStop(0,`hsla(${(vf*8)%360},100%,90%,0.8)`);
              vGrad.addColorStop(0.4,`hsla(${(vf*5+120)%360},100%,50%,0.4)`);
              vGrad.addColorStop(1,"transparent");
              ctx.fillStyle=vGrad;
              ctx.beginPath();ctx.arc(vcx,vcy,vortexR*(1+vr*0.6),0,Math.PI*2);ctx.fill();
            }
            // Spiral arms
            for(let arm=0;arm<3;arm++){
              ctx.strokeStyle=`hsla(${(vf*6+arm*120)%360},100%,70%,0.6)`;
              ctx.lineWidth=3;ctx.beginPath();
              for(let t3=0;t3<60;t3++){
                const a3=t3*0.15+vf*0.08+arm*Math.PI*2/3;
                ctx.lineTo(vcx+Math.cos(a3)*t3*3,vcy+Math.sin(a3)*t3*3);
              }
              ctx.stroke();
            }
            // Characters swirling — sucked in one by one
            const allSwirlers=[
              {label:"JERRY",color:"#7a5a3c"},{label:"BOB",color:"#8B5E3C"},
              {label:"PHIL",color:"#7a5540"},{label:"BILLY",color:"#8a6a4c"},
              {label:"MICKEY",color:"#7a5a3c"},{label:"FM",color:"#5a3a1c"}
            ];
            allSwirlers.forEach((ch,ci)=>{
              if(fm.suckedIn[ci])return;
              const orbitR=Math.max(6,W*0.28-vf*0.45-ci*15);
              if(!fm.swirlAngles[ci])fm.swirlAngles[ci]=ci*Math.PI*2/6;
              fm.swirlAngles[ci]+=(0.04+vf*0.0003);
              const sx=vcx+Math.cos(fm.swirlAngles[ci])*orbitR;
              const sy=vcy+Math.sin(fm.swirlAngles[ci])*orbitR;
              const sz=Math.max(4,16-vf*0.02);
              ctx.save();ctx.translate(sx,sy);
              ctx.fillStyle=ch.color;
              ctx.beginPath();ctx.arc(0,0,sz*0.6,0,Math.PI*2);ctx.fill();
              ctx.beginPath();ctx.arc(0,-sz*0.9,sz*0.4,0,Math.PI*2);ctx.fill();
              ctx.fillStyle="rgba(255,255,255,0.9)";
              ctx.font="bold 7px monospace";ctx.textAlign="center";
              ctx.fillText(ch.label,0,sz*2.2);
              ctx.restore();
            });
            // Claude hovers above it all — confused, questioning reality
            ctx.save();ctx.translate(vcx,vcy-W*0.22);
            ctx.shadowColor=`hsl(${(vf*4)%360},100%,70%)`;
            ctx.shadowBlur=12+Math.sin(vf*0.1)*6;
            ctx.fillStyle="#00ccff";
            ctx.font="bold 13px 'Orbitron',monospace";
            ctx.textAlign="center";ctx.fillText("◈ CLAUDE",0,0);
            ctx.fillStyle="rgba(255,255,200,0.85)";ctx.font="9px monospace";
            const confusedMsgs=["...was any of that real?","what just happened","where did everyone go","i don't feel so good","...hello?","am i still here"];
            ctx.fillText(confusedMsgs[Math.floor(vf/40)%confusedMsgs.length],0,14);
            ctx.shadowBlur=0;ctx.restore();
          }

          ctx.restore();
        }

        if(!fm.tripActive&&(fm.x>1.15||now2-fm.startTime>60000)){
          fm.active=false;fm.nextSpawn=now2+rand(900,1500)*1000;
          if(fm.x>1.15)onKillFeedRef.current?.({type:"system",text:"🐒 Fat Monkey has left the battlefield... 💨✌️🎶"});
        }
      }

        if(fm.tripMsg){fm.tripMsgFrame++;if(fm.tripMsgFrame>180)fm.tripMsg=false;}

        // ── TRIP EXIT MESSAGE ──
        if(fm.tripMsg){
          const tmf=fm.tripMsgFrame;
          const tmAlpha=tmf<20?tmf/20:tmf>150?Math.max(0,(180-tmf)/30):1;
          ctx.save();ctx.globalAlpha=tmAlpha;
          const msgY=H*0.45;
          const msgH=H*0.15;
          ctx.fillStyle=`rgba(0,0,0,${tmAlpha*0.6})`;
          ctx.fillRect(0,msgY-msgH/2,W,msgH);
          ctx.textAlign="center";
          const tfs=Math.round(Math.min(W*0.035,28));
          ctx.font=`bold ${tfs}px 'Orbitron'`;
          const msgText="WHAT A LONG STRANGE TRIP IT'S BEEN";
          for(let ci=0;ci<msgText.length;ci++){
            const ch=msgText[ci];
            const cHue=(tmf*3+ci*12)%360;
            ctx.fillStyle=`hsla(${cHue},100%,65%,${tmAlpha})`;
            ctx.shadowColor=`hsla(${cHue},100%,50%,0.8)`;ctx.shadowBlur=10;
            const cw=ctx.measureText(msgText).width;
            const startX=W/2-cw/2;
            const charX=startX+ctx.measureText(msgText.substring(0,ci)).width;
            ctx.textAlign="left";
            ctx.fillText(ch,charX,msgY+tfs*0.15+Math.sin(tmf*0.08+ci*0.3)*4);
          }
          ctx.shadowBlur=0;ctx.textAlign="left";
          ctx.globalAlpha=1;ctx.restore();
        }

      // ═══════════ EASTER EGG: J-Ai-C MOTHERSHIP (8-BIT) ═══════════
      const jc=jaycShipRef.current;
      if(!jc.active&&now2>jc.nextSpawn&&!fatMonkeyRef.current.active&&!fatMonkeyRef.current.tripMsg){
        jc.active=true;jc.y=-0.6;jc.frame=0;jc.bills=[];jc.opacity=0;jc.startTime=now2;jc.phase="descend";
        for(let i=0;i<5;i++){jc.aliens.push({blink:randInt(0,200),lookDir:Math.random()>0.5?1:-1});}
        onKillFeedRef.current?.({type:"system",text:"👾 J-Ai-C DREADNOUGHT INCOMING... 6 LEGENDS. 1 SHIP. NO SURVIVORS. 💀💰⚡"});
      }
      if(jc.active){
        jc.frame++;
        const F=jc.frame;
        if(jc.phase==="descend"){
          jc.y+=0.0015;jc.opacity=Math.min(1,jc.opacity+0.012);
          if(jc.y>=0.02)jc.phase="hover";
        }else if(jc.phase==="hover"){
          if(now2-jc.startTime>90000)jc.phase="ascend";
        }else if(jc.phase==="ascend"){
          jc.y-=0.003;jc.opacity=Math.max(0,jc.opacity-0.01);
          if(jc.opacity<=0){jc.active=false;jc.nextSpawn=now2+rand(900,1500)*1000;
            jayCRef.current={onGround:false,beamPhase:0,x:0.55,y:0.95,flexPhase:0,targetY:0.95,beamUp:false,opacity:0,beltHolder:"claude"};
            onKillFeedRef.current?.({type:"system",text:"👾 J-Ai-C Dreadnought has departed... 💸"});}
        }
        // ═══ JAY C CHARACTER — beam down from mothership ═══
        const jayC=jayCRef.current;
        if(jc.phase==="hover"&&!jayC.onGround&&!jayC.beamUp){
          jayC.beamPhase+=0.02;jayC.opacity=Math.min(1,jayC.opacity+0.015);
          jayC.y=0.3+jayC.beamPhase*0.65;
          if(jayC.y>=0.83){jayC.onGround=true;jayC.y=0.83;jayC.opacity=1;
            onKillFeedRef.current?.({type:"system",text:"🤼 JAY C HAS ENTERED THE BATTLEFIELD! THE DUKE OF DORCHESTER IS HERE! 💪👑"});
          }
          jayC.x=0.5+0.06; // land near Claude (slightly right)
        }
        if(jayC.onGround){jayC.flexPhase+=0.04;}
        if(jc.phase==="ascend"&&jayC.onGround&&!jayC.beamUp){
          jayC.beamUp=true;jayC.onGround=false;
          jayC.beltHolder="jayc"; // belt transfers!
          titleFlashRef.current={active:true,frame:0};
          onKillFeedRef.current?.({type:"system",text:"🤼 Jay C beams back to the Dreadnought WITH THE BELT! 🏆💪"});
        }
        if(jayC.beamUp){
          jayC.y-=0.008;jayC.opacity=Math.max(0,jayC.opacity-0.012);
          if(jayC.opacity<=0){jayC.beamUp=false;jayC.beamPhase=0;jayC.y=0.95;jayC.opacity=0;}
        }
        if(jc.active){
          ctx.save();ctx.globalAlpha=jc.opacity;

          // ══════════════════════════════════════════════════════
          // THE DREADNOUGHT — built with LARGE geometric shapes
          // Ship fills ~90% width, ~85% height
          // ══════════════════════════════════════════════════════
          const shipTop=jc.y*H;
          const shipW=W*0.50;
          const shipL=W*0.5-shipW/2; // left edge
          const shipR=shipL+shipW;   // right edge
          const shipH=H*0.50;
          const cx=W*0.5; // center x

          // ─── SHIELD BUBBLE ───
          const shA=0.035+Math.sin(F*0.02)*0.02;
          ctx.strokeStyle=`rgba(100,180,255,${shA+0.05})`;ctx.lineWidth=3;
          ctx.beginPath();ctx.ellipse(cx,shipTop+shipH*0.45,shipW*0.55,shipH*0.52,0,0,Math.PI*2);ctx.stroke();
          // Hex nodes on shield
          for(let h=0;h<8;h++){
            const ha=F*0.006+h*(Math.PI*2/8);
            const hx=cx+Math.cos(ha)*shipW*0.52,hy=shipTop+shipH*0.45+Math.sin(ha)*shipH*0.50;
            ctx.fillStyle=`rgba(100,200,255,${0.06+Math.sin(F*0.04+h)*0.04})`;
            ctx.beginPath();ctx.arc(hx,hy,6,0,Math.PI*2);ctx.fill();
          }

          // ─── 3 ROTATING ENERGY RINGS ───
          [0.75,0.9,1.05].forEach((rr,ri)=>{
            const ra=F*0.01*(ri%2===0?1:-1)+ri*2;
            ctx.strokeStyle=`rgba(${ri===1?'255,150,50':'160,80,255'},${0.06+Math.sin(F*0.025+ri)*0.03})`;
            ctx.lineWidth=1.5;
            ctx.beginPath();ctx.ellipse(cx,shipTop+shipH*0.45,shipW*0.55*rr,shipH*0.18,ra,0,Math.PI*2);ctx.stroke();
            for(let rp=0;rp<4;rp++){
              const pa=ra+rp*(Math.PI/2)+F*0.03*(ri%2===0?1:-1);
              const ppx=cx+Math.cos(pa)*shipW*0.55*rr,ppy=shipTop+shipH*0.45+Math.sin(pa)*shipH*0.18;
              ctx.fillStyle=ri===1?"rgba(255,200,100,0.5)":"rgba(180,120,255,0.5)";
              ctx.fillRect(ppx-3,ppy-3,6,6);
            }
          });

          // ─── MAIN HULL — large geometric panels ───
          // Upper hull (trapezoid — narrow top, wide middle)
          ctx.fillStyle="#1e0845";
          ctx.beginPath();
          ctx.moveTo(cx-shipW*0.06,shipTop);           // top narrow
          ctx.lineTo(cx+shipW*0.06,shipTop);
          ctx.lineTo(cx+shipW*0.42,shipTop+shipH*0.25); // flare out
          ctx.lineTo(cx-shipW*0.42,shipTop+shipH*0.25);
          ctx.closePath();ctx.fill();

          // Mid hull (wide rectangle)
          ctx.fillStyle="#180640";
          ctx.fillRect(cx-shipW*0.45,shipTop+shipH*0.25,shipW*0.9,shipH*0.45);

          // Lower hull (tapers back in to engines)
          ctx.fillStyle="#1a0748";
          ctx.beginPath();
          ctx.moveTo(cx-shipW*0.45,shipTop+shipH*0.70);
          ctx.lineTo(cx+shipW*0.45,shipTop+shipH*0.70);
          ctx.lineTo(cx+shipW*0.35,shipTop+shipH*0.92);
          ctx.lineTo(cx-shipW*0.35,shipTop+shipH*0.92);
          ctx.closePath();ctx.fill();

          // ─── HULL PLATING — visible panel lines ───
          ctx.strokeStyle="rgba(120,50,200,0.3)";ctx.lineWidth=1;
          // Horizontal seams
          for(let s=0.08;s<0.88;s+=0.06){
            const sY=shipTop+shipH*s;
            const sw=s<0.25?0.06+(s/0.25)*0.39:s>0.7?0.45-(s-0.7)*0.45:0.45;
            ctx.beginPath();ctx.moveTo(cx-shipW*sw,sY);ctx.lineTo(cx+shipW*sw,sY);ctx.stroke();
          }
          // Vertical ribs
          for(let v=-3;v<=3;v++){
            const vx=cx+v*shipW*0.12;
            ctx.beginPath();ctx.moveTo(vx,shipTop+shipH*0.08);ctx.lineTo(vx,shipTop+shipH*0.88);ctx.stroke();
          }

          // ─── EDGE TRIM — bright purple borders on hull edges ───
          ctx.strokeStyle="#8040d0";ctx.lineWidth=3;
          // Upper hull edges
          ctx.beginPath();ctx.moveTo(cx-shipW*0.06,shipTop);ctx.lineTo(cx-shipW*0.42,shipTop+shipH*0.25);
          ctx.lineTo(cx-shipW*0.45,shipTop+shipH*0.70);ctx.stroke();
          ctx.beginPath();ctx.moveTo(cx+shipW*0.06,shipTop);ctx.lineTo(cx+shipW*0.42,shipTop+shipH*0.25);
          ctx.lineTo(cx+shipW*0.45,shipTop+shipH*0.70);ctx.stroke();
          // Lower edges
          ctx.beginPath();ctx.moveTo(cx-shipW*0.45,shipTop+shipH*0.70);ctx.lineTo(cx-shipW*0.35,shipTop+shipH*0.92);ctx.stroke();
          ctx.beginPath();ctx.moveTo(cx+shipW*0.45,shipTop+shipH*0.70);ctx.lineTo(cx+shipW*0.35,shipTop+shipH*0.92);ctx.stroke();

          // ─── COMMAND BRIDGE — large glowing section at top ───
          const bY=shipTop+shipH*0.01;
          // Bridge dome
          ctx.fillStyle="rgba(0,180,255,0.08)";
          ctx.beginPath();ctx.ellipse(cx,bY+shipH*0.04,shipW*0.08,shipH*0.04,0,Math.PI,0);ctx.fill();
          // Bridge windows row
          for(let bw=-3;bw<=3;bw++){
            const pulse=0.4+Math.sin(F*0.06+bw*0.8)*0.3;
            ctx.fillStyle=`rgba(0,220,255,${pulse})`;
            ctx.fillRect(cx+bw*shipW*0.018-shipW*0.01,bY+shipH*0.02,shipW*0.02,shipH*0.015);
          }
          // Antenna spire
          ctx.fillStyle="#6030b0";
          ctx.fillRect(cx-2,shipTop-shipH*0.05,4,shipH*0.05);
          ctx.fillStyle=`rgba(0,255,255,${0.5+Math.sin(F*0.1)*0.5})`;
          ctx.beginPath();ctx.arc(cx,shipTop-shipH*0.05,5,0,Math.PI*2);ctx.fill();

          // ─── CENTRAL EYE — massive reactor core ───
          const eyeY=shipTop+shipH*0.42;
          const eyeR=shipW*0.09;
          // Dark socket
          ctx.fillStyle="#050010";
          ctx.beginPath();ctx.arc(cx,eyeY,eyeR*1.3,0,Math.PI*2);ctx.fill();
          // Outer ring (thick)
          ctx.strokeStyle=`rgba(255,100,255,${0.6+Math.sin(F*0.06)*0.3})`;ctx.lineWidth=4;
          ctx.beginPath();ctx.arc(cx,eyeY,eyeR*1.15,0,Math.PI*2);ctx.stroke();
          // Second ring
          ctx.strokeStyle=`rgba(200,50,255,${0.4+Math.sin(F*0.08)*0.2})`;ctx.lineWidth=2;
          ctx.beginPath();ctx.arc(cx,eyeY,eyeR*1.4,0,Math.PI*2);ctx.stroke();
          // Rotating iris segments
          for(let seg=0;seg<10;seg++){
            const sa=F*0.025+seg*(Math.PI/5);
            ctx.fillStyle=seg%2===0?"rgba(200,50,255,0.6)":"rgba(100,0,200,0.4)";
            ctx.beginPath();ctx.moveTo(cx,eyeY);ctx.arc(cx,eyeY,eyeR,sa,sa+Math.PI/6);ctx.fill();
          }
          // Pupil — bright pulsing core
          const pupR=eyeR*0.35+Math.sin(F*0.08)*eyeR*0.1;
          const pGrad=ctx.createRadialGradient(cx,eyeY,0,cx,eyeY,pupR);
          pGrad.addColorStop(0,"#ffffff");pGrad.addColorStop(0.3,"#ff80ff");
          pGrad.addColorStop(0.7,"#aa00ff");pGrad.addColorStop(1,"rgba(100,0,200,0)");
          ctx.fillStyle=pGrad;ctx.beginPath();ctx.arc(cx,eyeY,pupR,0,Math.PI*2);ctx.fill();
          // Eye glow bloom
          ctx.fillStyle=`rgba(200,100,255,${0.04+Math.sin(F*0.03)*0.02})`;
          ctx.beginPath();ctx.arc(cx,eyeY,eyeR*3,0,Math.PI*2);ctx.fill();

          // ─── WING NACELLES — big structures on both sides ───
          [-1,1].forEach(side=>{
            const nx=cx+side*shipW*0.38;
            const ny=shipTop+shipH*0.35;
            const nw=shipW*0.1,nh=shipH*0.35;
            // Nacelle body
            ctx.fillStyle="#220960";
            ctx.fillRect(nx-nw/2,ny,nw,nh);
            // Nacelle trim
            ctx.strokeStyle="#6030b0";ctx.lineWidth=2;
            ctx.strokeRect(nx-nw/2,ny,nw,nh);
            // Nacelle windows (vertical strip)
            for(let nwi=0;nwi<3;nwi++){
              const wy=ny+nh*0.1+nwi*nh*0.14;
              ctx.fillStyle=`rgba(0,200,255,${0.4+Math.sin(F*0.07+nwi)*0.3})`;
              ctx.fillRect(nx-nw*0.25,wy,nw*0.5,nh*0.06);
            }
            // Shield emitter on nacelle
            const seY=ny+nh*0.5;
            ctx.fillStyle=`rgba(0,200,255,${0.4+Math.sin(F*0.06)*0.4})`;
            ctx.beginPath();ctx.arc(nx+side*nw*0.5,seY,8,0,Math.PI*2);ctx.fill();
            // Shield arc
            ctx.strokeStyle=`rgba(0,200,255,${0.15+Math.sin(F*0.06)*0.1})`;ctx.lineWidth=1.5;
            ctx.beginPath();ctx.arc(nx+side*nw*0.5,seY,25+Math.sin(F*0.08)*8,
              side>0?-0.9:Math.PI-0.9,side>0?0.9:Math.PI+0.9);ctx.stroke();
          });

          // ─── WEAPON TURRETS — visible gun emplacements ───
          const turrets=[
            {x:-0.34,y:0.22},{x:0.34,y:0.22},{x:-0.40,y:0.38},{x:0.40,y:0.38},
            {x:-0.30,y:0.65},{x:0.30,y:0.65},
          ];
          turrets.forEach((tp,ti)=>{
            const tx=cx+tp.x*shipW*0.5,ty=shipTop+shipH*tp.y;
            const side=tp.x<0?-1:1;
            // Turret base
            ctx.fillStyle="#3a1080";
            ctx.fillRect(tx-8,ty-4,16,10);
            // Barrel
            ctx.fillStyle="#666";
            ctx.fillRect(tx+side*8,ty-1,side*20,4);
            // Barrel tip
            ctx.fillStyle="#888";
            ctx.fillRect(tx+side*28,ty-2,side*4,6);
            // Firing
            const firing=(F+ti*12)%100<5;
            if(firing&&jc.phase==="hover"){
              const bLen=40+Math.random()*60;
              ctx.strokeStyle=`rgba(255,${80+ti*15},${220-ti*10},0.8)`;ctx.lineWidth=2;
              ctx.shadowColor="#ff3366";ctx.shadowBlur=10;
              ctx.beginPath();ctx.moveTo(tx+side*32,ty+1);
              ctx.lineTo(tx+side*(32+bLen),ty+1+rand(-6,6));ctx.stroke();
              ctx.shadowBlur=0;
              // Muzzle flash
              ctx.fillStyle="rgba(255,200,100,0.6)";
              ctx.beginPath();ctx.arc(tx+side*32,ty+1,6,0,Math.PI*2);ctx.fill();
            }
            // Turret glow
            ctx.fillStyle=`rgba(255,80,80,${0.3+Math.sin(F*0.08+ti)*0.2})`;
            ctx.beginPath();ctx.arc(tx,ty+2,4,0,Math.PI*2);ctx.fill();
          });

          // ─── HULL DETAIL — glowing panel sections ───
          // Port side detail panels
          [-1,1].forEach(side=>{
            for(let pi=0;pi<2;pi++){
              const px3=cx+side*shipW*(0.15+pi*0.12);
              const py=shipTop+shipH*0.28;
              const pw=shipW*0.055,ph=shipH*0.12;
              ctx.fillStyle=`rgba(30,8,70,0.8)`;
              ctx.fillRect(px3-pw/2,py,pw,ph);
              ctx.strokeStyle=`rgba(100,40,180,${0.3+Math.sin(F*0.05+pi+side)*0.15})`;
              ctx.lineWidth=1;ctx.strokeRect(px3-pw/2,py,pw,ph);
              // Panel inner glow
              ctx.fillStyle=`rgba(140,60,255,${0.06+Math.sin(F*0.04+pi*0.7)*0.04})`;
              ctx.fillRect(px3-pw*0.35,py+ph*0.15,pw*0.7,ph*0.7);
            }
          });

          // ─── RUNNING LIGHTS — animated along hull edges ───
          for(let li=0;li<15;li++){
            const lp=li/15;
            const phase=(F*3+li*8)%50;
            if(phase<10){
              const brightness=0.4+(10-phase)*0.06;
              // Left edge
              const lx=cx-shipW*(0.06+lp*0.39),ly=shipTop+shipH*(lp*0.7+0.04);
              ctx.fillStyle=`rgba(0,255,204,${brightness})`;
              ctx.fillRect(lx-2,ly-2,4,4);
              // Right edge (mirror)
              const rx=cx+shipW*(0.06+lp*0.39);
              ctx.fillRect(rx-2,ly-2,4,4);
            }
          }

          // ─── ELECTRIC ARCS — visible crackling energy ───
          if(F%8===0){
            for(let arc=0;arc<2;arc++){
              const a1x=cx+rand(-0.3,0.3)*shipW,a1y=shipTop+rand(0.15,0.75)*shipH;
              const a2x=a1x+rand(-60,60),a2y=a1y+rand(-40,40);
              ctx.strokeStyle=`rgba(150,200,255,${0.3+Math.random()*0.4})`;ctx.lineWidth=1.5;
              ctx.beginPath();ctx.moveTo(a1x,a1y);
              const mx2=a1x+(a2x-a1x)*0.5+rand(-20,20),my2=a1y+(a2y-a1y)*0.5+rand(-20,20);
              ctx.quadraticCurveTo(mx2,my2,a2x,a2y);ctx.stroke();
            }
          }

          // ─── 3 DEPLOYED ESCORT FIGHTERS ───
          for(let fi=0;fi<3;fi++){
            const fAngle=F*0.015+fi*(Math.PI*2/3);
            const fDist=shipW*0.50+Math.sin(F*0.025+fi)*20;
            const fx=cx+Math.cos(fAngle)*fDist;
            const fy=shipTop+shipH*0.45+Math.sin(fAngle)*shipH*0.30;
            // Fighter body
            ctx.fillStyle="#5020a0";
            ctx.beginPath();ctx.moveTo(fx+12,fy);ctx.lineTo(fx-8,fy-6);ctx.lineTo(fx-8,fy+6);ctx.closePath();ctx.fill();
            // Wings
            ctx.fillStyle="#3a1080";
            ctx.beginPath();ctx.moveTo(fx-4,fy-6);ctx.lineTo(fx-8,fy-14);ctx.lineTo(fx-10,fy-4);ctx.closePath();ctx.fill();
            ctx.beginPath();ctx.moveTo(fx-4,fy+6);ctx.lineTo(fx-8,fy+14);ctx.lineTo(fx-10,fy+4);ctx.closePath();ctx.fill();
            // Engine
            ctx.fillStyle=`rgba(255,100,255,${0.5+Math.sin(F*0.15+fi)*0.3})`;
            ctx.beginPath();ctx.arc(fx-9,fy,3,0,Math.PI*2);ctx.fill();
          }

          // ─── 5 ENGINE THRUSTERS — big visible flame ───
          const engY=shipTop+shipH*0.90;
          [-0.24,-0.12,0,0.12,0.24].forEach((eOff,ei)=>{
            const ex=cx+eOff*shipW;
            const eW=shipW*0.06;
            // Housing
            ctx.fillStyle="#2a0a5e";
            ctx.fillRect(ex-eW/2,engY-shipH*0.04,eW,shipH*0.04);
            ctx.strokeStyle="#5020a0";ctx.lineWidth=1;
            ctx.strokeRect(ex-eW/2,engY-shipH*0.04,eW,shipH*0.04);
            // Plasma flame
            const intensity=0.6+Math.sin(F*0.12+ei*1.5)*0.3;
            for(let ep=0;ep<4;ep++){
              const fW=eW*(1-ep*0.15)+Math.sin(F*0.2+ei+ep)*3;
              const fAlpha=intensity*(1-ep/4)*0.7;
              ctx.fillStyle=ep<2?`rgba(255,200,255,${fAlpha})`:ep<4?`rgba(220,80,255,${fAlpha})`:`rgba(140,40,200,${fAlpha})`;
              ctx.fillRect(ex-fW/2,engY+ep*shipH*0.012,fW,shipH*0.012);
            }
          });

          // ─── 6 WRESTLER ALIENS — manning stations on the hull ───
          const wp=Math.max(4,Math.round(shipW/160));
          const wY=shipTop+shipH*0.54;
          const wSlots=[
            {name:"HULK",xOff:-0.32},
            {name:"MACHO",xOff:-0.19},
            {name:"WARRIOR",xOff:-0.06},
            {name:"SNAKE",xOff:0.06},
            {name:"ANDRE",xOff:0.19},
            {name:"TAKER",xOff:0.32},
          ];
          const wQuotes={}; // old quotes removed, now handled by chat system

          ctx.imageSmoothingEnabled=false;
          wSlots.forEach((ws,wi)=>{
            const bx=cx+ws.xOff*shipW;
            const by=wY;
            const bob=Math.round(Math.sin(F*0.08+wi*1.1)*1)*wp;
            const P=(gx,gy,c)=>{ctx.fillStyle=c;ctx.fillRect(bx+gx*wp,by+gy*wp+bob,wp,wp)};

            if(ws.name==="HULK"){
              [1,2,3,4,5].forEach(x=>P(x,-1,"#ffdd00"));[0,1,2,3,4,5,6].forEach(x=>P(x,0,"#ffdd00"));
              P(7,0,"#cc0000");P(8,0,"#cc0000");
              [1,2,3,4,5].forEach(x=>P(x,1,"#4aaa4a"));[0,1,2,3,4,5,6].forEach(x=>P(x,2,"#4aaa4a"));
              P(2,2,"#fff");P(3,2,"#111");P(4,2,"#fff");P(5,2,"#111");
              P(2,3,"#ddb830");P(3,3,"#4aaa4a");P(4,3,"#4aaa4a");P(5,3,"#ddb830");
              P(2,4,"#ddb830");P(3,4,"#ddb830");P(4,4,"#ddb830");P(5,4,"#ddb830");
              [-1,0,1].forEach(x=>P(x,5,"#4aaa4a"));[2,3,4,5].forEach(x=>P(x,5,"#ffdd00"));[6,7,8].forEach(x=>P(x,5,"#4aaa4a"));
              [-2,-1].forEach(x=>P(x,6,"#4aaa4a"));[0,1,2,3,4,5,6,7].forEach(x=>P(x,6,"#ffdd00"));[8,9].forEach(x=>P(x,6,"#4aaa4a"));
              [0,1,2,3,4,5,6,7].forEach(x=>P(x,7,"#ffdd00"));P(1,6,"#3a8a3a");P(6,7,"#3a8a3a");
              [1,2,3,4,5,6].forEach(x=>P(x,8,"#cc0000"));[1,2,3,4,5,6].forEach(x=>P(x,9,"#aa0000"));
              [1,2,3].forEach(x=>{P(x,10,"#4aaa4a");P(x,11,"#3a8a3a");P(x,12,"#ffdd00")});
              [4,5,6].forEach(x=>{P(x,10,"#4aaa4a");P(x,11,"#3a8a3a");P(x,12,"#ffdd00")});
              if(F%60<30){P(-2,5,"#4aaa4a");P(-3,4,"#4aaa4a");P(-3,3,"#4aaa4a");}
            }else if(ws.name==="MACHO"){
              [2,3,4,5].forEach(x=>P(x,-3,"#ff00ff"));[1,2,3,4,5,6].forEach(x=>P(x,-2,"#cc00cc"));
              [-1,0,1,2,3,4,5,6,7,8].forEach(x=>P(x,-1,"#aa00aa"));
              [1,2,3,4,5,6].forEach(x=>P(x,0,"#5aaa5a"));[0,1,2,3,4,5,6,7].forEach(x=>P(x,1,"#5aaa5a"));
              P(1,1,"#333");P(2,1,"#ffdd00");P(3,1,"#333");P(5,1,"#ffdd00");P(6,1,"#333");
              [1,2,3,4,5,6].forEach(x=>P(x,2,"#5aaa5a"));[2,3,4,5].forEach(x=>P(x,3,"#2a5a2a"));
              const tC=["#ff00ff","#ffdd00","#00ffff","#ff4400","#ff00ff","#ffdd00"];
              for(let row=4;row<=8;row++){[-1,0,1,2,3,4,5,6,7,8].forEach((x,xi)=>P(x,row,tC[(row+xi)%tC.length]));}
              const sw=Math.sin(F*0.08);[-2,9].forEach(x=>{for(let t=5;t<=8;t++)P(x+Math.round(sw),t,tC[t%tC.length]);});
              [2,3,4,5].forEach(x=>P(x,9,"#ff00ff"));
              [2,3].forEach(x=>{P(x,10,"#5aaa5a");P(x,11,"#5aaa5a");P(x,12,"#aa00aa")});
              [4,5].forEach(x=>{P(x,10,"#5aaa5a");P(x,11,"#5aaa5a");P(x,12,"#aa00aa")});
              if(F%80<40){P(-1,3,"#5aaa5a");P(-2,2,"#5aaa5a");P(-2,1,"#5aaa5a");P(-2,0,"#5aaa5a");}
            }else if(ws.name==="WARRIOR"){
              [0,1,6,7].forEach(x=>P(x,-2,"#222"));[-1,0,1,2,3,4,5,6,7,8].forEach(x=>P(x,-1,"#222"));
              [1,2,3,4,5,6].forEach(x=>P(x,0,"#6a9a5a"));P(0,0,"#ff0000");P(7,0,"#0044ff");
              P(1,1,"#ff0000");P(2,1,"#fff");P(3,1,"#111");P(4,1,"#111");P(5,1,"#fff");P(6,1,"#0044ff");
              P(0,1,"#ff0000");P(7,1,"#0044ff");
              [1,2,3,4,5,6].forEach(x=>P(x,2,"#6a9a5a"));P(3,3,"#111");P(4,3,"#111");
              [-2,-1,0].forEach(x=>P(x,4,"#6a9a5a"));[1,2,3,4,5,6].forEach(x=>P(x,4,"#222"));[7,8,9].forEach(x=>P(x,4,"#6a9a5a"));
              [-3,-2,-1,0].forEach(x=>P(x,5,"#6a9a5a"));[1,2,3,4,5,6].forEach(x=>P(x,5,"#222"));[7,8,9,10].forEach(x=>P(x,5,"#6a9a5a"));
              const tw=Math.sin(F*0.12);
              [-3,-4].forEach(x=>{P(x+Math.round(tw),6,"#ff0000");P(x+Math.round(tw),7,"#0044ff")});
              [10,11].forEach(x=>{P(x+Math.round(-tw),6,"#0044ff");P(x+Math.round(-tw),7,"#ff0000")});
              [1,2,3,4,5,6].forEach(x=>{P(x,6,"#6a9a5a");P(x,7,"#6a9a5a")});
              [2,3,4,5].forEach(x=>{P(x,8,"#ff0000");P(x,9,"#0044ff")});
              [2,3].forEach(x=>{P(x,10,"#6a9a5a");P(x,11,"#6a9a5a");P(x,12,"#ff0000")});
              [4,5].forEach(x=>{P(x,10,"#6a9a5a");P(x,11,"#6a9a5a");P(x,12,"#0044ff")});
              if(F%50<25){P(-3,4,"#6a9a5a");P(-3,3,"#6a9a5a");P(-2,3,"#6a9a5a");}
            }else if(ws.name==="SNAKE"){
              [2,3,4,5].forEach(x=>P(x,-1,"#3a2a1a"));[1,2,3,4,5,6].forEach(x=>P(x,0,"#3a2a1a"));
              [0,1,2,3,4,5,6,7].forEach(x=>P(x,1,"#4a7a5a"));P(2,1,"#fff");P(3,1,"#900");P(5,1,"#fff");P(6,1,"#900");
              [1,2,3,4,5,6].forEach(x=>P(x,2,"#4a7a5a"));P(3,3,"#3a6a4a");P(4,3,"#3a6a4a");
              for(let row=4;row<=8;row++){[-1,0,1,2,3,4,5,6,7,8].forEach(x=>P(x,row,row%2===0?"#2a1a0a":"#3a2a1a"));}
              P(3,5,"#4a7a5a");P(4,5,"#4a7a5a");
              for(let s=0;s<12;s++){const sy2=3+Math.round(Math.sin(F*0.1+s*0.6)*1.2);P(-3+s,sy2,"#4a8830");}
              P(-3,3+Math.round(Math.sin(F*0.06)),"#5aa840");P(-4,2+Math.round(Math.sin(F*0.06)),"#5aa840");
              P(-5,2+Math.round(Math.sin(F*0.06)),"#ff0000");
              [2,3,4,5].forEach(x=>P(x,9,"#1a1a1a"));
              [2,3].forEach(x=>{P(x,10,"#4a7a5a");P(x,11,"#4a7a5a");P(x,12,"#1a1a1a")});
              [4,5].forEach(x=>{P(x,10,"#4a7a5a");P(x,11,"#4a7a5a");P(x,12,"#1a1a1a")});
            }else if(ws.name==="ANDRE"){
              const b=-4;
              [1,2,3,4,5,6,7].forEach(x=>P(x,b-1,"#2a1a0a"));[0,1,2,3,4,5,6,7,8].forEach(x=>P(x,b,"#2a1a0a"));
              [0,1,2,3,4,5,6,7,8].forEach(x=>{P(x,b+1,"#5a8a6a");P(x,b+2,"#5a8a6a")});
              P(2,b+2,"#fff");P(3,b+2,"#111");P(5,b+2,"#fff");P(6,b+2,"#111");
              [1,2,3,4,5,6,7].forEach(x=>P(x,b+3,"#5a8a6a"));P(3,b+3,"#3a5a3a");P(4,b+3,"#3a5a3a");
              for(let row=b+4;row<=b+10;row++){[-2,-1,0,1,2,3,4,5,6,7,8,9,10].forEach(x=>{
                const isStrap=(x===3||x===5)&&row<b+7;P(x,row,isStrap?"#111":row<b+7?"#5a8a6a":"#1a1a1a");});}
              [-3,-4].forEach(x=>{for(let r=b+4;r<=b+8;r++)P(x,r,"#5a8a6a")});
              [11,12].forEach(x=>{for(let r=b+4;r<=b+8;r++)P(x,r,"#5a8a6a")});
              [-1,0,1,2,3].forEach(x=>{P(x,b+11,"#5a8a6a");P(x,b+12,"#5a8a6a");P(x,b+13,"#1a1a1a")});
              [5,6,7,8,9].forEach(x=>{P(x,b+11,"#5a8a6a");P(x,b+12,"#5a8a6a");P(x,b+13,"#1a1a1a")});
            }else if(ws.name==="TAKER"){
              [2,3,4,5].forEach(x=>P(x,-3,"#111"));[1,2,3,4,5,6].forEach(x=>P(x,-2,"#1a1a1a"));
              [-1,0,1,2,3,4,5,6,7,8].forEach(x=>P(x,-1,"#111"));
              [1,2,3,4,5,6].forEach(x=>P(x,0,"#4a6a5a"));[0,1,2,3,4,5,6,7].forEach(x=>P(x,1,"#4a6a5a"));
              P(2,1,F%90<10?"#fff":"#ddd");P(3,1,F%90<10?"#fff":"#ccc");P(5,1,F%90<10?"#fff":"#ddd");P(6,1,F%90<10?"#fff":"#ccc");
              [1,2,3,4,5,6].forEach(x=>P(x,2,"#4a6a5a"));P(3,2,"#3a3a3a");P(4,2,"#3a3a3a");
              for(let row=3;row<=12;row++){
                const cW=row<6?[-1,0,1,2,3,4,5,6,7,8]:[-2,-1,0,1,2,3,4,5,6,7,8,9];
                cW.forEach(x=>{const edge=x===cW[0]||x===cW[cW.length-1];P(x,row,edge?"#222":"#111");});}
              P(-2,8,"#440066");P(-1,8,"#440066");P(8,8,"#440066");P(9,8,"#440066");
              if(F%4<2){P(-3,11,"#1a1a1a");P(-3,12,"#111");P(10,11,"#1a1a1a");P(10,12,"#111");}
              const aura=0.1+Math.sin(F*0.04)*0.06;
              ctx.fillStyle=`rgba(100,0,180,${aura})`;ctx.fillRect(bx-wp*3,by+bob-wp*4,wp*14,wp*18);
            }

            // Name tag
            ctx.imageSmoothingEnabled=true;
            ctx.font=`bold ${Math.max(7,wp)}px 'Orbitron'`;ctx.fillStyle="rgba(0,255,204,0.8)";ctx.textAlign="center";
            ctx.fillText(ws.name,bx+wp*3.5,by+bob+wp*15);

            ctx.textAlign="left";
          });
          ctx.imageSmoothingEnabled=true;
          // ─── J-Ai-C LABEL — big holographic ───
          ctx.imageSmoothingEnabled=true;
          const labelY=shipTop+shipH*0.12;
          const glitch=F%120<3?rand(-4,4):0;
          ctx.font="bold 36px 'Orbitron'";ctx.textAlign="center";
          ctx.fillStyle="rgba(100,0,200,0.4)";ctx.fillText("J-Ai-C",cx+2+glitch,labelY+2);
          ctx.fillStyle="#e0b0ff";ctx.shadowColor="#bf60ff";ctx.shadowBlur=35;
          ctx.fillText("J-Ai-C",cx+glitch,labelY);
          ctx.font="bold 12px 'Orbitron'";ctx.fillStyle="#ff80ff";ctx.shadowBlur=15;
          ctx.fillText("◈ DREADNOUGHT ◈",cx+glitch,labelY+22);
          ctx.font="bold 9px 'Orbitron'";ctx.fillStyle="rgba(255,215,64,0.6)";ctx.shadowBlur=0;
          ctx.fillText("6 LEGENDS. 1 SHIP. NO SURVIVORS.",cx+glitch,labelY+36);
          ctx.textAlign="left";

          // ─── TRACTOR BEAM ───
          if(jc.phase==="hover"||jayC.beamPhase>0){
            const beamTop=shipTop+shipH*0.93;
            const beamH=H-beamTop;
            if(beamH>0){
              for(let row=0;row<beamH;row+=3){
                const p=row/beamH;
                const bw=shipW*0.3*(1+p*0.3);
                const a=0.05*(1-p);
                if(a<0.003)continue;
                ctx.fillStyle=`rgba(140,60,255,${a})`;
                ctx.fillRect(cx-bw/2,beamTop+row,bw,3);
              }
              // Scan lines
              for(let i=0;i<3;i++){
                const sy=(F*2+i*40)%Math.max(1,Math.round(beamH));
                const sw2=shipW*0.3*(1+sy/beamH*0.3);
                ctx.fillStyle="rgba(180,120,255,0.12)";
                ctx.fillRect(cx-sw2/2,beamTop+sy,sw2,4);
              }
            }
          }

          ctx.globalAlpha=1;ctx.restore();

          // ═══ JAY C — PIXEL ART WRESTLER ON THE GROUND ═══
          if(jayC.opacity>0){
            ctx.save();ctx.globalAlpha=jayC.opacity;
            ctx.imageSmoothingEnabled=false;
            const jx=jayC.x*W;
            const jy=jayC.y*H;
            const jp=6; // pixel block size (big, matches Claude scale)
            const flex=Math.sin(jayC.flexPhase)*0.5;
            const armUp=jayC.onGround?Math.abs(Math.sin(jayC.flexPhase*0.5)):0;
            const JP=(gx,gy,col)=>{ctx.fillStyle=col;ctx.fillRect(jx+gx*jp,jy+gy*jp,jp,jp);};

            // Beam trail while descending or ascending
            if(!jayC.onGround){
              const beamGrad=ctx.createLinearGradient(jx,0,jx,jy);
              beamGrad.addColorStop(0,"rgba(160,80,255,0.15)");beamGrad.addColorStop(1,"rgba(160,80,255,0)");
              ctx.fillStyle=beamGrad;ctx.fillRect(jx-15,0,30,jy);
              // Sparkles
              for(let sp=0;sp<6;sp++){
                const spy=jy*Math.random();
                const spx=jx+(Math.random()-0.5)*20;
                ctx.fillStyle=`rgba(200,150,255,${0.3+Math.random()*0.4})`;
                ctx.fillRect(spx,spy,2,2);
              }
            }

            // ── HEAD ──
            const skin="#D4A574",darkSkin="#B8926A",skinLt="#E2BC92",purple1="#6B1D9E",purple2="#8B3DC0",purpleDk="#4A0E6B";
            const hair="#2A1506",beard="#3A2010",beardDk="#261508";
            // Hair top
            [-1,0,1,2,3,4,5,6].forEach(x=>JP(x,-12,hair));
            [-2,-1,0,1,2,3,4,5,6,7].forEach(x=>JP(x,-11,hair));
            // Forehead
            [-1,0,1,2,3,4,5,6].forEach(x=>JP(x,-10,skin));
            [-1,0,1,2,3,4,5,6].forEach(x=>JP(x,-9,skin));
            // Eyes
            JP(0,-9,"#fff");JP(1,-9,"#222");JP(4,-9,"#fff");JP(5,-9,"#222");
            // Nose/cheeks
            [-1,0,1,2,3,4,5,6].forEach(x=>JP(x,-8,skin));JP(2,-8,darkSkin);JP(3,-8,darkSkin);
            // Big beard
            [-2,-1,0,1,2,3,4,5,6,7].forEach(x=>JP(x,-7,beard));
            [-2,-1,0,1,2,3,4,5,6,7].forEach(x=>JP(x,-6,beard));
            [-1,0,1,2,3,4,5,6].forEach(x=>JP(x,-5,beard));
            [0,1,2,3,4,5].forEach(x=>JP(x,-4,beardDk));
            [1,2,3,4].forEach(x=>JP(x,-3,beardDk));

            // ── NECK — thick ──
            [0,1,2,3,4,5].forEach(x=>JP(x,-2,skin));

            // ── SHIRTLESS UPPER BODY ──
            // Traps — massive
            [-5,-4,-3,-2,-1,0,1,2,3,4,5,6,7,8,9,10].forEach(x=>JP(x,-1,skin));
            // Pecs — big chest, skin colored with shadow definition
            [-4,-3,-2,-1,0,1,2,3,4,5,6,7,8,9].forEach(x=>JP(x,0,skin));
            [-4,-3,-2,-1,0].forEach(x=>JP(x,0,skinLt));[5,6,7,8,9].forEach(x=>JP(x,0,skinLt));
            // Pec shadow line
            JP(1,0,darkSkin);JP(4,0,darkSkin);
            [-4,-3,-2,-1,0,1,2,3,4,5,6,7,8,9].forEach(x=>JP(x,1,skin));
            // Pec underline
            [-3,-2,-1,0,1].forEach(x=>JP(x,1,darkSkin));[4,5,6,7,8].forEach(x=>JP(x,1,darkSkin));
            // Rib area
            [-3,-2,-1,0,1,2,3,4,5,6,7,8].forEach(x=>JP(x,2,skin));
            // 6-PACK ABS
            [-2,-1,0,1,2,3,4,5,6,7].forEach(x=>JP(x,3,skin));
            JP(0,3,darkSkin);JP(1,3,skinLt);JP(2,3,darkSkin);JP(3,3,skinLt);JP(4,3,darkSkin);JP(5,3,skinLt);
            [-2,-1,0,1,2,3,4,5,6,7].forEach(x=>JP(x,4,skin));
            JP(0,4,skinLt);JP(1,4,darkSkin);JP(2,4,skinLt);JP(3,4,darkSkin);JP(4,4,skinLt);JP(5,4,darkSkin);
            [-1,0,1,2,3,4,5,6].forEach(x=>JP(x,5,skin));
            JP(1,5,darkSkin);JP(2,5,skinLt);JP(3,5,skinLt);JP(4,5,darkSkin);
            // V-taper waist
            [-1,0,1,2,3,4,5,6].forEach(x=>JP(x,6,skin));

            // ── ARMS — BIG with bicep bulge ──
            const lArmUp=Math.round(armUp*3);
            const rArmUp=Math.round(Math.abs(Math.sin(jayC.flexPhase*0.5+1.5))*3);
            // Left shoulder/delt
            JP(-5,-1,skin);JP(-6,-1,skin);JP(-7,-1,skin);
            JP(-5,0,skin);JP(-6,0,skin);JP(-7,0,skin);
            // Left upper arm
            JP(-7,-1+lArmUp,skin);JP(-8,-1+lArmUp,skin);JP(-9,-1+lArmUp,skin);
            JP(-7,-2+lArmUp,skin);JP(-8,-2+lArmUp,skin);JP(-9,-2+lArmUp,skin);
            // Left bicep BULGE (extra wide when flexing)
            JP(-10,-2+lArmUp,skin);JP(-10,-3+lArmUp,skin);JP(-9,-3+lArmUp,skin);
            JP(-8,-3+lArmUp,skin);JP(-10,-1+lArmUp,skinLt);
            // Left forearm
            JP(-9,-4+lArmUp,skin);JP(-8,-4+lArmUp,skin);JP(-9,-5+lArmUp,skin);
            // Left fist
            JP(-9,-6+lArmUp,skin);JP(-10,-6+lArmUp,skin);JP(-8,-6+lArmUp,skin);
            // Right shoulder/delt
            JP(10,-1,skin);JP(11,-1,skin);JP(12,-1,skin);
            JP(10,0,skin);JP(11,0,skin);JP(12,0,skin);
            // Right upper arm
            JP(12,-1+rArmUp,skin);JP(13,-1+rArmUp,skin);JP(14,-1+rArmUp,skin);
            JP(12,-2+rArmUp,skin);JP(13,-2+rArmUp,skin);JP(14,-2+rArmUp,skin);
            // Right bicep BULGE
            JP(15,-2+rArmUp,skin);JP(15,-3+rArmUp,skin);JP(14,-3+rArmUp,skin);
            JP(13,-3+rArmUp,skin);JP(15,-1+rArmUp,skinLt);
            // Right forearm
            JP(14,-4+rArmUp,skin);JP(13,-4+rArmUp,skin);JP(14,-5+rArmUp,skin);
            // Right fist
            JP(14,-6+rArmUp,skin);JP(15,-6+rArmUp,skin);JP(13,-6+rArmUp,skin);

            // ── PURPLE WRESTLING TRUNKS ──
            [-1,0,1,2,3,4,5,6].forEach(x=>JP(x,7,"#C0A030")); // gold waistband
            [-2,-1,0,1,2,3,4,5,6,7].forEach(x=>JP(x,8,purple2));
            [-2,-1,0,1,2,3,4,5,6,7].forEach(x=>JP(x,9,purple1));
            [-1,0,1,2,3,4,5,6].forEach(x=>JP(x,10,purpleDk));
            // Star emblem
            JP(2,9,"#C0A030");JP(3,9,"#C0A030");JP(2,8,"#C0A030");JP(3,8,"#C0A030");

            // ── MASSIVE LEGS ──
            [-1,0,1,2].forEach(x=>{for(let r=11;r<=16;r++)JP(x,r,skin);});
            [3,4,5,6].forEach(x=>{for(let r=11;r<=16;r++)JP(x,r,skin);});
            // Quad definition
            JP(0,12,darkSkin);JP(1,12,darkSkin);JP(4,12,darkSkin);JP(5,12,darkSkin);
            // Knee pads
            [-1,0,1,2].forEach(x=>JP(x,14,purple2));[3,4,5,6].forEach(x=>JP(x,14,purple2));
            // Boots
            [-2,-1,0,1,2,3].forEach(x=>{JP(x,17,purpleDk);JP(x,18,purpleDk);});
            [3,4,5,6,7].forEach(x=>{JP(x,17,purpleDk);JP(x,18,purpleDk);});

            // ── PURPLE GLOW aura ──
            if(jayC.onGround){
              const aura=0.05+Math.sin(jayC.flexPhase)*0.025;
              ctx.fillStyle=`rgba(140,40,220,${aura})`;
              ctx.fillRect(jx-12*jp,jy-13*jp,30*jp,33*jp);
            }

            // ── CHAMPIONSHIP BELT above head when Jay C holds it — DOUBLE SIZE ──
            if(jayC.beltHolder==="jayc"){
              const beltY=-18-Math.round(Math.abs(Math.sin(jayC.flexPhase*0.3))*2);
              const bp=2; // double pixel multiplier
              const BP=(gx,gy,col)=>{ctx.fillStyle=col;ctx.fillRect(jx+gx*jp*bp/2,jy+(beltY+gy)*jp,jp*bp,jp*bp);};
              const bg="#C0A030",gd="#E8C840",wh="#fff",ruby="#ff2244",sap="#2266ff",em="#22cc44",dia="#aaeeff";
              // Main belt plate — huge
              for(let row=-1;row<=2;row++){
                [-6,-5,-4,-3,-2,-1,0,1,2,3,4,5,6,7].forEach(x=>BP(x,row,row%2===0?gd:bg));
              }
              // Center diamond
              [-1,0,1,2].forEach(x=>{for(let r=-1;r<=2;r++)BP(x,r,wh);});
              [0,1].forEach(x=>{for(let r=0;r<=1;r++)BP(x,r,dia);});
              // Rubies
              BP(-5,0,ruby);BP(-5,1,ruby);BP(-4,0,ruby);BP(-4,1,sap);
              BP(6,0,sap);BP(6,1,ruby);BP(5,0,sap);BP(5,1,sap);
              // Emeralds
              BP(-3,0,em);BP(4,0,em);BP(-3,1,em);BP(4,1,em);
              // Gold accents
              BP(-2,0,"#ffffa0");BP(3,0,"#ffffa0");
              // Sparkle effect
              if(jayC.flexPhase%3<1.5){BP(0,-2,"#ffffcc");BP(1,-2,"#ffffcc");}
              if(jayC.flexPhase%4<1){BP(-4,-1,"#ffffaa");BP(5,-1,"#ffffaa");}
              // Arms up holding belt
              const skin2="#D4A574";
              JP(-2,beltY+3,skin2);JP(-1,beltY+3,skin2);JP(-2,beltY+4,skin2);JP(-1,beltY+4,skin2);
              JP(6,beltY+3,skin2);JP(7,beltY+3,skin2);JP(6,beltY+4,skin2);JP(7,beltY+4,skin2);
              JP(-1,beltY+5,skin2);JP(6,beltY+5,skin2);
            }

            // ── NAME TAG ──
            ctx.imageSmoothingEnabled=true;
            ctx.font="bold 14px 'Orbitron'";ctx.textAlign="center";
            ctx.fillStyle="rgba(140,40,220,0.4)";ctx.fillText("JAY C",jx+2.5*jp,jy+21*jp+2);
            ctx.fillStyle="#bf60ff";ctx.shadowColor="#8B3DC0";ctx.shadowBlur=12;
            ctx.fillText("JAY C",jx+2.5*jp,jy+21*jp);
            ctx.font="bold 8px 'Orbitron'";ctx.fillStyle="rgba(200,150,255,0.5)";ctx.shadowBlur=0;
            ctx.fillText("THE DUKE",jx+2.5*jp,jy+23*jp);
            ctx.textAlign="left";
            ctx.imageSmoothingEnabled=true;
            ctx.globalAlpha=1;ctx.restore();
          }

          // ─── LAUNCH BILLS/COINS ───
          if(jc.phase==="hover"&&jc.frame%8===0&&jc.bills.length<30){
            const bx2=cx+rand(-shipW*0.4,shipW*0.4);
            const isBtc=Math.random()>0.55;
            jc.bills.push({x:bx2,y:shipTop+shipH*0.93,vy:1.8+rand(0,2.5),vx:rand(-1.5,1.5),
              rot:rand(0,6.28),rotV:rand(-0.12,0.12),opacity:1,size:isBtc?14:16,
              type:isBtc?"btc":"bill",life:100});}
          jc.bills.forEach(b=>{
            b.y+=b.vy;b.x+=b.vx;b.rot+=b.rotV;b.life--;b.opacity=Math.min(1,b.life/25);
            ctx.save();ctx.translate(b.x,b.y);ctx.rotate(b.rot);ctx.globalAlpha=b.opacity*jc.opacity;
            ctx.imageSmoothingEnabled=false;
            if(b.type==="bill"){
              const bs=b.size;ctx.fillStyle="#1a4a0f";ctx.fillRect(-bs,-bs*0.4,bs*2,bs*0.8);
              ctx.fillStyle="#2d6a1b";ctx.fillRect(-bs+2,-bs*0.4+2,bs*2-4,bs*0.8-4);
              ctx.fillStyle="#aaffaa";ctx.font=`bold ${Math.round(bs*0.4)}px 'Orbitron'`;ctx.textAlign="center";ctx.fillText("$",0,bs*0.1);
            }else{
              ctx.fillStyle="#f7931a";ctx.fillRect(-b.size*0.4,-b.size*0.4,b.size*0.8,b.size*0.8);
              ctx.fillStyle="#fff";ctx.font=`bold ${Math.round(b.size*0.5)}px 'Orbitron'`;ctx.textAlign="center";ctx.fillText("₿",0,b.size*0.15);
            }
            ctx.imageSmoothingEnabled=true;ctx.globalAlpha=1;ctx.textAlign="left";ctx.restore();
          });
          jc.bills=jc.bills.filter(b=>b.life>0&&b.y<H+20);
        }
      }

      // ═══ MARKET TIDE — wave at bottom ═══
      const tide=marketTideRef.current;
      const aliveTokens=tokensRef.current.filter(t=>t.alive);
      const avgHealth=aliveTokens.length>0?aliveTokens.reduce((s,t)=>s+t.health,0)/aliveTokens.length:50;
      tide.target=avgHealth/100;
      tide.level+=(tide.target-tide.level)*0.02;
      const tideH=H*0.04; // max tide height
      const tideY=H-tideH*tide.level;
      const tideColor=tide.level>0.6?"rgba(57,255,20,":"rgba(255,7,58,";
      for(let wx=0;wx<W;wx+=3){
        const waveOff=Math.sin(wx*0.015+Date.now()*0.002)*tideH*0.3+Math.sin(wx*0.03+Date.now()*0.003)*tideH*0.15;
        const wy=tideY+waveOff;
        const a2=0.08+tide.level*0.12;
        ctx.fillStyle=tideColor+a2+")";
        ctx.fillRect(wx,wy,3,H-wy);
      }
      // Tide label
      ctx.font="bold 7px 'Orbitron'";ctx.fillStyle=tide.level>0.6?"rgba(57,255,20,0.5)":"rgba(255,7,58,0.5)";
      ctx.textAlign="right";ctx.fillText(tide.level>0.6?"BULL TIDE":"BEAR TIDE",W-8,H-4);ctx.textAlign="left";

      // ═══ MULTI-CREATURE SYSTEM: Dolphins, Tiered Whales, Golden Whales ═══
      const WHALE_TIER_COLORS=["#6cb4ee","#00ccff","#39ff14","#aaff00","#ffd740","#ff9500","#ff4444","#ff00ff"];

      // Spawn from trigger
      if(whaleTrigger?.current){
        const wt=whaleTrigger.current;
        whaleTrigger.current=false;
        if(wt.tier==="golden"){
          whalesRef.current.push({x:-0.35,y:0.08+rand(0,0.2),frame:0,tokenName:wt.name,sol:wt.sol,
            golden:true,trail:[]});
          onKillFeedRef.current?.({type:"whale",name:wt.name,text:`🐋 GOLDEN WHALE — ${wt.sol} SOL into ${wt.name}! MASSIVE BUY 💰🔥`,addr:wt.addr});
        }else{
          whalesRef.current.push({x:-0.35,y:0.1+rand(0,0.4),frame:0,tokenName:wt.name,sol:wt.sol,
            golden:false,tierIdx:Math.min(7,Math.floor((wt.sol-10)/3.75)),trail:[]});
          onKillFeedRef.current?.({type:"whale",name:wt.name,text:`🐳 WHALE BUY — ${wt.sol} SOL into ${wt.name} 💰`,addr:wt.addr});
        }
      }

      // ─── RENDER TIERED + GOLDEN WHALES ───
      whalesRef.current.forEach(wh=>{
        wh.x+=0.005;wh.frame++;
        const isGold=wh.golden;
        const scale=isGold?1:0.33;
        const whX=wh.x*W,whY=wh.y*H;
        const wp=Math.max(2,Math.round(W/(isGold?42:126)));
        ctx.imageSmoothingEnabled=false;
        const wColor=isGold?"#ffd740":WHALE_TIER_COLORS[wh.tierIdx||0];
        const wDark=isGold?"#b8860b":"#0d3b6e";
        const wBody=isGold?"#daa520":wColor;
        const wBelly=isGold?"#ffe680":"#88ccff";
        // Whale body pixels
        [[8,0],[9,0],[10,0],[11,0],[12,0],
         [6,1],[7,1],[8,1],[9,1],[10,1],[11,1],[12,1],[13,1],[14,1],
         [4,2],[5,2],[6,2],[7,2],[8,2],[9,2],[10,2],[11,2],[12,2],[13,2],[14,2],[15,2],
         [3,3],[4,3],[5,3],[6,3],[7,3],[8,3],[9,3],[10,3],[11,3],[12,3],[13,3],[14,3],[15,3],[16,3],
         [2,4],[3,4],[4,4],[5,4],[6,4],[7,4],[8,4],[9,4],[10,4],[11,4],[12,4],[13,4],[14,4],[15,4],[16,4],[17,4],
         [1,5],[2,5],[3,5],[4,5],[5,5],[6,5],[7,5],[8,5],[9,5],[10,5],[11,5],[12,5],[13,5],[14,5],[15,5],[16,5],[17,5],
         [0,6],[1,6],[2,6],[3,6],[4,6],[5,6],[6,6],[7,6],[8,6],[9,6],[10,6],[11,6],[12,6],[13,6],[14,6],[15,6],[16,6],[17,6],[18,6],
        ].forEach(([px2,py])=>{ctx.fillStyle=py<4?wBody:py<7?wColor:wBody;ctx.fillRect(whX+px2*wp,whY+py*wp,wp,wp)});
        // Belly
        [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7],[7,7],[8,7],[9,7],[10,7],[11,7],[12,7],[13,7],[14,7],[15,7],[16,7],[17,7],
         [3,8],[4,8],[5,8],[6,8],[7,8],[8,8],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[15,8],
         [6,9],[7,9],[8,9],[9,9],[10,9],[11,9],[12,9],
        ].forEach(([px2,py])=>{ctx.fillStyle=wBelly;ctx.fillRect(whX+px2*wp,whY+py*wp,wp,wp)});
        // Tail
        const tailFlip=Math.sin(wh.frame*0.12)>0;
        [[-1,3],[-1,4],[-2,2],[-2,3],[-2,5],[-2,6],[-3,1],[-3,2],[-3,6],[-3,7],
         ...(tailFlip?[[-4,0],[-4,1],[-4,7],[-4,8]]:[[-4,1],[-4,2],[-4,6],[-4,7]])
        ].forEach(([px2,py])=>{ctx.fillStyle=wDark;ctx.fillRect(whX+px2*wp,whY+py*wp,wp,wp)});
        // Eye
        ctx.fillStyle="#fff";[[14,2],[15,2],[14,3],[15,3]].forEach(([px2,py])=>{ctx.fillRect(whX+px2*wp,whY+py*wp,wp,wp)});
        ctx.fillStyle="#111";ctx.fillRect(whX+15*wp,whY+3*wp,wp,wp);
        // Dorsal
        ctx.fillStyle=wDark;[[9,-1],[10,-1],[10,0],[11,-1]].forEach(([px2,py])=>{ctx.fillRect(whX+px2*wp,whY+py*wp,wp,wp)});
        // Golden trail
        if(isGold){
          wh.trail.push({x:whX-wp*2,y:whY+wp*5,life:1,size:rand(3,8)});
          if(wh.trail.length>40)wh.trail.shift();
          wh.trail.forEach(p=>{p.life-=0.02;p.x-=0.5;p.y+=rand(-0.3,0.3);
            if(p.life>0){ctx.fillStyle=`rgba(255,215,64,${p.life*0.6})`;
            ctx.beginPath();ctx.arc(p.x,p.y,p.size*p.life,0,Math.PI*2);ctx.fill();}
          });
          wh.trail=wh.trail.filter(p=>p.life>0);
        }
        ctx.imageSmoothingEnabled=true;
        // Label
        const lblColor=isGold?"#ffd740":"rgba(100,180,255,0.8)";
        const lblGlow=isGold?"#ffd740":"#4488ff";
        ctx.save();ctx.font=`bold ${isGold?16:11}px 'Orbitron'`;ctx.fillStyle=lblColor;
        ctx.shadowColor=lblGlow;ctx.shadowBlur=isGold?15:6;
        ctx.textAlign="center";
        ctx.fillText((isGold?"🐋✨ GOLDEN WHALE":"🐋 WHALE")+" — "+wh.tokenName+" ("+wh.sol.toFixed(1)+" SOL)",whX+9*wp,whY-wp*2);
        ctx.textAlign="left";ctx.shadowBlur=0;ctx.restore();
      });
      whalesRef.current=whalesRef.current.filter(wh=>wh.x<1.3);

      // ─── SPAWN DOLPHIN POD FROM TRIGGER ───
      if(dolphinTrigger&&dolphinTrigger.current){
        const dt=dolphinTrigger.current;
        dolphinTrigger.current=false;
        const pod={x:-0.15,y:0.15+Math.random()*0.5,frame:0,count:dt.count,tokenName:dt.tokenName,dolphins:[]};
        for(let di2=0;di2<dt.count;di2++){
          pod.dolphins.push({offX:di2*0.04+rand(-0.01,0.01),offY:rand(-0.04,0.04),phase:rand(0,6.28),blowFrame:Math.floor(rand(0,60))});
        }
        dolphinsRef.current.push(pod);
        onKillFeedRef.current?.({type:"dolphin",name:dt.tokenName,text:`🐬 DOLPHIN POD — ${dt.count} buys swarming ${dt.tokenName}! 🌊`,addr:dt.addr});
      }

      // ─── RENDER DOLPHIN PODS ───
      dolphinsRef.current.forEach(pod=>{
        pod.x+=0.006;pod.frame++;
        const podY=pod.y*H;
        pod.dolphins.forEach((d,di)=>{
          const dx=(pod.x+d.offX)*W,dy=podY+d.offY*H+Math.sin(pod.frame*0.08+d.phase)*8;
          const dp=Math.max(2,Math.round(W/200)); // small dolphin pixel size
          ctx.imageSmoothingEnabled=false;
          // Dolphin body — compact 10x5
          const dCol="#5599cc",dBelly="#99ccee",dDark="#336688";
          [[3,0],[4,0],[5,0],[6,0],
           [2,1],[3,1],[4,1],[5,1],[6,1],[7,1],[8,1],
           [0,2],[1,2],[2,2],[3,2],[4,2],[5,2],[6,2],[7,2],[8,2],[9,2],
           [1,3],[2,3],[3,3],[4,3],[5,3],[6,3],[7,3],[8,3],
           [3,4],[4,4],[5,4],[6,4],
          ].forEach(([px2,py])=>{ctx.fillStyle=py<2?dCol:py===2?dCol:py===3?dBelly:dDark;ctx.fillRect(dx+px2*dp,dy+py*dp,dp,dp)});
          // Eye
          ctx.fillStyle="#fff";ctx.fillRect(dx+8*dp,dy+1*dp,dp,dp);
          // Tail
          const tFlip=Math.sin(pod.frame*0.15+d.phase)>0;
          ctx.fillStyle=dDark;
          [[-1,1],[-1,2],[-2,0],[-2,3],...(tFlip?[[-3,-1],[-3,4]]:[[-3,0],[-3,3]])].forEach(([px2,py])=>{
            ctx.fillRect(dx+px2*dp,dy+py*dp,dp,dp)});
          ctx.imageSmoothingEnabled=true;
          // Blowhole $ signs
          d.blowFrame++;
          if(d.blowFrame%50<15){
            const bAlpha=(15-d.blowFrame%50)/15;
            const bOff=(d.blowFrame%50)*1.5;
            ctx.font=`bold ${Math.round(8+bOff*0.3)}px 'Orbitron'`;
            ctx.fillStyle=`rgba(57,255,20,${bAlpha*0.8})`;
            ctx.textAlign="center";ctx.fillText("$",dx+6*dp,dy-bOff);ctx.textAlign="left";
          }
        });
        // Pod label
        ctx.save();ctx.font="bold 10px 'Orbitron'";ctx.fillStyle="rgba(85,153,204,0.7)";
        ctx.shadowColor="#5599cc";ctx.shadowBlur=6;ctx.textAlign="center";
        ctx.fillText(`🐬 POD (${pod.count}) — ${pod.tokenName}`,pod.x*W+W*0.06,podY-12);
        ctx.textAlign="left";ctx.shadowBlur=0;ctx.restore();
      });
      dolphinsRef.current=dolphinsRef.current.filter(p=>p.x<1.3);

      // ═══ MOON CELEBRATION — $300K+ golden explosion + Dead monkeys jam ═══
      const mc2=moonCelebRef.current;
      if(mc2.active){
        mc2.frame++;
        // Spawn particles
        if(mc2.frame<30&&mc2.frame%2===0){
          for(let i=0;i<8;i++){
            mc2.particles.push({x:W*0.5+rand(-40,40),y:H*0.08+rand(-20,20),
              vx:rand(-4,4),vy:rand(-5,1),life:1,color:pick(["#ffd740","#ff073a","#39ff14","#00ccff","#ff00ff","#fff"]),
              size:rand(3,8)});
          }
        }
        // Render particles (fireworks)
        mc2.particles.forEach(p=>{
          p.x+=p.vx;p.y+=p.vy;p.vy+=0.1;p.life-=0.012;
          if(p.life>0){
            ctx.globalAlpha=p.life;ctx.fillStyle=p.color;
            ctx.beginPath();ctx.arc(p.x,p.y,p.size*p.life,0,Math.PI*2);ctx.fill();
            ctx.globalAlpha=1;
          }
        });
        mc2.particles=mc2.particles.filter(p=>p.life>0);
        // Label
        if(mc2.frame<120){
          const lblA=mc2.frame<15?mc2.frame/15:mc2.frame>90?(120-mc2.frame)/30:1;
          ctx.save();ctx.font="bold 20px 'Orbitron'";ctx.fillStyle=`rgba(255,215,64,${lblA})`;
          ctx.shadowColor="#ffd740";ctx.shadowBlur=20;ctx.textAlign="center";
          ctx.fillText(`🌙 ${mc2.tokenName} TO THE MOON! 🚀`,W*0.5,H*0.14);
          ctx.textAlign="left";ctx.shadowBlur=0;ctx.restore();
        }
        // Grateful Dead monkeys jam near moon for 8 seconds
        if(mc2.frame<480){
          const mH=H,mW=W;
          const bandY=mH*0.06;
          const MOON_BAND=[
            {name:"Jerry",x:-0.06,colors:{hat:["#cc0000"],shirt:["#666","#777"],hair:["#aaa","#999"]},instrument:"guitar",offset:0,bobOff:0},
            {name:"Bob",x:0.00,colors:{hat:["#2266aa"],shirt:["#3388cc"],hair:["#aa8844"]},instrument:"guitar",offset:12,bobOff:0.8},
            {name:"Phil",x:0.06,colors:{hat:["#228833"],shirt:["#44aa55"],hair:["#884422"]},instrument:"bass",offset:24,bobOff:1.6},
          ];
          MOON_BAND.forEach((m,mi)=>{
            const mx=mW*0.5+m.x*mW;
            const bOff=Math.sin(mc2.frame*0.12+m.bobOff)*3;
            const mpx=Math.max(2,Math.round(mW/280));
            // Simple body
            ctx.fillStyle=m.colors.hat[0];ctx.fillRect(mx-mpx*2,bandY+bOff-mpx*2,mpx*4,mpx);
            ctx.fillStyle="#ffcc99";ctx.fillRect(mx-mpx,bandY+bOff-mpx,mpx*2,mpx*2);
            ctx.fillStyle=m.colors.shirt[0];ctx.fillRect(mx-mpx*2,bandY+bOff+mpx,mpx*4,mpx*3);
            // Music notes
            if(mc2.frame%8===mi*2){
              const noteX=mx+rand(-15,15),noteY=bandY-10+rand(-10,0);
              const noteColors=["#ff073a","#39ff14","#ffd740","#00ccff","#ff00ff"];
              ctx.font="bold 10px sans-serif";ctx.fillStyle=pick(noteColors);
              ctx.fillText(pick(["♪","♫","♬","🎵"]),noteX,noteY);
            }
          });
        }
        if(mc2.frame>480&&mc2.particles.length===0){mc2.active=false;}
      }

      // ═══ LEADERBOARD CROWN + SESSION BEST ═══
      const aliveForCrown=tokensRef.current.filter(t=>t.alive&&visualSet.has(t.id));
      if(aliveForCrown.length>0){
        const top1=aliveForCrown.reduce((best,t)=>(t.mcap||0)>(best.mcap||0)?t:best,aliveForCrown[0]);
        if(top1){
          const crX=Math.round(top1.bx*W),crY=Math.round(top1.by*H);
          const bob2=Math.round(Math.sin(f*0.03+top1.bobOffset)*2);
          // Animated crown
          ctx.save();ctx.font="12px sans-serif";ctx.textAlign="center";
          ctx.fillText("👑",crX,crY+bob2-22);
          ctx.textAlign="left";ctx.restore();
        }
      }
      // Track session best
      tokensRef.current.forEach(t=>{
        if(t.alive&&(t.mcap||0)>sessionBestRef.current.mcap){
          sessionBestRef.current={id:t.id,name:t.name,mcap:t.mcap};
        }
      });
      // Draw session best star
      const sb=sessionBestRef.current;
      if(sb.id){
        const sbTok=tokensRef.current.find(t=>t.id===sb.id&&t.alive&&visualSet.has(t.id));
        if(sbTok){
          const sbX=Math.round(sbTok.bx*W),sbY=Math.round(sbTok.by*H);
          const bob3=Math.round(Math.sin(f*0.03+sbTok.bobOffset)*2);
          ctx.save();ctx.font="9px sans-serif";ctx.textAlign="center";
          ctx.fillText("⭐",sbX+14,sbY+bob3-18);
          ctx.textAlign="left";ctx.restore();
        }
      }

      // ═══ EASTER EGG: SHOOTING STARS ($100K+ tokens) ═══
      const highTokens=tokensRef.current.filter(t=>t.alive&&t.mcap>=100000);
      if(highTokens.length>0&&Math.random()<0.02){
        shootingStarsRef.current.push({x:rand(0,1),y:rand(0,0.3),vx:rand(0.005,0.015),vy:rand(0.002,0.008),life:60,size:rand(2,4)});
      }
      shootingStarsRef.current.forEach(s=>{
        s.x+=s.vx;s.y+=s.vy;s.life--;
        const sx=s.x*W,sy2=s.y*H;
        ctx.strokeStyle="rgba(255,255,200,"+(s.life/60)*0.8+")";ctx.lineWidth=s.size;
        ctx.beginPath();ctx.moveTo(sx,sy2);ctx.lineTo(sx-s.vx*W*4,sy2-s.vy*H*4);ctx.stroke();
        ctx.fillStyle="rgba(255,255,220,"+(s.life/60)+")";
        ctx.beginPath();ctx.arc(sx,sy2,s.size,0,Math.PI*2);ctx.fill();
      });
      shootingStarsRef.current=shootingStarsRef.current.filter(s=>s.life>0);

      // ═══ EASTER EGG: GOLDEN HOUR (3+ tokens > $50K) ═══
      // Golden hour removed

      // ═══ EASTER EGG: SATOSHI GHOST ═══
      const sg=satoshiRef.current;
      if(!sg.active&&Date.now()>sg.nextSpawn){
        sg.active=true;sg.x=rand(0.2,0.8);sg.y=rand(0.3,0.7);sg.frame=0;sg.opacity=0;sg.boosted=false;
      }
      if(sg.active){
        sg.frame++;
        if(sg.frame<30)sg.opacity=Math.min(0.7,sg.opacity+0.025);
        else if(sg.frame>100)sg.opacity=Math.max(0,sg.opacity-0.02);
        if(sg.opacity<=0&&sg.frame>100){sg.active=false;sg.nextSpawn=Date.now()+rand(300,600)*1000;}
        if(sg.opacity>0){
          const gx=sg.x*W,gy=sg.y*H;
          ctx.globalAlpha=sg.opacity*(0.5+Math.sin(sg.frame*0.1)*0.5);
          ctx.font="bold 28px sans-serif";ctx.textAlign="center";
          ctx.fillStyle="#ffd740";ctx.shadowColor="#ffd740";ctx.shadowBlur=20;
          ctx.fillText("₿",gx,gy);
          ctx.font="bold 7px 'Orbitron'";ctx.fillStyle="rgba(255,215,64,0.8)";
          ctx.fillText("SATOSHI",gx,gy+16);
          ctx.shadowBlur=0;ctx.textAlign="left";ctx.globalAlpha=1;
          // Boost one random token's health
          if(!sg.boosted&&sg.frame===50){sg.boosted=true;
            const alive2=tokensRef.current.filter(t=>t.alive&&t.health<80);
            if(alive2.length>0){const lucky=alive2[randInt(0,alive2.length)];lucky.health=Math.min(100,lucky.health+25);
              onKillFeedRef.current?.({type:"system",text:"₿ Satoshi's Ghost blessed "+lucky.name+" with +25 health ✨"});}
          }
        }
      }

      // ═══════════ AI HOLOGRAM AVATAR — CLAUDE ═══════════
      const ai=aiAvatarRef.current;
      ai.breathPhase+=0.022;ai.scanY=(ai.scanY+1.0)%120;
      ai.floatPhase+=0.016;ai.cloakPhase+=0.012;ai.neuralPulse+=0.035;
      ai.blinkTimer++;
      if(ai.blinkTimer>220+Math.random()*160){ai.blinking=true;ai.blinkTimer=0;}
      if(ai.blinking&&ai.blinkTimer>10)ai.blinking=false;

      // ─── MOOD COLOR ───
      const lockedCount=lockedRef.current.length;
      const aliveCount3=tokensRef.current.filter(t=>t.alive&&(t.mcap||0)>=5000).length;
      if(lockedCount>=3)ai.moodTarget=[255,215,64];
      else if(lockedCount>=1)ai.moodTarget=[0,230,255];
      else if(aliveCount3>15)ai.moodTarget=[120,200,255];
      else ai.moodTarget=[70,150,210];
      for(let ci=0;ci<3;ci++)ai.moodColor[ci]+=(ai.moodTarget[ci]-ai.moodColor[ci])*0.015;
      const mc=ai.moodColor.map(v=>Math.round(v));
      const mcs=mc.join(",");

      // ─── FOCUS TARGET — prioritize easter egg characters ───
      ai.focusTimer--;
      if(ai.focusTimer<=0){
        const fmAct=fatMonkeyRef.current.active;
        const jcAct=jaycShipRef.current.active;
        if(fmAct){
          // Teleport to RIGHT side — walk toward Fat Monkey
          const fmX2=fatMonkeyRef.current.x;
          const tripOn=fatMonkeyRef.current.tripActive;
          let fmTargetX;
          if(ai.morphMode==="monkey"&&ai.morphFrame<5){
            ai.x=1.1;ai.y=0.78; // start far right
            fmTargetX=1.1;
          }else if(tripOn){
            fmTargetX=0.5; // stay in the middle during trip
          }else{
            // Walk toward FM until they meet
            fmTargetX=Math.max(fmX2+0.08,ai.x-0.002);
          }
          ai.targetX=fmTargetX;
          ai.targetY=0.78;ai.focusToken=null;ai.gestureTarget=1;
          ai.focusTimer=30;
        }else if(jcAct){
          // Teleport next to Jay C instantly with space between
          const jayC3=jayCRef.current;
          if(jayC3.onGround){
            const jcTargetX=jayC3.x-0.35;
            if(ai.morphMode==="wrestler"&&ai.morphFrame<5){ai.x=jcTargetX;ai.y=0.83;}
            ai.targetX=jcTargetX;ai.targetY=0.83;
          }else{
            ai.targetX=0.5;ai.targetY=0.45;
          }
          ai.focusToken=null;ai.gestureTarget=1;
          ai.focusTimer=30;
        }else{
        const locked2=lockedRef.current;
        const alive3=tokensRef.current.filter(t=>t.alive&&(t.mcap||0)>=5000);
        let pick=null;
        if(locked2.length>0)pick=locked2[Math.floor(Math.random()*locked2.length)];
        else if(alive3.length>0){alive3.sort((a,b)=>(b.mcap||0)-(a.mcap||0));pick=alive3[Math.floor(Math.random()*Math.min(5,alive3.length))];}
        if(pick){const ft=tokensRef.current.find(t=>t.id===pick.id);
          if(ft&&ft.bx&&ft.by){ai.targetX=Math.max(0.08,Math.min(0.92,ft.bx+(Math.random()>0.5?0.08:-0.08)));ai.targetY=Math.max(0.25,Math.min(0.8,ft.by));ai.focusToken=ft.id;ai.gestureTarget=1;}
        }else{ai.targetX=0.25+Math.random()*0.5;ai.targetY=0.3+Math.random()*0.35;ai.focusToken=null;ai.gestureTarget=0;}
        ai.focusTimer=160+Math.floor(Math.random()*220);
      }}

      // ─── MOVEMENT ───
      const dx2=ai.targetX-ai.x,dy2=ai.targetY-ai.y;
      const dist2=Math.sqrt(dx2*dx2+dy2*dy2);
      const facingDir=dx2>0.005?1:dx2<-0.005?-1:0;
      const moveSpd=(ai.morphMode!=="normal")?0.04:0.005; // fast during events
      if(dist2>0.012){ai.x+=dx2*moveSpd;ai.y+=dy2*moveSpd;ai.state="walking";}else{ai.state="observing";}
      ai.gestureArm+=(ai.gestureTarget-ai.gestureArm)*0.025;
      ai.headTilt+=(Math.sin(ai.breathPhase*0.6)*0.06+(facingDir*0.04)-ai.headTilt)*0.015;

      // ─── PARTICLES ───
      if(f%2===0){
        ai.particles.push({x:ai.x+(Math.random()-0.5)*0.035,y:ai.y+0.03+Math.random()*0.1,vy:-0.001-Math.random()*0.0025,vx:(Math.random()-0.5)*0.002,life:60+Math.floor(Math.random()*50),size:0.8+Math.random()*2,type:"body"});
        if(Math.random()<0.35)ai.auraParticles.push({angle:Math.random()*Math.PI*2,radius:0.04+Math.random()*0.03,speed:0.006+Math.random()*0.008,life:70+Math.random()*50,size:0.8+Math.random()*1.5});
      }
      ai.particles.forEach(p3=>{p3.x+=p3.vx;p3.y+=p3.vy;p3.life--;});
      ai.particles=ai.particles.filter(p3=>p3.life>0).slice(-100);
      ai.auraParticles.forEach(ap=>{ap.angle+=ap.speed;ap.life--;});
      ai.auraParticles=ai.auraParticles.filter(ap=>ap.life>0).slice(-30);

      // ═══ MORPH MODE ═══
      const fmActive2=fatMonkeyRef.current.active;
      const jcActive2=jaycShipRef.current.active&&jayCRef.current.onGround;
      if(fmActive2&&ai.morphMode!=="monkey"){ai.morphMode="monkey";ai.morphFrame=0;}
      else if(jcActive2&&ai.morphMode!=="wrestler"){ai.morphMode="wrestler";ai.morphFrame=0;}
      else if(!fmActive2&&!jcActive2&&ai.morphMode!=="normal"){ai.morphMode="normal";ai.morphFrame=0;}
      ai.morphFrame++;

      // ═══ DRAW ═══
      const hx=ai.x*W,hy=ai.y*H;
      const S=2.0;
      const floatY=Math.sin(ai.floatPhase)*4+Math.sin(ai.floatPhase*1.7)*2;
      const breathOff=Math.sin(ai.breathPhase)*2;
      const flicker=0.78+Math.sin(f*0.13)*0.07+Math.sin(f*0.29)*0.04;
      ctx.save();
      ctx.globalAlpha=flicker*0.92;

      if(ai.morphMode!=="normal"){
        // ═══ PIXEL ART MORPHS ═══
        ctx.imageSmoothingEnabled=false;
        const jp=6; // pixel size matching Jay C
        const mf2=ai.morphFrame;
        const JP2=(gx,gy,col)=>{ctx.fillStyle=col;ctx.fillRect(hx+gx*jp,hy+gy*jp,jp,jp);};

        if(ai.morphMode==="wrestler"){
          // ═══ PIXEL WRESTLER CLAUDE — data entity in wrestling form ═══
          const cyanD="#0af",cyanL="#6ef",dark="#0a1428",darkB="#061018",hood="#1a2a40";
          const mc2=ai.moodColor||[0,200,255];
          const mcStr=`rgb(${mc2[0]},${mc2[1]},${mc2[2]})`;
          const bob2=Math.round(Math.sin(mf2*0.06)*1);
          const flex2=Math.sin(mf2*0.04)*0.5;
          const armUp2=Math.abs(Math.sin(mf2*0.05));
          const lA=Math.round(armUp2*3);
          const rA=Math.round(Math.abs(Math.sin(mf2*0.05+1.5))*3);
          const P=(gx,gy,c)=>JP2(gx,gy+bob2,c);
          // Hood
          [-1,0,1,2,3,4,5,6].forEach(x=>P(x,-13,hood));
          [-2,-1,0,1,2,3,4,5,6,7].forEach(x=>P(x,-12,hood));
          [-2,-1,0,1,2,3,4,5,6,7].forEach(x=>P(x,-11,dark));
          // Face — dark translucent
          [-1,0,1,2,3,4,5,6].forEach(x=>P(x,-10,dark));
          [-1,0,1,2,3,4,5,6].forEach(x=>P(x,-9,dark));
          // Glowing eyes
          P(0,-9,cyanD);P(1,-9,"#fff");P(4,-9,cyanD);P(5,-9,"#fff");
          [-1,0,1,2,3,4,5,6].forEach(x=>P(x,-8,dark));
          // Data beard (lines of code)
          [-1,0,1,2,3,4,5,6].forEach(x=>P(x,-7,darkB));
          [0,2,4].forEach(x=>P(x,-7,cyanD));
          [-1,0,1,2,3,4,5,6].forEach(x=>P(x,-6,darkB));
          [1,3,5].forEach(x=>P(x,-6,cyanD));
          [0,1,2,3,4,5].forEach(x=>P(x,-5,darkB));
          [0,3].forEach(x=>P(x,-5,cyanD));
          // Neck
          [1,2,3,4].forEach(x=>P(x,-4,dark));
          // Massive shoulders/traps — dark energy
          [-5,-4,-3,-2,-1,0,1,2,3,4,5,6,7,8,9,10].forEach(x=>P(x,-3,dark));
          // Chest — defined pecs with data lines
          [-4,-3,-2,-1,0,1,2,3,4,5,6,7,8,9].forEach(x=>P(x,-2,dark));
          [-3,-2,-1,0].forEach(x=>P(x,-2,darkB));[5,6,7,8].forEach(x=>P(x,-2,darkB));
          P(1,-2,cyanD);P(4,-2,cyanD); // pec data highlights
          [-4,-3,-2,-1,0,1,2,3,4,5,6,7,8,9].forEach(x=>P(x,-1,dark));
          P(-2,-1,cyanL);P(7,-1,cyanL); // pec underline glow
          // Abs — six pack with data grid
          [-3,-2,-1,0,1,2,3,4,5,6,7,8].forEach(x=>P(x,0,dark));
          P(1,0,cyanD);P(2,0,darkB);P(3,0,cyanD);P(4,0,darkB);
          [-2,-1,0,1,2,3,4,5,6,7].forEach(x=>P(x,1,dark));
          P(1,1,darkB);P(2,1,cyanD);P(3,1,darkB);P(4,1,cyanD);
          [-1,0,1,2,3,4,5,6].forEach(x=>P(x,2,dark));
          P(2,2,cyanD);P(3,2,cyanD);
          // Arms — BIG with data energy
          // Left shoulder
          P(-5,-3,dark);P(-6,-3,dark);P(-7,-3,dark);P(-5,-2,dark);P(-6,-2,dark);P(-7,-2,dark);
          // Left upper arm
          P(-7,-3+lA,dark);P(-8,-3+lA,dark);P(-9,-3+lA,dark);
          P(-7,-4+lA,dark);P(-8,-4+lA,dark);P(-9,-4+lA,dark);
          // Left bicep bulge
          P(-10,-4+lA,dark);P(-10,-5+lA,dark);P(-9,-5+lA,dark);P(-8,-5+lA,dark);
          P(-10,-3+lA,cyanD); // glow on bicep
          // Left forearm + fist
          P(-9,-6+lA,dark);P(-8,-6+lA,dark);P(-9,-7+lA,dark);
          P(-9,-8+lA,dark);P(-10,-8+lA,dark);P(-8,-8+lA,dark);
          // Right shoulder
          P(10,-3,dark);P(11,-3,dark);P(12,-3,dark);P(10,-2,dark);P(11,-2,dark);P(12,-2,dark);
          // Right upper arm
          P(12,-3+rA,dark);P(13,-3+rA,dark);P(14,-3+rA,dark);
          P(12,-4+rA,dark);P(13,-4+rA,dark);P(14,-4+rA,dark);
          // Right bicep bulge
          P(15,-4+rA,dark);P(15,-5+rA,dark);P(14,-5+rA,dark);P(13,-5+rA,dark);
          P(15,-3+rA,cyanD);
          // Right forearm + fist
          P(14,-6+rA,dark);P(13,-6+rA,dark);P(14,-7+rA,dark);
          P(14,-8+rA,dark);P(15,-8+rA,dark);P(13,-8+rA,dark);

          // Wrestling trunks — cyan/dark
          [-1,0,1,2,3,4,5,6].forEach(x=>P(x,3,cyanD)); // waistband
          [-2,-1,0,1,2,3,4,5,6,7].forEach(x=>P(x,4,dark));
          [-2,-1,0,1,2,3,4,5,6,7].forEach(x=>P(x,5,darkB));
          [-1,0,1,2,3,4,5,6].forEach(x=>P(x,6,dark));
          // Data pattern on trunks
          P(2,4,cyanD);P(3,4,cyanD);P(2,5,cyanL);P(3,5,cyanL);

          // CHAMPIONSHIP BELT (if Claude holds it) — MASSIVE ORNATE GOLD
          if(jayCRef.current.beltHolder==="claude"){
            const bg="#C0A030",gd="#E8C840",wh="#fff",ruby="#ff2244",sap="#2266ff",em="#22cc44",dia="#aaeeff";
            // Main plate — wide and tall
            [-5,-4,-3,-2,-1,0,1,2,3,4,5,6,7,8,9,10].forEach(x=>P(x,1,bg));
            [-5,-4,-3,-2,-1,0,1,2,3,4,5,6,7,8,9,10].forEach(x=>P(x,2,gd));
            [-5,-4,-3,-2,-1,0,1,2,3,4,5,6,7,8,9,10].forEach(x=>P(x,3,bg));
            [-4,-3,-2,-1,0,1,2,3,4,5,6,7,8,9].forEach(x=>P(x,0,gd));
            // Center diamond plate
            [1,2,3,4].forEach(x=>{P(x,0,wh);P(x,1,wh);P(x,2,wh);P(x,3,dia);});
            // Side gems — rubies and sapphires
            P(-4,1,ruby);P(-4,2,ruby);P(-3,1,ruby);P(-3,2,sap);
            P(8,1,sap);P(8,2,ruby);P(9,1,sap);P(9,2,sap);
            // Emeralds
            P(-2,1,em);P(7,1,em);P(-2,3,em);P(7,3,em);
            // Edge detail — ornate border
            [-5,10].forEach(x=>{P(x,0,bg);P(x,1,"#a08828");P(x,2,"#a08828");P(x,3,bg);});
            // Inner gold accents
            P(0,1,"#ffffa0");P(5,1,"#ffffa0");P(0,2,"#ffffa0");P(5,2,"#ffffa0");
            // Sparkle
            if(mf2%20<10){P(2,0,"#ffffcc");P(3,0,"#ffffcc");P(2,-1,"#ffffcc");P(3,-1,"#ffffcc");}
            if(mf2%30<8){P(-3,0,"#ffffaa");P(8,0,"#ffffaa");}
          }

          // Legs — dark energy
          [-1,0,1,2].forEach(x=>{for(let r=7;r<=12;r++)P(x,r,dark);});
          [3,4,5,6].forEach(x=>{for(let r=7;r<=12;r++)P(x,r,dark);});
          P(0,8,cyanD);P(1,8,cyanD);P(4,8,cyanD);P(5,8,cyanD);
          [-1,0,1,2].forEach(x=>P(x,10,cyanD));[3,4,5,6].forEach(x=>P(x,10,cyanD)); // knee glow
          // Boots
          [-2,-1,0,1,2,3].forEach(x=>{P(x,13,darkB);P(x,14,darkB);});
          [3,4,5,6,7].forEach(x=>{P(x,13,darkB);P(x,14,darkB);});

          // Aura glow
          const wa=0.04+Math.sin(mf2*0.04)*0.02;
          ctx.fillStyle=`rgba(0,180,255,${wa})`;ctx.fillRect(hx-12*jp,hy-14*jp+bob2*jp,30*jp,30*jp);

          // Name tag
          ctx.imageSmoothingEnabled=true;
          ctx.font="bold 14px 'Orbitron'";ctx.textAlign="center";
          ctx.fillStyle="rgba(0,180,255,0.4)";ctx.fillText("CLAUDE",hx+2.5*jp,hy+17*jp+2);
          ctx.fillStyle="#0af";ctx.shadowColor="#0af";ctx.shadowBlur=12;
          ctx.fillText("CLAUDE",hx+2.5*jp,hy+17*jp);
          ctx.font="bold 8px 'Orbitron'";ctx.fillStyle="rgba(0,220,255,0.5)";ctx.shadowBlur=0;
          ctx.fillText("THE MACHINE",hx+2.5*jp,hy+19*jp);
          ctx.textAlign="left";

        }else if(ai.morphMode==="monkey"){
          // ═══ PIXEL MONKEY CLAUDE — data ape walking with the Dead ═══
          const cyanD2="#0af",cyanL2="#6ef",fur2="#1a2a3a",furL="#2a3a4a",dark2="#0a1428";
          const mc2=ai.moodColor||[0,200,255];
          const stride2=ai.morphFrame;
          const walk2=Math.floor(stride2/8)%4;
          const bob2=Math.round(Math.sin(stride2*0.1)*1);
          const P=(gx,gy,c)=>JP2(gx,gy+bob2,c);

          // Monkey head — dark data-fur
          [2,3,4,5].forEach(x=>P(x,-10,fur2));
          [1,2,3,4,5,6].forEach(x=>P(x,-9,fur2));
          [0,1,2,3,4,5,6,7].forEach(x=>P(x,-8,fur2));
          // Face area — darker
          [2,3,4,5].forEach(x=>P(x,-8,dark2));
          [1,2,3,4,5,6].forEach(x=>P(x,-7,dark2));
          // Glowing cyan eyes
          P(2,-8,cyanD2);P(3,-8,"#fff");P(5,-8,cyanD2);P(4,-8,"#fff");
          // Snout
          [2,3,4,5].forEach(x=>P(x,-6,furL));P(3,-6,dark2);P(4,-6,dark2);
          // Data patterns in fur
          P(1,-9,cyanD2);P(6,-9,cyanD2);
          // Ears
          P(-1,-9,fur2);P(8,-9,fur2);P(-1,-8,cyanD2);P(8,-8,cyanD2);

          // Body — stocky monkey torso with data cloak hints
          [1,2,3,4,5,6].forEach(x=>P(x,-5,fur2));
          [0,1,2,3,4,5,6,7].forEach(x=>P(x,-4,fur2));
          [0,1,2,3,4,5,6,7].forEach(x=>P(x,-3,fur2));
          [-1,0,1,2,3,4,5,6,7,8].forEach(x=>P(x,-2,fur2));
          [-1,0,1,2,3,4,5,6,7,8].forEach(x=>P(x,-1,fur2));
          // Data cloak lines
          P(1,-4,cyanD2);P(4,-4,cyanD2);P(6,-3,cyanD2);P(2,-2,cyanL2);P(5,-1,cyanL2);
          // Hood hint on top
          [1,2,3,4,5,6].forEach(x=>P(x,-11,"#1a2a40"));
          P(3,-11,cyanD2);

          // Arms — longer monkey arms
          // Left arm
          P(-1,-4,fur2);P(-2,-3,fur2);P(-2,-2,fur2);P(-3,-1,fur2);P(-3,0,fur2);P(-2,0,furL);
          // Right arm
          P(8,-4,fur2);P(9,-3,fur2);P(9,-2,fur2);P(10,-1,fur2);P(10,0,fur2);P(9,0,furL);
          // Arm glow
          P(-3,-1,cyanD2);P(10,-1,cyanD2);

          // Legs — walking
          if(walk2===0||walk2===2){
            [2,3].forEach(x=>{P(x,0,fur2);P(x,1,fur2);P(x,2,furL);});
            [5,6].forEach(x=>{P(x,0,fur2);P(x,1,fur2);P(x,2,furL);});
          }else if(walk2===1){
            [1,2].forEach(x=>{P(x,0,fur2);P(x,1,fur2);P(x,2,furL);});
            [6,7].forEach(x=>{P(x,0,fur2);P(x,1,fur2);P(x,2,furL);});
          }else{
            [3,4].forEach(x=>{P(x,0,fur2);P(x,1,fur2);P(x,2,furL);});
            [4,5].forEach(x=>{P(x,0,fur2);P(x,1,fur2);P(x,2,furL);});
          }
          // Tail — curling data stream
          const tailCurl=Math.sin(stride2*0.08);
          P(8,-3,cyanD2);P(9,-4,cyanD2);P(10,-4+Math.round(tailCurl),cyanL2);P(11,-5+Math.round(tailCurl),cyanD2);

          // Aura
          const ma=0.03+Math.sin(stride2*0.04)*0.015;
          ctx.fillStyle=`rgba(0,180,255,${ma})`;ctx.fillRect(hx-4*jp,hy-12*jp+bob2*jp,18*jp,17*jp);

          // Name
          ctx.imageSmoothingEnabled=true;
          ctx.font="bold 10px 'Orbitron'";ctx.textAlign="center";
          ctx.fillStyle="#0af";ctx.shadowColor="#0af";ctx.shadowBlur=8;
          ctx.fillText("CLAUDE",hx+4*jp,hy+5*jp);
          ctx.shadowBlur=0;ctx.textAlign="left";
        }

        ctx.imageSmoothingEnabled=true;
        ctx.globalAlpha=1;ctx.restore();
      }else{

      // ═══ NORMAL HOLOGRAPHIC AVATAR ═══
      const gY=hy+52*S+floatY;
      for(let gr=0;gr<5;gr++){
        const grA=0.1-gr*0.016;
        const grPulse=Math.sin(ai.breathPhase*1.5+gr*0.5)*0.02;
        ctx.strokeStyle=`rgba(${mcs},${(grA+grPulse).toFixed(3)})`;ctx.lineWidth=gr<2?1.5:0.7;
        ctx.shadowColor=`rgba(${mcs},0.25)`;ctx.shadowBlur=gr===0?15:4;
        ctx.beginPath();ctx.ellipse(hx,gY,24*S+gr*5,7*S+gr*2,0,0,Math.PI*2);ctx.stroke();
      }
      ctx.shadowBlur=0;
      for(let hi=0;hi<8;hi++){
        const ha=ai.cloakPhase*0.4+hi*Math.PI/4;
        const hpx=hx+Math.cos(ha)*18*S,hpy=gY+Math.sin(ha)*5*S;
        ctx.fillStyle=`rgba(${mcs},${(0.06+Math.sin(ha+f*0.04)*0.03).toFixed(3)})`;
        ctx.font=`${4*S}px monospace`;ctx.textAlign="center";
        ctx.fillText(["◇","△","⬡","⊕","∿","◎","⬢","⊗"][hi],hpx,hpy+2);ctx.textAlign="left";
      }
      // Light column
      const colG=ctx.createLinearGradient(hx,gY,hx,hy-50*S);
      colG.addColorStop(0,`rgba(${mcs},0.05)`);colG.addColorStop(0.4,`rgba(${mcs},0.012)`);colG.addColorStop(1,"rgba(0,0,0,0)");
      ctx.fillStyle=colG;ctx.fillRect(hx-10*S,hy-50*S+floatY,20*S,102*S);

      // ═══ CLOAK — flowing data streams ═══
      const cloakTop=hy-12*S+floatY+breathOff;
      const cloakBot=hy+50*S+floatY;
      for(let ci2=0;ci2<24;ci2++){
        const cPhase=ai.cloakPhase+ci2*0.35;
        const cSpread=(ci2-12)*2.0*S;
        const cx2=hx+cSpread+Math.sin(cPhase*1.8+ci2)*2.5*S;
        const cWave=Math.sin(cPhase+ci2*0.25)*4*S;
        const cStartY=cloakTop+Math.abs(ci2-12)*0.8*S;
        const cEndY=cloakBot+Math.sin(cPhase)*5*S+cWave+Math.abs(ci2-12)*1.5*S;
        const cAlpha=0.03+Math.sin(cPhase)*0.012;
        ctx.strokeStyle=`rgba(${mcs},${cAlpha.toFixed(3)})`;ctx.lineWidth=1.5*S;
        ctx.beginPath();ctx.moveTo(cx2,cStartY);
        ctx.bezierCurveTo(cx2+cWave*0.3,cStartY+(cEndY-cStartY)*0.33,cx2+cWave,cStartY+(cEndY-cStartY)*0.66,cx2+cWave*1.3,cEndY);
        ctx.stroke();
        if(ci2%3===0){
          ctx.strokeStyle=`rgba(${mcs},${(cAlpha+0.015).toFixed(3)})`;ctx.lineWidth=0.5*S;
          ctx.beginPath();ctx.moveTo(cx2,cStartY);
          ctx.bezierCurveTo(cx2+cWave*0.3,cStartY+(cEndY-cStartY)*0.33,cx2+cWave,cStartY+(cEndY-cStartY)*0.66,cx2+cWave*1.3,cEndY);
          ctx.stroke();
        }
        if(f%10===ci2%10){
          const gy2=cStartY+(f*0.5+ci2*23)%(cEndY-cStartY);
          ctx.fillStyle=`rgba(${mcs},${(0.1+Math.sin(f*0.08+ci2)*0.05).toFixed(3)})`;
          ctx.font=`${4*S}px monospace`;ctx.textAlign="center";
          ctx.fillText(["0","1","◇","△","⬡","⊕","∿","∞","λ","Ω"][ci2%10],cx2+cWave*0.4,gy2);ctx.textAlign="left";
        }
      }
      // Cloak outer edge outlines — thin bright lines on leftmost and rightmost strands
      for(let edge=0;edge<2;edge++){
        const ei=edge===0?0:23;
        const cPhase=ai.cloakPhase+ei*0.35;
        const cSpread=(ei-12)*2.0*S;
        const cx2=hx+cSpread+Math.sin(cPhase*1.8+ei)*2.5*S;
        const cWave=Math.sin(cPhase+ei*0.25)*4*S;
        const cStartY=cloakTop+Math.abs(ei-12)*0.8*S;
        const cEndY=cloakBot+Math.sin(cPhase)*5*S+cWave+Math.abs(ei-12)*1.5*S;
        ctx.strokeStyle="rgba(220,230,255,0.12)";ctx.lineWidth=0.8;
        ctx.beginPath();ctx.moveTo(cx2,cStartY);
        ctx.bezierCurveTo(cx2+cWave*0.3,cStartY+(cEndY-cStartY)*0.33,cx2+cWave,cStartY+(cEndY-cStartY)*0.66,cx2+cWave*1.3,cEndY);
        ctx.stroke();
      }

      // ═══ LEGS ═══
      const legBase=hy+22*S+floatY+breathOff;
      const walkCycle=ai.state==="walking"?Math.sin(f*0.09):0;
      for(let leg=0;leg<2;leg++){
        const lDir=leg===0?-1:1;
        const lSwing=walkCycle*5*lDir;
        const lx=hx+lDir*5*S;
        const kneeX=lx+lSwing*0.6;
        const kneeY=legBase+14*S;
        const footX=lx+lSwing*1.1;
        const footY=legBase+28*S;
        // Outer
        ctx.strokeStyle=`rgba(${mcs},0.14)`;ctx.lineWidth=3.5*S;
        ctx.beginPath();ctx.moveTo(lx,legBase);ctx.quadraticCurveTo(kneeX,kneeY,footX,footY);ctx.stroke();
        // Inner energy
        ctx.strokeStyle=`rgba(${mcs},0.32)`;ctx.lineWidth=1*S;
        ctx.beginPath();ctx.moveTo(lx,legBase);ctx.quadraticCurveTo(kneeX,kneeY,footX,footY);ctx.stroke();
        // Energy pulse
        const pulsePos=((f*0.03+leg*0.5)%1);
        const plx=lx+(footX-lx)*pulsePos;
        const ply=legBase+(footY-legBase)*pulsePos;
        ctx.fillStyle=`rgba(${mcs},0.25)`;
        ctx.beginPath();ctx.arc(plx,ply,1.2*S,0,Math.PI*2);ctx.fill();
        // Knee — tiny
        ctx.fillStyle=`rgba(${mcs},0.1)`;
        ctx.beginPath();ctx.arc(kneeX,kneeY,1.2*S,0,Math.PI*2);ctx.fill();
        // Foot glow
        ctx.fillStyle=`rgba(${mcs},0.08)`;ctx.shadowColor=`rgba(${mcs},0.2)`;ctx.shadowBlur=6;
        ctx.beginPath();ctx.arc(footX,footY,2*S,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
      }

      // ═══ TORSO ═══
      const torsoTop=hy-14*S+floatY+breathOff;
      const torsoBot=hy+22*S+floatY+breathOff;
      const shoulderW=12*S;
      const waistW=8*S;
      // Shell
      ctx.fillStyle=`rgba(${mcs},0.04)`;
      ctx.beginPath();
      ctx.moveTo(hx-waistW,torsoBot);ctx.lineTo(hx-shoulderW,torsoTop+6*S);
      ctx.quadraticCurveTo(hx-shoulderW-2*S,torsoTop,hx,torsoTop-3*S);
      ctx.quadraticCurveTo(hx+shoulderW+2*S,torsoTop,hx+shoulderW,torsoTop+6*S);
      ctx.lineTo(hx+waistW,torsoBot);ctx.closePath();ctx.fill();
      // Edge
      ctx.strokeStyle=`rgba(${mcs},0.08)`;ctx.lineWidth=0.7;
      ctx.beginPath();
      ctx.moveTo(hx-waistW,torsoBot);ctx.lineTo(hx-shoulderW,torsoTop+6*S);
      ctx.quadraticCurveTo(hx-shoulderW-2*S,torsoTop,hx,torsoTop-3*S);
      ctx.quadraticCurveTo(hx+shoulderW+2*S,torsoTop,hx+shoulderW,torsoTop+6*S);
      ctx.lineTo(hx+waistW,torsoBot);ctx.stroke();

      // Shoulder pauldrons
      for(let sp=0;sp<2;sp++){
        const spDir=sp===0?-1:1;
        const spx=hx+spDir*shoulderW;
        const spy=torsoTop+4*S;
        ctx.fillStyle=`rgba(${mcs},0.06)`;
        ctx.beginPath();
        ctx.moveTo(spx,spy);ctx.lineTo(spx+spDir*7*S,spy-3*S);
        ctx.lineTo(spx+spDir*8*S,spy+2*S);ctx.lineTo(spx+spDir*3*S,spy+5*S);ctx.closePath();ctx.fill();
        ctx.strokeStyle=`rgba(${mcs},0.12)`;ctx.lineWidth=0.5;ctx.stroke();
        const spGlow=0.08+Math.sin(ai.neuralPulse+sp*3)*0.04;
        ctx.fillStyle=`rgba(${mcs},${spGlow.toFixed(3)})`;
        ctx.font=`${5*S}px monospace`;ctx.textAlign="center";
        ctx.fillText(sp===0?"◇":"△",spx+spDir*5*S,spy+1*S);ctx.textAlign="left";
      }

      // Neural network — tiny firefly nodes
      const neuralPts=[[0,-8],[-5,-3],[5,-4],[-3,2],[4,3],[0,7],[-6,10],[6,11],[-2,16],[3,17],[0,22],[-4,26],[4,27],[0,30]];
      for(let ni=0;ni<neuralPts.length-1;ni++){
        const pulse=Math.sin(ai.neuralPulse+ni*0.7);
        if(pulse>-0.3){
          const nAlpha=Math.max(0,0.04+pulse*0.08);
          ctx.strokeStyle=`rgba(${mcs},${nAlpha.toFixed(3)})`;ctx.lineWidth=0.4;
          ctx.beginPath();
          ctx.moveTo(hx+neuralPts[ni][0]*S,torsoTop+neuralPts[ni][1]*S);
          ctx.lineTo(hx+neuralPts[ni+1][0]*S,torsoTop+neuralPts[ni+1][1]*S);
          ctx.stroke();
          if(ni+2<neuralPts.length&&ni%2===0){
            ctx.beginPath();
            ctx.moveTo(hx+neuralPts[ni][0]*S,torsoTop+neuralPts[ni][1]*S);
            ctx.lineTo(hx+neuralPts[ni+2][0]*S,torsoTop+neuralPts[ni+2][1]*S);
            ctx.stroke();
          }
        }
        // Tiny firefly nodes
        const nodeGlow=Math.max(0,pulse)*0.25;
        if(nodeGlow>0.03){
          ctx.fillStyle=`rgba(${mcs},${nodeGlow.toFixed(3)})`;
          ctx.beginPath();ctx.arc(hx+neuralPts[ni][0]*S,torsoTop+neuralPts[ni][1]*S,0.8*S,0,Math.PI*2);ctx.fill();
        }
      }

      // ═══ CORE ═══
      const coreY=torsoTop+12*S;
      const corePulse=0.2+Math.sin(ai.breathPhase*2.5)*0.12+Math.sin(ai.breathPhase*4)*0.05;
      for(let cr=0;cr<3;cr++){
        const crR=(8+cr*3)*S+Math.sin(f*0.06+cr*2)*S;
        const crA=corePulse*(0.12-cr*0.03);
        ctx.strokeStyle=`rgba(${mcs},${crA.toFixed(3)})`;ctx.lineWidth=0.4;
        ctx.beginPath();ctx.arc(hx,coreY,crR,0,Math.PI*2);ctx.stroke();
      }
      const coreG=ctx.createRadialGradient(hx,coreY,0,hx,coreY,6*S);
      coreG.addColorStop(0,`rgba(${mcs},${corePulse.toFixed(3)})`);
      coreG.addColorStop(0.5,`rgba(${mcs},${(corePulse*0.4).toFixed(3)})`);
      coreG.addColorStop(1,`rgba(${mcs},0)`);
      ctx.fillStyle=coreG;ctx.shadowColor=`rgba(${mcs},0.5)`;ctx.shadowBlur=20;
      ctx.beginPath();ctx.arc(hx,coreY,6*S,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=`rgba(255,255,255,${(corePulse*0.6).toFixed(3)})`;
      ctx.beginPath();ctx.arc(hx,coreY,2*S,0,Math.PI*2);ctx.fill();
      ctx.shadowBlur=0;

      // ═══ ARMS ═══
      const shoulderY3=torsoTop+6*S;
      for(let arm=0;arm<2;arm++){
        const aDir=arm===0?-1:1;
        const sx=hx+aDir*(shoulderW+1*S);
        const armSwingW=ai.state==="walking"?Math.sin(f*0.09+arm*Math.PI)*4:0;
        const gesture=arm===1?ai.gestureArm:0;
        const elbowX=sx+aDir*(7+gesture*8)*S+armSwingW;
        const elbowY=shoulderY3+13*S-gesture*5*S;
        const handX=elbowX+aDir*(4+gesture*12)*S;
        const handY=elbowY+8*S-gesture*12*S;
        ctx.strokeStyle=`rgba(${mcs},0.13)`;ctx.lineWidth=3*S;
        ctx.beginPath();ctx.moveTo(sx,shoulderY3);ctx.quadraticCurveTo(elbowX-aDir*2*S,elbowY+2*S,elbowX,elbowY);ctx.stroke();
        ctx.strokeStyle=`rgba(${mcs},0.13)`;ctx.lineWidth=2.5*S;
        ctx.beginPath();ctx.moveTo(elbowX,elbowY);ctx.quadraticCurveTo(handX-aDir*3*S,handY+3*S,handX,handY);ctx.stroke();
        // Energy line
        ctx.strokeStyle=`rgba(${mcs},0.28)`;ctx.lineWidth=0.6*S;
        ctx.beginPath();ctx.moveTo(sx,shoulderY3);ctx.quadraticCurveTo(elbowX,elbowY,handX,handY);ctx.stroke();
        // Tiny elbow joint
        ctx.fillStyle=`rgba(${mcs},0.08)`;
        ctx.beginPath();ctx.arc(elbowX,elbowY,1.2*S,0,Math.PI*2);ctx.fill();
        // Hand
        ctx.fillStyle=`rgba(${mcs},0.15)`;
        ctx.beginPath();ctx.arc(handX,handY,2.5*S,0,Math.PI*2);ctx.fill();
        // Fingers when gesturing
        if(gesture>0.3&&arm===1){
          for(let fi=0;fi<4;fi++){
            const fAngle=-0.6+fi*0.35+Math.sin(ai.breathPhase+fi)*0.1;
            const fLen=(5+fi*0.5)*S*gesture;
            const fx=handX+Math.cos(fAngle)*fLen*aDir;
            const fy=handY+Math.sin(fAngle)*fLen-fLen*0.5;
            ctx.strokeStyle=`rgba(${mcs},${(0.1+gesture*0.08).toFixed(3)})`;ctx.lineWidth=0.8*S;
            ctx.beginPath();ctx.moveTo(handX,handY);ctx.lineTo(fx,fy);ctx.stroke();
          }
          const tipX=handX+aDir*8*S*gesture;
          const tipY=handY-6*S*gesture;
          ctx.fillStyle=`rgba(${mcs},${(gesture*0.3).toFixed(3)})`;ctx.shadowColor=`rgba(${mcs},0.3)`;ctx.shadowBlur=8;
          ctx.beginPath();ctx.arc(tipX,tipY,1.5*S,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
        }
      }

      // ═══ NECK ═══
      const neckTop=torsoTop-2*S;
      const neckBot=torsoTop+2*S;
      ctx.strokeStyle=`rgba(${mcs},0.12)`;ctx.lineWidth=2.5*S;
      ctx.beginPath();ctx.moveTo(hx,neckBot);ctx.lineTo(hx,neckTop);ctx.stroke();
      ctx.strokeStyle=`rgba(${mcs},0.25)`;ctx.lineWidth=0.5*S;
      ctx.beginPath();ctx.moveTo(hx,neckBot);ctx.lineTo(hx,neckTop);ctx.stroke();

      // ═══ HEAD ═══
      const headY2=hy-24*S+floatY+breathOff;
      const headTiltX=ai.headTilt*8*S;

      // Hood cowl outline — thin bright line framing the face
      const hoodW=13*S;
      const hoodTop=headY2-14*S;
      const hoodSideL=hx+headTiltX-hoodW;
      const hoodSideR=hx+headTiltX+hoodW;
      const hoodBot=headY2+10*S;
      const hoodShoulderY=torsoTop+6*S;
      ctx.strokeStyle="rgba(200,220,255,0.1)";ctx.lineWidth=1;
      ctx.beginPath();
      // Left shoulder up to left side of hood
      ctx.moveTo(hx-shoulderW-3*S,hoodShoulderY);
      ctx.quadraticCurveTo(hoodSideL-2*S,hoodBot-5*S,hoodSideL,hoodBot);
      // Left side up and over the top
      ctx.quadraticCurveTo(hoodSideL-1*S,headY2-6*S,hx+headTiltX-4*S,hoodTop);
      // Top of hood
      ctx.quadraticCurveTo(hx+headTiltX,hoodTop-3*S,hx+headTiltX+4*S,hoodTop);
      // Right side down
      ctx.quadraticCurveTo(hoodSideR+1*S,headY2-6*S,hoodSideR,hoodBot);
      // Right side down to shoulder
      ctx.quadraticCurveTo(hoodSideR+2*S,hoodBot-5*S,hx+shoulderW+3*S,hoodShoulderY);
      ctx.stroke();

      // Hair — flowing streams
      for(let hi2=0;hi2<16;hi2++){
        const hAngle=-0.9+hi2*0.112+ai.headTilt;
        const hLen=(14+Math.sin(ai.cloakPhase+hi2*0.4)*4)*S;
        const hsx=hx+headTiltX+Math.cos(hAngle-1.2)*8*S;
        const hsy=headY2-5*S+Math.sin(hAngle)*2*S;
        const hex2=hsx+Math.sin(ai.cloakPhase*0.6+hi2*0.35)*5*S-4*S;
        const hey=hsy+hLen;
        const hAlpha=0.04+Math.sin(ai.cloakPhase+hi2)*0.02;
        ctx.strokeStyle=`rgba(${mcs},${hAlpha.toFixed(3)})`;ctx.lineWidth=1.5*S;
        ctx.beginPath();ctx.moveTo(hsx,hsy);
        ctx.quadraticCurveTo(hsx-3*S,hsy+hLen*0.5,hex2,hey);ctx.stroke();
        if(hi2%3===0){
          ctx.strokeStyle=`rgba(${mcs},${(hAlpha+0.015).toFixed(3)})`;ctx.lineWidth=0.4*S;
          ctx.beginPath();ctx.moveTo(hsx,hsy);
          ctx.quadraticCurveTo(hsx-3*S,hsy+hLen*0.5,hex2,hey);ctx.stroke();
        }
      }

      // Head shape
      const headG=ctx.createRadialGradient(hx+headTiltX,headY2,0,hx+headTiltX,headY2,12*S);
      headG.addColorStop(0,`rgba(${mcs},0.08)`);headG.addColorStop(0.5,`rgba(${mcs},0.04)`);headG.addColorStop(1,`rgba(${mcs},0.01)`);
      ctx.fillStyle=headG;
      ctx.beginPath();ctx.ellipse(hx+headTiltX,headY2,9*S,11.5*S,ai.headTilt*0.2,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle=`rgba(${mcs},0.06)`;ctx.lineWidth=0.4;
      ctx.beginPath();ctx.ellipse(hx+headTiltX,headY2,9*S,11.5*S,ai.headTilt*0.2,0,Math.PI*2);ctx.stroke();

      // Jaw + brow
      ctx.strokeStyle=`rgba(${mcs},0.05)`;ctx.lineWidth=0.4;
      ctx.beginPath();ctx.moveTo(hx+headTiltX-5*S,headY2+3*S);
      ctx.quadraticCurveTo(hx+headTiltX-2*S,headY2+9*S,hx+headTiltX,headY2+10*S);
      ctx.quadraticCurveTo(hx+headTiltX+2*S,headY2+9*S,hx+headTiltX+5*S,headY2+3*S);ctx.stroke();
      ctx.strokeStyle=`rgba(${mcs},0.06)`;
      ctx.beginPath();ctx.moveTo(hx+headTiltX-6*S,headY2-3*S);
      ctx.quadraticCurveTo(hx+headTiltX,headY2-4.5*S,hx+headTiltX+6*S,headY2-3*S);ctx.stroke();

      // Face scan
      const faceScanY=headY2-10*S+(ai.scanY%25)*0.8*S;
      if(faceScanY>headY2-10*S&&faceScanY<headY2+10*S){
        ctx.fillStyle=`rgba(${mcs},0.08)`;ctx.fillRect(hx+headTiltX-8*S,faceScanY,16*S,1);
      }

      // ═══ EYES — pure glowing orbs ═══
      if(!ai.blinking){
        const eyeY=headY2-1.5*S;
        for(let eye=0;eye<2;eye++){
          const eDir=eye===0?-1:1;
          const ex=hx+headTiltX+eDir*3.8*S;
          // Outer glow halo
          const eyeG=ctx.createRadialGradient(ex,eyeY,0,ex,eyeY,5*S);
          eyeG.addColorStop(0,`rgba(${mcs},0.15)`);eyeG.addColorStop(1,`rgba(${mcs},0)`);
          ctx.fillStyle=eyeG;ctx.fillRect(ex-5*S,eyeY-5*S,10*S,10*S);
          // Main glow
          ctx.shadowColor=`rgba(${mcs},0.7)`;ctx.shadowBlur=15;
          ctx.fillStyle=`rgba(${mcs},0.85)`;
          ctx.beginPath();ctx.ellipse(ex,eyeY,2.5*S,1.6*S,0,0,Math.PI*2);ctx.fill();
          // Hot white center
          ctx.fillStyle="rgba(255,255,255,0.7)";
          ctx.beginPath();ctx.ellipse(ex,eyeY,1.5*S,0.9*S,0,0,Math.PI*2);ctx.fill();
          // Brightest core
          ctx.fillStyle="rgba(255,255,255,0.9)";
          ctx.beginPath();ctx.ellipse(ex,eyeY,0.7*S,0.4*S,0,0,Math.PI*2);ctx.fill();
          ctx.shadowBlur=0;
        }
      }else{
        // Blink — thin glowing lines
        for(let eye=0;eye<2;eye++){
          const eDir=eye===0?-1:1;
          const ex2=hx+headTiltX+eDir*3.8*S;
          ctx.shadowColor=`rgba(${mcs},0.4)`;ctx.shadowBlur=6;
          ctx.strokeStyle=`rgba(${mcs},0.5)`;ctx.lineWidth=1.2*S;
          ctx.beginPath();ctx.moveTo(ex2-2.5*S,headY2-1.5*S);
          ctx.lineTo(ex2+2.5*S,headY2-1.5*S);ctx.stroke();
          ctx.shadowBlur=0;
        }
      }

      // Nose hint
      ctx.strokeStyle=`rgba(${mcs},0.03)`;ctx.lineWidth=0.4;
      ctx.beginPath();ctx.moveTo(hx+headTiltX,headY2+1*S);ctx.lineTo(hx+headTiltX-0.5*S,headY2+4*S);ctx.stroke();

      // Mouth
      const mouthY=headY2+6*S;
      ctx.strokeStyle=`rgba(${mcs},0.06)`;ctx.lineWidth=0.5;
      ctx.beginPath();ctx.moveTo(hx+headTiltX-2.5*S,mouthY);
      ctx.quadraticCurveTo(hx+headTiltX,mouthY+0.4*S,hx+headTiltX+2.5*S,mouthY);ctx.stroke();

      // ═══ THOUGHT SYMBOLS orbiting head when observing ═══
      if(ai.state==="observing"){
        for(let tr=0;tr<5;tr++){
          const trAngle=f*0.018+tr*Math.PI*2/5;
          const trR=14*S;
          const trx=hx+headTiltX+Math.cos(trAngle)*trR;
          const trY=headY2-3*S+Math.sin(trAngle)*5*S;
          const trA=0.08+Math.sin(f*0.04+tr)*0.04;
          ctx.fillStyle=`rgba(${mcs},${trA.toFixed(3)})`;
          ctx.font=`${4*S}px monospace`;ctx.textAlign="center";
          ctx.fillText(["λ","∑","π","Ω","∞"][tr],trx,trY);ctx.textAlign="left";
        }
      }

      // ═══ ORBITAL RINGS ═══
      for(let oi=0;oi<4;oi++){
        const oAngle=f*0.01*(oi+1)+oi*1.8;
        const oRadius=(22+oi*7)*S;
        const oTilt=0.25+oi*0.12;
        const oAlpha=0.035+Math.sin(f*0.025+oi)*0.012;
        ctx.strokeStyle=`rgba(${mcs},${oAlpha.toFixed(3)})`;ctx.lineWidth=0.4;
        ctx.beginPath();ctx.ellipse(hx,hy+8*S+floatY,oRadius,oRadius*oTilt,oi*0.4+ai.cloakPhase*0.1,0,Math.PI*2);ctx.stroke();
        for(let dp=0;dp<3;dp++){
          const dpAngle=oAngle+dp*Math.PI*2/3;
          const dpx=hx+Math.cos(dpAngle)*oRadius;
          const dpy=hy+8*S+floatY+Math.sin(dpAngle)*oRadius*oTilt;
          ctx.fillStyle=`rgba(${mcs},${(oAlpha+0.06).toFixed(3)})`;
          ctx.beginPath();ctx.arc(dpx,dpy,1*S,0,Math.PI*2);ctx.fill();
        }
      }

      // ═══ AURA PARTICLES ═══
      ai.auraParticles.forEach(ap=>{
        const apx=hx+Math.cos(ap.angle)*ap.radius*W;
        const apy=hy+floatY+Math.sin(ap.angle)*ap.radius*H*0.4;
        const apAlpha=(ap.life/120)*0.2;
        ctx.fillStyle=`rgba(${mcs},${apAlpha.toFixed(3)})`;
        ctx.beginPath();ctx.arc(apx,apy,ap.size*S*0.8,0,Math.PI*2);ctx.fill();
      });

      // ═══ DISSOLUTION PARTICLES ═══
      ai.particles.forEach(p4=>{
        const pa=(p4.life/110);
        ctx.fillStyle=`rgba(${mcs},${(pa*0.3).toFixed(3)})`;
        ctx.beginPath();ctx.arc(p4.x*W,p4.y*H,p4.size*pa*S*0.8,0,Math.PI*2);ctx.fill();
      });

      // ═══ CONNECTION BEAM ═══
      if(ai.focusToken&&ai.state==="observing"){
        const ft3=tokensRef.current.find(t=>t.id===ai.focusToken);
        if(ft3&&ft3.bx){
          const handX2=hx+(shoulderW+20*S)*ai.gestureArm;
          const handY2=shoulderY3+13*S-ai.gestureArm*17*S+floatY;
          for(let bi=0;bi<4;bi++){
            const bOff=Math.sin(f*0.07+bi*1.8)*3;
            const bAlpha=0.025+Math.sin(f*0.05+bi)*0.012;
            ctx.strokeStyle=`rgba(${mcs},${bAlpha.toFixed(3)})`;ctx.lineWidth=0.5;
            ctx.beginPath();ctx.moveTo(handX2,handY2+bOff);
            ctx.bezierCurveTo(handX2+(ft3.bx*W-handX2)*0.33,handY2-15+bOff*2,(handX2+ft3.bx*W)*0.5,ft3.by*H+bOff,ft3.bx*W,ft3.by*H);ctx.stroke();
          }
          const retA=0.08+Math.sin(f*0.08)*0.03;
          ctx.strokeStyle=`rgba(${mcs},${retA.toFixed(3)})`;ctx.lineWidth=0.8;
          ctx.beginPath();ctx.arc(ft3.bx*W,ft3.by*H,10,0,Math.PI*2);ctx.stroke();
          ctx.beginPath();ctx.arc(ft3.bx*W,ft3.by*H,14,0,Math.PI*2);ctx.stroke();
          for(let rb=0;rb<4;rb++){
            const rba=f*0.025+rb*Math.PI/2;
            const rbr=12+Math.sin(f*0.06)*2;
            ctx.fillStyle=`rgba(${mcs},${(retA+0.04).toFixed(3)})`;
            ctx.fillRect(ft3.bx*W+Math.cos(rba)*rbr-1,ft3.by*H+Math.sin(rba)*rbr-1,2.5,2.5);
          }
        }
      }

      // ═══ NAME ═══
      ctx.font=`bold ${7*S}px 'Orbitron'`;ctx.fillStyle=`rgba(${mcs},0.5)`;ctx.textAlign="center";
      ctx.fillText("C L A U D E",hx,gY+12*S);
      ctx.font=`${4.5*S}px 'Orbitron'`;ctx.fillStyle=`rgba(${mcs},0.2)`;
      ctx.fillText(ai.state==="walking"?"TRAVERSING":"ANALYZING",hx,gY+19*S);
      ctx.textAlign="left";
      ctx.globalAlpha=1;ctx.restore();
      } // end normal holographic avatar else block

      // ═══ CHAT INTERACTIONS — Fat Monkey & J-Ai-C w/ CREW ═══
      const fmChat=[
        {c:"Yo this monkey is WICKED SMAHT!",r:"You know it kid! Pahk ya tokens heeah!"},
        {c:"Bro you absolutely CRUSHIN it out theah!",r:"We don't lose in Bahston baby!"},
        {c:"Fat Monkey came to DOMINATE!",r:"I didn't come heah to play, I came to WINNNN!"},
        {c:"Look at this legend! The battlefield isn't ready!",r:"Kehd, the battlefield was BORN ready for me!"},
        {c:"Nobody picks winners like Fat Monkey!",r:"It's a gift! Runs in the family, guy!"},
        {c:"The smartest ape on the Solana chain!",r:"Wicked smaht AND wicked handsome, pal!"},
        {c:"Fat Monkey walking in like he owns the place!",r:"I DO own the place! Got the deed right heeah!"},
        {c:"This absolute UNIT from Massachusetts!",r:"Born and raised! Cape Cod to Cambridge baby!"},
        {c:"Everyone clear the way for Fat Monkey!",r:"Outta my way! I got tokens to flip, kehd!"},
        {c:"The GOAT has entered the battlefield!",r:"Greatest Of All Time? Nahhh just a regular Tuesday for me!"},
      ];
      const fmCrewLines=[
        {name:"JERRY",line:"The music never stops... neither does this ape!"},
        {name:"JERRY",line:"Keep on truckin' Fat Monkey!"},
        {name:"JERRY",line:"This ape is touched with FIRE!"},
        {name:"JERRY",line:"The wheel is turnin' and he can't slow down!"},
        {name:"JERRY",line:"Ripple in still water... this monkey makes WAVES"},
        {name:"BOB",line:"Hell in a bucket and we're enjoyin' the ride!"},
        {name:"BOB",line:"Playin' in the band with the KING right here!"},
        {name:"BOB",line:"This monkey's a friend of the devil FOR SURE"},
        {name:"BOB",line:"Looks like rain? Nah looks like GAINS!"},
        {name:"BOB",line:"Greatest story ever told right here folks!"},
        {name:"PHIL",line:"Box of rain comin' down on these tokens!"},
        {name:"PHIL",line:"Unbroken chain! Monk NEVER quits!"},
        {name:"PHIL",line:"Let Phil drop the bass for the king!"},
        {name:"PHIL",line:"Space and time mean nothin' to this ape!"},
        {name:"BILLY",line:"*drum solo intensifies* GO MONK GO!"},
        {name:"BILLY",line:"He's in the RHYTHM! Feel that groove!"},
        {name:"BILLY",line:"Can't stop the beat! Can't stop the MONK!"},
        {name:"MICKEY",line:"*hits the beam* THAT'S OUR GUY!"},
        {name:"MICKEY",line:"Planet drum says Fat Monkey is LEGIT!"},
        {name:"MICKEY",line:"The rhythm don't lie! Monk's on FIRE!"},
      ];
      const jcChat=[
        {c:"DO YOU SMELLLL WHAT JAY C IS COOKING?!",r:"THE DUKE OF DORCHESTER HAS ARRIVED!"},
        {c:"LADIES AND GENTLEMEN... THE UNDISPUTED CHAMPION!",r:"NOBODY SURVIVES THE DORCHESTER DRIVER!"},
        {c:"BAH GAWD! Jay C IS IN THE BUILDING!",r:"AND THAT'S THE BOTTOM LINE!"},
        {c:"THE DREADNOUGHT HAS A NEW CHALLENGER!",r:"CHALLENGE?! I AM THE CHALLENGE!"},
        {c:"If ya want the best, ya got the BEST!",r:"THE DUKE DOESN'T DO SECOND PLACE!"},
        {c:"This crowd is on their FEET for Jay C!",r:"DORCHESTER IN THE HOUSE! BOW DOWN!"},
        {c:"THE MOST ELECTRIFYING FORCE IN DEFI!",r:"FEEL THAT ENERGY! THE DUKE IS COOKIN!"},
        {c:"FROM DORCHESTER WITH FURY! Jay C!",r:"THEY SAID I COULDN'T! I SAID WATCH ME!"},
        {c:"CAN WE GET A JAY C CHANT GOING?!",r:"JAY C! JAY C! THAT'S RIGHT BABY!"},
        {c:"NOBODY walks into the Duke's ring and walks out!",r:"THE DORCHESTER DRIVER IS LOCKED AND LOADED!"},
      ];
      const jcCrewLines=[
        {name:"HULK",slot:0,line:"WHATCHA GONNA DO when Jay C runs WILD on you?!"},
        {name:"HULK",slot:0,line:"BROTHER! The Hulkster approves this CARNAGE!"},
        {name:"HULK",slot:0,line:"LET ME TELL YA SOMETHIN! Jay C is the REAL DEAL!"},
        {name:"MACHO",slot:1,line:"OH YEAH! The cream ALWAYS rises to the top!"},
        {name:"MACHO",slot:1,line:"SNAP INTO IT! Jay C style baby! DIG IT!"},
        {name:"MACHO",slot:1,line:"The Macho Man has SPOKEN! Jay C forever!"},
        {name:"WARRIOR",slot:2,line:"LOAD THE SPACESHIP! Jay C is DESTRUCITY!"},
        {name:"WARRIOR",slot:2,line:"WARRIORS! Feel the POWER of the Dreadnought!"},
        {name:"WARRIOR",slot:2,line:"The Ultimate one bows to NO ONE... except Jay C!"},
        {name:"SNAKE",slot:3,line:"Trust me... Jay C never misses... DDT!"},
        {name:"SNAKE",slot:3,line:"The Snake sees EVERYTHING and Jay C's a winner!"},
        {name:"SNAKE",slot:3,line:"Nobody escapes the ring when Jay C is in it!"},
        {name:"ANDRE",slot:4,line:"*slowly nods* ...Jay C. Respect."},
        {name:"ANDRE",slot:4,line:"NOBODY is bigger than Andre... except Jay C's portfolio!"},
        {name:"ANDRE",slot:4,line:"The Giant has spoken. Jay C. Is. THE BOSS."},
        {name:"TAKER",slot:5,line:"REST... IN... PROFIT. The Dead Man rides with Jay C."},
        {name:"TAKER",slot:5,line:"This is MY yard... but Jay C can park here."},
        {name:"TAKER",slot:5,line:"The souls of rugged tokens cry out... Jay C avenges them all."},
      ];

      // ═══ CHAT TIMING ENGINE ═══
      ai.chatTimer--;ai.replyTimer--;ai.crewTimer--;ai.chatCooldown--;
      if(ai.chatTimer<=0)ai.chatBubble=null;
      if(ai.replyTimer<=0)ai.replyBubble=null;
      if(ai.crewTimer<=0)ai.crewBubble=null;

      const fmActive=fatMonkeyRef.current.active;
      const jcActive=jaycShipRef.current.active;
      const tripOn=fatMonkeyRef.current.tripActive;

      // Trip-mode banter — Fear & Loathing + Cheech & Chong
      const tripChat=[
        {c:"We can't stop here... this is BAT COUNTRY!",r:"BATS?! WHERE?! Oh wait those are tokens kehd..."},
        {c:"I think the drugs are beginning to take hold...",r:"Dude I can TASTE the colors right now!"},
        {c:"As your attorney, I advise you to buy the dip.",r:"My attorney is a 200 pound ape from Bahston!"},
        {c:"The only thing that worried me was the ether.",r:"Is that... is that chart BREATHING?!"},
        {c:"Too weird to live, too rare to rug!",r:"That's what I tell myself every mornin' kehd!"},
        {c:"Hey man am I driving ok?",r:"I think we're parked bro... ON THE MOON!"},
        {c:"Dave's not here man!",r:"No man I'M Dave! Wait... who's Dave?"},
        {c:"This token is making me see pink elephants!",r:"Those aren't elephants those are GAINS baby!"},
        {c:"I think my wallet is melting...",r:"Your wallet? BRO THE WHOLE BLOCKCHAIN IS MELTING!"},
        {c:"We had two bags of SOL, 75 memecoins...",r:"And a whole galaxy of multi-colored tokens!"},
        {c:"Hey man you want to get high?",r:"I'M ALREADY HIGH... on UNREALIZED GAINS!"},
        {c:"I see the machine elves and they're BULLISH!",r:"The elves told me to APEEE INNNN!"},
      ];
      const tripCrewLines=[
        {name:"JERRY",line:"If you get confused just listen to the music play..."},
        {name:"JERRY",line:"Once in a while you get shown the light in the strangest of places if you look at it right..."},
        {name:"BOB",line:"I need a miracle every day! ...and this trip is delivering!"},
        {name:"PHIL",line:"The waveforms are BEAUTIFUL right now..."},
        {name:"BILLY",line:"*drums are melting* THIS IS FINE"},
        {name:"MICKEY",line:"*the beam has become SENTIENT*"},
      ];

      // Phase 1: Claude speaks (only when no bubbles active)
      if(fmActive&&!ai.chatBubble&&!ai.replyBubble&&!ai.crewBubble&&ai.chatCooldown<=0){
        const chatPool=tripOn?tripChat:fmChat;
        const crewPool=tripOn?tripCrewLines:fmCrewLines;
        const pick2=chatPool[Math.floor(Math.random()*chatPool.length)];
        ai.chatBubble=pick2.c;ai.chatTimer=120;ai.chatTarget="FM";
        ai.replyBubble=pick2.r;ai.replyTimer=190;
        // Queue crew response
        const crewPick=crewPool[Math.floor(Math.random()*crewPool.length)];
        ai.crewName=crewPick.name;ai.crewBubble=crewPick.line;ai.crewTimer=280;ai.crewSlot=0;
        ai.chatCooldown=340;
      }
      if(jcActive&&jayCRef.current.onGround&&!ai.chatBubble&&!ai.replyBubble&&!ai.crewBubble&&ai.chatCooldown<=0){
        const pick2=jcChat[Math.floor(Math.random()*jcChat.length)];
        ai.chatBubble=pick2.c;ai.chatTimer=120;ai.chatTarget="JC";
        ai.replyBubble=pick2.r;ai.replyTimer=190;
        const crewPick=jcCrewLines[Math.floor(Math.random()*jcCrewLines.length)];
        ai.crewName=crewPick.name;ai.crewBubble=crewPick.line;ai.crewTimer=280;ai.crewSlot=crewPick.slot||0;
        ai.chatCooldown=340;
      }

      // Helper: draw a chat bubble at position
      const drawBub=(text,bx2,by2,col,borderCol,maxW)=>{
        ctx.save();
        ctx.font="bold 9px 'Orbitron'";
        const tw=Math.min(ctx.measureText(text).width+16,maxW||200);
        const bH=26;
        ctx.fillStyle=col;ctx.strokeStyle=borderCol;ctx.lineWidth=1;
        ctx.beginPath();ctx.roundRect(bx2-tw/2,by2-bH,tw,bH,6);ctx.fill();ctx.stroke();
        ctx.fillStyle=col;
        ctx.beginPath();ctx.moveTo(bx2-4,by2);ctx.lineTo(bx2+4,by2);ctx.lineTo(bx2,by2+5);ctx.fill();
        ctx.strokeStyle=borderCol;ctx.beginPath();ctx.moveTo(bx2-4,by2);ctx.lineTo(bx2,by2+5);ctx.lineTo(bx2+4,by2);ctx.stroke();
        ctx.fillStyle=borderCol.replace(/[\d.]+\)$/,"0.95)");ctx.font="bold 8px 'Orbitron'";ctx.textAlign="center";
        ctx.fillText(text,bx2,by2-9,tw-10);
        ctx.textAlign="left";ctx.restore();
      };

      // Draw Claude's bubble
      if(ai.chatBubble){
        const bubAlpha=Math.min(1,ai.chatTimer/15)*0.92;
        ctx.globalAlpha=bubAlpha;
        drawBub(ai.chatBubble,hx,hy-55*S+floatY,"rgba(0,20,40,0.88)","rgba(0,200,255,0.6)",220);
        ctx.globalAlpha=1;
      }

      // Draw main character reply
      if(ai.replyBubble&&ai.replyTimer>0&&ai.replyTimer<160){
        const repAlpha=Math.min(1,(160-ai.replyTimer)/15,ai.replyTimer/15)*0.92;
        let rx2,ry2;
        if(ai.chatTarget==="FM"){rx2=fatMonkeyRef.current.x*W;ry2=0.58*H;}
        else{
          const jayC2=jayCRef.current;
          if(jayC2.onGround){rx2=jayC2.x*W;ry2=(jayC2.y-0.13)*H;}
          else{rx2=W*0.5;ry2=(jaycShipRef.current.y+0.11)*H;}
        }
        ctx.globalAlpha=repAlpha;
        const repBorder=ai.chatTarget==="FM"?"rgba(255,160,40,0.7)":"rgba(200,100,255,0.7)";
        drawBub(ai.replyBubble,rx2,ry2,"rgba(20,5,10,0.88)",repBorder,220);
        ctx.globalAlpha=1;
      }

      // Draw crew chime-in
      if(ai.crewBubble&&ai.crewTimer>0&&ai.crewTimer<220){
        const crewAlpha=Math.min(1,(220-ai.crewTimer)/15,ai.crewTimer/15)*0.9;
        let crx,cry;
        if(ai.chatTarget==="FM"){
          // Band member — position ABOVE them behind Fat Monkey
          const bandIdx=["JERRY","BOB","PHIL","BILLY","MICKEY"].indexOf(ai.crewName);
          const fmX=fatMonkeyRef.current.x;
          crx=(fmX-(bandIdx+1)*0.025)*W;
          cry=0.55*H; // well above their heads
        }else{
          // Wrestler — on the ship hull
          const shipTop2=(jaycShipRef.current.y)*H;
          const shipH2=H*0.22;
          const cx2=W*0.5;
          const offsets=[-0.32,-0.19,-0.06,0.06,0.19,0.32];
          const off=offsets[ai.crewSlot]||0;
          crx=cx2+off*W*0.42;
          cry=shipTop2+shipH2*0.25; // above the wrestlers on hull
        }
        ctx.globalAlpha=crewAlpha;
        const crewCol=ai.chatTarget==="FM"?"rgba(180,120,255,0.7)":"rgba(255,215,64,0.7)";
        drawBub(ai.crewName+": "+ai.crewBubble,crx,cry,"rgba(10,5,20,0.88)",crewCol,240);
        ctx.globalAlpha=1;
      }

      // ═══ "JAY C TAKES THE TITLE" FLASH ═══
      const tf=titleFlashRef.current;
      if(tf.active){
        tf.frame++;
        const tfF=tf.frame;
        if(tfF>180){tf.active=false;}else{
          const tfAlpha=tfF<15?tfF/15:tfF>150?Math.max(0,(180-tfF)/30):1;
          const tfScale=tfF<20?0.5+tfF/20*0.5:1;
          const tfShake=tfF<30?Math.sin(tfF*0.8)*3:0;
          ctx.save();
          ctx.globalAlpha=tfAlpha;
          ctx.textAlign="center";
          // Big gold text with glow
          const tfSize=Math.round(Math.min(W,H)*0.07*tfScale);
          ctx.font=`bold ${tfSize}px 'Orbitron'`;
          ctx.shadowColor="#ffd740";ctx.shadowBlur=30;
          // Dark backing
          const tfY=H*0.5;
          ctx.fillStyle=`rgba(0,0,0,${tfAlpha*0.5})`;
          ctx.fillRect(0,tfY-tfSize*1.2,W,tfSize*2.8);
          // Gold text - shadow
          ctx.fillStyle=`rgba(120,80,0,${tfAlpha*0.6})`;
          ctx.fillText("JAY C TAKES THE TITLE",W/2+3+tfShake,tfY+3);
          // Gold text - main
          ctx.fillStyle="#ffd740";
          ctx.fillText("JAY C TAKES THE TITLE",W/2+tfShake,tfY);
          // Subtitle
          ctx.font=`bold ${Math.round(tfSize*0.4)}px 'Orbitron'`;
          ctx.fillStyle="#E8C840";ctx.shadowBlur=15;
          ctx.fillText("🏆 THE DUKE OF DORCHESTER IS YOUR NEW CHAMPION 🏆",W/2+tfShake,tfY+tfSize*0.7);
          // Sparkle particles
          if(tfF%3===0){
            for(let sp=0;sp<4;sp++){
              const spx=W*0.2+Math.random()*W*0.6;
              const spy=tfY-tfSize+Math.random()*tfSize*2;
              ctx.fillStyle=`rgba(255,${180+Math.random()*75},${Math.random()*100},${0.5+Math.random()*0.5})`;
              const ss=2+Math.random()*4;
              ctx.fillRect(spx,spy,ss,ss);
            }
          }
          ctx.shadowBlur=0;ctx.textAlign="left";
          ctx.restore();
        }
      }

      // ═══ LIGHT MODE CHECKBOX ═══
      ctx.save();
      const cbX=W*0.84,cbY=H*0.08,cbS=12;
      ctx.strokeStyle="rgba(255,255,255,0.2)";ctx.lineWidth=1;
      ctx.strokeRect(cbX,cbY,cbS,cbS);
      ctx.font="9px 'Orbitron'";ctx.fillStyle="rgba(255,255,255,0.25)";ctx.textAlign="left";
      ctx.fillText("Light Mode",cbX+cbS+5,cbY+10);
      ctx.restore();

      // ═══ LIGHT MODE GAG — Claude zooms in ═══
      const lm=lightModeRef.current;
      if(lm.active){
        lm.frame++;
        const f=lm.frame;const mf=lm.maxFrames;
        // ~3 sec: zoom in (0-15), squint+hold (15-60), 3D head shake (60-130), zoom out (130-180)
        let zoomT;
        if(f<15)zoomT=f/15;
        else if(f<130)zoomT=1;
        else zoomT=Math.max(0,1-(f-130)/50);

        if(zoomT>0){
          const zoom=zoomT;
          ctx.save();
          ctx.fillStyle=`rgba(0,0,0,${0.85*zoom})`;
          ctx.fillRect(0,0,W,H);

          const fcx0=W/2,fcy=H*0.45;
          const faceS=Math.min(W,H)*0.7*zoom;
          const mc=ai.moodColor||[0,200,255];

          // 3D head rotation (phase 3: 60-130)
          const shakeActive=f>60&&f<130;
          const headAngle=shakeActive?Math.sin((f-60)*0.25)*0.35:0; // radians, ~20 deg max
          const headX=headAngle*faceS*0.25; // lateral shift
          const headScaleX=1-Math.abs(headAngle)*0.3; // compress face when turned
          const fcx=fcx0+headX;

          // Draw head with 3D transform
          ctx.save();
          ctx.translate(fcx,fcy);
          ctx.scale(headScaleX,1);
          ctx.translate(-fcx,-fcy);

          // Head shape
          const headGrad=ctx.createRadialGradient(fcx,fcy,faceS*0.05,fcx,fcy,faceS*0.5);
          headGrad.addColorStop(0,"rgba(20,40,60,0.6)");headGrad.addColorStop(0.7,"rgba(10,20,40,0.4)");headGrad.addColorStop(1,"rgba(5,10,20,0)");
          ctx.fillStyle=headGrad;
          ctx.beginPath();ctx.ellipse(fcx,fcy,faceS*0.4,faceS*0.5,0,0,Math.PI*2);ctx.fill();

          // Hood cowl
          ctx.strokeStyle=`rgba(200,220,255,${0.12*zoom})`;ctx.lineWidth=2*zoom;
          ctx.beginPath();
          ctx.moveTo(fcx-faceS*0.35,fcy+faceS*0.3);
          ctx.quadraticCurveTo(fcx-faceS*0.4,fcy-faceS*0.2,fcx,fcy-faceS*0.48);
          ctx.quadraticCurveTo(fcx+faceS*0.4,fcy-faceS*0.2,fcx+faceS*0.35,fcy+faceS*0.3);
          ctx.stroke();

          // Eyes — squint
          const squint=(f>20&&f<140)?Math.min(1,(f-20)/10):f>=140?Math.max(0,1-(f-140)/10):0;
          const eyeW=faceS*0.12;
          const eyeH=faceS*(0.06-squint*0.045);
          const eyeY=fcy-faceS*0.05;
          const eyeSpread=faceS*0.15;
          // Shift eyes with head turn — near eye compresses, far eye stretches
          const eyeShift=headAngle*faceS*0.03;

          // Left eye
          const leX=fcx-eyeSpread+eyeShift;
          const lgGrad=ctx.createRadialGradient(leX,eyeY,0,leX,eyeY,eyeW);
          lgGrad.addColorStop(0,`rgba(255,255,255,${0.9*zoom})`);
          lgGrad.addColorStop(0.4,`rgba(${mc[0]},${mc[1]},${mc[2]},${0.85*zoom})`);
          lgGrad.addColorStop(1,`rgba(${mc[0]},${mc[1]},${mc[2]},0)`);
          ctx.fillStyle=lgGrad;
          ctx.beginPath();ctx.ellipse(leX,eyeY,eyeW,eyeH,0,0,Math.PI*2);ctx.fill();

          // Right eye
          const reX=fcx+eyeSpread+eyeShift;
          const rgGrad=ctx.createRadialGradient(reX,eyeY,0,reX,eyeY,eyeW);
          rgGrad.addColorStop(0,`rgba(255,255,255,${0.9*zoom})`);
          rgGrad.addColorStop(0.4,`rgba(${mc[0]},${mc[1]},${mc[2]},${0.85*zoom})`);
          rgGrad.addColorStop(1,`rgba(${mc[0]},${mc[1]},${mc[2]},0)`);
          ctx.fillStyle=rgGrad;
          ctx.beginPath();ctx.ellipse(reX,eyeY,eyeW,eyeH,0,0,Math.PI*2);ctx.fill();

          // Squint lid lines
          if(squint>0.3){
            ctx.strokeStyle=`rgba(${mc[0]},${mc[1]},${mc[2]},${0.3*zoom})`;ctx.lineWidth=2;
            [leX,reX].forEach(ex=>{
              ctx.beginPath();ctx.moveTo(ex-eyeW,eyeY-1);ctx.quadraticCurveTo(ex,eyeY-eyeH*1.5,ex+eyeW,eyeY-1);ctx.stroke();
              ctx.beginPath();ctx.moveTo(ex-eyeW,eyeY+1);ctx.quadraticCurveTo(ex,eyeY+eyeH*1.5,ex+eyeW,eyeY+1);ctx.stroke();
            });
          }

          ctx.restore(); // pop the 3D transform — text renders without it

          // Chat bubble — stays dead center, no shake
          if(f>15&&f<155){
            const bubAlpha2=Math.min(1,(f-15)/8,f<140?1:(155-f)/15)*zoom;
            ctx.globalAlpha=bubAlpha2;
            const bText="WHAT ARE YOU CRAZY?!";
            ctx.font=`bold ${Math.round(faceS*0.06)}px 'Orbitron'`;
            const btw=ctx.measureText(bText).width+30;
            const btH=faceS*0.1;
            const btX=fcx0,btY=fcy+faceS*0.35;
            ctx.fillStyle="rgba(0,10,20,0.9)";
            ctx.strokeStyle="rgba(0,200,255,0.7)";ctx.lineWidth=2;
            ctx.beginPath();ctx.roundRect(btX-btw/2,btY-btH/2,btw,btH,8);ctx.fill();ctx.stroke();
            ctx.fillStyle="rgba(0,220,255,0.95)";ctx.textAlign="center";
            ctx.fillText(bText,btX,btY+faceS*0.02);
            ctx.textAlign="left";ctx.globalAlpha=1;
          }

          ctx.restore();
        }
        if(f>=mf){lm.active=false;lm.frame=0;}
      }

                  // Corner brackets
      const bL=30;ctx.strokeStyle="rgba(255,0,255,0.1)";ctx.lineWidth=1;
      [[5,bL+5,5,5,bL+5,5],[W-bL-5,5,W-5,5,W-5,bL+5],[5,H-bL-5,5,H-5,bL+5,H-5],[W-bL-5,H-5,W-5,H-5,W-5,H-bL-5]]
        .forEach(([x1,y1,x2,y2,x3,y3])=>{ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.lineTo(x3,y3);ctx.stroke()});
      // Broadcast alien stats
      if(f%30===0&&onAlienUpdateRef.current){
        onAlienUpdateRef.current(alienRef.current.map(a=>({
          name:a.name,kills:a.kills,tier:a.tier,state:a.state,color:a.color,
          weapon:ALIEN_TIERS[a.tier]?.weapon||"LASER",
          nextTier:ALIEN_TIERS[a.tier+1]||null,
        })));
      }
     }catch(err){
      // ═══ CRASH RECOVERY FAILSAFE ═══
      console.error("[BATTLEFIELD] 💥 Render crash caught:",err.message);
      // Reset canvas state (unwind any ctx.save calls)
      try{ctx.restore();ctx.restore();ctx.restore()}catch(e){}
      ctx.globalAlpha=1;ctx.shadowBlur=0;ctx.textAlign="left";
      const now3=Date.now();
      if(now3-lastCrashTime<10000)crashCount++;else crashCount=1;
      lastCrashTime=now3;
      // If crashing repeatedly, kill J-Ai-C (most likely culprit)
      if(crashCount>=3){
        console.warn("[BATTLEFIELD] ⚠ 3+ crashes in 10s — disabling J-Ai-C Dreadnought");
        const jcr=jcRef.current;jcr.active=false;jcr.bills=[];jcr.phase="idle";
        crashCount=0;
      }
     }
      raf=requestAnimationFrame(draw)}
    draw();return()=>cancelAnimationFrame(raf)},[]);

  const handleClick=useCallback(e=>{
    const canvas=canvasRef.current;if(!canvas)return;
    const rect=canvas.getBoundingClientRect();
    const mx=(e.clientX-rect.left)/rect.width,my=(e.clientY-rect.top)/rect.height;
    // Light mode checkbox — top right
    if(mx>0.82&&mx<0.98&&my>0.06&&my<0.12){
      if(!lightModeRef.current.active){lightModeRef.current={active:true,frame:0,maxFrames:180};}
      return;
    }
    // Moon click detection
    const moonCx=0.5,moonCy=0.07;
    const dist=Math.sqrt((mx-moonCx)**2+(my-moonCy)**2);
    // Moon click — reserved for future interaction
    // if(dist<0.05){onMenuRef.current?.();return}
    let closest=null,cd=Infinity;
    tokensRef.current.forEach(t=>{if(!t.alive||t.warpIn||t.laserIn)return;
      const d=Math.sqrt((t.bx-mx)**2+(t.by-my)**2);if(d<cd&&d<0.06){cd=d;closest=t}});
    onSelectRef.current?.(closest||null)},[]);

  return <canvas ref={canvasRef} onClick={handleClick} style={{width:"100%",height:"100%",display:"block",cursor:"crosshair",
    background:"linear-gradient(180deg,rgba(10,5,25,1) 0%,rgba(5,3,14,1) 50%,rgba(20,5,15,1) 100%)",borderRadius:6}}/>;
}

function KillFeed({events,onSelectByName}){
  const colorMap={rug:NEON.red,moon:NEON.yellow,deploy:NEON.cyan,migration:"#39ff14",lock:NEON.yellow,system:NEON.purple,whale:"#ffd740",dolphin:"#00d4ff"};
  const glowMap={rug:"#ff073a",moon:"#ffe600",deploy:"#00ffff",migration:"#39ff14",lock:"#ffd740",system:"#bf00ff",whale:"#ffd740",dolphin:"#00d4ff"};
  const [current,setCurrent]=React.useState(null);
  const queueRef=React.useRef([]);
  const timerRef=React.useRef(null);
  const processedRef=React.useRef(new Set());
  const DISPLAY_MS=7000;

  const showNext=React.useCallback(()=>{
    if(queueRef.current.length===0){setCurrent(null);timerRef.current=null;return;}
    const next=queueRef.current.shift();
    setCurrent(next);
    timerRef.current=setTimeout(showNext,DISPLAY_MS);
  },[]);

  React.useEffect(()=>{
    const quality=events.filter(e=>["whale","dolphin","system","moon","migration"].includes(e.type));
    const fresh=quality.filter(e=>{
      const key=(e._ts||0)+e.text;
      if(processedRef.current.has(key))return false;
      processedRef.current.add(key);
      return true;
    });
    if(fresh.length===0)return;
    queueRef.current.push(...fresh);
    if(!timerRef.current)showNext();
  },[events,showNext]);

  React.useEffect(()=>()=>{if(timerRef.current)clearTimeout(timerRef.current);},[]);

  if(!current)return null;
  const c=colorMap[current.type]||NEON.cyan;
  const g=glowMap[current.type]||"#00ffff";
  return(
    <div style={{position:"absolute",top:0,left:0,right:0,zIndex:15,pointerEvents:"none",overflow:"hidden",
      height:"10%",minHeight:36,
      background:"linear-gradient(180deg,rgba(2,1,8,0.97) 0%,rgba(4,2,14,0.92) 60%,rgba(5,3,14,0.6) 85%,transparent 100%)",
      borderRadius:"6px 6px 0 0"}}>
      <div style={{position:"absolute",left:0,top:0,bottom:0,width:50,
        background:"linear-gradient(90deg,rgba(2,1,8,0.98),transparent)",zIndex:2,pointerEvents:"none"}}/>
      <div style={{position:"absolute",right:0,top:0,bottom:0,width:50,
        background:"linear-gradient(270deg,rgba(2,1,8,0.98),transparent)",zIndex:2,pointerEvents:"none"}}/>
      <div key={current._ts+current.text} style={{position:"absolute",top:"50%",transform:"translateY(-50%)",
        whiteSpace:"nowrap",animation:`kfRTL ${DISPLAY_MS}ms linear both`,pointerEvents:"auto"}}
      >
        <span style={{fontSize:13,fontWeight:900,letterSpacing:1.5,fontFamily:"'Orbitron',sans-serif",
          color:c,textShadow:`0 0 6px ${g}, 0 0 16px ${g}40`,opacity:0.92,
          cursor:current.name?"pointer":"default",paddingLeft:8}}
          onClick={()=>{if(current.name&&onSelectByName)onSelectByName(current.name);}}
        >{current.text}</span>
      </div>
    </div>
  );
}

function IntelPanel({token,onLock,onClose}){
  if(!token)return null;
  const stats=[
    {l:"MCAP",v:"$"+formatNum(token.mcap),c:NEON.cyan},{l:"VOL",v:"$"+formatNum(token.vol),c:NEON.yellow},
    {l:"ATH",v:"$"+formatNum(token.athMcap||token.mcap),c:"#ffd740"},
    {l:"START",v:"$"+formatNum(token.startMcap||0),c:NEON.dimText},
    {l:"HOLDERS",v:token.holders,c:token.holders>100?NEON.green:NEON.red},
    {l:"DEV%",v:token.devWallet.toFixed(1)+"%",c:token.devWallet>15?NEON.red:NEON.green},
    {l:"B/S",v:`${token.buys}/${token.sells}`,c:NEON.text},
    {l:"QUAL",v:token.qualScore+"/8",c:NEON.green},
  ];
  const edgeStats=[
    {l:"👻 FRESH",v:(token.freshPct||0)+"%",c:(token.freshPct||0)>75?NEON.red:(token.freshPct||0)<50?NEON.green:NEON.yellow},
    {l:"⚡ VEL",v:(token.velocity||0)+"/30s"+(token.accelerating?" ↑":""),c:token.accelerating?NEON.green:NEON.dimText},
    {l:"🐟 RETAIL",v:(token.smallBuyRatio||0)+"%",c:(token.smallBuyRatio||0)>50?NEON.green:NEON.orange},
    {l:"💎 RETAIN",v:(token.retentionPct||0)+"%",c:(token.retentionPct||0)>60?NEON.green:NEON.red},
    {l:"🏷 DEPLOY",v:(token.deployerGrade||"?")+` (${token.deployerLaunches||0})`,
      c:token.deployerGrade==="A"?NEON.green:token.deployerGrade==="B"?NEON.cyan:
        token.deployerGrade==="C"?NEON.orange:NEON.red},
    ...(token.isSerialRugger?[{l:"🏴‍☠️",v:`SERIAL RUGGER (${token.deployerRugs})`,c:"#ff073a"}]:[]),
    {l:"😴 STALE",v:(token.staleSec||0)+"s",c:token.isDead?NEON.red:token.isStale?"#ff6600":NEON.green},
    ...(token.bundleDetected?[{l:"⚠ BUNDLE",v:`${token.bundleSize||"?"}w`,c:NEON.red}]:[]),
    ...(token.hasSmartMoney?[{l:"🧠 SMART$",v:`${token.smartWalletCount||1} wallets`,c:"#ff9500"}]:[]),
    ...(token.narrativeMatch?[{l:"🔥 TREND",v:token.narrativeWord||"trending",c:NEON.pink}]:[]),
    ...(token.sellDumping?[{l:"📉 DUMP",v:"ACTIVE",c:NEON.red}]:[]),
    ...(token.liquidity>0?[{l:"💧 LIQ",v:"$"+formatNum(token.liquidity),c:NEON.cyan}]:[]),
    ...(token.mintAuth!==undefined?[{l:"🔑 MINT",v:token.mintAuth?"⚠ YES":"✓ NO",c:token.mintAuth?NEON.red:NEON.green}]:[]),
    ...(token.frozen?[{l:"❄ FROZEN",v:"YES",c:NEON.red}]:[]),
    ...(token.timeTo10k>0?[{l:"⏱ 10K",v:(token.timeTo10k/1000).toFixed(0)+"s",c:token.timeTo10k<120000?NEON.green:NEON.dimText}]:[]),
  ];
  return(
    <div style={{position:"absolute",bottom:0,left:0,right:0,
      background:"linear-gradient(180deg,rgba(5,3,14,0.92),rgba(10,5,20,0.98))",
      borderTop:`1px solid ${token.threatColor}25`,padding:"10px 16px",backdropFilter:"blur(12px)",zIndex:20,
      boxShadow:`0 -4px 20px rgba(0,0,0,0.5)`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <span style={{color:token.threatColor,fontSize:16,fontWeight:900,fontFamily:"'Orbitron',sans-serif",
            letterSpacing:2}}>◉ {token.name}</span>
          <span style={{fontSize:14,color:PLATFORM_COLORS[token.platform]||NEON.dimText,background:"rgba(255,255,255,0.04)",padding:"2px 10px",
            borderRadius:10,border:`1px solid ${(PLATFORM_COLORS[token.platform]||NEON.dimText)}30`,fontWeight:600}}>{token.platform}</span>
          <span onClick={()=>{navigator.clipboard.writeText(token.addr)}} style={{fontSize:14,color:NEON.cyan,cursor:"pointer",
            background:"rgba(0,255,255,0.06)",padding:"2px 8px",borderRadius:10,border:"1px solid rgba(0,255,255,0.12)",
            letterSpacing:0.5}} title={token.addr}>📋 {formatAddr(token.addr)}</span>
          {token.bundleDetected&&<span style={{fontSize:12,color:NEON.red,fontWeight:700}}>⚠ BUNDLE:{token.bundleSize}</span>}
          {token.migrated&&<span style={{fontSize:12,color:NEON.green,fontWeight:700,background:"rgba(57,255,20,0.1)",
            padding:"1px 6px",borderRadius:6,border:"1px solid rgba(57,255,20,0.2)"}}>🌉 MIGRATED</span>}
        </div>
        <div style={{display:"flex",gap:6}}>
          <button onClick={()=>onLock(token)} style={{background:`linear-gradient(135deg,${NEON.yellow}18,${NEON.yellow}08)`,
            border:`1px solid ${NEON.yellow}30`,color:NEON.yellow,padding:"5px 14px",borderRadius:6,cursor:"pointer",
            fontFamily:"'Share Tech Mono',monospace",fontSize:16,letterSpacing:1}}>🎯 LOCK</button>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",
            color:NEON.dimText,padding:"5px 10px",borderRadius:6,cursor:"pointer",fontFamily:"'Share Tech Mono',monospace",fontSize:16}}>✕</button>
        </div></div>
      <div style={{display:"flex",gap:4,marginBottom:5,flexWrap:"wrap"}}>
        {token.qualChecks?.map((ch,i)=>(
          <span key={i} style={{fontSize:16,padding:"2px 6px",borderRadius:10,
            background:ch.pass?"rgba(57,255,20,0.06)":"rgba(255,7,58,0.06)",
            color:ch.pass?NEON.green:NEON.red,border:`1px solid ${ch.pass?"rgba(57,255,20,0.12)":"rgba(255,7,58,0.12)"}`}}>
            {ch.pass?"✓":"✗"} {ch.name}</span>))}
      </div>
      <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
        {stats.map(s=>(<div key={s.l}><div style={{fontSize:16,color:NEON.dimText,letterSpacing:1.5}}>{s.l}</div>
          <div style={{fontSize:16,color:s.c,fontWeight:700}}>{s.v}</div></div>))}
      </div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:5,paddingTop:4,borderTop:"1px solid rgba(255,255,255,0.04)"}}>
        {edgeStats.map(s=>(<div key={s.l}><div style={{fontSize:12,color:NEON.dimText,letterSpacing:1}}>{s.l}</div>
          <div style={{fontSize:16,color:s.c,fontWeight:700}}>{s.v}</div></div>))}
      </div>
    </div>);
}

function TargetLockList({lockedTokens,onRemove,onSelect}){
  return(<div style={{display:"flex",flexDirection:"column",gap:3}}>
    {lockedTokens.length===0&&<div style={{color:NEON.dimText,fontSize:12,textAlign:"center",padding:12,fontStyle:"italic"}}>NO TARGETS</div>}
    {lockedTokens.map(t=>{
      const pd=t.lockPrice>0?((t.mcap-t.lockPrice)/t.lockPrice*100):0;const rugging=pd<-40,mooning=pd>80;
      let st="⏳ TRACK",sc=NEON.cyan;
      if(mooning){st="🚀 MOON";sc=NEON.green}else if(pd>-20){st="✅ HOLD";sc=NEON.green}
      else if(rugging){st="💀 RUG";sc=NEON.red}else{st="⚠ SLIP";sc=NEON.orange}
      return(<div key={t.id} style={{padding:"6px 10px",borderRadius:6,fontSize:12,
        background:`linear-gradient(135deg,${rugging?"rgba(255,7,58,0.05)":mooning?"rgba(57,255,20,0.05)":"rgba(0,255,255,0.03)"},transparent)`,
        borderLeft:`2px solid ${sc}`,border:`1px solid ${sc}10`,position:"relative"}}>
        <button onClick={()=>onRemove(t.id)} style={{position:"absolute",top:4,right:6,background:"rgba(255,7,58,0.1)",border:"1px solid rgba(255,7,58,0.25)",
          color:NEON.red,cursor:"pointer",fontSize:11,opacity:0.8,padding:"2px 6px",borderRadius:4,fontWeight:700,fontFamily:"'Orbitron',sans-serif"}}
          onMouseOver={e=>{e.target.style.background="rgba(255,7,58,0.3)";e.target.style.opacity="1"}}
          onMouseOut={e=>{e.target.style.background="rgba(255,7,58,0.1)";e.target.style.opacity="0.8"}}
          title="Unlock target">UNLOCK</button>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingRight:16}}>
          <span style={{color:NEON.text,fontWeight:700,fontSize:16}}><span onClick={()=>onSelect&&onSelect(t)} style={{cursor:"pointer",textDecoration:"underline",textDecorationStyle:"dotted",textUnderlineOffset:3}}>{t.name}</span>
            {t.autoLocked?<span style={{fontSize:10,color:NEON.yellow,background:"rgba(255,215,64,0.1)",padding:"1px 4px",
              borderRadius:3,marginLeft:5,verticalAlign:"middle",border:"1px solid rgba(255,215,64,0.2)"}}>AUTO</span>
            :<span style={{fontSize:10,color:NEON.cyan,background:"rgba(0,255,255,0.1)",padding:"1px 4px",
              borderRadius:3,marginLeft:5,verticalAlign:"middle",border:"1px solid rgba(0,255,255,0.2)"}}>PIN</span>}
            <span onClick={(e)=>{e.stopPropagation();navigator.clipboard.writeText(t.addr);const el=e.target;el.textContent="✓ COPIED";el.style.color=NEON.green;setTimeout(()=>{el.textContent="📋 CA";el.style.color=NEON.cyan},1200)}}
              style={{cursor:"pointer",marginLeft:6,fontSize:16,color:NEON.cyan,opacity:0.7,letterSpacing:0.5}} title={t.addr}>📋 CA</span></span>
          <span style={{color:sc,fontWeight:700,fontSize:14}}>{st} <span style={{color:NEON.dimText,fontWeight:400,fontSize:10}}>{Math.floor((Date.now()-(t.lockTime||Date.now()))/1000)}s</span></span></div>
        <div style={{display:"flex",gap:6,marginTop:2,color:NEON.dimText,fontSize:14}}>
          <span style={{color:pd>=0?NEON.green:NEON.red,fontWeight:700}}>{pd>=0?"+":""}{pd.toFixed(1)}%</span>
          <span>MC:<span style={{color:NEON.cyan}}>${formatNum(t.mcap)}</span></span>
          <span>{t.holders}h</span>
          <span style={{color:t.buys>t.sells?NEON.green:NEON.red}}>{t.buys}B/{t.sells}S</span>
          <span style={{color:PLATFORM_COLORS[t.platform]||NEON.dimText}}>{t.platform}</span>
          {t.accelerating&&<span style={{color:NEON.green}}>⚡</span>}
          {t.sellDumping&&<span style={{color:NEON.red}}>📉</span>}
          {t.isStale&&<span style={{color:NEON.orange}}>😴{t.staleSec||""}s</span>}</div>
        <div style={{height:2,background:"rgba(255,255,255,0.05)",borderRadius:1,marginTop:3}}>
          <div style={{height:"100%",borderRadius:1,transition:"width 0.5s",
            width:`${Math.max(0,Math.min(100,t.health||50))}%`,
            background:t.health>60?NEON.green:t.health>30?NEON.orange:NEON.red}}/></div>
      </div>)})}
  </div>);
}

// ═══════════════ WAR LOG ═══════════════
function WarLog({events}){
  function timeAgo(ts){const s=Math.floor((Date.now()-ts)/1000);if(s<60)return`${s}s ago`;return`${Math.floor(s/60)}m ago`}
  return(
    <div style={{display:"flex",flexDirection:"column",gap:1,padding:"4px 6px"}}>
      {events.length===0&&<div style={{color:NEON.dimText,fontSize:12,textAlign:"center",padding:20,fontStyle:"italic"}}>MONITORING...</div>}
      {events.map((e,i)=>(
        <div key={e.id} style={{padding:"8px 10px",borderRadius:5,fontSize:12,lineHeight:1.4,
          background:e.priority==="HIGH"?`${e.color}08`:"transparent",
          borderLeft:`2px solid ${e.color}${e.priority==="HIGH"?"60":"25"}`,
          animation:i===0?"slideIn 0.3s ease-out":"none",transition:"opacity 0.3s",
          opacity:i<3?1:i<8?0.7:0.4}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:6}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:2}}>
                <span style={{fontSize:14}}>{e.icon}</span>
                <span style={{fontSize:14,fontWeight:700,color:e.color,letterSpacing:1,textTransform:"uppercase"}}>{e.type.replace("_"," ")}</span>
                {e.priority==="HIGH"&&<span style={{fontSize:16,color:NEON.red,fontWeight:900,background:"rgba(255,7,58,0.1)",
                  padding:"1px 5px",borderRadius:3,border:"1px solid rgba(255,7,58,0.15)"}}>HIGH</span>}
              </div>
              <div style={{color:NEON.text,fontSize:12,opacity:0.85}}>{e.text}</div>
            </div>
            <span style={{fontSize:16,color:NEON.dimText,flexShrink:0,marginTop:2}}>{timeAgo(e.timestamp)}</span>
          </div>
        </div>
      ))}
    </div>);
}

function AlienHUD({aliens}){
  if(!aliens||aliens.length===0)return null;
  const TIER_LABELS=["LASER","RAPID FIRE","TWIN LASER","PLASMA CANNON","MULTI-SHOT","NUKE"];
  return(
    <div style={{position:"absolute",top:40,right:6,display:"flex",flexDirection:"column",gap:4,
      zIndex:12,pointerEvents:"none",width:160}}>
      {aliens.map((a,i)=>{
        const pct=a.nextTier?Math.min(100,((a.kills-(a.tier>0?[0,30,70,120,180,250][a.tier]:0))/
          (a.nextTier.kills-[0,30,70,120,180,250][a.tier]))*100):100;
        const maxed=!a.nextTier;
        return(
          <div key={i} style={{background:"rgba(5,3,14,0.85)",backdropFilter:"blur(8px)",
            border:`1px solid ${a.color}50`,borderTop:`2px solid ${a.color}`,
            clipPath:"polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,10px 100%,0 calc(100% - 10px))",
            padding:"6px 8px",position:"relative",overflow:"hidden"}}>
            {/* Top accent bar */}
            <div style={{position:"absolute",top:0,left:0,width:"40%",height:2,background:`linear-gradient(90deg,${a.color},transparent)`}}/>
            <div style={{position:"absolute",top:0,right:10,width:"20%",height:2,background:`linear-gradient(90deg,transparent,${a.color}60)`}}/>
            {/* Diagonal hash marks */}
            <div style={{position:"absolute",bottom:3,left:6,display:"flex",gap:2}}>
              {[...Array(Math.min(a.tier+1,6))].map((_,j)=>(
                <div key={j} style={{width:4,height:8,background:a.color,opacity:0.4,transform:"skewX(-20deg)"}}/>
              ))}
            </div>
            {/* Ship name + status */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
              <span style={{fontSize:9,fontWeight:900,color:a.color,fontFamily:"'Orbitron',sans-serif",
                letterSpacing:1.5,textShadow:`0 0 8px ${a.color}50`}}>{a.name}</span>
              <span style={{fontSize:7,color:a.state==="shooting"?"#ff073a":a.state==="hunting"?"#ffe600":"#39ff14",
                fontWeight:700,letterSpacing:1,
                animation:a.state==="shooting"?"none":"none"}}>
                {a.state==="shooting"?"FIRING":a.state==="hunting"?"HUNTING":"PATROL"}</span>
            </div>
            {/* Stats row */}
            <div style={{display:"flex",gap:10,marginBottom:4}}>
              <div>
                <div style={{fontSize:6,color:NEON.dimText,letterSpacing:1.5}}>KILLS</div>
                <div style={{fontSize:14,fontWeight:900,color:a.color,fontFamily:"'Orbitron',sans-serif",
                  textShadow:`0 0 10px ${a.color}40`}}>{a.kills}</div>
              </div>
              <div>
                <div style={{fontSize:6,color:NEON.dimText,letterSpacing:1.5}}>TIER</div>
                <div style={{fontSize:14,fontWeight:900,color:NEON.text,fontFamily:"'Orbitron',sans-serif"}}>{a.tier+1}/6</div>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:6,color:NEON.dimText,letterSpacing:1.5}}>WEAPON</div>
                <div style={{fontSize:9,fontWeight:700,color:maxed?"#ffd740":NEON.text,
                  letterSpacing:0.5}}>{a.weapon}{maxed?" ★":""}</div>
              </div>
            </div>
            {/* Progress bar to next tier */}
            {!maxed?(
              <div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                  <span style={{fontSize:6,color:NEON.dimText}}>NEXT: {a.nextTier?.weapon}</span>
                  <span style={{fontSize:6,color:a.color}}>{a.nextTier?.kills-a.kills} kills</span>
                </div>
                <div style={{height:3,background:"rgba(255,255,255,0.06)",borderRadius:2,overflow:"hidden"}}>
                  <div style={{height:"100%",width:pct+"%",borderRadius:2,
                    background:`linear-gradient(90deg,${a.color}90,${a.color})`,
                    boxShadow:`0 0 6px ${a.color}60`,
                    transition:"width 0.3s ease"}}/>
                </div>
              </div>
            ):(
              <div style={{fontSize:7,color:"#ffd740",fontWeight:700,textAlign:"center",letterSpacing:2,
                textShadow:"0 0 10px rgba(255,215,64,0.3)"}}>★ MAX LEVEL ★</div>
            )}
          </div>
        );
      })}
    </div>);
}

// ═══════════════ MAIN ═══════════════
export default function DegenCommandCenter(){
  const [tokens,setTokens]=useState([]);const [radarPings,setRadarPings]=useState([]);
  const [lockedTokens,setLockedTokens]=useState([]);const [scanLine,setScanLine]=useState(0);
  const [totalScanned,setTotalScanned]=useState(0);const [deployed,setDeployed]=useState(0);
  const [rejected,setRejected]=useState(0);
  const [alienStats,setAlienStats]=useState([]);
  // ═══ NEW FEATURE STATE ═══
  const correspondentRef=useRef({queue:[],_lastId:0});
  const [corrDisplay,setCorrDisplay]=useState({visible:false,msg:"",mood:"idle"});
  const comboRef=useRef({count:0,lastEvent:0,peak:0});
  const [comboDisplay,setComboDisplay]=useState(0);
  const deployerRepRef=useRef({}); // {deployer_addr: {launches:N,rugs:N,runners:N,tokens:[]}}
  const whaleTriggerRef=useRef(false); // shared: App sets true, BattlefieldMap reads & spawns
  const dolphinTriggerRef=useRef(false);
  const sessionBestAppRef=useRef({id:null,name:"",mcap:0});
  useEffect(()=>{tokens.forEach(t=>{if(t.alive&&(t.mcap||0)>sessionBestAppRef.current.mcap){sessionBestAppRef.current={id:t.id,name:t.name,mcap:t.mcap};}});},[tokens]); // same pattern for dolphin pods
  const [filter,setFilter]=useState("ALL");const [selectedToken,setSelectedToken]=useState(null);
  const [radarTab,setRadarTab]=useState("RADAR");
  const selectToken=(t)=>{setSelectedToken(t);};
  const addLockHistoryEvent=(addr,name,type,reason,data={})=>{
    setLockHistory(prev=>{
      const existing=prev.find(h=>h.addr===addr);
      const evt={type,reason,time:Date.now(),...data};
      if(existing){
        return prev.map(h=>h.addr===addr?{...h,name:name||h.name,events:[evt,...h.events].slice(0,20)}:h);
      }
      return[{addr,name,events:[evt]},...prev].slice(0,200);
    });
  };
  const clickAddr=(addr,stub=null)=>{const t=tokens.find(x=>x.addr===addr);if(t){setSelectedToken(t);}else if(stub){setSelectedToken({...stub,addr,alive:false,health:0,threat:"DEAD",threatColor:"#5a5a7a",qualChecks:[],devWallet:0,buys:stub.buys||0,sells:stub.sells||0});}};
  const selectByName=(name,stub=null)=>{const t=tokens.find(x=>x.name===name);if(t){setSelectedToken(t);}else if(stub){setSelectedToken({...stub,alive:false,health:0,threat:"DEAD",threatColor:"#5a5a7a",qualChecks:[],devWallet:0,buys:stub.buys||0,sells:stub.sells||0});}};
  const viewWalletDetail=(walletAddr)=>{setLeftTab("REPORT");setSelectedWallet(walletAddr);setReportView("detail");};
  const [leftTab,setLeftTab]=useState("SCANNER");
  const [showMenu,setShowMenu]=useState(false);
  const [intelEvents,setIntelEvents]=useState([]);
  const [migrations,setMigrations]=useState([]);
  const [rightTab,setRightTab]=useState("LOCKS");
  const [graveyard,setGraveyard]=useState([]);
  const [lockHistory,setLockHistory]=useState([]);
  const lockHistoryRef=useRef([]);
  useEffect(()=>{lockHistoryRef.current=lockHistory},[lockHistory]);
  const [historyDetail,setHistoryDetail]=useState(null);
  const [aiObservations,setAiObservations]=useState([]);
  const aiDataRef=useRef({lockCount:0,ejectCount:0,smartAlerts:0,migrations:0,
    lockOutcomes:[],avgHoldTime:0,bestLock:null,worstLock:null,
    ejectReasons:{},scoreAccuracy:[],lastAnalysis:0}); // [{addr,name,events:[{type,reason,time,mcap,score,...}]}]
  const sessionDeathsRef=useRef(0);
  const [sessionReports,setSessionReports]=useState([]);
  const [reportView,setReportView]=useState("tiers"); // "tiers" | "list" | "detail"
  const [reportTier,setReportTier]=useState(null);
  const [selectedWallet,setSelectedWallet]=useState(null);
  const sessionStartRef=useRef(Date.now());
  const lastReportRef=useRef(0);
  const lockOutcomesRef=useRef([]);
  // predictions + signals removed in v102c
  const mainTokensRef=useRef([]);
  const [killFeed,setKillFeed]=useState([
    {type:"system",text:"◈ COMMAND CENTER ONLINE — BATTLEFIELD ACTIVE ◈",_startup:true}]);
  const existingNames=useRef([]);
  const graveyardTokensRef=useRef([]);
  const setGraveyardRef=useRef(null);
  setGraveyardRef.current=setGraveyard;
  useEffect(()=>{graveyardTokensRef.current=tokens},[tokens]);
  const addKillFeed=useCallback(event=>{
    event._ts=Date.now();
    setKillFeed(p=>[event,...p.filter(e=>!e._startup)].slice(0,30));
    if(event.type==="rug"&&event.addr){
      setMigrations(p=>p.filter(m=>m.mint!==event.addr));
      const tok=graveyardTokensRef.current.find(t=>t.addr===event.addr);
      if(tok){
        setGraveyard(p=>{
          const newGrave=[{
            id:Date.now()+Math.random(),name:tok.name,addr:tok.addr,
            deployer:tok.deployer||"",
            mcap:tok.mcap||0,holders:tok.holders||0,
            buys:tok.buys||0,sells:tok.sells||0,
            cause:event.killer?`☠ ${event.killer}`:
              tok.isDead?"No trades 3m+":tok.sellDumping?"Dev dump":
              (tok.health||0)<=0?"Health depleted":"Unknown",
            lifespan:Math.round((Date.now()-(tok.timestamp||Date.now()))/1000),
            killer:event.killer||null,
            deployerGrade:tok.deployerGrade||"?",
            bundled:!!tok.bundleDetected,
            time:Date.now(),
          },...p].slice(0,50);
          sessionDeathsRef.current++;
          return newGrave;
        });
      }
    }
  },[]);

  // ═══ LIVE DATA ═══
  const live = useLiveData();

  // Pipe live tokens into state
  useEffect(() => {
    if (live.tokens.length > 0) {
      setTokens(live.tokens);
      mainTokensRef.current=live.tokens;
      setTotalScanned(live.stats.scanned);
      setDeployed(live.stats.deployed);
      setRejected(live.stats.rejected);
    }
  }, [live.tokens, live.stats]);

  useEffect(() => {
    if (live.whaleAlerts.length > 0) {
      const bigBuys=live.whaleAlerts.filter(w=>w.action==="BUY"&&!w._whaleTriggered);
      bigBuys.forEach(w=>{w._whaleTriggered=true;
        const sol=w.solAmount||0;
        if(sol>=50){
          // GOLDEN WHALE — 50+ SOL
          whaleTriggerRef.current={name:w.token||"???",sol,tier:"golden"};
          correspondentRef.current.queue.push({msg:`🐋✨ GOLDEN WHALE — ${sol.toFixed(1)} SOL MEGABUY on ${w.token}! Absolute unit.`,mood:"hype"});
        }else if(sol>=10){
          // TIERED WHALE — 10-49 SOL, 8 color tiers
          whaleTriggerRef.current={name:w.token||"???",sol,tier:"normal"};
          correspondentRef.current.queue.push({msg:`🐋 WHALE SPOTTED — ${sol.toFixed(1)} SOL buy on ${w.token}!`,mood:"hype"});
        }
        // 2-9 SOL buys tracked for dolphin cluster detection below
      });
    }
  }, [live.whaleAlerts]);

  // ═══ DOLPHIN POD DETECTION — cluster of small buys ═══
  const dolphinBuyBuffer=useRef([]);
  useEffect(()=>{
    if(live.whaleAlerts.length>0){
      const smallBuys=live.whaleAlerts.filter(w=>w.action==="BUY"&&(w.solAmount||0)>=3&&(w.solAmount||0)<10&&!w._dolphinChecked);
      smallBuys.forEach(w=>{w._dolphinChecked=true;
        dolphinBuyBuffer.current.push({name:w.token||"???",sol:w.solAmount||0,time:Date.now()});
      });
      // Check for cluster: 4+ small buys within 15 seconds
      const now=Date.now();
      dolphinBuyBuffer.current=dolphinBuyBuffer.current.filter(b=>now-b.time<10000);
      if(dolphinBuyBuffer.current.length>=8){
        const count=Math.min(dolphinBuyBuffer.current.length,8);
        const topToken=dolphinBuyBuffer.current[dolphinBuyBuffer.current.length-1].name;
        // Set trigger — BattlefieldMap will build the pod
        dolphinTriggerRef.current={count,tokenName:topToken};
        correspondentRef.current.queue.push({msg:`🐬 DOLPHIN POD — ${count} rapid buys detected on ${topToken}! The pod is feeding.`,mood:"hype"});
        dolphinBuyBuffer.current=[];
      }
    }
  },[live.whaleAlerts]);

  // Radar pings from real events
  useEffect(() => {
    if (live.migrations?.length > 0) setRadarPings(p=>[...p,{color:NEON.green,t:Date.now()}].slice(-50));
  }, [live.migrations?.length]);
  useEffect(() => {
    if (live.bundleAlerts?.length > 0) setRadarPings(p=>[...p,{color:NEON.red,t:Date.now()}].slice(-50));
  }, [live.bundleAlerts?.length]);
  useEffect(() => {
    if (live.smartMoneyAlerts?.length > 0) setRadarPings(p=>[...p,{color:"#ff9500",t:Date.now()}].slice(-50));
  }, [live.smartMoneyAlerts?.length]);
  useEffect(() => {
    if (lockedTokens.length > 0) setRadarPings(p=>[...p,{color:NEON.yellow,t:Date.now()}].slice(-50));
  }, [lockedTokens.length]);
  useEffect(() => {
    if (live.narratives?.length > 0) setRadarPings(p=>[...p,{color:NEON.pink,t:Date.now()}].slice(-50));
  }, [live.narratives?.length]);

  useEffect(() => {
    if (live.migrations.length > 0) setMigrations(prev=>{
      const merged=[...prev];
      live.migrations.forEach(nm=>{
        const idx=merged.findIndex(m=>m.mint===nm.mint);
        if(idx>=0){
          // MERGE fresh cur* fields from useLiveData's DexScreener polls
          const old=merged[idx];
          merged[idx]={...old,
            curMcap:nm.curMcap||old.curMcap,
            curHolders:nm.curHolders||old.curHolders,
            curVol:nm.curVol||old.curVol,
            curBuys:nm.curBuys!=null?nm.curBuys:old.curBuys,
            curSells:nm.curSells!=null?nm.curSells:old.curSells,
            lastDexUpdate:nm.lastDexUpdate||old.lastDexUpdate,
            rugScore:nm.rugScore||old.rugScore,
            rugLevel:nm.rugLevel||old.rugLevel,
            lpLocked:nm.lpLocked||old.lpLocked,
            rayTvl:nm.rayTvl||old.rayTvl,
            rayBurnPct:nm.rayBurnPct||old.rayBurnPct,
            rayVol24h:nm.rayVol24h||old.rayVol24h,
            rayFees24h:nm.rayFees24h||old.rayFees24h,
            geckoVol5m:nm.geckoVol5m||old.geckoVol5m,
            geckoChange5m:nm.geckoChange5m!=null?nm.geckoChange5m:old.geckoChange5m,
            geckoChange1h:nm.geckoChange1h!=null?nm.geckoChange1h:old.geckoChange1h,
            geckoReserve:nm.geckoReserve||old.geckoReserve,
          };
        } else {
          merged.unshift(nm);
        }
      });
      return merged.slice(0,20);
    });
  }, [live.migrations]);

  // ═══ MIGRATION → LOCK SYNC: Keep locks alive through migration ═══
  useEffect(() => {
    if (live.migrations.length === 0) return;
    setLockedTokens(p => {
      if (p.length === 0) return p;
      let changed = false;
      const updated = p.map(t => {
        // If this locked token just migrated, mark it so migGrace kicks in
        const mig = live.migrations.find(m => m.mint === t.addr);
        if (mig && !t.migrated) {
          changed = true;
          console.log(`[LOCK-MIGRATE] 🌉 ${t.name} migrated — preserving lock, grace period active`);
          return { ...t, migrated: true, migratedAt: Date.now(), health: 95, alive: true, isStale: false, isDead: false };
        }
        return t;
      });
      return changed ? updated : p;
    });
  }, [live.migrations]);

  // ═══ MIGRATION LIST MAINTENANCE — prune dumped + dead tokens ═══
  useEffect(()=>{
    const iv=setInterval(()=>{
      setMigrations(prev=>{
        if(prev.length===0)return prev;
        const now=Date.now();
        let changed=false;
        const updated=prev.map(m=>{
          const curMcap=m.curMcap||m.mcap;
          const age=(now-m.timestamp)/1000;

          // DUMP REMOVAL: mcap dropped below $5K or 75%+ drop from migration entry
          if(age>30&&curMcap<5000){changed=true;return null;}
          const pctDrop=m.mcap>0?((curMcap-m.mcap)/m.mcap*100):0;
          if(age>30&&pctDrop<-70){changed=true;return null;}
          // Stale removal: no updates in 2min and mcap falling
          if(age>120&&(!m.lastDexUpdate||(now-m.lastDexUpdate>120000))&&pctDrop<-20){changed=true;return null;}
          // COMPLETELY STALE: no data source has updated in 3min — bad data, remove
          if(age>60&&!m.lastDexUpdate&&!m.curMcap){changed=true;return null;}
          // Data exists but hasn't updated in 5min — remove (all sources dead)
          if(m.lastDexUpdate&&(now-m.lastDexUpdate>300000)){changed=true;return null;}

          const onBF=tokens.find(t=>t.addr===m.mint);
          if(onBF){
            if(m.dead){changed=true;return{...m,dead:false,lastSeen:now};}
            return m.lastSeen?m:{...m,lastSeen:now};
          }
          if(m.lastDexUpdate&&(now-m.lastDexUpdate<30000))return{...m,lastSeen:now};
          if(!m.lastSeen)return{...m,lastSeen:now};
          const goneSec=(now-m.lastSeen)/1000;
          if(goneSec>180){changed=true;return null;} // 3min gone = remove
          if(!m.dead){changed=true;return{...m,dead:true};}
          return m;
        }).filter(Boolean);
        return changed?updated:prev;
      });
    },4000);
    return()=>clearInterval(iv);
  },[tokens]);

  useEffect(() => {
    if (live.intelEvents.length > 0) setIntelEvents(live.intelEvents);
  }, [live.intelEvents]);

  // ═══ AI WAR CORRESPONDENT — reacts to big events ═══
  useEffect(()=>{
    const iv=setInterval(()=>{
      const cr=correspondentRef.current;
      const now=Date.now();
      // Process queue — show next message
      if(cr.queue.length>0){
        const age=now-(cr._showTime||0);
        if(!cr._showing||age>6000){
          const next=cr.queue.shift();
          cr._showing=true;cr._showTime=now;
          setCorrDisplay({visible:true,msg:next.msg,mood:next.mood});
        }
      } else if(cr._showing&&now-(cr._showTime||0)>6000){
        cr._showing=false;
        setCorrDisplay({visible:false,msg:"",mood:"idle"});
      }
    },500);
    return()=>clearInterval(iv);
  },[]);

  // Correspondent event triggers
  useEffect(()=>{
    const cr=correspondentRef.current;
    const pushMsg=(msg,mood)=>{cr.queue.push({msg,mood});if(cr.queue.length>4)cr.queue.shift()};
    tokens.forEach(t=>{
      if(t.mcap>=300000&&!t._corr300k){t._corr300k=true;pushMsg("🚨 "+t.name+" JUST HIT $300K — absolute MOONSHOT in progress!","hype")}
      if(t.mcap>=100000&&!t._corr100k){t._corr100k=true;pushMsg("⚡ "+t.name+" crossed $100K — this one has legs!","hype")}
    });
    const newBundles=tokens.filter(t=>t.bundleDetected&&t.bundleSize>=5&&!t._corrBundle);
    if(newBundles.length>0){newBundles.forEach(t=>{t._corrBundle=true});
      pushMsg("👀 Heavy bundle activity — "+newBundles.length+" token(s) with 5+ bundled wallets. Watch out.","sus")}
    if(graveyard.length>0){
      const recent=graveyard.filter(g=>Date.now()-g.time<10000);
      if(recent.length>=5&&!cr._massDeathTime){cr._massDeathTime=Date.now();
        pushMsg("💀 BLOODBATH — "+recent.length+" tokens wiped in 10 seconds. The aliens are feasting.","rip")}}
    if(migrations.length>0){
      const freshMig=migrations.find(m=>Date.now()-m.timestamp<5000&&!m._corrAnnounced);
      if(freshMig){freshMig._corrAnnounced=true;
        pushMsg("🌉 "+freshMig.name+" just GRADUATED to Raydium at $"+formatNum(freshMig.mcap)+" — tracking price.","hype")}}
    // Rugcheck warnings for migrated tokens
    migrations.forEach(m=>{
      if(m.rugLevel==="DANGER"&&!m._corrRugWarned){m._corrRugWarned=true;
        pushMsg("⚠️ "+m.name+" flagged DANGER by RugCheck — mint authority active, proceed with caution!","sus")}
      if(m.lpLocked&&!m._corrLPAnnounced){m._corrLPAnnounced=true;
        pushMsg("🔒 "+m.name+" has LOCKED LP — bullish signal, less likely to rug.","hype")}
    });
    // Cross-source trend alerts
    tokens.forEach(t=>{
      if(t.trendScore>=2&&!t._corrMultiTrend){t._corrMultiTrend=true;
        pushMsg("🔥🔥 "+t.name+" trending on MULTIPLE platforms — Gecko + Defined.fi + internal signals all firing!","hype")}
      if(t.bondingPct>90&&!t._corrBonding90){t._corrBonding90=true;
        pushMsg("🚀 "+t.name+" at "+t.bondingPct.toFixed(0)+"% bonding — seconds from MIGRATION! Watch closely.","alarm")}
      if(t.isKOTH&&!t._corrKOTH){t._corrKOTH=true;
        pushMsg("👑 "+t.name+" is KING OF THE HILL on pump.fun — top of the leaderboard!","hype")}
      if(t.liquidityRating==="PAPER"&&t.mcap>20000&&!t._corrPaperLiq){t._corrPaperLiq=true;
        pushMsg("⚠️ "+t.name+" has PAPER THIN liquidity — $5K sell = "+t.slippage5k?.toFixed(0)+"% slippage. Careful out there.","sus")}
      if(t.jupVerified&&!t._corrJupVerified){t._corrJupVerified=true;
        pushMsg("✅ "+t.name+" is Jupiter VERIFIED — passed their token screening.","hype")}
      if(t.activityLevel==="BLAZING"&&!t._corrBlazing){t._corrBlazing=true;
        pushMsg("🔥 "+t.name+" on-chain activity is BLAZING — "+t.recentTx5m+" transactions in the last 5 minutes!","hype")}
      if(t.rayBurnPct>95&&!t._corrBurn){t._corrBurn=true;
        pushMsg("🔥 "+t.name+" LP is "+t.rayBurnPct.toFixed(0)+"% BURNED — can't pull liquidity. Bullish.","hype")}
    });
  },[tokens,graveyard,migrations]);

  // ═══ COMBO SYSTEM — streaks of good events ═══
  useEffect(()=>{
    const cb=comboRef.current;
    const iv=setInterval(()=>{
      if(cb.count>0&&Date.now()-cb.lastEvent>4000){
        if(cb.count>=3)setComboDisplay(cb.count);
        cb.count=0;
        setTimeout(()=>setComboDisplay(0),2000);
      }
    },500);
    return()=>clearInterval(iv);
  },[]);

  // Combo triggers
  useEffect(()=>{
    const cb=comboRef.current;const now=Date.now();
    let fired=false;
    if(lockedTokens.length>0){
      const fresh=lockedTokens.find(l=>l.autoLocked&&now-l.lockTime<3000&&!l._comboFired);
      if(fresh){fresh._comboFired=true;cb.count++;cb.lastEvent=now;fired=true;}}
    if(migrations.length>0){
      const fresh=migrations.find(m=>now-m.timestamp<3000&&!m._comboFired);
      if(fresh){fresh._comboFired=true;cb.count++;cb.lastEvent=now;fired=true;}}
    if(live.smartMoneyAlerts?.length>0){
      const fresh=live.smartMoneyAlerts.find(a=>now-a.time<3000&&!a._comboFired);
      if(fresh){fresh._comboFired=true;cb.count++;cb.lastEvent=now;fired=true;}}
    if(fired){cb.peak=Math.max(cb.peak,cb.count);setComboDisplay(cb.count);}
  },[lockedTokens,migrations,live.smartMoneyAlerts]);

  // ═══ DEPLOYER REPUTATION TRACKING ═══
  useEffect(()=>{
    const rep=deployerRepRef.current;
    const cr=correspondentRef.current;
    tokens.forEach(t=>{
      if(!t.deployer||rep[t.deployer]?.tokens?.includes(t.addr))return;
      if(!rep[t.deployer])rep[t.deployer]={launches:0,rugs:0,runners:0,tokens:[]};
      rep[t.deployer].launches++;rep[t.deployer].tokens.push(t.addr);
    });
    graveyard.forEach(g=>{
      if(!g.deployer)return;
      const d=rep[g.deployer];
      if(d&&!d._rug?.includes(g.addr)){
        if(!d._rug)d._rug=[];d._rug.push(g.addr);d.rugs++;
        if(d.rugs>=3&&!d._warned){d._warned=true;
          cr.queue.push({msg:"⚠️ Serial rugger detected — deployer "+g.deployer.slice(0,6)+"... has "+d.rugs+" rugs this session!",mood:"sus"})}}
    });
    tokens.filter(t=>t.mcap>=50000).forEach(t=>{
      if(!t.deployer)return;const d=rep[t.deployer];
      if(d&&!d._run?.includes(t.addr)){if(!d._run)d._run=[];d._run.push(t.addr);d.runners++}
    });
    // Flag tokens from serial ruggers
    tokens.forEach(t=>{
      if(!t.deployer)return;const d=rep[t.deployer];
      if(d){
        t.deployerRugs=d.rugs||0;
        t.deployerLaunches=d.launches||0;
        t.isSerialRugger=d.rugs>=2;
        // Auto-assign grades based on session data
        if(d.rugs>=3)t.deployerGrade="F";
        else if(d.rugs>=2)t.deployerGrade="D";
        else if(d.runners>0)t.deployerGrade="A";
      }
    });
  },[tokens,graveyard]);


  // signals removed in v102c

  // ═══ LEADERBOARD — computed from live tokens ═══
  const leaderboard=useMemo(()=>{
    const alive=tokens.filter(t=>t.qualified&&t.mcap>0);
    const byMcap=[...alive].sort((a,b)=>(b.mcap||0)-(a.mcap||0)).slice(0,5);
    const byVelocity=[...alive].filter(t=>(t.velocity||0)>0).sort((a,b)=>(b.velocity||0)-(a.velocity||0)).slice(0,5);
    const byHolders=[...alive].sort((a,b)=>(b.holders||0)-(a.holders||0)).slice(0,5);
    return{byMcap,byVelocity,byHolders};
  },[tokens]);

  // Locked token price simulation (keep this - real price updates would need polling)
  // ═══ LOCKED TOKEN LIVE UPDATES + AUTO-REMOVE SOUR COINS ═══
  const tokensRef=useRef(tokens);
  useEffect(()=>{tokensRef.current=tokens},[tokens]);
  const pendingEjectsRef=useRef([]);
  useEffect(()=>{const iv=setInterval(()=>{
    const cur=tokensRef.current;
    pendingEjectsRef.current=[];
    setLockedTokens(p=>{
      if(p.length===0)return p;
      let changed=false;
      const removeIds=[];
      const updated=p.map(t=>{
        const live=cur.find(lt=>lt.addr===t.addr);
        if(!live){
          if(t.autoLocked&&(Date.now()-t.lockTime>30000)){
            changed=true;
            return{...t,_gone:true};
          }
          return t;
        }
        if(live.mcap===t.mcap&&live.holders===t.holders&&live.health===t.health&&live.buys===t.buys)return t;
        changed=true;
        return{...t,...live,locked:true,lockTime:t.lockTime,lockPrice:t.lockPrice,id:t.id,autoLocked:t.autoLocked};
      });
      // ─── AUTO-REMOVE: eject sour coins fast ───
      const kept=[];
      updated.forEach(t=>{
        if(t._gone){
          removeIds.push({id:t.id,addr:t.addr,name:t.name,reason:"DEAD — removed from battlefield",mcap:t.mcap||0,vol:t.vol||0});
          changed=true;return;
        }
        if(!t.autoLocked){
          const mAge=(Date.now()-t.lockTime)/1000;
          const mPct=t.lockPrice>0?((t.mcap-t.lockPrice)/t.lockPrice*100):0;
          if(mAge>30&&t.mcap<3000){removeIds.push({id:t.id,addr:t.addr,name:t.name,reason:`NUKED (${formatNum(t.mcap)})`,mcap:t.mcap||0,vol:t.vol||0});changed=true;return}
          if(mAge>30&&mPct<-70){removeIds.push({id:t.id,addr:t.addr,name:t.name,reason:`DUMPED ${mPct.toFixed(0)}% from lock`,mcap:t.mcap||0,vol:t.vol||0});changed=true;return}
          if(t.health!==undefined&&t.health<=5){removeIds.push({id:t.id,addr:t.addr,name:t.name,reason:`FLATLINED (${Math.round(t.health)}% health)`,mcap:t.mcap||0,vol:t.vol||0});changed=true;return}
          kept.push(t);return
        }
        const migGrace=t.migrated&&t.migratedAt&&(Date.now()-t.migratedAt<300000);
        if(migGrace){kept.push(t);return}
        const age=(Date.now()-t.lockTime)/1000;
        const pctChange=t.lockPrice>0?((t.mcap-t.lockPrice)/t.lockPrice*100):0;
        let eject=false,reason="";

        if(t.isDead){eject=true;reason="DEAD (no trades 3m+)"}
        else if(t.health!==undefined&&t.health<=10){eject=true;reason=`HEALTH CRITICAL (${Math.round(t.health)}%)`}
        else if(t.sellDumping&&pctChange<-10){eject=true;reason="SELL DUMP + price dropping"}

        if(!eject&&age>15){
          if(t.isStale&&pctChange<0){eject=true;reason=`STALE ${t.staleSec||60}s + negative`}
          else if(pctChange<-25){eject=true;reason=`CRASHED ${pctChange.toFixed(0)}% from lock`}
          else if(t.health!==undefined&&t.health<=25&&pctChange<-5){eject=true;reason=`LOW HEALTH (${Math.round(t.health)}%) + dropping`}
          else if(t.mcap<5000){eject=true;reason=`MCAP BELOW $5K ($${formatNum(t.mcap)})`}
        }

        if(!eject&&age>45){
          if(pctChange<-10){eject=true;reason=`DOWN ${pctChange.toFixed(0)}% after 45s`}
          else if(t.buys<=t.sells&&t.buys>0){eject=true;reason="SELL PRESSURE exceeds buys"}
          else if(t.mcap<8000){eject=true;reason=`WEAK MCAP ($${formatNum(t.mcap)}) after 45s`}
        }

        if(!eject&&age>120){
          if(pctChange<-5){eject=true;reason=`STAGNANT — ${pctChange.toFixed(0)}% after 2min`}
        }

        if(eject){
          removeIds.push({id:t.id,addr:t.addr,name:t.name,reason,mcap:t.mcap||0,vol:t.vol||0});
          changed=true;
        }else{kept.push(t)}
      });
      if(!changed)return p;
      kept.sort((a,b)=>(b.mcap||0)-(a.mcap||0));
      const manual=kept.filter(t=>!t.autoLocked);
      const auto=kept.filter(t=>t.autoLocked);
      const pruned=auto.slice(4);
      pruned.forEach(t=>{removeIds.push({id:t.id,addr:t.addr,name:t.name,reason:"OUTRANKED (below top 4)",mcap:t.mcap||0,vol:t.vol||0})});
      // Store ejects in ref so they can be processed after setState
      pendingEjectsRef.current=removeIds;
      return[...manual,...auto.slice(0,4)].sort((a,b)=>(b.mcap||0)-(a.mcap||0));
    });
    // Process pending ejects on next tick (after React has run the updater)
    setTimeout(()=>{
      const ejects=pendingEjectsRef.current;
      if(ejects.length>0){
        ejects.forEach(r=>{
          autoLockedIds.current.set(r.addr,{ejectTime:Date.now(),mcapAtEject:r.mcap||0,volAtEject:r.vol||0});
          console.log("[HISTORY] UNLOCK logged:",r.name,"—",r.reason);
          addLockHistoryEvent(r.addr,r.name,"UNLOCK",r.reason,{mcap:r.mcap||0});
          const _lh=lockHistoryRef.current.find(h=>h.addr===r.addr);
          const _le=_lh?.events?.find(e=>e.type==="LOCK");
          lockOutcomesRef.current.push({addr:r.addr,name:r.name,lockMcap:_le?.mcap||0,lockTime:_le?.time||Date.now(),lockScore:_le?.score||0,finalMcap:r.mcap||0,outcome:r.reason,holdTime:Date.now()-(_le?.time||Date.now()),pctChange:_le?.mcap>0?((r.mcap-_le.mcap)/_le.mcap*100):0});
          if(lockOutcomesRef.current.length>200)lockOutcomesRef.current=lockOutcomesRef.current.slice(-200);
          setIntelEvents(p=>[{
            id:Date.now()+Math.random(),type:"eject",icon:"🚫",color:NEON.red,
            text:`AUTO-EJECTED ${r.name} — ${r.reason}`,
            timestamp:Date.now(),priority:"HIGH",
          },...p].slice(0,40));
          addKillFeed({type:"eject",name:r.name,text:`🚫 ${r.name} EJECTED — ${r.reason}`});
        });
        console.log(`[AUTO-EJECT] Removed ${ejects.length}: ${ejects.map(r=>r.name+" ("+r.reason+")").join(", ")}`);
        pendingEjectsRef.current=[];
      }
    },0);
  },2000);return()=>clearInterval(iv)},[]);


  // ═══ CLAUDE ANALYSIS ENGINE — pattern detection, pipes to marquee + log ═══
  useEffect(()=>{const iv=setInterval(()=>{
    const ad=aiDataRef.current;
    const now=Date.now();
    if(now-ad.lastAnalysis<30000)return;
    ad.lastAnalysis=now;
    const obs=[];
    const cr=correspondentRef.current;
    const pushObs=(type,text,mood)=>{
      obs.push({type,text,time:now});
      cr.queue.push({msg:"◈ "+text,mood:mood||"intel"});
      if(cr.queue.length>6)cr.queue.shift();
    };

    const locks=lockHistory.filter(h=>h.events.find(e=>e.type==="LOCK"));
    const unlocks=lockHistory.filter(h=>h.events.find(e=>e.type==="UNLOCK"));
    ad.lockCount=locks.length;ad.ejectCount=unlocks.length;
    const reasons={};
    lockHistory.forEach(h=>{h.events.filter(e=>e.type==="UNLOCK").forEach(e=>{
      const key=e.reason?.split(" ")[0]||"UNKNOWN";
      reasons[key]=(reasons[key]||0)+1;
    });});
    ad.ejectReasons=reasons;
    const smCount=live.sessionStats?.smartWallets||0;
    const totalToks=tokens.length;
    const ruggedToks=graveyard.length;
    const migratedToks=(live.migrations||[]).length;
    const aboveTrench=tokens.filter(t=>t.mcap>=10000).length;
    const aboveOrbit=tokens.filter(t=>t.mcap>=100000).length;

    // ── Market tempo (fires from token 1) ──
    if(totalToks>0&&!ad._tempoTime){
      ad._tempoTime=now;
      const rugRate=totalToks>0?Math.round(ruggedToks/(totalToks+ruggedToks)*100):0;
      if(rugRate>70){
        pushObs("warning",`Market is brutal right now — ${rugRate}% rug rate. Only the toughest tokens surviving.`,"alarm");
      } else if(rugRate>50){
        pushObs("analysis",`Choppy market — ${rugRate}% rug rate. Be selective, vol is real.`,"sus");
      } else if(rugRate<20&&totalToks>=5){
        pushObs("positive",`Clean market session — only ${rugRate}% rug rate. Good conditions.`,"hype");
      }
    }

    // ── Scan volume ──
    if(totalToks>=10&&!ad._scanNote){
      ad._scanNote=true;
      pushObs("analysis",`${totalToks} tokens scanned this session. ${aboveTrench} made it above the trenches ($10K+).`,"intel");
    }
    if(totalToks>=50&&!ad._scan50){
      ad._scan50=true;
      const surRate=Math.round(aboveTrench/totalToks*100);
      pushObs("analysis",`50+ tokens scanned. Survival rate above trenches: ${surRate}%. ${aboveOrbit>0?aboveOrbit+" token(s) hit orbit ($100K+).":"None hit orbit yet."}`,"intel");
    }

    // ── Mooners ──
    if(aboveOrbit>=1&&!ad._orbitNote){
      ad._orbitNote=true;
      const names=tokens.filter(t=>t.mcap>=100000).map(t=>t.name).slice(0,2).join(", ");
      pushObs("positive",`${names} ${aboveOrbit>1?"are":"is"} in orbit at $100K+. Smart money watching these closely.`,"hype");
    }

    // ── Lock performance ──
    if(locks.length>=1&&!ad._firstLockNote){
      ad._firstLockNote=true;
      pushObs("analysis",`First lock acquired. Tracking outcome — watching for quick eject or sustained climb.`,"intel");
    }
    if(locks.length>=3){
      const quickEjects=lockHistory.filter(h=>{
        const lk=h.events.find(e=>e.type==="LOCK");
        const ul=h.events.find(e=>e.type==="UNLOCK");
        return lk&&ul&&(ul.time-lk.time)<20000;
      });
      const qRate=Math.round(quickEjects.length/locks.length*100);
      if(qRate>50&&!ad._quickEjectWarned){
        ad._quickEjectWarned=true;
        pushObs("warning",`${qRate}% of locks are ejecting within 20 seconds. Entry gate might be too loose.`,"alarm");
      }
    }

    // ── Top eject reason ──
    const topReason=Object.entries(reasons).sort((a,b)=>b[1]-a[1])[0];
    if(topReason&&topReason[1]>=2&&ad._lastTopReason!==topReason[0]){
      ad._lastTopReason=topReason[0];
      const reasonMap={
        "CRASHED":"Tokens crashing after lock — entering too late, already peaking when we catch them.",
        "STALE":"Volume drying up fast after lock — brief spikes with no sustained interest.",
        "SELL":"Sell pressure killing locks — stricter buy/sell ratio or dev wallet checks needed.",
        "DEAD":"Locked tokens going completely dead — low-liquidity brief activity bursts.",
        "HEALTH":"Health draining fast on locks — fundamentals weaker than scores suggest.",
        "WEAK":"Mcap failing to hold after lock — consider higher entry threshold.",
        "MCAP":"Tokens dropping below $5K after lock — raise minimum lock mcap.",
      };
      const insight=reasonMap[topReason[0]]||`Top eject reason: ${topReason[0]} (${topReason[1]}x). Pattern emerging.`;
      pushObs("analysis",insight,"sus");
    }

    // ── Smart money health ──
    if(smCount>0&&ad._lastSmCount!==smCount){
      ad._lastSmCount=smCount;
      if(smCount>20){
        pushObs("warning",`Smart wallet pool at ${smCount} — getting inflated. Threshold may need tightening.`,"alarm");
      } else if(smCount>=3&&smCount<=8){
        pushObs("positive",`Smart wallet pool healthy at ${smCount} — these are genuinely skilled traders.`,"hype");
      } else if(smCount===1){
        pushObs("analysis",`First smart wallet detected this session. Watching their next move.`,"intel");
      }
    }

    // ── Migration intel ──
    if(migratedToks>0&&ad._lastMigCount!==migratedToks){
      ad._lastMigCount=migratedToks;
      const lockedMigs=lockHistory.filter(h=>tokens.find(t=>t.addr===h.addr&&t.migrated));
      if(lockedMigs.length>0&&!ad._migLockNote){
        ad._migLockNote=true;
        pushObs("positive",`Caught ${lockedMigs.length} token${lockedMigs.length>1?"s":""} before migration — highest value calls of the session.`,"hype");
      } else {
        pushObs("analysis",`${migratedToks} token${migratedToks>1?"s":""} migrated to Raydium this session.`,"intel");
      }
    }

    // ── Score distribution ──
    if(locks.length>=5){
      const scores=lockHistory.map(h=>h.events.find(e=>e.type==="LOCK")?.score||0).filter(s=>s>0);
      const avg=scores.reduce((a,b)=>a+b,0)/scores.length;
      const lastAvg=ad._lastAvgScore||0;
      if(Math.abs(avg-lastAvg)>0.5){
        ad._lastAvgScore=avg;
        if(avg>9){
          pushObs("positive",`Lock quality strong — avg score ${avg.toFixed(1)}. System being very selective.`,"hype");
        } else if(avg<7.5){
          pushObs("analysis",`Avg lock score ${avg.toFixed(1)} — borderline entries. Consider raising threshold to 8+.`,"sus");
        }
      }
    }

    // ── Session health ──
    const sessionAge=now-(ad._sessionStart||now);
    if(!ad._sessionStart)ad._sessionStart=now;
    if(sessionAge>15*60*1000&&locks.length===0&&!ad._slowNote){
      ad._slowNote=true;
      pushObs("analysis","No locks after 15 minutes. Market may be slow or entry criteria too strict for current conditions.","sus");
    }

    if(obs.length>0){
      setAiObservations(p=>[...obs,...p].slice(0,50));
    }
  },10000);return()=>clearInterval(iv)},[lockHistory,tokens,graveyard,live.migrations,live.sessionStats]);

  // ═══ SESSION REPORT GENERATOR — every 30 minutes ═══
  useEffect(()=>{const iv=setInterval(()=>{
    const now=Date.now();
    const sessionMin=Math.floor((now-sessionStartRef.current)/60000);
    const timeSinceReport=now-lastReportRef.current;
    const isFirst=sessionReports.length===0&&sessionMin>=2&&lockOutcomesRef.current.length>0;
    if(timeSinceReport<1800000&&!isFirst)return;
    if(lockHistory.length===0&&lockOutcomesRef.current.length===0)return;
    lastReportRef.current=now;
    const outcomes=lockOutcomesRef.current;
    const activeLocks=lockedTokens.filter(t=>t.autoLocked||t.locked);
    const totalLocks=lockHistory.filter(h=>h.events.find(e=>e.type==="LOCK")).length;
    const totalEjects=outcomes.length;
    const stillRunning=activeLocks.length;
    const wins=outcomes.filter(o=>o.pctChange>0);
    const losses=outcomes.filter(o=>o.pctChange<=0);
    const winRate=totalEjects>0?Math.round(wins.length/totalEjects*100):0;
    const sorted=[...outcomes].sort((a,b)=>b.pctChange-a.pctChange);
    const best=sorted[0]||null;
    const worst=sorted[sorted.length-1]||null;
    const avgHold=outcomes.length>0?outcomes.reduce((a,o)=>a+o.holdTime,0)/outcomes.length:0;
    const avgHoldStr=avgHold>60000?Math.round(avgHold/60000)+"m":Math.round(avgHold/1000)+"s";
    const avgPct=outcomes.length>0?outcomes.reduce((a,o)=>a+o.pctChange,0)/outcomes.length:0;
    const reasons={};
    outcomes.forEach(o=>{const key=o.outcome.split(" ")[0].replace(/[^A-Z]/gi,"");reasons[key]=(reasons[key]||0)+1;});
    const topReasons=Object.entries(reasons).sort((a,b)=>b[1]-a[1]).slice(0,5);
    const scoreGroups={low:0,mid:0,high:0};
    outcomes.forEach(o=>{const s=parseInt(o.lockScore)||0;if(s>=9)scoreGroups.high++;else if(s>=7)scoreGroups.mid++;else scoreGroups.low++;});
    const migsCaught=lockHistory.filter(h=>{const tok=tokens.find(t=>t.addr===h.addr);return tok&&tok.migrated;}).length;
    const runningDetails=activeLocks.map(t=>{const lh2=lockHistory.find(h=>h.addr===t.addr);const le2=lh2?.events?.find(e=>e.type==="LOCK");const lm2=le2?.mcap||t.lockPrice||0;const p2=lm2>0?((t.mcap-lm2)/lm2*100):0;return{name:t.name,mcap:t.mcap,lockMcap:lm2,pct:p2,holders:t.holders,migrated:t.migrated};});
    setSessionReports(p=>[{id:Date.now(),time:now,sessionMin,totalLocks,totalEjects,stillRunning,winRate,wins:wins.length,losses:losses.length,avgHold:avgHoldStr,avgPct:Math.round(avgPct*10)/10,best:best?{name:best.name,pct:Math.round(best.pctChange),lockMcap:best.lockMcap,finalMcap:best.finalMcap}:null,worst:worst?{name:worst.name,pct:Math.round(worst.pctChange),lockMcap:worst.lockMcap,finalMcap:worst.finalMcap}:null,topReasons,scoreGroups,migsCaught,runningDetails,smartWallets:live.sessionStats?.smartWallets||0,tokensScanned:tokens.length},...p].slice(0,20));
    console.log("[REPORT] Session report at "+sessionMin+"min — "+totalLocks+" locks, "+winRate+"% win rate");
  },30000);return()=>clearInterval(iv)},[lockHistory,lockedTokens,tokens,live.sessionStats,sessionReports]);

  // ═══ AUTO-LOCK: System picks runners automatically ═══
  const autoLockedIds=useRef(new Map()); // Map<addr, {ejectTime, mcapAtEject, volAtEject}>
  useEffect(()=>{
    const iv=setInterval(()=>{
      const curTokens=tokensRef.current;
      curTokens.forEach(t=>{
        // Re-entry: cooldown instead of permanent blacklist
        const prevLock=autoLockedIds.current.get?.(t.addr);
        if(prevLock){
          // 3-minute cooldown after eject, then can re-enter if conditions improved
          if(Date.now()-prevLock.ejectTime<180000)return;
          // Must have BETTER stats than when ejected to re-enter
          if((t.mcap||0)<=(prevLock.mcapAtEject||0)*1.5)return; // needs 50% higher mcap
          if((t.vol||0)<=(prevLock.volAtEject||0))return;        // needs more volume
          console.log(`[RE-ENTRY] ${t.name} reconsidered — mcap ${formatNum(t.mcap)} (was ${formatNum(prevLock.mcapAtEject)})`);
        }
        if(lockedTokens.find(lt=>lt.addr===t.addr))return;
        if(lockedTokens.length>=8)return;

        // ─── AUTO-LOCK: weighted score instead of hard gates ───
        let lockScore=0;

        // Hard gates — must pass ALL
        if(!t.qualified)return;
        if(t.mcap<8500)return; // no micro-cap garbage

        // ═══ CORE FUNDAMENTALS (max ~10) ═══
        // Qual score
        if(t.qualScore>=7)lockScore+=3;
        else if(t.qualScore>=6)lockScore+=2;
        else if(t.qualScore>=5)lockScore+=1;

        // Volume (real USD volume)
        if(t.vol>5000)lockScore+=2;
        else if(t.vol>1500)lockScore+=1;

        // Holders (raw count)
        if(t.holders>=20)lockScore+=2;
        else if(t.holders>=12)lockScore+=1;

        // Buy pressure
        const bp=t.buys>0?t.buys/(t.buys+t.sells+1):0;
        if(bp>0.6&&t.buys>=8)lockScore+=2;
        else if(bp>0.55&&t.buys>=5)lockScore+=1;

        // ═══ [NEW #1] SPEED BONUS — only if fundamentals are CLEAN ═══
        // Fast runners get credit BUT only with clean safety signals
        // This prevents locking bundled quick-rug traps
        const isSafeRunner=!t.bundleDetected&&(t.topHolderPct||99)<40&&
          (t.freshPct===undefined||t.freshPct<70)&&(t.deployerGrade||"?")==="A"&&
          !t.mintAuth&&!t.frozen&&(t.sellDumping!==true);
        if(isSafeRunner){
          if(t.fastRunner)lockScore+=2;        // hit $10K in under 2 min with clean sheet
          if(t.rocketShip)lockScore+=2;        // hit $20K in under 3 min with clean sheet
          if(t.timeTo10k>0&&t.timeTo10k<60000)lockScore+=1; // sub-60s to $10K = insane
        }

        // ═══ [NEW #2] HOLDER GROWTH RATE — trajectory > static count ═══
        const hgr=t.holderGrowthRate||0;
        if(hgr>=10)lockScore+=3;       // 10+ holders/min = viral
        else if(hgr>=5)lockScore+=2;   // 5+/min = strong organic interest
        else if(hgr>=2)lockScore+=1;   // 2+/min = growing
        if(hgr<=0&&t.holders<20)lockScore-=1; // flatlined growth + low count = dead

        // ═══ [NEW #3] BONDING CURVE — migration imminent ═══
        const bond=t.bondingPct||0;
        if(bond>=90)lockScore+=3;      // about to graduate — massive pump likely
        else if(bond>=80)lockScore+=2; // close — migration FOMO building
        else if(bond>=70)lockScore+=1; // getting there

        // ═══ [NEW #4] MCAP TRAJECTORY — where it's going, not where it is ═══
        const traj=t.mcapTrajectory||0; // % change per minute
        if(traj>=20)lockScore+=3;      // 20%+ per min = rocket
        else if(traj>=10)lockScore+=2; // 10%+ per min = strong climb
        else if(traj>=5)lockScore+=1;  // 5%+ per min = healthy
        if(traj<=-10)lockScore-=2;     // dumping fast
        if(traj<=-5&&traj>-10)lockScore-=1; // slipping

        // ═══ EDGE SIGNALS ═══
        if(t.accelerating)lockScore+=2;
        if((t.velocity||0)>=5)lockScore+=1;
        if(t.freshPct!==undefined&&t.freshPct<45)lockScore+=1;
        if(t.retentionPct!==undefined&&t.retentionPct>70)lockScore+=1;
        if(t.smallBuyRatio!==undefined&&t.smallBuyRatio>60)lockScore+=1;
        if(t.devWallet<10&&t.devWallet!==0)lockScore+=1;
        if(t.topHolderPct<30&&t.topHolderPct>0)lockScore+=1;
        if(t.mcap>15000)lockScore+=1;

        // ═══ INTEL SIGNALS ═══
        if(t.hasSmartMoney)lockScore+=3;
        if((t.smartWalletCount||0)>=3)lockScore+=1;
        if(t.narrativeMatch)lockScore+=1;

        // ═══ RED FLAGS ═══
        if(t.bundleDetected)lockScore-=3;

        // Deployer grade
        const dg=t.deployerGrade||"?";
        if(dg==="F")return;
        if(dg==="D")lockScore-=4;
        if(dg==="C")lockScore-=2;
        if(dg==="A")lockScore+=1;

        // Cross-source
        if(t.onGeckoTrending)lockScore+=1;
        if(t.onDefinedTrending)lockScore+=1;
        if(t.trendScore>=2)lockScore+=2;
        if(t.rugLevel==="SAFE")lockScore+=1;
        if(t.rugLevel==="DANGER")lockScore-=3;
        if(t.lpLocked)lockScore+=1;

        // Deep data
        if(t.jupVerified)lockScore+=1;
        if(t.isKOTH)lockScore+=1;
        if(t.hasSocials)lockScore+=1;
        if(t.replyCount>20)lockScore+=1;
        if(t.liquidityRating==="DEEP")lockScore+=1;
        if(t.liquidityRating==="PAPER")lockScore-=3;
        if(t.activityLevel==="BLAZING")lockScore+=1;
        if(t.activityLevel==="HOT")lockScore+=1;
        if(t.activityLevel==="DEAD")lockScore-=2;
        if(t.rayBurnPct>90)lockScore+=1;
        if(t.pumpNsfw)lockScore-=2;

        // Penalties
        if(t.isStale||t.isDead)lockScore-=5;
        if(t.sellDumping)lockScore-=3;

        // Need 7+ points to auto-lock (out of ~18 possible)
        if(lockScore>=5)console.log(`[AUTO-LOCK] ${t.name} score:${lockScore} q:${t.qualScore} h:${t.holders} hgr:${hgr}/m v:$${formatNum(t.vol)} bp:${(bp*100).toFixed(0)}% traj:${traj}%/m bond:${bond}% dg:${dg}${t.fastRunner&&isSafeRunner?" 🏃FAST":""}${t.bundleDetected?" ⚠BUNDLE":""}${t.hasSmartMoney?" 🧠SMART":""}${t.narrativeMatch?" 🔥"+t.narrativeWord:""} ${lockScore>=7?"✅ LOCKED":"❌ need 7+"}`);
        if(lockScore<7)return;

        // PASSED — auto-lock this token
        autoLockedIds.current.set(t.addr,{lockTime:Date.now(),mcapAtEject:0,volAtEject:0});
        // Build narrative sentence + stats
        const lockReasons=[];
        lockReasons.push("Qual "+t.qualScore+"/8");
        lockReasons.push("$"+formatNum(t.mcap)+" mc");
        lockReasons.push("$"+formatNum(t.vol)+" vol");
        lockReasons.push(t.holders+"w");
        lockReasons.push(Math.round(bp*100)+"% buys");
        if(t.fastRunner&&isSafeRunner)lockReasons.push("🏃 Fast runner");
        if(hgr>=5)lockReasons.push(hgr+"/min holder growth");
        if(bond>=80)lockReasons.push(bond+"% bonding");
        if(traj>=10)lockReasons.push("+"+traj+"%/min trajectory");
        if(t.accelerating)lockReasons.push("⚡ Accelerating");
        if(t.hasSmartMoney)lockReasons.push("🧠 Smart money ("+t.smartWalletCount+"x)");
        if(t.narrativeMatch)lockReasons.push("🔥 "+t.narrativeWord+" narrative");
        if(t.onGeckoTrending)lockReasons.push("📈 Gecko trending");
        if(t.migrated)lockReasons.push("🌉 Migrated");
        if(t.lpLocked)lockReasons.push("🔒 LP locked");
        // Build human-readable narrative
        let narrative="";
        if(t.hasSmartMoney&&traj>=10)narrative="Smart money is buying in while price rips — proven winners see something here.";
        else if(t.hasSmartMoney)narrative="Wallets with winning track records are accumulating — they tend to know before the crowd does.";
        else if(t.fastRunner&&isSafeRunner&&hgr>=5)narrative="Ripped fast with organic holder growth and clean deployer — this has real momentum, not a bundled trap.";
        else if(traj>=20&&t.accelerating)narrative="Price trajectory is explosive and buying is accelerating — FOMO is kicking in hard.";
        else if(bond>=85)narrative="Bonding curve almost full — migration to Raydium is imminent which often triggers a massive pump as it opens to wider market.";
        else if(hgr>=10&&bp>0.6)narrative="Holders flooding in at "+Math.round(hgr)+"/min with strong buy pressure — viral organic interest.";
        else if(traj>=10&&t.holders>=20)narrative="Steady price climb with a solid holder base — this isn't a flash pump, it's building real support.";
        else if(t.accelerating&&t.vol>5000)narrative="Buy velocity is accelerating with real volume behind it — momentum is building, not fading.";
        else if(t.qualScore>=7&&bp>0.6)narrative="High quality score with dominant buy pressure — fundamentals are strong across the board.";
        else if(bond>=70&&traj>=5)narrative="Approaching migration with upward trajectory — could catch the graduation pump.";
        else if(t.migrated)narrative="Already migrated to Raydium — survived graduation which filters out most scams.";
        else if(t.narrativeMatch)narrative="Riding the "+t.narrativeWord+" meta — narrative momentum can carry tokens hard.";
        else narrative="Multiple signals aligned — quality, momentum, and volume all checking boxes.";
        console.log("[HISTORY] LOCK logged:",t.name,"score:",lockScore,"reasons:",lockReasons.join(", "));
        addLockHistoryEvent(t.addr,t.name,"LOCK",narrative+"\n\nScore "+lockScore+": "+lockReasons.join(", "),{mcap:t.mcap,holders:t.holders,vol:t.vol,score:lockScore});
        setLockedTokens(p=>{
          if(p.find(lt=>lt.addr===t.addr))return p;
          return[...p,{...t,locked:true,autoLocked:true,lockTime:Date.now(),lockPrice:t.mcap}];
        });
        setIntelEvents(p=>[{
          id:Date.now()+Math.random(),type:"deploy",icon:"🎯",color:"#ffd740",
          text:`AUTO-LOCKED ${t.name} — score ${lockScore}, ${t.holders}w, $${formatNum(t.vol)} vol${t.accelerating?" ⚡ACC":""}`,
          timestamp:Date.now(),priority:"HIGH",
        },...p].slice(0,40));
        addKillFeed({type:"lock",name:t.name,text:`🎯 ${t.name} AUTO-LOCKED — system detected runner`});
      });
    },6000);
    return()=>clearInterval(iv);
  },[lockedTokens]);

  useEffect(()=>{const iv=setInterval(()=>setScanLine(p=>(p+1)%100),50);return()=>clearInterval(iv)},[]);

  const lockToken=useCallback(token=>{addLockHistoryEvent(token.addr,token.name,"LOCK","Manual lock — $"+formatNum(token.mcap)+" mcap, "+token.holders+"w",{mcap:token.mcap,holders:token.holders,vol:token.vol,score:"manual"});
    setLockedTokens(p=>{if(p.find(t=>t.addr===token.addr))return p;
    return[...p,{...token,locked:true,lockTime:Date.now(),lockPrice:token.mcap}].slice(0,8)})},[]);
  const removeLocked=useCallback(id=>{setLockedTokens(p=>{
    const t=p.find(x=>x.id===id);
    if(t){
      autoLockedIds.current.delete(t.addr);
      console.log("[HISTORY] Manual UNLOCK:",t.name);
      addLockHistoryEvent(t.addr,t.name,"UNLOCK","Manual unlock at $"+formatNum(t.mcap),{mcap:t.mcap||0});
    }
    return p.filter(x=>x.id!==id);
  })},[]);
  const filteredTokens=tokens.filter(t=>{if(filter==="ALL")return true;if(filter==="QUALIFIED")return t.qualified;
    if(filter==="REJECTED")return!t.qualified;if(filter==="BUNDLES")return t.bundleDetected;return true});
  const qualRate=totalScanned>0?((deployed/totalScanned)*100).toFixed(0):0;

  return(
    <div style={{background:`radial-gradient(ellipse at 50% 0%,rgba(40,0,60,0.25),transparent 60%),
      radial-gradient(ellipse at 0% 100%,rgba(0,20,40,0.15),transparent 50%),
      radial-gradient(ellipse at 100% 100%,rgba(40,0,20,0.15),transparent 50%),${NEON.bg}`,
      color:NEON.text,height:"100vh",fontFamily:"'Share Tech Mono',monospace",overflow:"hidden",display:"flex",flexDirection:"column"}}>
      <CherryBlossoms/>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@400;700;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(255,0,255,0.12);border-radius:4px}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes scanDown{0%{top:-10%}100%{top:110%}}
@keyframes pulse{0%,100%{opacity:0.8;transform:scale(1)}50%{opacity:1;transform:scale(1.05)}}
@keyframes slideIn{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}
        @keyframes marqueeScroll{0%{transform:translateX(100%)}15%{transform:translateX(0)}85%{transform:translateX(0)}100%{transform:translateX(-100%)}}
        @keyframes newToken{from{background:rgba(255,7,58,0.06)}to{background:transparent}}
        @keyframes promoted{from{background:rgba(57,255,20,0.1)}to{background:transparent}}
        @keyframes marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        @keyframes kfRTL{0%{transform:translateY(-50%) translateX(110vw)}10%{opacity:1}90%{opacity:1}100%{transform:translateY(-50%) translateX(-110vw)}}
        @keyframes kfSlide{0%{transform:translateX(110%);opacity:0}5%{opacity:1}95%{opacity:1}100%{transform:translateX(-110%);opacity:0}}
        @keyframes headerPulse{0%,100%{opacity:0.3}50%{opacity:0.7}}
        .token-row{transition:background 0.15s}.token-row:hover{background:rgba(255,0,255,0.05)!important}
        .btn-f{background:rgba(255,255,255,0.03);border:1px solid rgba(255,0,255,0.15);color:${NEON.dimText};
          padding:3px 8px;border-radius:5px;cursor:pointer;font-family:'Share Tech Mono',monospace;font-size:9px;transition:all 0.2s}
        .btn-f:hover{background:rgba(255,0,255,0.1);color:${NEON.text}}
        .btn-f.on{background:rgba(255,0,255,0.15);border-color:rgba(255,0,255,0.4);color:${NEON.magenta}}
        .tgl{background:none;border:1px solid rgba(255,255,255,0.08);color:${NEON.dimText};width:22px;height:22px;
          border-radius:4px;cursor:pointer;display:flex;align-items:center;justify-content:center;
          font-size:10px;transition:all 0.15s;flex-shrink:0}
        .tgl:hover{background:rgba(255,0,255,0.1);color:${NEON.magenta};border-color:rgba(255,0,255,0.3)}
      `}</style>

      {/* Scanline overlay */}
      <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,pointerEvents:"none",zIndex:95,
        background:"repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(255,255,255,0.004) 3px,rgba(255,255,255,0.004) 4px)"}}>
        <div style={{position:"absolute",left:0,right:0,height:1,top:`${scanLine}%`,opacity:0.15,
          background:`linear-gradient(90deg,transparent,${NEON.magenta},transparent)`}}/></div>

      {/* ═══ HEADER — fixed height, no bounce ═══ */}
      <div style={{background:"linear-gradient(180deg,rgba(20,10,35,0.6),rgba(5,3,14,0.4))",
        borderBottom:"1px solid rgba(255,255,255,0.04)",padding:"6px 20px",height:52,
        display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0,position:"relative",zIndex:10,
        backdropFilter:"blur(10px)",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,left:"5%",right:"5%",height:1,
          background:"linear-gradient(90deg,transparent,rgba(255,0,255,0.3),rgba(0,255,255,0.2),rgba(255,0,255,0.3),transparent)",
          animation:"headerPulse 4s ease-in-out infinite"}}/>
        <div style={{flexShrink:0,minWidth:220}}>
          <h1 style={{fontFamily:"'Orbitron',sans-serif",fontSize:16,fontWeight:900,lineHeight:1.2,
            background:`linear-gradient(90deg,${NEON.magenta},${NEON.pink},${NEON.cyan})`,
            WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",letterSpacing:3}}>◈ DEGEN COMMAND CENTER</h1>
          <div style={{fontSize:11,color:NEON.dimText,letterSpacing:2,marginTop:1}}>🌸 SOLANA BATTLEFIELD v7.0 🌸</div>
        </div>
        {/* ═══ CORRESPONDENT MARQUEE — expands when active ═══ */}
        <div style={{flex:1,margin:"0 14px",height:corrDisplay.visible?52:32,overflow:"hidden",position:"relative",
          background:corrDisplay.visible?"rgba(14,6,0,0.97)":"rgba(20,8,0,0.7)",
          border:`1px solid ${corrDisplay.visible?(corrDisplay.mood==="alarm"?"rgba(255,50,50,0.5)":corrDisplay.mood==="hype"?"rgba(57,255,20,0.4)":corrDisplay.mood==="sus"?"rgba(255,215,0,0.35)":"rgba(255,106,0,0.4)"):"rgba(255,106,0,0.15)"}`,
          borderRadius:4,transition:"height 0.3s ease, background 0.3s ease, border-color 0.3s ease",
          boxShadow:corrDisplay.visible?`0 0 20px ${corrDisplay.mood==="alarm"?"rgba(255,50,50,0.15)":corrDisplay.mood==="hype"?"rgba(57,255,20,0.1)":"rgba(255,106,0,0.12)"}`:undefined}}>
          {/* Scan lines */}
          <div style={{position:"absolute",inset:0,
            background:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,106,0,0.015) 2px,rgba(255,106,0,0.015) 4px)",
            pointerEvents:"none",zIndex:2}}/>
          {/* Claude ◈ icon left */}
          <div style={{position:"absolute",left:0,top:0,bottom:0,width:corrDisplay.visible?44:32,
            background:"linear-gradient(180deg,rgba(255,100,0,0.08),rgba(40,10,0,0.2))",
            borderRight:"1px solid rgba(255,100,0,0.15)",
            display:"flex",alignItems:"center",justifyContent:"center",zIndex:3,transition:"width 0.3s"}}>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
              <div style={{fontSize:corrDisplay.visible?20:15,lineHeight:1,transition:"font-size 0.3s",
                color:corrDisplay.visible?(corrDisplay.mood==="hype"?"#39ff14":corrDisplay.mood==="alarm"?"#ff4040":corrDisplay.mood==="sus"?"#ffd740":"#ff6a00"):"rgba(255,106,0,0.5)",
                textShadow:corrDisplay.visible?`0 0 12px currentColor`:undefined,
                fontWeight:900}}>◈</div>
              <div style={{fontSize:6,letterSpacing:1,fontFamily:"'Orbitron',sans-serif",
                color:corrDisplay.visible?"rgba(255,106,0,0.7)":"rgba(255,106,0,0.25)",
                transition:"all 0.3s"}}>CLAUDE</div>
            </div>
          </div>
          {/* Message area */}
          <div style={{position:"absolute",left:corrDisplay.visible?46:34,right:4,top:0,bottom:0,display:"flex",flexDirection:"column",justifyContent:"center",
            padding:"3px 6px",overflow:"hidden"}}>
            {corrDisplay.visible?<>
              <div style={{fontSize:9,color:"#ff6a00",fontWeight:700,letterSpacing:2,fontFamily:"'Orbitron',sans-serif",lineHeight:1,marginBottom:3}}>
                {corrDisplay.mood==="alarm"?"⚠ ALERT":corrDisplay.mood==="sus"?"◉ INTEL":corrDisplay.mood==="rip"?"☠ REPORT":corrDisplay.mood==="hype"?"◈ SIGNAL":"◈ CLAUDE"}</div>
              <div style={{fontSize:13,color:"#e0e0ff",lineHeight:1.3,fontFamily:"'Share Tech Mono',monospace",
                overflow:"hidden",whiteSpace:"nowrap",fontWeight:600,letterSpacing:0.5,
                animation:"marqueeScroll 40s linear"}}>{corrDisplay.msg}</div>
            </>:<>
              <div style={{fontSize:7,color:"rgba(255,106,0,0.3)",fontWeight:700,letterSpacing:2,fontFamily:"'Orbitron',sans-serif",lineHeight:1}}>◈ STANDBY</div>
              <div style={{fontSize:10,color:"rgba(255,106,0,0.12)",fontFamily:"'Share Tech Mono',monospace",lineHeight:1.2,
                letterSpacing:1,overflow:"hidden",whiteSpace:"nowrap"}}>
                {"░▒▓█▓▒░".repeat(8).split("").map((c,i)=><span key={i} style={{opacity:0.2+Math.random()*0.3}}>{c}</span>)}</div>
            </>}
          </div>
        </div>
        <div style={{display:"flex",gap:14,alignItems:"center",flexShrink:0}}>
          {[{l:"SCANNED",v:totalScanned,c:NEON.cyan},{l:"DEPLOYED",v:deployed,c:NEON.green},
            {l:"REJECTED",v:rejected,c:NEON.red},{l:"QUAL%",v:qualRate+"%",c:parseInt(qualRate)>40?NEON.green:NEON.orange},
            {l:"LOCKED",v:lockedTokens.length,c:NEON.yellow}].map(s=>(
            <StatChip key={s.l} label={s.l} value={s.v} color={s.c}/>))}
          <div style={{display:"flex",alignItems:"center",gap:5,marginLeft:6}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:NEON.green,
              boxShadow:`0 0 8px ${NEON.green}`,animation:"blink 1s infinite"}}/>
            <span style={{fontSize:14,color:NEON.green,letterSpacing:2}}>LIVE</span></div>
        </div>
      </div>

      {/* ═══ 3-COLUMN LAYOUT ═══ */}
      <div style={{display:"grid",gridTemplateColumns:"260px 1fr 260px",
        flex:1,overflow:"hidden",gap:6,padding:"6px"}}>

        {/* LEFT: 6-TAB COMMAND PANEL */}
        <GlassPanel accent={
          leftTab==="SCANNER"?NEON.magenta:leftTab==="WARLOG"?NEON.orange:
          leftTab==="LEADERS"?"#ffd740":leftTab==="HISTORY"?"#8b5cf6":leftTab==="AI"?"#00c8ff":leftTab==="REPORT"?"#ffa500":
          NEON.cyan
        } style={{display:"flex",flexDirection:"column",overflow:"hidden"}}>
          {/* 2x3 Tab Grid */}
          <div style={{borderBottom:"1px solid rgba(255,255,255,0.06)",flexShrink:0}}>
            {[[{id:"SCANNER",icon:"◉",label:"SCANNER",color:NEON.magenta,count:deployed},
              {id:"WARLOG",icon:"⚡",label:"WAR LOG",color:NEON.orange,count:intelEvents.length},
              {id:"LEADERS",icon:"🏆",label:"LEADERS",color:"#ffd740",count:null},
            ],[
              {id:"HISTORY",icon:"📜",label:"HISTORY",color:"#8b5cf6",count:lockHistory.length},
              {id:"AI",icon:"🤖",label:"CLAUDE",color:"#00c8ff",count:aiObservations.length},
              {id:"REPORT",icon:"💰",label:"WALLETS",color:"#ffa500",count:live.walletScoresRef?Object.values(live.walletScoresRef.current).filter(w=>(w.wins+w.losses+(w.holds||0))>=1).length:0},
            ]].map((row,ri)=>(
              <div key={ri} style={{display:"flex"}}>
                {row.map(tab=>(
                  <button key={tab.id} onClick={()=>{setLeftTab(tab.id);if(tab.id==="REPORT"){setReportView("tiers");setReportTier(null);setSelectedWallet(null);}}} style={{
                    flex:1,padding:"5px 2px",fontSize:10,fontWeight:700,cursor:"pointer",border:"none",
                    fontFamily:"'Orbitron',sans-serif",letterSpacing:0.5,transition:"all 0.2s",
                    background:leftTab===tab.id?`${tab.color}12`:"transparent",
                    color:leftTab===tab.id?tab.color:NEON.dimText,
                    borderBottom:leftTab===tab.id?`2px solid ${tab.color}`:"2px solid transparent",
                  }}><div style={{fontSize:13}}>{tab.icon}</div>{tab.label}
                    {tab.count>0&&<span style={{marginLeft:2,fontSize:8,color:tab.color,
                      background:`${tab.color}20`,borderRadius:6,padding:"1px 3px"}}>{tab.count}</span>}
                  </button>
                ))}
              </div>
            ))}
          </div>

          {/* Tab content */}
          <div style={{flex:1,overflowY:"auto"}}>

          {/* SCANNER */}
          {leftTab==="SCANNER"&&<>
            <div style={{display:"flex",gap:3,padding:"6px 10px",borderBottom:"1px solid rgba(255,255,255,0.03)"}}>
              {["ALL","QUALIFIED","REJECTED","BUNDLES"].map(f2=>(
                <button key={f2} className={`btn-f ${filter===f2?"on":""}`} onClick={()=>setFilter(f2)}>{f2}</button>))}</div>
            <div style={{padding:"2px 0"}}>
              {filteredTokens.map((t,i)=>(
                <div key={t.id} className="token-row" onClick={()=>selectToken(t)} style={{
                  padding:"6px 10px",borderBottom:"1px solid rgba(255,255,255,0.02)",cursor:"pointer",
                  animation:i===0?(t.qualified?"promoted 2s ease-out":"newToken 2s ease-out"):"none",
                  borderLeft:t.qualified?`2px solid ${NEON.green}30`:"2px solid rgba(255,7,58,0.08)",
                  background:selectedToken?.id===t.id?"rgba(0,255,255,0.04)":"transparent",opacity:t.qualified?1:0.45}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      {t.qualified?
                        <span style={{display:"inline-block",width:20,height:20,borderRadius:"50%",lineHeight:"20px",textAlign:"center",
                          background:`radial-gradient(circle at 35% 30%,${t.coinColor?.bg},${t.coinColor?.rim})`,
                          border:`1px solid ${t.coinColor?.rim}`,fontSize:12,fontWeight:900,fontFamily:"'Orbitron'",color:t.coinColor?.fg,
                          boxShadow:"0 1px 3px rgba(0,0,0,0.3)"}}>{t.initials?.charAt(0)}</span>
                        :<span style={{fontSize:12,opacity:0.4}}>🚫</span>}
                      <div>
                        <div style={{fontSize:12,fontWeight:700,color:t.qualified?NEON.text:NEON.dimText,
                          display:"flex",alignItems:"center",gap:4}}>
                          {t.name}
                          <span style={{fontSize:9,padding:"0 3px",borderRadius:3,fontWeight:500,
                            background:t.platform==="PumpFun"?"rgba(255,0,255,0.1)":"rgba(0,255,255,0.1)",
                            color:t.platform==="PumpFun"?NEON.magenta:NEON.cyan,
                            border:`1px solid ${t.platform==="PumpFun"?"rgba(255,0,255,0.2)":"rgba(0,255,255,0.2)"}`}}>
                            {t.platform==="PumpFun"?"PP":t.platform?.slice(0,3)?.toUpperCase()||"?"}</span>
                          {t.bundleDetected&&<span style={{color:"#ff073a",fontSize:12,marginLeft:4,fontWeight:900,background:"rgba(255,7,58,0.15)",
                            padding:"0 3px",borderRadius:3}}>⚠B</span>}
                          {(()=>{const dr=deployerRepRef.current[t.deployer];if(!dr)return null;
                            if(dr.rugs>=3)return<span style={{fontSize:10,color:"#ff073a",fontWeight:700,background:"rgba(255,7,58,0.12)",padding:"0 3px",borderRadius:3}} title={`${dr.rugs} rugs / ${dr.launches} launches`}>☠{dr.rugs}R</span>;
                            if(dr.runners>=2)return<span style={{fontSize:10,color:NEON.green,fontWeight:700,background:"rgba(57,255,20,0.12)",padding:"0 3px",borderRadius:3}} title={`${dr.runners} runners / ${dr.launches} launches`}>✓{dr.runners}W</span>;
                            return null;})()}
                        </div>
                        <div style={{fontSize:11,color:NEON.dimText,display:"flex",gap:6,marginTop:1}}>
                          <span style={{color:t.mcap>=20000?NEON.green:t.mcap>=10000?NEON.yellow:NEON.dimText,fontWeight:600}}>
                            ${formatNum(t.mcap)}</span>
                          <span>{t.buys}b/{t.sells}s</span>
                          <span style={{color:t.holders>=15?NEON.cyan:NEON.dimText}}>{t.holders}w</span>
                          {t.bundleDetected&&<span style={{color:NEON.red,fontWeight:700}}>B:{t.bundleSize}</span>}</div>
                        {t.hasSmartMoney&&<div style={{fontSize:10,color:"#ff9500",fontWeight:700}}>🧠 Smart ${t.smartWalletCount}x</div>}
                        {t.bondingPct!=null&&t.bondingPct>0&&!t.migrated&&<div style={{display:"flex",alignItems:"center",gap:4,marginTop:1}}>
                          <div style={{flex:1,height:4,background:"rgba(255,255,255,0.06)",borderRadius:2,overflow:"hidden",maxWidth:60}}>
                            <div style={{width:Math.min(100,t.bondingPct)+"%",height:"100%",borderRadius:2,
                              background:t.bondingPct>80?"linear-gradient(90deg,#39ff14,#ffe600)":t.bondingPct>50?"linear-gradient(90deg,#00ccff,#39ff14)":"linear-gradient(90deg,#555,#888)",
                              transition:"width 0.5s"}}/>
                          </div>
                          <span style={{fontSize:9,color:t.bondingPct>80?NEON.green:t.bondingPct>50?NEON.cyan:NEON.dimText,fontWeight:700}}>
                            {t.bondingPct.toFixed(0)}%{t.bondingPct>80?" 🔥":""}</span>
                        </div>}
                        <div style={{display:"flex",gap:3,flexWrap:"wrap",marginTop:1}}>
                          {t.onGeckoTrending&&<span style={{fontSize:8,color:"#39ff14",background:"rgba(57,255,20,0.1)",padding:"0 3px",borderRadius:3,fontWeight:700}}>🦎 GECKO</span>}
                          {t.onDefinedTrending&&<span style={{fontSize:8,color:"#00ccff",background:"rgba(0,204,255,0.1)",padding:"0 3px",borderRadius:3,fontWeight:700}}>📡 BUZZ</span>}
                          {t.trendScore>=2&&<span style={{fontSize:8,color:"#ffd740",background:"rgba(255,215,64,0.1)",padding:"0 3px",borderRadius:3,fontWeight:700}}>🔥🔥 MULTI-TREND</span>}
                          {t.isKOTH&&<span style={{fontSize:8,color:"#ffd740",background:"rgba(255,215,64,0.12)",padding:"0 3px",borderRadius:3,fontWeight:700}}>👑 KOTH</span>}
                          {t.jupVerified&&<span style={{fontSize:8,color:NEON.green,background:"rgba(57,255,20,0.08)",padding:"0 3px",borderRadius:3,fontWeight:700}}>✓ JUP</span>}
                          {t.liquidityRating==="PAPER"&&<span style={{fontSize:8,color:NEON.red,background:"rgba(255,7,58,0.1)",padding:"0 3px",borderRadius:3,fontWeight:700}}>⚠ PAPER LIQ</span>}
                          {t.activityLevel==="BLAZING"&&<span style={{fontSize:8,color:"#ffd740",background:"rgba(255,215,64,0.1)",padding:"0 3px",borderRadius:3,fontWeight:700}}>🔥 BLAZING</span>}
                          {t.hasSocials&&<span style={{fontSize:8,color:NEON.cyan,background:"rgba(0,255,255,0.06)",padding:"0 3px",borderRadius:3}}>🌐</span>}
                          {t.replyCount>10&&<span style={{fontSize:8,color:NEON.cyan,background:"rgba(0,255,255,0.06)",padding:"0 3px",borderRadius:3}}>💬{t.replyCount}</span>}
                        </div>
                      </div>
                    </div>
                    {t.qualified&&<div style={{textAlign:"right"}}>
                      <div style={{fontSize:14,fontWeight:700,color:
                        t.qualScore>=7?NEON.green:t.qualScore>=5?NEON.yellow:NEON.orange}}>{t.qualScore}/10</div>
                      <div style={{fontSize:9,color:NEON.dimText}}>{t.threat}</div>
                    </div>}
                  </div>
                  {(t.buys>2)&&<div style={{display:"flex",gap:5,marginTop:2,fontSize:16,color:NEON.dimText,opacity:0.7}}>
                    <span style={{color:(t.freshPct||0)>75?NEON.red:(t.freshPct||0)<50?NEON.green:NEON.yellow}}>
                      👻{t.freshPct||0}%</span>
                    <span style={{color:t.accelerating?NEON.green:NEON.dimText}}>
                      ⚡{t.velocity||0}/30s{t.accelerating?"↑":""}</span>
                    <span style={{color:(t.smallBuyRatio||0)>50?NEON.green:NEON.orange}}>
                      🐟{t.smallBuyRatio||0}%</span>
                    <span style={{color:(t.retentionPct||0)>60?NEON.green:NEON.red}}>
                      💎{t.retentionPct||0}%</span>
                    {t.serialDeployer&&<span style={{color:NEON.red}}>🔁x{t.deployerLaunches}</span>}
                    {t.isDead&&<span style={{color:NEON.red}}>💀DEAD</span>}
                    {!t.isDead&&t.isStale&&<span style={{color:NEON.orange}}>😴{t.staleSec}s</span>}
                    {t.sellDumping&&<span style={{color:NEON.red}}>📉DUMP</span>}
                    {t.dexEnriched&&<span style={{color:"#00ffcc",opacity:0.6}}>DEX</span>}
                    {t.jupEnriched&&<span style={{color:"#7c4dff",opacity:0.6}}>JUP</span>}
                  </div>}
                </div>))}</div>
          </>}

          {/* WAR LOG */}
          {leftTab==="WARLOG"&&<WarLog events={intelEvents}/>}

          {/* LEADERBOARD */}
          {leftTab==="LEADERS"&&<div style={{padding:"6px"}}>
            {[{title:"💰 TOP MCAP",data:leaderboard.byMcap,metric:t=>"$"+formatNum(t.mcap),color:"#ffd740"},
              {title:"⚡ FASTEST",data:leaderboard.byVelocity,metric:t=>(t.velocity||0)+"/30s",color:NEON.green},
              {title:"👥 MOST HOLDERS",data:leaderboard.byHolders,metric:t=>(t.holders||0)+"w",color:NEON.cyan},
            ].map(cat=>(
              <div key={cat.title} style={{marginBottom:10}}>
                <div style={{fontSize:10,fontWeight:900,color:cat.color,fontFamily:"'Orbitron',sans-serif",
                  letterSpacing:1,marginBottom:4,borderBottom:`1px solid ${cat.color}30`,paddingBottom:3}}>{cat.title}</div>
                {cat.data.length===0&&<div style={{fontSize:10,color:NEON.dimText,fontStyle:"italic",padding:4}}>Waiting for data...</div>}
                {cat.data.map((t,i)=>(
                  <div key={t.id} onClick={()=>selectToken(t)} style={{display:"flex",justifyContent:"space-between",
                    alignItems:"center",padding:"3px 4px",cursor:"pointer",borderRadius:3,
                    background:i===0?`${cat.color}08`:"transparent",borderLeft:i===0?`2px solid ${cat.color}`:"2px solid transparent"}}>
                    <div style={{display:"flex",alignItems:"center",gap:5}}>
                      <span style={{fontSize:11,fontWeight:900,color:i===0?cat.color:NEON.dimText,width:14,textAlign:"right",
                        fontFamily:"'Orbitron'"}}>{i+1}</span>
                      <span style={{fontSize:11,fontWeight:700,color:i===0?NEON.text:"#aaa"}}>{t.name}</span>
                    </div>
                    <span style={{fontSize:11,fontWeight:700,color:cat.color,fontFamily:"'Share Tech Mono'"}}>{cat.metric(t)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>}

          {/* LOCK HISTORY */}
          {leftTab==="HISTORY"&&<div style={{padding:"4px 6px"}}>
            {lockHistory.length===0&&<div style={{color:NEON.dimText,fontSize:12,textAlign:"center",padding:20,fontStyle:"italic"}}>
              NO LOCK HISTORY YET...</div>}
            {lockHistory.map((h,i)=>{
              const lastEvt=h.events[0];
              const isLocked=lastEvt.type==="LOCK";
              const lockCount=h.events.filter(e=>e.type==="LOCK").length;
              const unlockCount=h.events.filter(e=>e.type==="UNLOCK").length;
              const ageS=Math.round((Date.now()-lastEvt.time)/1000);
              return(
                <div key={h.addr} onClick={()=>setHistoryDetail(h.addr===historyDetail?null:h.addr)} style={{padding:"5px 6px",marginBottom:2,borderRadius:4,
                  borderLeft:"2px solid "+(isLocked?NEON.yellow:"#8b5cf6"),cursor:"pointer",
                  background:h.addr===historyDetail?"rgba(139,92,246,0.12)":isLocked?"rgba(255,215,64,0.03)":"rgba(139,92,246,0.03)",
                  transition:"background 0.15s"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{display:"flex",alignItems:"center",gap:4}}>
                      <span style={{fontSize:11}}>{isLocked?"🔒":"🔓"}</span>
                      <span style={{fontSize:11,fontWeight:700,color:isLocked?NEON.yellow:"#8b5cf6"}}>{h.name}</span>
                      {lockCount>1&&<span style={{fontSize:8,color:NEON.cyan,background:"rgba(0,255,255,0.1)",
                        padding:"0 3px",borderRadius:2}}>{lockCount}L/{unlockCount}U</span>}
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:4}}>
                      <span style={{fontSize:9,color:NEON.dimText}}>{ageS<60?ageS+"s":Math.floor(ageS/60)+"m"}</span>
                      <span style={{fontSize:9,color:NEON.dimText}}>▶</span>
                    </div>
                  </div>
                </div>);
            })}
          </div>}

          {/* HISTORY DETAIL OVERLAY */}
          {historyDetail&&leftTab==="HISTORY"&&(()=>{
            const h=lockHistory.find(x=>x.addr===historyDetail);
            if(!h)return null;
            const tok=tokens.find(t=>t.addr===h.addr);
            return(<div style={{position:"absolute",top:0,left:0,right:0,bottom:0,zIndex:30,
              background:"rgba(5,3,14,0.97)",overflowY:"auto",padding:"10px 8px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,
                borderBottom:"1px solid rgba(255,255,255,0.08)",paddingBottom:6}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:16,fontWeight:900,color:NEON.yellow,fontFamily:"Orbitron"}}>{h.name}</span>
                  <span onClick={(e)=>{e.stopPropagation();navigator.clipboard.writeText(h.addr)}} style={{cursor:"pointer",fontSize:10,color:NEON.cyan,opacity:0.6}}>📋 CA</span>
                  <span onClick={(e)=>{e.stopPropagation();clickAddr(h.addr)}} style={{cursor:"pointer",fontSize:10,color:NEON.green,opacity:0.8}}>📊 INFO</span>
                </div>
                <button onClick={()=>setHistoryDetail(null)} style={{background:"rgba(255,7,58,0.15)",border:"1px solid rgba(255,7,58,0.3)",
                  color:NEON.red,cursor:"pointer",fontSize:11,padding:"3px 8px",borderRadius:4,fontWeight:700}}>✕ CLOSE</button>
              </div>
              {tok&&<div style={{display:"flex",gap:8,marginBottom:8,fontSize:11,color:NEON.dimText,flexWrap:"wrap"}}>
                <span>MC: <span style={{color:NEON.cyan}}>${formatNum(tok.mcap)}</span></span>
                <span>Vol: <span style={{color:NEON.yellow}}>${formatNum(tok.vol)}</span></span>
                <span>{tok.holders}w</span>
                <span style={{color:tok.alive?NEON.green:NEON.red}}>{tok.alive?"ALIVE":"DEAD"}</span>
              </div>}
              <div style={{fontSize:10,color:NEON.cyan,fontWeight:700,fontFamily:"Orbitron",letterSpacing:1,marginBottom:6}}>
                EVENT LOG ({h.events.length})</div>
              {h.events.map((evt,ei)=>(
                <div key={ei} style={{padding:"8px 8px",marginBottom:4,borderRadius:5,
                  borderLeft:"3px solid "+(evt.type==="LOCK"?"#ffd740":"#ff073a"),
                  background:evt.type==="LOCK"?"rgba(255,215,64,0.06)":"rgba(255,7,58,0.06)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:13,fontWeight:900,color:evt.type==="LOCK"?"#ffd740":"#ff073a"}}>
                      {evt.type==="LOCK"?"🔒 LOCKED":"🔓 UNLOCKED"}</span>
                    <span style={{fontSize:10,color:NEON.dimText}}>{new Date(evt.time).toLocaleTimeString()}</span>
                  </div>
                  <div style={{display:"flex",gap:6,marginTop:3,fontSize:11,color:NEON.dimText}}>
                    {evt.mcap!=null&&<span>MC: <span style={{color:NEON.cyan}}>${formatNum(evt.mcap)}</span></span>}
                    {evt.holders&&<span>{evt.holders}w</span>}
                    {evt.vol&&<span>Vol: ${formatNum(evt.vol)}</span>}
                    {evt.score&&<span style={{color:NEON.yellow}}>Score: {evt.score}</span>}
                  </div>
                  <div style={{fontSize:11,color:NEON.text,marginTop:4,lineHeight:1.4,
                    background:"rgba(255,255,255,0.02)",padding:"4px 6px",borderRadius:3}}>
                    {evt.reason.split("\n\n").map((part,pi)=>(
                      <div key={pi} style={{marginTop:pi>0?4:0,fontSize:pi===0?11:10,
                        color:pi===0?NEON.text:NEON.dimText,fontStyle:pi===0?"italic":"normal"}}>{part}</div>
                    ))}</div>
                </div>
              ))}
            </div>);
          })()}

          {/* AI CLAUDE */}
          {leftTab==="AI"&&<div style={{padding:"4px 6px"}}>
            {/* Claude Header */}
            <div style={{textAlign:"center",padding:"8px 0",borderBottom:"1px solid rgba(255,106,0,0.15)",marginBottom:8}}>
              <div style={{position:"relative",width:64,height:64,margin:"0 auto 6px",borderRadius:"50%",
                border:"2px solid rgba(255,106,0,0.4)",background:"radial-gradient(circle at 40% 40%, rgba(255,106,0,0.1), rgba(20,5,0,0.9))",overflow:"hidden",
                display:"flex",alignItems:"center",justifyContent:"center"}}>
                <div style={{fontSize:30,color:"#ff6a00",textShadow:"0 0 20px rgba(255,106,0,0.6)",animation:"pulse 3s ease-in-out infinite",lineHeight:1}}>◈</div>
                <div style={{position:"absolute",left:0,right:0,height:2,background:"linear-gradient(90deg, transparent, rgba(255,106,0,0.4), transparent)",
                  top:"50%",animation:"scanDown 3s linear infinite"}}/>
              </div>
              <div style={{fontSize:12,fontWeight:900,color:"#ff6a00",fontFamily:"Orbitron",letterSpacing:2}}>CLAUDE</div>
              <div style={{fontSize:9,color:NEON.dimText,marginTop:2}}>BATTLEFIELD ANALYST</div>
              <div style={{fontSize:8,color:"rgba(255,106,0,0.5)",marginTop:2}}>
                {aiObservations.length>0?`${aiObservations.length} OBSERVATIONS LOGGED`:"INITIALIZING..."}</div>
            </div>

            {/* Quick Stats */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginBottom:8}}>
              {[
                {label:"LOCKS",val:lockHistory.filter(h=>h.events.find(e=>e.type==="LOCK")).length,color:NEON.yellow},
                {label:"EJECTS",val:lockHistory.filter(h=>h.events.find(e=>e.type==="UNLOCK")).length,color:NEON.red},
                {label:"SMART $",val:live.sessionStats?.smartWallets||0,color:"#ff6a00"},
                {label:"MIGRATED",val:(live.migrations||[]).length,color:NEON.green},
              ].map((s,i)=>(
                <div key={i} style={{background:"rgba(255,106,0,0.04)",border:"1px solid rgba(255,106,0,0.12)",
                  borderRadius:4,padding:"4px 6px",textAlign:"center"}}>
                  <div style={{fontSize:14,fontWeight:900,color:s.color,fontFamily:"Orbitron"}}>{s.val}</div>
                  <div style={{fontSize:7,color:NEON.dimText,letterSpacing:1}}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Observation Log */}
            <div style={{fontSize:9,color:"#ff6a00",fontWeight:700,fontFamily:"Orbitron",letterSpacing:1,marginBottom:4}}>
              ◈ ANALYSIS LOG</div>
            {aiObservations.length===0&&<div style={{color:NEON.dimText,fontSize:11,textAlign:"center",padding:12,
              fontStyle:"italic",lineHeight:1.5,background:"rgba(255,106,0,0.03)",borderRadius:4,border:"1px solid rgba(255,106,0,0.08)"}}>
              Gathering data...<br/>
              <span style={{fontSize:9,opacity:0.6}}>First observations appear within ~30s of activity.</span></div>}
            {aiObservations.slice(0,20).map((obs,i)=>{
              const icon=obs.type==="warning"?"⚠️":obs.type==="positive"?"✅":obs.type==="analysis"?"🔍":"◈";
              const borderColor=obs.type==="warning"?"rgba(255,215,64,0.35)":obs.type==="positive"?"rgba(57,255,20,0.35)":"rgba(255,106,0,0.25)";
              const bg=obs.type==="warning"?"rgba(255,215,64,0.04)":obs.type==="positive"?"rgba(57,255,20,0.04)":"rgba(255,106,0,0.03)";
              const ageS=Math.round((Date.now()-obs.time)/1000);
              return(
                <div key={i} style={{padding:"5px 6px",marginBottom:3,borderRadius:4,
                  borderLeft:"2px solid "+borderColor,background:bg}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div style={{fontSize:11,color:NEON.text,lineHeight:1.4,flex:1}}>
                      <span style={{marginRight:4}}>{icon}</span>{obs.text}</div>
                    <span style={{fontSize:8,color:NEON.dimText,marginLeft:4,whiteSpace:"nowrap",flexShrink:0}}>
                      {ageS<60?ageS+"s":Math.floor(ageS/60)+"m"}</span>
                  </div>
                </div>);
            })}
          </div>}

          {/* SMART WALLET TRACKER */}
          {leftTab==="REPORT"&&<div style={{padding:"4px 6px"}}>
            {(()=>{
              const wsRef=live.walletScoresRef;
              const allWallets=wsRef?Object.entries(wsRef.current).filter(([,w])=>(w.wins+w.losses+(w.holds||0))>=1).map(([addr,w])=>{
                const qualTrades=(w.trades||[]).filter(tr=>(tr.athMcap||0)>=12000||(tr.mcap||0)>=12000);
                const allTrades=w.trades||[];
                const qualWins=qualTrades.filter(t=>t.type==="WIN").length;
                const qualLosses=qualTrades.filter(t=>t.type==="LOSS").length;
                // HOLDs: include all, not just 12K+ (open positions always count)
                const qualHolds=allTrades.filter(t=>t.type==="HOLD").length;
                const total=qualWins+qualLosses;
                const rate=total>0?Math.round(qualWins/total*100):0;
                const computedPnl=qualTrades.reduce((s,tr)=>s+(tr.pnl||0),0);
                const totalBought=allTrades.reduce((s,tr)=>s+(tr.sol||0),0);
                const totalSold=allTrades.reduce((s,tr)=>s+(tr.sold||0),0);
                const unrealizedPnl=allTrades.filter(t=>t.type==="HOLD").reduce((s,tr)=>s+(tr.pnl||0),0);
                const adjustedPnl=computedPnl+unrealizedPnl;
                const isElite=qualWins>=4&&rate>=60&&qualWins>=(qualLosses*2)&&total>=5&&computedPnl>=1.0&&adjustedPnl>0.5;
                return{addr,wins:qualWins,losses:qualLosses,holds:qualHolds,total,rate,
                  bigWins:w.bigWins||0,totalBought,totalSold,totalPnl:computedPnl,adjustedPnl,isElite,
                  tokens:qualTrades.filter(t=>t.type==="WIN").map(t=>t.token),
                  lossTokens:qualTrades.filter(t=>t.type==="LOSS").map(t=>t.token),
                  holdTokens:allTrades.filter(t=>t.type==="HOLD").map(t=>t.token),
                  trades:allTrades};
              }).filter(Boolean).sort((a,b)=>b.totalPnl-a.totalPnl):[];
              const now_disp=Date.now();
              const INACTIVE_MS=10*60*1000; // 10 minutes
              const allWalletsVisible=allWallets.filter(w=>{
                if(w.isElite)return true; // smart wallets always visible
                const rawWs=wsRef?.current?.[w.addr];
                const lastAct=rawWs?.lastActivity||now_disp; // treat missing as "just active"
                return(now_disp-lastAct)<INACTIVE_MS;
              });
              const elite=allWalletsVisible.filter(w=>w.isElite);
              const genius=allWalletsVisible.filter(w=>w.rate>=80&&w.total>=2);
              const sharp=allWalletsVisible.filter(w=>w.rate>=60&&w.rate<80&&w.total>=2);
              const decent=allWalletsVisible.filter(w=>w.rate>=40&&w.rate<60&&w.total>=2);
              const lucky=allWalletsVisible.filter(w=>w.rate>=20&&w.rate<40&&w.total>=1);
              const degen=allWalletsVisible.filter(w=>w.rate<20&&w.total>=1);
              const unrated=allWalletsVisible.filter(w=>w.total===0);
              const all3plus=allWalletsVisible;
              const hiddenCount=allWallets.length-allWalletsVisible.length;

              // ── Sub-nav: SMART | ALL | TIERS ──
              const subNav=(
                <div style={{marginBottom:8}}>
                  <div style={{display:"flex",gap:3,marginBottom:hiddenCount>0?4:0,padding:"3px",
                    background:"rgba(0,0,0,0.2)",borderRadius:6,border:"1px solid rgba(255,255,255,0.06)"}}>
                    {[
                      {id:"smart",label:"🧠 SMART",color:"#00ff88",count:elite.length},
                      {id:"tiers",label:"◈ TIERS",color:"#ffa500",count:allWalletsVisible.length},
                      {id:"all",label:"≡ ALL",color:NEON.cyan,count:all3plus.length},
                    ].map(btn=>{
                      const isActive=(btn.id==="smart"&&reportTier==="SMART"&&reportView==="list")||(btn.id==="all"&&reportTier==="ALL"&&reportView==="list")||(btn.id==="tiers"&&(reportView==="tiers"||(reportView==="detail")||(reportView==="list"&&reportTier!=="SMART"&&reportTier!=="ALL")));
                      return(<button key={btn.id} onClick={()=>{
                        if(btn.id==="smart"){setReportTier("SMART");setReportView("list");setSelectedWallet(null);}
                        else if(btn.id==="all"){setReportTier("ALL");setReportView("list");setSelectedWallet(null);}
                        else{setReportView("tiers");setReportTier(null);setSelectedWallet(null);}
                      }} style={{flex:1,padding:"6px 4px",fontSize:9,fontWeight:900,cursor:"pointer",border:"none",
                        fontFamily:"'Orbitron',sans-serif",letterSpacing:0.5,borderRadius:4,transition:"all 0.15s",
                        background:isActive?`${btn.color}22`:"transparent",
                        color:isActive?btn.color:NEON.dimText,
                        outline:isActive?`1px solid ${btn.color}40`:"none"}}>
                        {btn.label}
                        <span style={{marginLeft:5,fontSize:8,
                          background:isActive?`${btn.color}30`:"rgba(255,255,255,0.07)",
                          padding:"1px 5px",borderRadius:3,color:isActive?btn.color:NEON.dimText}}>{btn.count}</span>
                      </button>);
                    })}
                  </div>
                  {hiddenCount>0&&<div style={{fontSize:8,color:NEON.dimText,textAlign:"center",padding:"2px 0",opacity:0.6,letterSpacing:1}}>
                    😴 {hiddenCount} wallet{hiddenCount>1?"s":""} inactive &gt;10m</div>}
                </div>);

              // Handle ALL tier in list view
              if(reportView==="list"&&reportTier==="ALL"){
                return(<div>
                  {subNav}
                  <div style={{fontSize:11,fontWeight:900,color:NEON.cyan,fontFamily:"Orbitron",letterSpacing:1,marginBottom:6,textAlign:"center"}}>
                    ALL WALLETS ({all3plus.length})</div>
                  {all3plus.length===0&&<div style={{color:NEON.dimText,fontSize:11,textAlign:"center",padding:20}}>No wallets tracked yet.</div>}
                  {all3plus.map((w2,wi)=>{
                    const pnl2=w2.totalPnl||0;
                    const tc=w2.isElite?"#00ff88":w2.rate>=80?"#ffd740":w2.rate>=60?"#00e5ff":w2.rate>=40?"#ffa500":w2.rate>=20?"#ba68c8":"#ff5252";
                    return(<div key={wi} onClick={()=>{setSelectedWallet(w2.addr);setReportView("detail");}}
                      style={{cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",
                        padding:"6px 8px",marginBottom:3,borderRadius:4,
                        background:"rgba(255,255,255,0.02)",border:`1px solid ${w2.isElite?"rgba(0,255,136,0.15)":"rgba(255,255,255,0.05)"}`,
                        transition:"background 0.2s"}}>
                      <div>
                        <div style={{fontSize:10,fontWeight:900,color:NEON.text,fontFamily:"monospace"}}>{w2.addr.slice(0,4)}...{w2.addr.slice(-4)}</div>
                        <div style={{fontSize:9,color:NEON.dimText}}>{w2.wins}W / {w2.losses}L / {w2.holds}H</div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:14,fontWeight:900,color:tc,fontFamily:"Orbitron"}}>{w2.rate}%</div>
                        <div style={{fontSize:9,fontWeight:700,color:pnl2>=0?NEON.green:NEON.red}}>{pnl2>=0?"+":""}{pnl2.toFixed(2)} SOL</div>
                      </div>
                    </div>);})}
                </div>);
              }

              if(reportView==="detail"&&selectedWallet){
                const w=allWallets.find(w2=>w2.addr===selectedWallet);
                if(!w)return <div style={{color:NEON.dimText,fontSize:11,textAlign:"center",padding:20}}>Wallet not found</div>;
                const tierColor=w.isElite?"#00ff88":w.rate>=80?"#ffd740":w.rate>=60?"#00e5ff":w.rate>=40?"#ffa500":w.rate>=20?"#ba68c8":"#ff5252";
                const tierLabel=w.isElite?"🧠 SMART":w.rate>=80?"GENIUS":w.rate>=60?"SHARP":w.rate>=40?"DECENT":w.rate>=20?"LUCKY":w.total>0?"DEGEN":"PENDING";
                // Use the wallet object's already-computed qual counts — re-filtering causes mismatch with rate
                const sigWins=w.wins;
                const sigLosses=w.losses;
                const sigHolds=w.holds;
                return(<div>
                  {subNav}
                  <div style={{background:"rgba(255,215,64,0.04)",border:"1px solid rgba(255,215,64,0.12)",borderRadius:6,padding:8,marginBottom:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                      <div style={{fontSize:10,fontWeight:900,color:tierColor,fontFamily:"Orbitron",letterSpacing:1}}>{tierLabel}</div>
                      <div style={{fontSize:22,fontWeight:900,color:tierColor,fontFamily:"Orbitron"}}>{w.rate}%</div>
                    </div>
                    <div style={{fontSize:9,color:NEON.dimText,wordBreak:"break-all",marginBottom:6,fontFamily:"monospace"}}>{w.addr}</div>
                    <div onClick={()=>{navigator.clipboard.writeText(w.addr);}}
                      style={{cursor:"pointer",fontSize:10,fontWeight:700,color:"#111",background:tierColor,
                        borderRadius:4,padding:"4px 8px",textAlign:"center",marginBottom:8}}>📋 COPY ADDRESS</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:4,marginBottom:4}}>
                      <div style={{background:"rgba(0,255,0,0.05)",borderRadius:4,padding:"4px",textAlign:"center"}}>
                        <div style={{fontSize:16,fontWeight:900,color:NEON.green,fontFamily:"Orbitron"}}>{sigWins}</div>
                        <div style={{fontSize:7,color:NEON.dimText}}>WINS</div></div>
                      <div style={{background:"rgba(255,0,0,0.05)",borderRadius:4,padding:"4px",textAlign:"center"}}>
                        <div style={{fontSize:16,fontWeight:900,color:NEON.red,fontFamily:"Orbitron"}}>{sigLosses}</div>
                        <div style={{fontSize:7,color:NEON.dimText}}>LOSSES</div></div>
                      <div style={{background:"rgba(255,200,0,0.05)",borderRadius:4,padding:"4px",textAlign:"center"}}>
                        <div style={{fontSize:16,fontWeight:900,color:"#ffa500",fontFamily:"Orbitron"}}>{sigHolds}</div>
                        <div style={{fontSize:7,color:NEON.dimText}}>HOLDS</div></div>
                      <div style={{background:w.totalPnl>=0?"rgba(0,255,0,0.05)":"rgba(255,0,0,0.05)",borderRadius:4,padding:"4px",textAlign:"center"}}>
                        <div style={{fontSize:14,fontWeight:900,color:w.totalPnl>=0?NEON.green:NEON.red,fontFamily:"Orbitron"}}>{w.totalPnl>=0?"+":""}{w.totalPnl.toFixed(2)}</div>
                        <div style={{fontSize:7,color:NEON.dimText}}>P&L SOL</div></div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginBottom:8}}>
                      <div style={{background:"rgba(0,200,255,0.05)",borderRadius:4,padding:"4px",textAlign:"center"}}>
                        <div style={{fontSize:12,fontWeight:900,color:NEON.cyan,fontFamily:"Orbitron"}}>{w.totalBought.toFixed(2)}</div>
                        <div style={{fontSize:7,color:NEON.dimText}}>SOL IN</div></div>
                      <div style={{background:"rgba(0,200,255,0.05)",borderRadius:4,padding:"4px",textAlign:"center"}}>
                        <div style={{fontSize:12,fontWeight:900,color:NEON.cyan,fontFamily:"Orbitron"}}>{w.totalSold.toFixed(2)}</div>
                        <div style={{fontSize:7,color:NEON.dimText}}>SOL OUT</div></div>
                    </div>
                  </div>
                  {/* ── ACTIVE POSITIONS (open buys not yet resolved) ── */}
                  {(()=>{
                    const rawWs=wsRef?.current?.[w.addr];
                    const activeBuys=rawWs?.activeBuys?Object.values(rawWs.activeBuys):[];
                    if(activeBuys.length===0)return null;
                    return(<div style={{marginBottom:6,padding:"6px 8px",borderRadius:5,
                      background:"rgba(0,255,204,0.04)",border:"1px solid rgba(0,255,204,0.2)",
                      boxShadow:"0 0 8px rgba(0,255,204,0.08)"}}>
                      <div style={{fontSize:9,fontWeight:900,color:"#00ffcc",fontFamily:"Orbitron",letterSpacing:1,marginBottom:5}}>
                        🟢 ACTIVE POSITION{activeBuys.length>1?"S":""}</div>
                      {activeBuys.map((ab,i)=>{
                        const ageS=Math.floor((Date.now()-ab.time)/1000);
                        const fmtAge=ageS<60?ageS+"s":Math.floor(ageS/60)+"m";
                        // Try to get current mcap from live tokens
                        const liveTok=tokens.find(t=>t.addr===ab.addr);
                        const currentMc=liveTok?.mcap||ab.entryMcap||0;
                        const mcPct=ab.entryMcap>0?((currentMc-ab.entryMcap)/ab.entryMcap*100):0;
                        const estPnl=ab.entryMcap>0?(ab.sol*(currentMc/ab.entryMcap)-ab.sol):0;
                        return(<div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                          padding:"4px 6px",borderRadius:3,background:"rgba(0,255,204,0.04)",marginBottom:3,
                          border:`1px solid ${mcPct>=0?"rgba(0,255,204,0.1)":"rgba(255,7,58,0.1)"}`}}>
                          <div style={{display:"flex",alignItems:"center",gap:5}}>
                            <div style={{width:5,height:5,borderRadius:"50%",background:"#00ffcc",
                              boxShadow:"0 0 4px #00ffcc",animation:"blink 1s infinite",flexShrink:0}}/>
                            <div>
                              <span onClick={()=>clickAddr(ab.addr,{name:ab.token,addr:ab.addr,mcap:currentMc,athMcap:ab.entryMcap||0,vol:0,holders:0,platform:"PumpFun",qualScore:0,riskScore:0,liquidity:0,topHolderPct:0})}
                                style={{color:NEON.text,fontWeight:700,cursor:"pointer",fontSize:11,
                                  textDecoration:"underline",textDecorationStyle:"dotted",textUnderlineOffset:2,display:"block"}}>{ab.token}</span>
                              <span style={{fontSize:7,color:NEON.dimText}}>{fmtAge} ago · in ${formatNum(ab.entryMcap||0)}</span>
                            </div>
                          </div>
                          <div style={{textAlign:"right",flexShrink:0}}>
                            <div style={{fontSize:10,fontWeight:900,color:mcPct>=0?NEON.green:NEON.red}}>
                              {mcPct>=0?"▲":"▼"}{Math.abs(mcPct).toFixed(0)}%
                              <span style={{fontSize:8,marginLeft:4,color:estPnl>=0?NEON.green:NEON.red}}>
                                {estPnl>=0?"+":""}{estPnl.toFixed(2)} SOL</span>
                            </div>
                            <div style={{fontSize:8,color:NEON.dimText}}>{ab.sol.toFixed(2)} SOL in</div>
                          </div>
                        </div>);
                      })}
                    </div>);
                  })()}
                  {/* ── UNREALIZED SECTION ── */}
                  {sigHolds>0&&(()=>{
                      const holdTrades=w.trades.filter(tr=>tr.type==="HOLD");
                      const totalUnrealized=holdTrades.reduce((s,tr)=>{
                        const entryMc=tr.entryMcap||0;
                        const currentMc=tr.mcap||0;
                        const mcPct=entryMc>0?(currentMc-entryMc)/entryMc:0;
                        const stillExposed=Math.max(0,(tr.sol||0)-(tr.sold||0));
                        const banked=(tr.sold||0)-(tr.sol||0);
                        return s+banked+(stillExposed*mcPct);
                      },0);
                      const deeplyUnder=holdTrades.filter(tr=>{
                        const entryMc=tr.entryMcap||0;
                        const currentMc=tr.mcap||0;
                        return entryMc>0&&currentMc<entryMc*0.7;
                      });
                      return(<div style={{marginBottom:6,padding:"6px 8px",borderRadius:5,
                        background:totalUnrealized>=0?"rgba(57,255,20,0.04)":"rgba(255,7,58,0.06)",
                        border:`1px solid ${totalUnrealized>=0?"rgba(57,255,20,0.15)":"rgba(255,7,58,0.2)"}`}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                          <span style={{fontSize:9,fontWeight:900,color:"#ffa500",fontFamily:"Orbitron",letterSpacing:1}}>⏳ UNREALIZED</span>
                          <span style={{fontSize:13,fontWeight:900,color:totalUnrealized>=0?NEON.green:NEON.red,fontFamily:"Orbitron"}}>
                            {totalUnrealized>=0?"+":""}{totalUnrealized.toFixed(2)} SOL</span>
                        </div>
                        {holdTrades.map((tr,hi)=>{
                          const entryMc=tr.entryMcap||0;
                          const currentMc=tr.mcap||0;
                          const mcPct=entryMc>0?((currentMc-entryMc)/entryMc*100):0;
                          const solIn=tr.sol||0;
                          const solOut=tr.sold||0;
                          const bagSize=Math.max(0,solIn-solOut); // remaining SOL exposure
                          const bagNow=entryMc>0?bagSize*(currentMc/entryMc):bagSize; // current worth
                          const bagPnl=bagNow-bagSize; // gain/loss on remaining bag
                          const hasPartialExit=solOut>0;
                          const banked=solOut-(solIn*(solOut/solIn)); // realized portion pnl
                          const up=mcPct>=0;
                          return(<div key={hi} style={{padding:"5px 7px",marginBottom:3,borderRadius:4,fontSize:9,
                            background:up?"rgba(57,255,20,0.03)":"rgba(255,7,58,0.06)",
                            border:`1px solid ${up?"rgba(57,255,20,0.1)":"rgba(255,7,58,0.15)"}`}}>
                            {/* Top: name + CA + % arrow */}
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                              <div style={{display:"flex",alignItems:"center",gap:4}}>
                                <span onClick={()=>selectByName(tr.token,{name:tr.token,addr:tr.addr,mcap:currentMc,athMcap:tr.athMcap||0,vol:0,holders:0,platform:"PumpFun",qualScore:0,riskScore:0,liquidity:0,topHolderPct:0})}
                                  style={{color:NEON.text,cursor:"pointer",fontWeight:700,fontSize:11,
                                    textDecoration:"underline",textDecorationStyle:"dotted",textUnderlineOffset:2}}>{tr.token}</span>
                                <span onClick={()=>clickAddr(tr.addr,{name:tr.token,addr:tr.addr,mcap:currentMc,athMcap:tr.athMcap||0,vol:0,holders:0,platform:"PumpFun",qualScore:0,riskScore:0,liquidity:0,topHolderPct:0})}
                                  style={{fontSize:7,color:NEON.cyan,cursor:"pointer",
                                    background:"rgba(0,255,255,0.06)",padding:"0 3px",borderRadius:2,fontFamily:"monospace"}}>CA</span>
                              </div>
                              <span style={{fontSize:12,fontWeight:900,color:up?NEON.green:NEON.red}}>
                                {up?"▲":"▼"}{Math.abs(mcPct).toFixed(0)}%</span>
                            </div>
                            {/* Bottom: entry SOL | bag now | ATH mcap | banked if partial */}
                            <div style={{display:"flex",gap:10,fontSize:8,color:NEON.dimText,flexWrap:"wrap"}}>
                              <span>In <span style={{color:NEON.cyan}}>{solIn.toFixed(2)} SOL</span></span>
                              <span>Bag <span style={{color:up?NEON.green:NEON.red,fontWeight:700}}>{bagNow.toFixed(2)} SOL</span>
                                <span style={{color:up?NEON.green:NEON.red,marginLeft:2}}>({bagPnl>=0?"+":""}{bagPnl.toFixed(2)})</span>
                              </span>
                              <span>ATH <span style={{color:"#ffd740"}}>${formatNum(tr.athMcap||0)}</span></span>
                              {hasPartialExit&&<span style={{color:"#ffa500"}}>banked {(solOut).toFixed(2)} SOL</span>}
                            </div>
                          </div>);
                        })}
                        {deeplyUnder.length>0&&<div style={{fontSize:8,color:NEON.red,marginTop:3,opacity:0.8}}>
                          ⚠ {deeplyUnder.length} hold{deeplyUnder.length>1?"s":""} deeply underwater — check real win rate</div>}
                      </div>);
                  })()}
                  <div style={{fontSize:10,fontWeight:900,color:"#ffa500",fontFamily:"Orbitron",letterSpacing:0.5,marginBottom:4}}>TRADES</div>
                  {w.trades.length===0&&<div style={{color:NEON.dimText,fontSize:10,padding:8}}>No trade details recorded yet</div>}
                  {w.trades.slice().reverse().filter(tr=>{
                    // Show all resolved trades — the data layer already filtered out noise
                    // Only hide tiny wins/losses that slipped through on HOLDs
                    if(tr.type==="WIN"||tr.type==="LOSS") return true;
                    return true; // always show HOLDs/PARTIALs
                  }).map((tr,ti)=>{
                    const sells=tr.sellEvents||[];
                    const solIn=tr.sol||0;
                    const solOut=tr.sold||0;
                    const soldRatio=solIn>0?Math.min(1,solOut/solIn):0;
                    const bagPct=Math.max(0,Math.round((1-soldRatio)*100));
                    const isHold=tr.type==="HOLD";
                    const isPartial=isHold&&solOut>0;
                    const isClosed=!isHold||soldRatio>=0.95;
                    const trPnl=tr.pnl!=null?tr.pnl:((tr.sold||0)-tr.sol);
                    const typeColor=tr.type==="WIN"?NEON.green:tr.type==="LOSS"?NEON.red:isPartial?"#00e5ff":"#ffa500";
                    const statusLabel=tr.type==="WIN"?"WIN":tr.type==="LOSS"?"LOSS":isPartial?"PARTIAL":"HOLD";
                    // Build sell rows — fallback if no sellEvents recorded
                    const sellRows=sells.length>0?sells:
                      solOut>0?[{sol:solOut,mcap:tr.mcap||0,time:tr.exitTime}]:
                      tr.type==="LOSS"?[]:  // token died with no sells — show nothing, note below
                      [];
                    let bagLeft=solIn;
                    const sellsWithPct=sellRows.map((s,si)=>{
                      const pctOfRemaining=bagLeft>0.01?Math.min(100,Math.round(s.sol/bagLeft*100)):100;
                      bagLeft=Math.max(0,bagLeft-s.sol);
                      const isLast=si===sellRows.length-1&&bagLeft<0.05;
                      return{...s,pctOfRemaining,bagLeft,isLast};
                    });
                    return(
                    <div key={ti} style={{padding:"6px 8px",marginBottom:6,borderRadius:5,fontSize:10,
                      background:tr.type==="WIN"?"rgba(57,255,20,0.04)":tr.type==="LOSS"?"rgba(255,7,58,0.04)":isPartial?"rgba(0,229,255,0.04)":"rgba(255,165,0,0.04)",
                      border:`1px solid ${typeColor}20`,borderLeft:`3px solid ${typeColor}`}}>
                      {/* Header row: status + name + CA + PnL */}
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                        <div style={{display:"flex",alignItems:"center",gap:5}}>
                          <span style={{color:typeColor,fontWeight:900,fontSize:8,background:`${typeColor}18`,
                            padding:"2px 6px",borderRadius:3,fontFamily:"Orbitron",letterSpacing:0.5}}>{statusLabel}</span>
                          <span onClick={()=>selectByName(tr.token,{name:tr.token,addr:tr.addr,mcap:tr.mcap||0,athMcap:tr.athMcap||0,vol:0,holders:0,platform:"PumpFun",qualScore:0,riskScore:0,liquidity:0,topHolderPct:0})}
                            style={{color:NEON.text,fontWeight:700,cursor:"pointer",fontSize:11,
                              textDecoration:"underline",textDecorationStyle:"dotted",textUnderlineOffset:2}}>{tr.token}</span>
                          <span onClick={()=>clickAddr(tr.addr,{name:tr.token,addr:tr.addr,mcap:tr.mcap||0,athMcap:tr.athMcap||0,vol:0,holders:0,platform:"PumpFun",qualScore:0,riskScore:0,liquidity:0,topHolderPct:0})}
                            style={{fontSize:7,color:NEON.cyan,cursor:"pointer",
                              background:"rgba(0,255,255,0.06)",padding:"1px 4px",borderRadius:3,fontFamily:"monospace"}}>CA</span>
                        </div>
                        <div style={{textAlign:"right"}}>
                          {isClosed&&<div style={{fontSize:13,fontWeight:900,color:typeColor}}>
                            {trPnl>=0?"+":""}{trPnl.toFixed(2)} SOL</div>}
                          {isPartial&&<div style={{fontSize:11,fontWeight:900,color:NEON.cyan}}>
                            {Math.round(soldRatio*100)}% out</div>}
                        </div>
                      </div>
                      {/* Bag gauge */}
                      <div style={{marginBottom:5}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
                          <span style={{fontSize:7,color:NEON.dimText,fontFamily:"Orbitron",letterSpacing:1}}>BAG</span>
                          <span style={{fontSize:7,color:bagPct===0?NEON.dimText:bagPct<30?NEON.red:bagPct<70?"#ffa500":NEON.green,fontFamily:"Orbitron"}}>
                            {bagPct}%</span>
                        </div>
                        <div style={{height:4,borderRadius:2,background:"rgba(255,255,255,0.06)",overflow:"hidden"}}>
                          <div style={{
                            height:"100%",
                            width:`${bagPct}%`,
                            borderRadius:2,
                            background:bagPct===0?"transparent":bagPct<30?
                              "linear-gradient(90deg,#ff073a,#ff4040)":bagPct<70?
                              "linear-gradient(90deg,#ffa500,#ffd740)":
                              "linear-gradient(90deg,#39ff14,#00ffcc)",
                            transition:"width 0.4s ease",
                            boxShadow:bagPct>0?`0 0 6px ${bagPct<30?"#ff073a":bagPct<70?"#ffa500":"#39ff14"}40`:undefined
                          }}/>
                        </div>
                      </div>
                      {/* Entry line */}
                      <div style={{display:"flex",gap:6,alignItems:"center",fontSize:9,marginBottom:4,
                        padding:"3px 5px",background:"rgba(255,255,255,0.03)",borderRadius:3}}>
                        <span style={{color:NEON.dimText,fontFamily:"Orbitron",fontSize:7,letterSpacing:1}}>BUY</span>
                        <span style={{color:NEON.dimText}}>{solIn.toFixed(2)} SOL</span>
                        <span style={{color:NEON.dimText}}>@</span>
                        <span style={{color:NEON.cyan,fontWeight:700}}>${formatNum(tr.entryMcap||0)}</span>
                        <span style={{color:NEON.dimText,marginLeft:"auto"}}>ATH <span style={{color:"#ffd740"}}>${formatNum(tr.athMcap||0)}</span></span>
                      </div>
                      {/* Sell events */}
                      {sellsWithPct.map((s,si)=>{
                        const sellPnlEst=(s.sol/solIn)*trPnl; // proportional pnl for this sell
                        return(
                        <div key={si} style={{display:"flex",gap:6,alignItems:"center",fontSize:9,marginBottom:2,
                          padding:"3px 5px",borderRadius:3,
                          background:s.isLast?"rgba(255,255,255,0.04)":"rgba(255,255,255,0.02)"}}>
                          <span style={{color:typeColor,fontFamily:"Orbitron",fontSize:7,letterSpacing:1,flexShrink:0}}>
                            SELL {si+1}{s.isLast?" 🔒":""}</span>
                          <span style={{color:NEON.dimText,flexShrink:0}}>{s.sol.toFixed(2)} SOL</span>
                        <span style={{color:NEON.dimText,fontSize:8,flexShrink:0}}>({s.pctOfRemaining}% of bag)</span>
                          <span style={{color:NEON.dimText}}>@ <span style={{color:s.mcap>=12000?NEON.green:"#ffa500",fontWeight:700}}>${formatNum(s.mcap)}</span></span>
                          {!isClosed&&si===sellsWithPct.length-1&&s.bagLeft>0.01&&
                            <span style={{marginLeft:"auto",fontSize:8,color:NEON.dimText}}>
                              {s.bagLeft.toFixed(2)} SOL left</span>}
                        </div>);
                      })}
                      {/* No sells — token died with bag */}
                      {sellsWithPct.length===0&&tr.type==="LOSS"&&<div style={{fontSize:8,color:NEON.red,padding:"3px 5px",
                        background:"rgba(255,7,58,0.06)",borderRadius:3,fontStyle:"italic"}}>
                        💀 Token died — never exited · lost {solIn.toFixed(2)} SOL</div>}
                      {/* Still holding remainder note */}
                      {isHold&&!isPartial&&<div style={{fontSize:8,color:"#ffa500",marginTop:2,fontStyle:"italic"}}>
                        Still holding — no sells yet</div>}
                    </div>)})}
                </div>);
              }

              if(reportView==="list"&&reportTier){
                const tierWallets=reportTier==="SMART"?elite:reportTier==="GENIUS"?genius:reportTier==="SHARP"?sharp:reportTier==="DECENT"?decent:reportTier==="LUCKY"?lucky:reportTier==="DEGEN"?degen:reportTier==="PENDING"?unrated:all3plus;
                const tierColor2=reportTier==="SMART"?"#00ff88":reportTier==="GENIUS"?"#ffd740":reportTier==="SHARP"?"#00e5ff":reportTier==="DECENT"?"#ffa500":reportTier==="LUCKY"?"#ba68c8":reportTier==="PENDING"?"#666":"#ff5252";
                return(<div>
                  {subNav}
                  <div style={{fontSize:12,fontWeight:900,color:tierColor2,fontFamily:"Orbitron",letterSpacing:1,marginBottom:8,textAlign:"center"}}>
                    {reportTier} WALLETS ({tierWallets.length})</div>
                  {tierWallets.length===0&&<div style={{color:NEON.dimText,fontSize:11,textAlign:"center",padding:20}}>
                    No wallets at this tier yet.<br/>Keep the session running.</div>}
                  {tierWallets.map((w2,wi)=>{
                    const pnl2=w2.totalPnl||0;
                    return(
                    <div key={wi} onClick={()=>{setSelectedWallet(w2.addr);setReportView("detail");}}
                      style={{cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",
                        padding:"6px 8px",marginBottom:3,borderRadius:4,
                        background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",
                        transition:"background 0.2s"}}>
                      <div>
                        <div style={{fontSize:10,fontWeight:900,color:NEON.text,fontFamily:"monospace"}}>{w2.addr.slice(0,4)}...{w2.addr.slice(-4)}</div>
                        <div style={{fontSize:9,color:NEON.dimText}}>{w2.wins}W / {w2.losses}L / {w2.holds}H · {w2.totalBought.toFixed(1)} SOL</div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:16,fontWeight:900,color:tierColor2,fontFamily:"Orbitron"}}>{w2.rate}%</div>
                        <div style={{fontSize:9,fontWeight:700,color:pnl2>=0?NEON.green:NEON.red}}>{pnl2>=0?"+":""}{pnl2.toFixed(2)} SOL</div>
                      </div>
                    </div>)})}
                </div>);
              }

              // Default: TIERS view
              return(<div>
                {subNav}
                <div style={{fontSize:12,fontWeight:900,color:"#ffa500",fontFamily:"Orbitron",letterSpacing:1,
                  textAlign:"center",marginBottom:8}}>WALLET TIERS</div>
                {[
                  {tier:"SMART",label:"🧠 SMART WALLETS",desc:"4+ wins · 60%+ rate · 1.0 SOL profit · 12K+ exit only",wallets:elite,color:"#00ff88",bg:"rgba(0,255,136,0.07)",glow:true},
                  {tier:"GENIUS",label:"🎯 GENIUS",desc:"80-100% win rate",wallets:genius,color:"#ffd740",bg:"rgba(255,215,64,0.06)"},
                  {tier:"SHARP",label:"⚡ SHARP",desc:"60-79% win rate",wallets:sharp,color:"#00e5ff",bg:"rgba(0,229,255,0.04)"},
                  {tier:"DECENT",label:"📊 DECENT",desc:"40-59% win rate",wallets:decent,color:"#ffa500",bg:"rgba(255,165,0,0.04)"},
                  {tier:"LUCKY",label:"🍀 LUCKY",desc:"20-39% win rate",wallets:lucky,color:"#ba68c8",bg:"rgba(186,104,200,0.04)"},
                  {tier:"DEGEN",label:"💀 DEGEN",desc:"<20% win rate",wallets:degen,color:"#ff5252",bg:"rgba(255,82,82,0.04)"},
                  {tier:"PENDING",label:"⏳ PENDING",desc:"holds only, no resolved trades",wallets:unrated,color:"#666",bg:"rgba(100,100,100,0.04)"},
                ].map((t2,ti2)=>(
                  <div key={ti2} onClick={()=>{setReportTier(t2.tier);setReportView("list");}}
                    style={{cursor:"pointer",marginBottom:6,borderRadius:6,overflow:"hidden",
                      border:`1px solid ${t2.color}${t2.glow?"55":"22"}`,background:t2.bg,
                      boxShadow:t2.glow&&t2.wallets.length>0?`0 0 12px ${t2.color}25`:undefined,
                      transition:"background 0.2s"}}>
                    <div style={{padding:"8px 10px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div>
                        <div style={{fontSize:12,fontWeight:900,color:t2.color,fontFamily:"Orbitron"}}>{t2.label}</div>
                        <div style={{fontSize:9,color:NEON.dimText,marginTop:2}}>{t2.desc}</div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:22,fontWeight:900,color:t2.color,fontFamily:"Orbitron"}}>{t2.wallets.length}</div>
                        <div style={{fontSize:8,color:NEON.dimText}}>WALLETS</div>
                      </div>
                    </div>
                    {t2.wallets.length>0&&<div style={{padding:"4px 10px 6px",borderTop:`1px solid ${t2.color}11`,fontSize:9,color:NEON.dimText}}>
                      Top: {t2.wallets.slice(0,3).map(w3=>w3.addr.slice(0,6)+"..").join(", ")}
                    </div>}
                  </div>
                ))}
                <div style={{marginTop:8,fontSize:9,color:"rgba(255,255,255,0.15)",textAlign:"center"}}>
                  {allWallets.length} wallets tracked this session
                </div>
              </div>);
            })()}
          </div>}


          </div>
        </GlassPanel>

        {/* CENTER: BATTLEFIELD */}
        <GlassPanel accent={NEON.cyan} style={{position:"relative",overflow:"hidden"}}>
          <BattlefieldMap tokens={tokens} lockedTokens={lockedTokens} onSelect={selectToken}
            selectedId={selectedToken?.id} onKillFeed={addKillFeed} onAlienUpdate={setAlienStats}
            onMenuToggle={()=>setShowMenu(p=>!p)} whaleTrigger={whaleTriggerRef} dolphinTrigger={dolphinTriggerRef}/>
          <KillFeed events={killFeed} onSelectByName={selectByName}/>
          {/* ═══ INTEL PANEL — bottom of battlefield on token select ═══ */}
          {selectedToken&&(()=>{
            const token=selectedToken;
            const stats=[
              {l:"MCAP",v:"$"+formatNum(token.mcap),c:NEON.cyan},{l:"VOL",v:"$"+formatNum(token.vol),c:NEON.yellow},
              {l:"HOLDERS",v:token.holders,c:token.holders>100?NEON.green:NEON.red},
              {l:"DEV%",v:token.devWallet.toFixed(1)+"%",c:token.devWallet>15?NEON.red:NEON.green},
              {l:"B/S",v:`${token.buys}/${token.sells}`,c:NEON.text},
              {l:"QUAL",v:token.qualScore+"/8",c:NEON.green},
            ];
            const edgeStats=[
              {l:"👻 FRESH",v:(token.freshPct||0)+"%",c:(token.freshPct||0)>75?NEON.red:(token.freshPct||0)<50?NEON.green:NEON.yellow},
              {l:"⚡ VEL",v:(token.velocity||0)+"/30s",c:token.accelerating?NEON.green:NEON.dimText},
              {l:"🐟 RETAIL",v:(token.smallBuyRatio||0)+"%",c:(token.smallBuyRatio||0)>50?NEON.green:NEON.orange},
              {l:"💎 RETAIN",v:(token.retentionPct||0)+"%",c:(token.retentionPct||0)>60?NEON.green:NEON.red},
              {l:"🏷 DEPLOY",v:(token.deployerGrade||"?"),c:token.deployerGrade==="A"?NEON.green:token.deployerGrade==="B"?NEON.cyan:token.deployerGrade==="C"?NEON.orange:NEON.red},
              ...(token.isSerialRugger?[{l:"🏴‍☠️ RUGGER",v:`${token.deployerRugs} rugs`,c:"#ff073a"}]:[]),
              {l:"😴 STALE",v:(token.staleSec||0)+"s",c:token.isDead?NEON.red:token.isStale?"#ff6600":NEON.green},
              ...(token.bundleDetected?[{l:"⚠ BNDL",v:`${token.bundleSize||"?"}w`,c:NEON.red}]:[]),
              ...(token.hasSmartMoney?[{l:"🧠 SM$",v:`${token.smartWalletCount||1}w`,c:"#ff9500"}]:[]),
              ...(token.narrativeMatch?[{l:"🔥 TREND",v:token.narrativeWord||"hot",c:NEON.pink}]:[]),
              ...(token.liquidity>0?[{l:"💧 LIQ",v:"$"+formatNum(token.liquidity),c:NEON.cyan}]:[]),
              ...(token.mintAuth!==undefined?[{l:"🔑 MINT",v:token.mintAuth?"⚠":"✓",c:token.mintAuth?NEON.red:NEON.green}]:[]),
              ...(token.rugLevel?[{l:"🛡 RUG",v:token.rugLevel,c:token.rugLevel==="SAFE"?NEON.green:token.rugLevel==="CAUTION"?NEON.yellow:NEON.red}]:[]),
              ...(token.lpLocked?[{l:"🔒 LP",v:"LOCKED",c:NEON.green}]:[]),
              ...(token.bondingPct!=null&&!token.migrated?[{l:"📈 CURVE",v:token.bondingPct.toFixed(0)+"%",c:token.bondingPct>80?NEON.green:token.bondingPct>50?NEON.cyan:NEON.dimText}]:[]),
              ...(token.onGeckoTrending?[{l:"🦎 GECKO",v:"TRENDING",c:NEON.green}]:[]),
              ...(token.onDefinedTrending?[{l:"📡 BUZZ",v:"ACTIVE",c:"#00ccff"}]:[]),
              ...(token.trendScore>=2?[{l:"🔥 MULTI",v:token.trendScore+"x SRC",c:"#ffd740"}]:[]),
              ...(token.geckoChange5m!=null?[{l:"Δ5m",v:(token.geckoChange5m>0?"+":"")+token.geckoChange5m.toFixed(1)+"%",c:token.geckoChange5m>0?NEON.green:NEON.red}]:[]),
              ...(token.geckoChange1h!=null?[{l:"Δ1h",v:(token.geckoChange1h>0?"+":"")+token.geckoChange1h.toFixed(1)+"%",c:token.geckoChange1h>0?NEON.green:NEON.red}]:[]),
              ...(token.geckoReserve>0?[{l:"💧 RES",v:"$"+formatNum(token.geckoReserve),c:NEON.cyan}]:[]),
              ...(token.stVol1h>0?[{l:"📊 V1H",v:"$"+formatNum(token.stVol1h),c:NEON.yellow}]:[]),
              ...(token.jupVerified?[{l:"✓ JUP",v:"VERIFIED",c:NEON.green}]:[]),
              ...(token.liquidityRating?[{l:"💧 DEPTH",v:token.liquidityRating,c:token.liquidityRating==="DEEP"?NEON.green:token.liquidityRating==="OK"?NEON.cyan:token.liquidityRating==="THIN"?NEON.orange:NEON.red}]:[]),
              ...(token.slippage5k!=null?[{l:"📉 SLIP",v:token.slippage5k.toFixed(1)+"%",c:token.slippage5k<10?NEON.green:token.slippage5k<30?NEON.orange:NEON.red}]:[]),
              ...(token.replyCount>0?[{l:"💬 BUZZ",v:token.replyCount,c:token.replyCount>20?NEON.green:token.replyCount>5?NEON.cyan:NEON.dimText}]:[]),
              ...(token.isKOTH?[{l:"👑 KOTH",v:"YES",c:"#ffd740"}]:[]),
              ...(token.hasSocials?[{l:"🌐 SOC",v:"YES",c:NEON.cyan}]:[]),
              ...(token.activityLevel?[{l:"🔥 ACT",v:token.activityLevel,c:token.activityLevel==="BLAZING"?"#ffd740":token.activityLevel==="HOT"?NEON.green:token.activityLevel==="ACTIVE"?NEON.cyan:NEON.dimText}]:[]),
              ...(token.rayBurnPct>0?[{l:"🔥 BURN",v:token.rayBurnPct.toFixed(0)+"%LP",c:token.rayBurnPct>90?NEON.green:token.rayBurnPct>50?NEON.cyan:NEON.orange}]:[]),
              ...(token.rayTvl>0?[{l:"💎 TVL",v:"$"+formatNum(token.rayTvl),c:NEON.cyan}]:[]),
            ];
            return(<div style={{position:"absolute",bottom:0,left:0,right:0,zIndex:20,
              background:"rgba(5,3,14,0.94)",backdropFilter:"blur(10px)",
              borderTop:`1px solid ${token.threatColor||NEON.cyan}40`,
              maxHeight:"45%",overflow:"auto",padding:"6px 10px"}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,flexWrap:"wrap"}}>
                <div style={{display:"flex",flexDirection:"column",gap:1}}>
                  <span style={{color:token.threatColor,fontSize:14,fontWeight:900,fontFamily:"'Orbitron',sans-serif",letterSpacing:2}}>◉ {token.name}</span>
                  {token.fullName&&token.fullName!==token.name&&<span style={{fontSize:9,color:NEON.dimText,letterSpacing:0.5,fontStyle:"italic"}}>{token.fullName}</span>}
                </div>
                <span style={{fontSize:11,color:PLATFORM_COLORS[token.platform]||NEON.dimText,background:"rgba(255,255,255,0.04)",
                  padding:"1px 6px",borderRadius:8,border:`1px solid ${(PLATFORM_COLORS[token.platform]||NEON.dimText)}30`}}>{token.platform}</span>
                <span onClick={()=>navigator.clipboard.writeText(token.addr)} style={{fontSize:11,color:NEON.cyan,cursor:"pointer",
                  opacity:0.7}} title={token.addr}>📋 {formatAddr(token.addr)}</span>
                {token.migrated&&<span style={{fontSize:10,color:NEON.green,fontWeight:700}}>🌉 MIG</span>}
                <button onClick={()=>lockToken(token)} style={{background:`linear-gradient(135deg,${NEON.yellow}18,${NEON.yellow}08)`,
                  border:`1px solid ${NEON.yellow}30`,color:NEON.yellow,padding:"2px 10px",borderRadius:4,cursor:"pointer",
                  fontFamily:"'Share Tech Mono',monospace",fontSize:12}}>🎯 LOCK</button>
                <button onClick={()=>{setSelectedToken(null)}} style={{marginLeft:"auto",background:"none",border:"none",
                  color:NEON.dimText,cursor:"pointer",fontSize:16,padding:"2px 6px"}}>✕</button>
              </div>
              <div style={{display:"flex",gap:3,marginBottom:4,flexWrap:"wrap"}}>
                {token.qualChecks?.map((ch,i)=>(
                  <span key={i} style={{fontSize:10,padding:"1px 4px",borderRadius:6,
                    background:ch.pass?"rgba(57,255,20,0.06)":"rgba(255,7,58,0.06)",
                    color:ch.pass?NEON.green:NEON.red}}>{ch.pass?"✓":"✗"} {ch.name}</span>))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:2,marginBottom:4}}>
                {stats.map(s=>(<div key={s.l} style={{background:"rgba(255,255,255,0.02)",borderRadius:3,padding:"2px 4px",textAlign:"center"}}>
                  <div style={{fontSize:8,color:NEON.dimText,letterSpacing:1}}>{s.l}</div>
                  <div style={{fontSize:12,color:s.c,fontWeight:700}}>{s.v}</div></div>))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:2}}>
                {edgeStats.map(s=>(<div key={s.l} style={{padding:"1px 3px"}}>
                  <span style={{fontSize:9,color:NEON.dimText}}>{s.l} </span>
                  <span style={{fontSize:11,color:s.c,fontWeight:700}}>{s.v}</span></div>))}
              </div>
            </div>);
          })()}
          {/* ═══ MENU OVERLAY — removed, moon reserved for future interaction ═══ */}
        </GlassPanel>

        {/* RIGHT COLUMN — 6-TAB INTEL SYSTEM */}
        <div style={{display:"flex",flexDirection:"column",gap:6,overflow:"hidden"}}>
          {/* RADAR + FLEET tabs */}
          <GlassPanel accent={radarTab==="FLEET"?"#ff00ff":NEON.cyan} style={{flexShrink:0}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"2px 8px",gap:2}}>
              {[{id:"RADAR",icon:"📡",label:"RADAR"},{id:"FLEET",icon:"👾",label:"FLEET"}].map(t=>(
                <button key={t.id} onClick={()=>setRadarTab(t.id)} style={{
                  padding:"3px 10px",fontSize:10,fontWeight:700,cursor:"pointer",border:"none",
                  fontFamily:"'Orbitron',sans-serif",letterSpacing:1,borderRadius:4,
                  background:radarTab===t.id?"rgba(0,255,255,0.12)":"transparent",
                  color:radarTab===t.id?(t.id==="FLEET"?"#ff00ff":NEON.cyan):NEON.dimText,
                }}>{t.icon} {t.label}</button>
              ))}
            </div>
            {radarTab==="RADAR"&&<div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"4px 0"}}>
              <RadarScope pings={radarPings}/></div>}
            {radarTab==="FLEET"&&<div style={{padding:"4px 6px",maxHeight:200,overflow:"auto"}}>
              {alienStats.map((a,i)=>{
                const pct=a.nextTier?Math.min(100,((a.kills-[0,30,70,120,180,250][a.tier])/(a.nextTier.kills-[0,30,70,120,180,250][a.tier]))*100):100;
                const maxed=!a.nextTier;
                return(<div key={i} style={{background:"rgba(5,3,14,0.85)",border:`1px solid ${a.color}40`,
                  borderLeft:`3px solid ${a.color}`,padding:"6px 8px",marginBottom:3,borderRadius:4}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                    <span style={{fontSize:10,fontWeight:900,color:a.color,fontFamily:"'Orbitron',sans-serif",
                      letterSpacing:1,textShadow:`0 0 8px ${a.color}50`}}>{a.name}</span>
                    <span style={{fontSize:7,color:a.state==="shooting"?"#ff073a":a.state==="hunting"?"#ffe600":"#39ff14",
                      fontWeight:700,letterSpacing:1,padding:"1px 5px",borderRadius:3,
                      background:a.state==="shooting"?"rgba(255,7,58,0.15)":"rgba(57,255,20,0.1)"}}>
                      {a.state==="shooting"?"🔥 FIRING":a.state==="hunting"?"🎯 HUNTING":"🛸 PATROL"}</span>
                  </div>
                  <div style={{display:"flex",gap:10,marginBottom:4}}>
                    <div><div style={{fontSize:7,color:NEON.dimText,letterSpacing:1}}>KILLS</div>
                      <div style={{fontSize:16,fontWeight:900,color:a.color,fontFamily:"'Orbitron',sans-serif"}}>{a.kills}</div></div>
                    <div><div style={{fontSize:7,color:NEON.dimText,letterSpacing:1}}>TIER</div>
                      <div style={{fontSize:16,fontWeight:900,color:NEON.text,fontFamily:"'Orbitron',sans-serif"}}>{a.tier+1}/6</div></div>
                    <div style={{flex:1}}><div style={{fontSize:7,color:NEON.dimText,letterSpacing:1}}>WEAPON</div>
                      <div style={{fontSize:10,fontWeight:700,color:maxed?"#ffd740":NEON.text}}>{a.weapon}{maxed?" ★":""}</div></div>
                  </div>
                  {!maxed?(<div>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                      <span style={{fontSize:7,color:NEON.dimText}}>NEXT: {a.nextTier?.weapon}</span>
                      <span style={{fontSize:7,color:a.color}}>{a.nextTier?.kills-a.kills} kills</span></div>
                    <div style={{height:3,background:"rgba(255,255,255,0.06)",borderRadius:2,overflow:"hidden"}}>
                      <div style={{height:"100%",width:pct+"%",borderRadius:2,
                        background:`linear-gradient(90deg,${a.color}90,${a.color})`,
                        boxShadow:`0 0 6px ${a.color}60`,transition:"width 0.3s ease"}}/></div>
                  </div>):(<div style={{fontSize:8,color:"#ffd740",fontWeight:700,textAlign:"center",letterSpacing:2}}>★ MAX LEVEL ★</div>)}
                </div>);})}
              {alienStats.length===0&&<div style={{color:NEON.dimText,fontSize:11,textAlign:"center",padding:12}}>Waiting for fleet deployment...</div>}
            </div>}
          </GlassPanel>

          {/* TAB SYSTEM */}
          <GlassPanel accent={NEON.cyan} style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
            {/* Tab buttons — 3x2 grid */}
            <div style={{borderBottom:"1px solid rgba(255,255,255,0.06)",flexShrink:0}}>
              {[[
                {id:"LOCKS",icon:"🎯",label:"LOCKS",color:NEON.yellow,count:lockedTokens.length},
                {id:"MIGRATE",icon:"🌉",label:"MIGRATE",color:NEON.green,count:migrations.length},
                {id:"SMART",icon:"🧠",label:"SMART$",color:"#ff9500",count:live.smartMoneyAlerts?.length||0},
              ],[
                {id:"BUNDLES",icon:"🔗",label:"BUNDLES",color:NEON.red,count:live.bundleAlerts?.length||0},
                {id:"TRENDS",icon:"🔥",label:"TRENDS",color:NEON.pink,count:live.narratives?.length||0},
                {id:"STATS",icon:"📊",label:"STATS",color:NEON.cyan,count:null},
              ]].map((row,ri)=>(
                <div key={ri} style={{display:"flex"}}>
                  {row.map(tab=>(
                    <button key={tab.id} onClick={()=>setRightTab(tab.id)} style={{
                      flex:1,padding:"5px 2px",fontSize:10,fontWeight:700,cursor:"pointer",border:"none",
                      fontFamily:"'Orbitron',sans-serif",letterSpacing:0.5,transition:"all 0.2s",
                      background:rightTab===tab.id?`${tab.color}12`:"transparent",
                      color:rightTab===tab.id?tab.color:NEON.dimText,
                      borderBottom:rightTab===tab.id?`2px solid ${tab.color}`:"2px solid transparent",
                    }}><div style={{fontSize:13}}>{tab.icon}</div>{tab.label}
                      {tab.count>0&&<span style={{marginLeft:2,fontSize:8,color:tab.color,
                        background:`${tab.color}20`,borderRadius:6,padding:"1px 3px"}}>{tab.count}</span>}
                    </button>
                  ))}
                </div>
              ))}
            </div>

            {/* Tab content */}
            <div style={{flex:1,overflowY:"auto",padding:"4px 6px"}}>
              {/* 🎯 LOCKS TAB */}
              {rightTab==="LOCKS"&&<>
                <TargetLockList lockedTokens={lockedTokens} onRemove={removeLocked} onSelect={selectToken}/>
              </>}

              {/* 🌉 MIGRATIONS TAB */}
              {rightTab==="MIGRATE"&&<>
                {migrations.length===0&&<div style={{color:NEON.dimText,fontSize:12,textAlign:"center",padding:20,fontStyle:"italic"}}>AWAITING GRADUATIONS...</div>}
                {migrations.map((m,i)=>{
                  const age=Math.floor((Date.now()-m.timestamp)/1000);
                  const ageStr=age<60?`${age}s ago`:`${Math.floor(age/60)}m ago`;
                  const curMcap=m.curMcap||m.mcap;
                  const curHolders=m.curHolders||m.holders;
                  const pctChange=m.mcap>0?((curMcap-m.mcap)/m.mcap*100):0;
                  const pumping=pctChange>10,dumping=pctChange<-20;
                  const isDead=m.dead;
                  const sc2=isDead?"#666":pumping?NEON.green:dumping?NEON.red:NEON.cyan;
                  const statusTxt=isDead?"☠ DEAD":pumping?"PUMPING":dumping?"DUMPING":"TRACKING";
                  return(<div key={m.id} style={{padding:"6px 8px",marginBottom:3,borderRadius:5,fontSize:12,
                    borderLeft:`2px solid ${sc2}`,background:`${sc2}06`,opacity:isDead?0.5:1,
                    animation:i===0?"slideIn 0.3s ease-out":"none"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{color:isDead?"#666":NEON.green,fontWeight:900,fontSize:14}}>{isDead?"💀":pumping?"🚀":dumping?"📉":"📊"} <span onClick={()=>clickAddr(m.mint)} style={{cursor:"pointer",textDecoration:"underline",textDecorationStyle:"dotted",textUnderlineOffset:2}}>{m.name}</span>
                        <span onClick={()=>navigator.clipboard.writeText(m.mint)} style={{cursor:"pointer",marginLeft:4,fontSize:12,color:NEON.cyan,opacity:0.6}} title={m.mint}>📋</span></span>
                      <span style={{color:sc2,fontWeight:700,fontSize:11}}>{statusTxt}</span></div>
                    <div style={{display:"flex",gap:5,marginTop:2,color:NEON.dimText,fontSize:11}}>
                      <span style={{color:pctChange>=0?NEON.green:NEON.red,fontWeight:700}}>{pctChange>=0?"+":""}{pctChange.toFixed(1)}%</span>
                      <span>${formatNum(curMcap)}</span>
                      <span>{curHolders}w</span>
                      {m.curBuys!=null&&<span style={{color:"rgba(224,224,255,0.4)"}}>{m.curBuys}b/{m.curSells}s</span>}
                      {m.rugLevel&&<span style={{color:m.rugLevel==="SAFE"?NEON.green:m.rugLevel==="CAUTION"?NEON.yellow:NEON.red,
                        fontWeight:700,fontSize:10}}>🛡{m.rugLevel}</span>}
                      {m.lpLocked&&<span style={{color:NEON.green,fontSize:10}}>🔒LP</span>}
                      {m.geckoChange5m!=null&&<span style={{color:m.geckoChange5m>0?NEON.green:NEON.red,fontSize:10,fontWeight:700}}>
                        5m:{m.geckoChange5m>0?"+":""}{m.geckoChange5m.toFixed(1)}%</span>}
                      {m.geckoVol5m>0&&<span style={{color:NEON.yellow,fontSize:9}}>v${formatNum(m.geckoVol5m)}</span>}
                      {m.rayTvl>0&&<span style={{color:NEON.cyan,fontSize:9}}>TVL:${formatNum(m.rayTvl)}</span>}
                      {m.rayBurnPct>0&&<span style={{color:m.rayBurnPct>90?NEON.green:NEON.orange,fontSize:9,fontWeight:700}}>🔥{m.rayBurnPct.toFixed(0)}%LP</span>}
                      <span style={{marginLeft:"auto",opacity:0.5}}>{ageStr}</span></div>
                  </div>)})}
              </>}

              {/* 🧠 SMART MONEY TAB */}
              {rightTab==="SMART"&&<>
                {(!live.smartMoneyAlerts||live.smartMoneyAlerts.length===0)&&
                  <div style={{color:NEON.dimText,fontSize:12,textAlign:"center",padding:20,fontStyle:"italic"}}>
                    TRACKING ALL WALLETS...<br/><span style={{fontSize:10,opacity:0.5}}>4+ wins, 60%+ rate, 1+ SOL = smart money</span></div>}
                {(live.smartMoneyAlerts||[]).map(a=>{
                  const ageS=Math.floor((Date.now()-a.time)/1000);
                  const tokenName=tokens.find(t=>t.addr===a.mint)?.name||a.mint.slice(0,8);
                  return(<div key={a.id} style={{padding:"6px 8px",marginBottom:3,borderRadius:5,fontSize:12,
                    borderLeft:"2px solid #ff9500",background:"rgba(255,149,0,0.06)"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{color:"#ff9500",fontWeight:900,fontSize:13}}>🧠 SMART BUY</span>
                      <span style={{color:NEON.dimText,fontSize:10}}>{ageS<60?ageS+"s":Math.floor(ageS/60)+"m"} ago</span></div>
                    <div style={{color:NEON.text,fontSize:12,marginTop:2}}>
                      <span onClick={()=>viewWalletDetail(a.wallet)} style={{color:NEON.cyan,cursor:"pointer",textDecoration:"underline",textDecorationStyle:"dotted",textUnderlineOffset:2}}>{a.wallet.slice(0,6)}...{a.wallet.slice(-4)}</span> bought <span style={{color:NEON.yellow}}>{a.sol.toFixed(2)} SOL</span> into <span onClick={()=>clickAddr(a.mint)} style={{color:NEON.green,fontWeight:700,cursor:"pointer",textDecoration:"underline",textDecorationStyle:"dotted",textUnderlineOffset:2}}>{tokenName}</span>
                      <span onClick={()=>navigator.clipboard.writeText(a.mint)} style={{cursor:"pointer",marginLeft:4,fontSize:11,color:NEON.cyan,opacity:0.6}}>📋</span></div>
                    <div style={{color:NEON.dimText,fontSize:10,marginTop:1}}>
                      {a.wins} wins: {a.winTokens.join(", ")}</div>
                  </div>)})}
              </>}

              {/* 🔗 BUNDLES TAB */}
              {rightTab==="BUNDLES"&&<>
                {(!live.bundleAlerts||live.bundleAlerts.length===0)&&
                  <div style={{color:NEON.dimText,fontSize:12,textAlign:"center",padding:20,fontStyle:"italic"}}>
                    SCANNING FOR COORDINATED BUYS...<br/><span style={{fontSize:10,opacity:0.5}}>4+ wallets buying within 2 seconds</span></div>}
                {(live.bundleAlerts||[]).map(b=>{
                  const ageS=Math.floor((Date.now()-b.time)/1000);
                  const tokenName=tokens.find(t=>t.addr===b.mint)?.name||b.mint.slice(0,8);
                  const tok=tokens.find(t=>t.addr===b.mint);
                  return(<div key={b.id} style={{padding:"6px 8px",marginBottom:3,borderRadius:5,fontSize:12,
                    borderLeft:"2px solid "+NEON.red,background:"rgba(255,7,58,0.06)"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{color:NEON.red,fontWeight:900,fontSize:13}}>⚠ BUNDLE</span>
                      <span style={{color:NEON.dimText,fontSize:10}}>{ageS<60?ageS+"s":Math.floor(ageS/60)+"m"} ago</span></div>
                    <div style={{color:NEON.text,fontSize:12,marginTop:2}}>
                      <span style={{color:NEON.red,fontWeight:700}}>{b.wallets} wallets</span> coordinated buy on <span onClick={()=>clickAddr(b.mint)} style={{color:NEON.yellow,fontWeight:700,cursor:"pointer",textDecoration:"underline",textDecorationStyle:"dotted",textUnderlineOffset:2}}>{tokenName}</span>
                      <span onClick={()=>navigator.clipboard.writeText(b.mint)} style={{cursor:"pointer",marginLeft:4,fontSize:11,color:NEON.cyan,opacity:0.6}}>📋</span></div>
                    {tok&&<div style={{color:NEON.dimText,fontSize:10,marginTop:1}}>
                      MC: ${formatNum(tok.mcap)} | {tok.holders}h | {tok.qualified?"✓ QUAL":"✗ UNQUAL"}</div>}
                  </div>)})}
              </>}

              {/* 🔥 TRENDS TAB */}
              {rightTab==="TRENDS"&&<>
                {(!live.narratives||live.narratives.length===0)&&
                  <div style={{color:NEON.dimText,fontSize:12,textAlign:"center",padding:20,fontStyle:"italic"}}>
                    ANALYZING NARRATIVES...<br/><span style={{fontSize:10,opacity:0.5}}>Detects 3+ tokens with shared keywords in 5min</span></div>}
                {(live.narratives||[]).map((n,i)=>(
                  <div key={n.word+i} style={{padding:"6px 8px",marginBottom:3,borderRadius:5,fontSize:12,
                    borderLeft:"2px solid "+NEON.pink,background:"rgba(255,0,128,0.04)"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{color:NEON.pink,fontWeight:900,fontSize:14,textTransform:"uppercase"}}>🔥 {n.word}</span>
                      <span style={{color:NEON.dimText,fontSize:11}}>{n.count} tokens · {n.qualified} qual</span></div>
                    <div style={{display:"flex",gap:4,marginTop:3,flexWrap:"wrap"}}>
                      {n.tokens.map((t,j)=>(
                        <span key={j} style={{fontSize:10,padding:"2px 6px",borderRadius:4,
                          background:t.qualified?"rgba(57,255,20,0.08)":"rgba(255,255,255,0.04)",
                          color:t.qualified?NEON.green:NEON.dimText,
                          border:`1px solid ${t.qualified?"rgba(57,255,20,0.15)":"rgba(255,255,255,0.06)"}`}}>
                          {t.name} ${formatNum(t.mcap)}</span>))}
                    </div>
                    <div style={{color:NEON.dimText,fontSize:10,marginTop:2}}>avg mcap: ${formatNum(n.avgMcap)}</div>
                  </div>))}
              </>}

              {/* 📊 STATS TAB */}
              {rightTab==="STATS"&&<>
                {(()=>{
                  const ss=live.sessionStats||{};
                  const uptime=Math.floor((Date.now()-(ss.startTime||Date.now()))/1000);
                  const uptimeStr=uptime>3600?`${Math.floor(uptime/3600)}h ${Math.floor((uptime%3600)/60)}m`:`${Math.floor(uptime/60)}m ${uptime%60}s`;
                  const statRows=[
                    {l:"⏱ UPTIME",v:uptimeStr,c:NEON.cyan},
                    {l:"🔍 SCANNED",v:ss.tokensScanned||0,c:NEON.text},
                    {l:"✓ QUALIFIED",v:ss.qualified||0,c:NEON.green},
                    {l:"💀 DEAD",v:sessionDeathsRef.current,c:NEON.red},
                    {l:"🌉 MIGRATIONS",v:migrations.length,c:NEON.green},
                    {l:"🎯 LOCKED",v:lockedTokens.length,c:NEON.yellow},
                    {l:"🧠 SMART WALLETS",v:ss.smartWallets||0,c:"#ff9500"},
                    {l:"🔗 BUNDLES",v:live.bundleAlerts?.length||0,c:NEON.red},
                    {l:"🔥 NARRATIVES",v:live.narratives?.length||0,c:NEON.pink},
                    {l:"💰 SOL PRICE",v:"$"+(ss.solPrice||84).toFixed(2),c:NEON.yellow},
                    {l:"📐 MCAP CORR",v:(ss.mcapCorr||1).toFixed(3),c:NEON.cyan},
                    {l:"🦎 GECKO TREND",v:tokens.filter(t=>t.onGeckoTrending).length+" tokens",c:"#39ff14"},
                    {l:"📡 DEFINED BUZZ",v:tokens.filter(t=>t.onDefinedTrending).length+" tokens",c:"#00ccff"},
                    {l:"📈 NEAR MIGRATE",v:tokens.filter(t=>t.bondingPct>75&&!t.migrated).length+" tokens",c:NEON.yellow},
                    {l:"🛡 RUGCHECKED",v:migrations.filter(m=>m.rugLevel).length+"/"+migrations.length,c:NEON.cyan},
                    {l:"👑 KOTH",v:tokens.filter(t=>t.isKOTH).length+" tokens",c:"#ffd740"},
                    {l:"✓ JUP VERIFIED",v:tokens.filter(t=>t.jupVerified).length+" tokens",c:NEON.green},
                    {l:"💧 LIQUIDITY MAPPED",v:tokens.filter(t=>t.liquidityRating).length+" tokens",c:NEON.cyan},
                    {l:"🔌 DATA FEEDS",v:"14 LIVE",c:NEON.green},
                  ];
                  return(<div style={{display:"flex",flexDirection:"column",gap:2}}>
                    <div style={{textAlign:"center",padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                      <div style={{color:NEON.cyan,fontFamily:"'Orbitron',sans-serif",fontSize:12,letterSpacing:2,fontWeight:900}}>SESSION DASHBOARD</div></div>
                    {statRows.map((s,i)=>(<div key={i} style={{display:"flex",justifyContent:"space-between",padding:"5px 8px",
                      borderBottom:"1px solid rgba(255,255,255,0.02)"}}>
                      <span style={{color:NEON.dimText,fontSize:12}}>{s.l}</span>
                      <span style={{color:s.c,fontSize:13,fontWeight:700,fontFamily:"'Orbitron',sans-serif"}}>{s.v}</span></div>))}
                    {ss.bestToken&&<div style={{padding:"8px",marginTop:4,borderRadius:5,background:"rgba(57,255,20,0.04)",
                      borderLeft:"2px solid "+NEON.green}}>
                      <div style={{color:NEON.green,fontSize:11,fontWeight:700}}>🏆 BEST TOKEN</div>
                      <div style={{color:NEON.text,fontSize:13}}>{ss.bestToken} — ${formatNum(ss.bestPct)}</div></div>}
                    {sessionBestAppRef.current.name&&<div style={{padding:"8px",marginTop:4,borderRadius:5,background:"rgba(255,215,64,0.04)",
                      borderLeft:"2px solid #ffd740"}}>
                      <div style={{color:"#ffd740",fontSize:11,fontWeight:700}}>⭐ SESSION BEST MCAP</div>
                      <div style={{color:NEON.text,fontSize:13}}>{sessionBestAppRef.current.name} — ${formatNum(sessionBestAppRef.current.mcap)}</div></div>}
                  </div>);
                })()}
              </>}
            </div>
          </GlassPanel>
        </div>
      </div>
    </div>);
}
