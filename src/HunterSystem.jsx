// ═══════════════════════════════════════════════════════════════
// HunterSystem.jsx — Degen Hunter RPG v2
// Supabase-backed profiles, 200+ items, full stat system
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback, useRef } from "react";

const SB_URL = "https://yrmjphhfgduysoftnuxv.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlybWpwaGhmZ2R1eXNvZnRudXh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MzI5MzAsImV4cCI6MjA4ODMwODkzMH0.scHhvTGiABJDybgbjgjilw8XuxOfmWPsqo4iytMZmio";

export const STATS = {
  rugDetection:   {label:"Rug Detection",       icon:"🪤",color:"#39ff14",desc:"Sense rugs before they happen"},
  dignity:        {label:"Dignity",             icon:"🎩",color:"#00ffff",desc:"Self-respect. Can go negative."},
  degenEnergy:    {label:"Degen Energy",        icon:"⚡",color:"#ff9500",desc:"Raw unhinged ape power"},
  diamondHands:   {label:"Diamond Hands",       icon:"💎",color:"#448aff",desc:"Resistance to paper-handing"},
  moonPotential:  {label:"Moon Potential",      icon:"🌙",color:"#bf00ff",desc:"Likelihood of making it"},
  copeResistance: {label:"Cope Resistance",     icon:"🧃",color:"#ff073a",desc:"Ability to accept losses"},
  alphaIQ:        {label:"Alpha IQ",            icon:"🧠",color:"#ffd740",desc:"Ability to find actual alpha"},
  jeetRepulsion:  {label:"Jeet Repulsion",      icon:"🚫",color:"#ff00ff",desc:"Keeps weak hands away"},
  fudImmunity:    {label:"FUD Immunity",        icon:"🛡️",color:"#00bfff",desc:"Fear uncertainty doubt resist"},
  liquiditySniff: {label:"Liquidity Sniffing",  icon:"👃",color:"#69f0ae",desc:"Smell thin liquidity"},
  exitAvoidance:  {label:"Exit Liquidity Avoid",icon:"🚪",color:"#ff6600",desc:"Don't be the bag holder"},
  vibeCheck:      {label:"Vibe Check",          icon:"✅",color:"#39ff14",desc:"General market sense"},
};

export const RARITIES = {
  common:   {label:"COMMON",   color:"#9e9e9e",glow:"rgba(158,158,158,0.3)",mult:1,   chance:0.50},
  uncommon: {label:"UNCOMMON", color:"#39ff14",glow:"rgba(57,255,20,0.3)",  mult:1.5, chance:0.25},
  rare:     {label:"RARE",     color:"#448aff",glow:"rgba(68,138,255,0.4)", mult:2.5, chance:0.13},
  epic:     {label:"EPIC",     color:"#bf00ff",glow:"rgba(191,0,255,0.4)",  mult:4,   chance:0.08},
  legendary:{label:"LEGENDARY",color:"#ffd740",glow:"rgba(255,215,64,0.5)", mult:7,   chance:0.03},
  mythic:   {label:"MYTHIC",   color:"#ff073a",glow:"rgba(255,7,58,0.6)",   mult:12,  chance:0.01},
};

export const ITEMS = [
  // HELMETS
  {id:"h_bag",       name:"McDonald's Bag Helm",      icon:"🛍️",rarity:"common",   slot:"helmet",power:1, stats:{dignity:-3,degenEnergy:2},                                       flavor:"Free with any value meal.",                     desc:"Fashioned from a bag of shame. Smells like nuggets."},
  {id:"h_tin",       name:"Tinfoil Conspiracy Hat",   icon:"🤍",rarity:"common",   slot:"helmet",power:2, stats:{fudImmunity:4,alphaIQ:-2,rugDetection:1},                         flavor:"They can't track your bags if you wear this.",  desc:"Blocks government signals AND crypto alpha."},
  {id:"h_cap",       name:"We're So Back Cap",        icon:"🧢",rarity:"common",   slot:"helmet",power:2, stats:{copeResistance:3,moonPotential:1},                                flavor:"Worn during dead cat bounces.",                  desc:"Certified cope accessory. Limited hopium."},
  {id:"h_ape_skull", name:"Ape Skull Helm",           icon:"💀",rarity:"uncommon", slot:"helmet",power:5, stats:{degenEnergy:5,dignity:-2,rugDetection:2},                         flavor:"BAYC didn't make it. You did. Somehow.",        desc:"Salvaged from a 2022 NFT rug. Still radiates energy."},
  {id:"h_nfa_visor", name:"NFA Visor Pro",            icon:"🥽",rarity:"uncommon", slot:"helmet",power:6, stats:{fudImmunity:4,exitAvoidance:3,dignity:2},                         flavor:"Not Financial Advice. Seriously.",               desc:"Legal disclaimer built into the visor."},
  {id:"h_chad",      name:"Chad Crown of Gains",      icon:"👑",rarity:"rare",     slot:"helmet",power:9, stats:{degenEnergy:6,moonPotential:5,dignity:4,alphaIQ:3},               flavor:"Only the truly based may wear this.",            desc:"Worn by those who buy the top and still profit."},
  {id:"h_sol_war",   name:"Solana War Helm",          icon:"⛑️",rarity:"rare",     slot:"helmet",power:11,stats:{rugDetection:6,fudImmunity:5,liquiditySniff:4},                   flavor:"Forged during the 2022 meltdown.",               desc:"Purple iridescent. Processes at 65K TPS."},
  {id:"h_reaper",    name:"Crypto Reaper Skull",      icon:"☠️",rarity:"epic",     slot:"helmet",power:16,stats:{rugDetection:10,degenEnergy:8,dignity:-5,jeetRepulsion:7},        flavor:"A thousand rugs carved this face.",              desc:"Transcended fear. Now just vibes."},
  {id:"h_gigabrain", name:"Giga Brain Exohelm",       icon:"🧠",rarity:"epic",     slot:"helmet",power:18,stats:{alphaIQ:12,liquiditySniff:8,exitAvoidance:6,moonPotential:6},     flavor:"Three extra lobes from reading whitepapers.",   desc:"Cybernetically enhanced for alpha detection."},
  {id:"h_halo",      name:"Degen God Halo",           icon:"😇",rarity:"legendary",slot:"helmet",power:25,stats:{alphaIQ:15,moonPotential:12,rugDetection:10,dignity:10,degenEnergy:10},flavor:"The market genuflects.",                       desc:"The universe routes alpha directly to you."},
  {id:"h_satoshi",   name:"Satoshi Phantom Mask",     icon:"🎭",rarity:"legendary",slot:"helmet",power:28,stats:{alphaIQ:18,fudImmunity:15,exitAvoidance:12,vibeCheck:10},         flavor:"He left this behind. You found it.",            desc:"Unknown origin. Unknown power. Very bullish."},
  {id:"h_void",      name:"Void Reaper Crown",        icon:"🌑",rarity:"mythic",   slot:"helmet",power:40,stats:{rugDetection:20,degenEnergy:20,alphaIQ:20,dignity:-10,jeetRepulsion:15,fudImmunity:20},flavor:"REDACTED",                   desc:"Forged in the void between transactions."},
  // CHEST
  {id:"c_cardboard", name:"Amazon Box Chest Plate",   icon:"📦",rarity:"common",   slot:"chest", power:1, stats:{dignity:-2,degenEnergy:1},                                        flavor:"Prime delivery. 2-day from poverty.",           desc:"Reinforced with packing tape."},
  {id:"c_hoodie",    name:"Bearmarket Hoodie",        icon:"🧥",rarity:"common",   slot:"chest", power:3, stats:{copeResistance:4,degenEnergy:2,dignity:-1},                       flavor:"Never washed. Absorbed 2 years of losses.",     desc:"Smells like stale hopium and instant noodles."},
  {id:"c_ngmi_vest", name:"NGMI Proof Vest",          icon:"🦺",rarity:"common",   slot:"chest", power:3, stats:{fudImmunity:3,copeResistance:3},                                  flavor:"They said NGMI. You're still here.",            desc:"Deflects NGMI energy. Absorbs cope."},
  {id:"c_diamond",   name:"Diamond Hands Plate",      icon:"💠",rarity:"uncommon", slot:"chest", power:7, stats:{diamondHands:8,copeResistance:4,dignity:3},                       flavor:"Chest vibrates at HODL frequency.",             desc:"Once equipped, paper selling becomes painful."},
  {id:"c_ape_guard", name:"Ape Soldier Chestguard",   icon:"🦍",rarity:"uncommon", slot:"chest", power:8, stats:{degenEnergy:7,jeetRepulsion:5,dignity:-3,moonPotential:4},        flavor:"Jungle tested. Degen approved.",                desc:"Woven from pure ape energy. Smells like bananas."},
  {id:"c_peniscoin", name:"PenisCoin Investor Plate", icon:"🍆",rarity:"common",   slot:"chest", power:2, stats:{dignity:-8,degenEnergy:4,moonPotential:1},                        flavor:"You bought it. We don't judge. We do judge.",   desc:"-5 dignity for buying PenisCoin. Respect the conviction."},
  {id:"c_sol_plate", name:"Solana Aegis Plate",       icon:"🛡️",rarity:"rare",     slot:"chest", power:13,stats:{fudImmunity:8,rugDetection:6,exitAvoidance:5,liquiditySniff:4},   flavor:"Survived the dark winter of 2022.",             desc:"Legendary armor forged during SOL bear market."},
  {id:"c_whale_skin",name:"Whale Skin Vest",          icon:"🐋",rarity:"rare",     slot:"chest", power:14,stats:{exitAvoidance:10,liquiditySniff:8,alphaIQ:5,dignity:-6},          flavor:"Ethically sourced from paper hands.",           desc:"Waterproof. Market-proof. Morality-questionable."},
  {id:"c_reaper",    name:"Reaper Obsidian Cloak",    icon:"🥷",rarity:"epic",     slot:"chest", power:18,stats:{rugDetection:12,jeetRepulsion:10,degenEnergy:8,dignity:-4},       flavor:"You are the rug now.",                          desc:"Grants near-invisibility to rug detection algos."},
  {id:"c_validator", name:"Validator Aegis",          icon:"⚙️",rarity:"epic",     slot:"chest", power:20,stats:{fudImmunity:12,diamondHands:10,liquiditySniff:8,exitAvoidance:8}, flavor:"Runs a full node. Earns yield while blocking.", desc:"Self-sustaining defensive armor."},
  {id:"c_god_plate", name:"Transcendent Degen Plate", icon:"✨",rarity:"legendary",slot:"chest", power:28,stats:{rugDetection:15,fudImmunity:14,diamondHands:12,moonPotential:12,degenEnergy:10},flavor:"Cannot be rugged. The rug rugs itself.",desc:"Assembled from condensed hopium of 10K paper hands."},
  {id:"c_void",      name:"Void Reaper Carapace",     icon:"🌌",rarity:"mythic",   slot:"chest", power:45,stats:{rugDetection:25,fudImmunity:22,diamondHands:18,degenEnergy:18,alphaIQ:15,jeetRepulsion:15},flavor:"DO NOT WEAR IN REGULATED JURISDICTIONS.",desc:"Absorbed energy of every rug since 2017."},
  // LEGS
  {id:"l_pajamas",   name:"Degen Pajama Pants",       icon:"👖",rarity:"common",   slot:"legs",  power:1, stats:{degenEnergy:2,dignity:-3,copeResistance:2},                       flavor:"Never changed. Gains are inside.",               desc:"Work-from-home certified. Zero productivity."},
  {id:"l_shorts",    name:"Cope Shorts",              icon:"🩳",rarity:"common",   slot:"legs",  power:2, stats:{copeResistance:5,dignity:-2,moonPotential:1},                     flavor:"Light enough to run from the chart.",            desc:"Aerodynamic. Great for fleeing positions."},
  {id:"l_jeet_proof",name:"Jeet-Proof Leggings",      icon:"🩲",rarity:"uncommon", slot:"legs",  power:6, stats:{diamondHands:6,jeetRepulsion:5,dignity:1},                        flavor:"Prevent involuntary sell motions.",              desc:"FDA of Degens fully approved."},
  {id:"l_moon_boots",name:"Moon Strider Greaves",     icon:"🥾",rarity:"uncommon", slot:"legs",  power:7, stats:{moonPotential:7,degenEnergy:5,exitAvoidance:3},                   flavor:"0.001% closer to moon per step.",               desc:"One small step for degen. Giant leap for bags."},
  {id:"l_sol_speed", name:"Solana Speed Greaves",     icon:"⚡",rarity:"rare",     slot:"legs",  power:12,stats:{exitAvoidance:9,alphaIQ:6,liquiditySniff:6,degenEnergy:6},        flavor:"First in, last out. 400ms finality.",           desc:"Move at 65K TPS. Always first to the entry."},
  {id:"l_whale_fin", name:"Whale Fin Stabilizers",    icon:"🌊",rarity:"rare",     slot:"legs",  power:13,stats:{diamondHands:8,liquiditySniff:10,exitAvoidance:7},                flavor:"Swim in liquidity without splashing.",           desc:"Stabilizes large position entries."},
  {id:"l_shadow",    name:"Shadow Operative Pants",   icon:"🌑",rarity:"epic",     slot:"legs",  power:17,stats:{exitAvoidance:12,alphaIQ:8,rugDetection:9,jeetRepulsion:8},       flavor:"Moves between candles undetected.",             desc:"No one sees you accumulate. No one sees you exit."},
  {id:"l_god_stride",name:"Omnidegen Striders",       icon:"🌠",rarity:"legendary",slot:"legs",  power:24,stats:{moonPotential:14,degenEnergy:12,alphaIQ:10,exitAvoidance:10,liquiditySniff:8},flavor:"Bridgeless. Vibes-based transport.",    desc:"Multichain capable. Gas-free via unknown mechanism."},
  {id:"l_void",      name:"Void Walker Greaves",      icon:"🕳️",rarity:"mythic",   slot:"legs",  power:38,stats:{exitAvoidance:20,alphaIQ:18,rugDetection:16,moonPotential:16,liquiditySniff:14},flavor:"You don't walk. You manifest positions.",desc:"Buy before the chart moves."},
  // WEAPONS
  {id:"w_fork",      name:"Plastic Fork of Truth",    icon:"🍴",rarity:"common",   slot:"weapon",power:1, stats:{rugDetection:2,dignity:-1},                                       flavor:"Pokes at whitepapers. Occasionally useful.",    desc:"Penetrates thin whitepapers. Bends on contracts."},
  {id:"w_foam",      name:"Foam Rug Detector",        icon:"🗡️",rarity:"common",   slot:"weapon",power:2, stats:{rugDetection:3,dignity:-2,degenEnergy:1},                         flavor:"100% accurate 20% of the time.",                desc:"Mostly ceremonial. Better than reading the code."},
  {id:"w_cope_sword",name:"Cope Blade",               icon:"🔪",rarity:"common",   slot:"weapon",power:3, stats:{copeResistance:6,dignity:-3,degenEnergy:2},                       flavor:"Designed to cut losses. You won't use it.",     desc:"Sharp enough to cut losses. Never used for that."},
  {id:"w_fud_blast", name:"FUD Blaster 3000",         icon:"🔫",rarity:"uncommon", slot:"weapon",power:6, stats:{fudImmunity:7,jeetRepulsion:5,degenEnergy:4},                     flavor:"Semi-auto hopium. Max range: your Discord.",    desc:"Fires counter-FUD. Effective against paper hands."},
  {id:"w_rug_saber", name:"Rug Saber",                icon:"⚔️",rarity:"uncommon", slot:"weapon",power:7, stats:{rugDetection:8,exitAvoidance:4,dignity:2},                        flavor:"Forged in the meme wars of 2021.",               desc:"Cuts through scam projects like butter."},
  {id:"w_pepe_staff",name:"Pepe Sacred Staff",        icon:"🐸",rarity:"rare",     slot:"weapon",power:10,stats:{moonPotential:8,vibeCheck:7,degenEnergy:6,dignity:-2},            flavor:"Blessed by meme gods in 2016.",                 desc:"Channel ancient meme energy. Surprisingly effective."},
  {id:"w_alpha_dart",name:"Alpha Dart Gun",           icon:"🎯",rarity:"rare",     slot:"weapon",power:10,stats:{alphaIQ:9,liquiditySniff:7,exitAvoidance:5},                      flavor:"Fires concentrated alpha. Pinpoint accuracy.",  desc:"Single-shot. Reload: one whitepaper read."},
  {id:"w_sol_cannon",name:"Solana Plasma Cannon",     icon:"💫",rarity:"rare",     slot:"weapon",power:12,stats:{degenEnergy:10,rugDetection:7,fudImmunity:6},                     flavor:"Overkill for anything under $500K mcap.",       desc:"Fires concentrated SOL plasma. Burns gas auto."},
  {id:"w_jeet_repel",name:"Jeet Repellant Cannon",    icon:"🧪",rarity:"rare",     slot:"weapon",power:11,stats:{jeetRepulsion:12,diamondHands:6,fudImmunity:5},                   flavor:"Industrial-grade. 300ft jeet-free zone.",       desc:"Area-of-effect jeet deterrent. OSHA not approved."},
  {id:"w_alpha_lance",name:"Alpha Lance",             icon:"🏹",rarity:"epic",     slot:"weapon",power:17,stats:{alphaIQ:13,liquiditySniff:10,rugDetection:9,exitAvoidance:7},      flavor:"Pierces noise. Reaches alpha directly.",        desc:"Precision FUD destruction. One shot one kill."},
  {id:"w_scythe",    name:"Crypto Reaper Scythe",     icon:"🌙",rarity:"epic",     slot:"weapon",power:20,stats:{rugDetection:14,degenEnergy:12,jeetRepulsion:10,dignity:-6},      flavor:"Harvests life force of dead coins.",            desc:"Grows stronger with every confirmed kill."},
  {id:"w_god_finger",name:"Finger of God Markets",    icon:"☝️",rarity:"legendary",slot:"weapon",power:27,stats:{alphaIQ:17,moonPotential:15,rugDetection:13,degenEnergy:12,vibeCheck:12},flavor:"Point at anything. Moon or rug. Unknown which.",desc:"Omnidirectional market influence. Don't."},
  {id:"w_satoshi_pen",name:"Satoshi Signing Key",     icon:"🔑",rarity:"legendary",slot:"weapon",power:30,stats:{alphaIQ:20,fudImmunity:16,exitAvoidance:14,dignity:15,vibeCheck:14},flavor:"Do not sign transactions. Do not ask why.",     desc:"The power is real. The responsibility is not."},
  {id:"w_void_cannon",name:"Void Singularity Cannon", icon:"🌀",rarity:"mythic",   slot:"weapon",power:50,stats:{rugDetection:25,alphaIQ:22,degenEnergy:22,jeetRepulsion:20,fudImmunity:18,moonPotential:15},flavor:"Fires compressed degen singularities.",desc:"Everything near it moons or rugs. Usually both."},
  // OFFHAND
  {id:"o_tinfoil",   name:"Tinfoil Shield",           icon:"🛡️",rarity:"common",   slot:"offhand",power:1,stats:{fudImmunity:3,alphaIQ:-1,dignity:-2},                            flavor:"Blocks manipulation. Also blocks WiFi.",        desc:"Conspiracy-certified. 0% against rugs."},
  {id:"o_cope_torch",name:"Cope Torch",               icon:"🔦",rarity:"common",   slot:"offhand",power:2,stats:{copeResistance:5,moonPotential:2,dignity:-2},                     flavor:"Illuminates why price will recover. It won't.", desc:"Burns cope as fuel. Infinite supply discovered."},
  {id:"o_rug_map",   name:"Rug Cartographer Map",     icon:"🗺️",rarity:"uncommon", slot:"offhand",power:5,stats:{rugDetection:7,exitAvoidance:5,liquiditySniff:3},                 flavor:"Here be rugs. Mostly everywhere.",              desc:"Map of known rug exit points. Updated real-time."},
  {id:"o_scrying_orb",name:"Degen Scrying Orb",      icon:"🔮",rarity:"uncommon", slot:"offhand",power:6,stats:{rugDetection:6,liquiditySniff:7,alphaIQ:4,vibeCheck:4},           flavor:"Shows rugs 5 minutes after they happen.",       desc:"Hindsight 20/20. Foresight 2/20. Still useful."},
  {id:"o_hopium",    name:"Hopium Tank",              icon:"🫀",rarity:"uncommon", slot:"offhand",power:5,stats:{copeResistance:7,moonPotential:5,degenEnergy:4,dignity:-2},        flavor:"Compressed hopium. Surgical grade.",            desc:"For when the chart goes vertical. Or doesn't."},
  {id:"o_sol_shield",name:"Solana Validator Shield",  icon:"💎",rarity:"rare",     slot:"offhand",power:11,stats:{fudImmunity:9,diamondHands:8,rugDetection:6,exitAvoidance:5},    flavor:"Runs a validator. Earns yield while blocking.", desc:"Productive defense. APY: enough."},
  {id:"o_nfa_book",  name:"NFA Grimoire",             icon:"📖",rarity:"rare",     slot:"offhand",power:10,stats:{alphaIQ:10,exitAvoidance:7,rugDetection:5,dignity:4},            flavor:"500 pages of disclaimers.",                     desc:"Every alpha call ever made. And disclaimers."},
  {id:"o_alpha_tome",name:"Book of Infinite Alpha",   icon:"📚",rarity:"epic",     slot:"offhand",power:16,stats:{alphaIQ:14,liquiditySniff:10,exitAvoidance:8,vibeCheck:8},       flavor:"Every page is blank. THAT is the alpha.",       desc:"Author: You. Publisher: Reality."},
  {id:"o_chad_shield",name:"Certified Chad Shield",   icon:"🔵",rarity:"epic",     slot:"offhand",power:17,stats:{jeetRepulsion:13,fudImmunity:11,diamondHands:9,dignity:8,degenEnergy:7},flavor:"Repels paper hands on contact.",           desc:"Pure chad energy. Undeniable presence."},
  {id:"o_god_tome",  name:"Omnidegen Codex",          icon:"📜",rarity:"legendary",slot:"offhand",power:26,stats:{alphaIQ:18,rugDetection:14,liquiditySniff:12,exitAvoidance:12,vibeCheck:10,dignity:8},flavor:"Volume I of infinity. Page 1.",     desc:"Every known alpha strategy. Every known rug pattern."},
  {id:"o_genesis",   name:"Genesis Block Fragment",   icon:"⛓️",rarity:"legendary",slot:"offhand",power:29,stats:{fudImmunity:18,diamondHands:16,alphaIQ:14,moonPotential:13,dignity:12},flavor:"Block 0. Your hands carry it.",            desc:"A piece of the genesis block. Believed real."},
  {id:"o_void_orb",  name:"Void Singularity Orb",     icon:"🌑",rarity:"mythic",   slot:"offhand",power:42,stats:{rugDetection:22,alphaIQ:20,fudImmunity:18,exitAvoidance:16,vibeCheck:16,liquiditySniff:14},flavor:"Contains a micro-singularity of knowledge.",desc:"Compressed alpha. Handle irresponsibly."},
  // ITEMS
  {id:"i_rug_spray",  name:"Rug Repellant Spray",     icon:"🧴",rarity:"common",   slot:"item",power:0,stats:{rugDetection:1},                                                     flavor:"DYOR Industries™. Apply before aping.",         desc:"30% effective. Studies inconclusive."},
  {id:"i_crystal",    name:"Broken Crystal Ball",     icon:"🔮",rarity:"uncommon", slot:"item",power:0,stats:{alphaIQ:1,vibeCheck:2},                                              flavor:"1% accuracy. 99% cope.",                        desc:"Predicts the market. Often correct about yesterday."},
  {id:"i_wojak_tears",name:"Wojak Tears Bottled",     icon:"😭",rarity:"common",   slot:"item",power:0,stats:{copeResistance:2},                                                   flavor:"Vintage 2022. Excellent body.",                 desc:"Bottled from a thousand bag holders."},
  {id:"i_moon_ticket",name:"Moon Ticket Expired",     icon:"🎫",rarity:"common",   slot:"item",power:0,stats:{moonPotential:1,dignity:-1},                                         flavor:"Non-refundable. Still holding.",                desc:"Valid for one moon mission. Expired. Holding anyway."},
  {id:"i_dyor",       name:"DYOR Goggles",            icon:"🥽",rarity:"uncommon", slot:"item",power:0,stats:{rugDetection:3,alphaIQ:2},                                           flavor:"+5 Rug Detection. -5 patience.",                desc:"Let you see through rugs. Sometimes."},
  {id:"i_cope_juice", name:"Cope Juice 16oz",         icon:"🧃",rarity:"common",   slot:"item",power:0,stats:{copeResistance:3,dignity:-2},                                        flavor:"This is actually bullish.",                     desc:"For when bags are down 90%."},
  {id:"i_lambo",      name:"Lambo Keys Someday",      icon:"🔑",rarity:"rare",     slot:"item",power:0,stats:{moonPotential:4,dignity:3},                                          flavor:"The lambo is not here yet.",                    desc:"Manifesting the lambo. It's a process."},
  {id:"i_paper_bag",  name:"Paper Bag Disguise",      icon:"🛍️",rarity:"common",   slot:"item",power:0,stats:{dignity:-4,copeResistance:3},                                        flavor:"One size fits all losers.",                     desc:"Wear when calls go to zero. Breathable."},
  {id:"i_whitepaper", name:"Unread Whitepaper",       icon:"📄",rarity:"common",   slot:"item",power:0,stats:{dignity:-1,alphaIQ:1},                                               flavor:"Downloaded. Never opened. Bullish on vibes.",   desc:"42 pages of hopium. Bookmarked on page 2."},
  {id:"i_antidote",   name:"NGMI Antidote",           icon:"💉",rarity:"rare",     slot:"item",power:0,stats:{moonPotential:3,copeResistance:3,degenEnergy:2},                     flavor:"One dose of WAGMI energy.",                     desc:"Side effects: overconfidence, aping too early."},
  {id:"i_dgloves",    name:"Diamond Hands Gloves",    icon:"🧤",rarity:"uncommon", slot:"item",power:0,stats:{diamondHands:4,dignity:2},                                           flavor:"0 slip grip technology.",                       desc:"Prevents panic selling. Also prevents profit taking."},
  {id:"i_sol_compass",name:"Solana Compass",          icon:"🧭",rarity:"rare",     slot:"item",power:0,stats:{liquiditySniff:4,alphaIQ:3,rugDetection:2},                          flavor:"Points toward 100x. Occasionally rugs.",        desc:"Calibrated on pure vibes."},
  {id:"i_alpha_scroll",name:"Alpha Scroll",           icon:"📜",rarity:"epic",     slot:"item",power:0,stats:{alphaIQ:6,liquiditySniff:4,vibeCheck:4},                             flavor:"Contains the actual alpha. REDACTED.",           desc:"You wouldn't understand it yet."},
  {id:"i_rug_piece",  name:"Piece of a Rug",          icon:"🪡",rarity:"common",   slot:"item",power:0,stats:{rugDetection:2,copeResistance:1,dignity:-1},                         flavor:"Souvenir. First one hurts most.",               desc:"From your first rug. Collection growing."},
  {id:"i_peniscoin",  name:"PenisCoin Bag -95%",      icon:"🍆",rarity:"common",   slot:"item",power:0,stats:{dignity:-6,degenEnergy:3,copeResistance:2},                          flavor:"You bought it and you know it.",                desc:"Fully rugged. Keeping as reminder."},
  {id:"i_sol_sticker",name:"Solana Laptop Sticker",   icon:"💜",rarity:"common",   slot:"item",power:0,stats:{degenEnergy:2,dignity:1},                                            flavor:"Signals the vibe.",                             desc:"The universal symbol of belief."},
  {id:"i_airdrop",    name:"Airdrop Claim Ticket",    icon:"🎟️",rarity:"rare",     slot:"item",power:0,stats:{moonPotential:5,alphaIQ:2},                                          flavor:"May or may not exist.",                         desc:"Rumored airdrop. Probably real. Speculative."},
  {id:"i_salt",       name:"Bag of Copium Salt",      icon:"🧂",rarity:"common",   slot:"item",power:0,stats:{copeResistance:4,dignity:-3},                                        flavor:"Salted by losses. Seasoned by grief.",          desc:"Sprinkle on charts. Improves red candle flavor."},
  {id:"i_pepe_card",  name:"Rare Pepe Card",          icon:"🐸",rarity:"epic",     slot:"item",power:0,stats:{vibeCheck:7,moonPotential:5,alphaIQ:3,degenEnergy:3},                flavor:"Only 69 in existence.",                         desc:"Found in a chest. Genuinely rare."},
  {id:"i_genesis_nft",name:"Genesis NFT Worthless",  icon:"🖼️",rarity:"rare",     slot:"item",power:0,stats:{dignity:-4,degenEnergy:4,copeResistance:3,moonPotential:2},          flavor:"Floor: 0.0001 SOL. Memories: priceless.",       desc:"First NFT. Project rugged. Art remains."},
  {id:"i_ledger",     name:"Ledger Broken Screen",    icon:"🔒",rarity:"uncommon", slot:"item",power:0,stats:{diamondHands:4,exitAvoidance:3,dignity:2},                           flavor:"Can't sell what you can't access.",             desc:"Unintentional diamond hands. Funds safu."},
  {id:"i_hot_sauce",  name:"Alpha Hot Sauce",         icon:"🌶️",rarity:"rare",     slot:"item",power:0,stats:{degenEnergy:5,rugDetection:3,alphaIQ:3},                             flavor:"Burns in. Burns out. Still bullish.",            desc:"Applied before every trade. Ritual-grade."},
  {id:"i_wagmi",      name:"WAGMI T-Shirt",           icon:"👕",rarity:"common",   slot:"item",power:0,stats:{moonPotential:2,copeResistance:3,dignity:-1},                        flavor:"Probably.",                                     desc:"Worn exclusively during -50% weeks."},
  {id:"i_ape_jpg",    name:"Ape NFT Screenshot",      icon:"🖼️",rarity:"common",   slot:"item",power:0,stats:{dignity:-3,degenEnergy:2,copeResistance:1},                          flavor:"Right-click saved. Same energy.",               desc:"Not yours. Vibes are transferable."},
  {id:"i_dev_wallet", name:"Dev Wallet Detector",     icon:"🔎",rarity:"epic",     slot:"item",power:0,stats:{rugDetection:8,exitAvoidance:6,alphaIQ:4},                           flavor:"Tracks the dev wallet in real time.",           desc:"Alerts when dev moves. Occasionally saves bag."},
  {id:"i_vhs",        name:"Crypto 2017 VHS Tape",    icon:"📼",rarity:"rare",     slot:"item",power:0,stats:{alphaIQ:4,copeResistance:4,vibeCheck:3,dignity:2},                   flavor:"Bitcoin is in a bubble — experts 2017.",        desc:"Historical footage of first bull run."},
  {id:"i_laser_eyes", name:"Laser Eyes Filter",       icon:"🔴",rarity:"uncommon", slot:"item",power:0,stats:{moonPotential:4,degenEnergy:3,dignity:-1},                           flavor:"Pfp update complete. Price goes up now.",       desc:"Activates the moon signal. Statistical significance: real."},
  {id:"i_hopium_pipe",name:"Hopium Pipe",             icon:"🪈",rarity:"uncommon", slot:"item",power:0,stats:{copeResistance:5,moonPotential:3,dignity:-2,degenEnergy:3},          flavor:"Smokes pure hopium. Straight to brain.",        desc:"Chronic hopium user. Bulls on everything."},
  {id:"i_solscan",    name:"SolScan Magnifying Glass",icon:"🔍",rarity:"rare",     slot:"item",power:0,stats:{rugDetection:6,liquiditySniff:5,exitAvoidance:3},                    flavor:"Read the chain. It doesn't lie.",               desc:"Magnifies on-chain data 100x for rug spotting."},
  {id:"i_degen_dice", name:"Degen Dice",              icon:"🎲",rarity:"rare",     slot:"item",power:0,stats:{moonPotential:4,degenEnergy:5,exitAvoidance:-2,dignity:-2},          flavor:"50/50. Just like a coin flip.",                 desc:"Investment strategy tool. Not joking."},
  {id:"i_noodles",    name:"Bearmarket Noodles",      icon:"🍜",rarity:"common",   slot:"item",power:0,stats:{copeResistance:3,degenEnergy:1,dignity:-1},                          flavor:"$0.35. The true stable asset.",                 desc:"When portfolio hits zero, this remains."},
  {id:"i_gm_note",    name:"GM Note Handwritten",     icon:"📝",rarity:"common",   slot:"item",power:0,stats:{vibeCheck:3,degenEnergy:2},                                          flavor:"Received 6:00AM. Unknown sender.",              desc:"Simple. Powerful. Foundation of this community."},
  {id:"i_chad_cert",  name:"Chad Certification",      icon:"📋",rarity:"epic",     slot:"item",power:0,stats:{dignity:8,jeetRepulsion:6,degenEnergy:5,vibeCheck:5},                flavor:"Issued by the Council of Chads.",               desc:"Certifies you as genuinely based."},
  {id:"i_cope_stone", name:"Infinite Cope Stone",     icon:"💠",rarity:"legendary",slot:"item",power:0,stats:{copeResistance:15,moonPotential:8,dignity:-5,degenEnergy:8},         flavor:"Thanos had Infinity Stone. You have Cope Stone.",desc:"Limitless cope generation. No bag too heavy."},
  {id:"i_nfa_badge",  name:"Certified NFA Badge",     icon:"🪪",rarity:"uncommon", slot:"item",power:0,stats:{fudImmunity:3,dignity:3,exitAvoidance:2},                            flavor:"Officially not financial advice.",               desc:"Absolution from liability."},
];

export const LEVEL_TITLES = [
  {lvl:1,  title:"Paper Hand Peasant",   icon:"🧻",color:"#888"},
  {lvl:5,  title:"Bag Carrier",          icon:"🛍️",color:"#aaa"},
  {lvl:10, title:"Floor Sweeper",        icon:"🧹",color:"#69f0ae"},
  {lvl:15, title:"Dip Buyer",            icon:"📉",color:"#40c4ff"},
  {lvl:20, title:"Chart Watcher",        icon:"📈",color:"#39ff14"},
  {lvl:25, title:"Moonboy Initiate",     icon:"🌙",color:"#7c4dff"},
  {lvl:30, title:"Based Degen",          icon:"🦍",color:"#ff9500"},
  {lvl:35, title:"Diamond Handed",       icon:"💎",color:"#00bfff"},
  {lvl:40, title:"Ape Commander",        icon:"🦧",color:"#ff6600"},
  {lvl:45, title:"Whale Rider",          icon:"🐋",color:"#448aff"},
  {lvl:50, title:"Alpha Hunter",         icon:"🎯",color:"#ffd740"},
  {lvl:55, title:"Rug Survivor",         icon:"🪤",color:"#ff9500"},
  {lvl:60, title:"Jeet Slayer",          icon:"⚔️",color:"#ff00ff"},
  {lvl:65, title:"Chad Operator",        icon:"😎",color:"#39ff14"},
  {lvl:70, title:"Giga Brain",           icon:"🧠",color:"#bf00ff"},
  {lvl:75, title:"Solana Specter",       icon:"👻",color:"#9945ff"},
  {lvl:80, title:"Crypto Reaper",        icon:"💀",color:"#ff073a"},
  {lvl:85, title:"Blockchain Phantom",   icon:"🌀",color:"#00ffff"},
  {lvl:90, title:"Satoshi Shadow",       icon:"🥷",color:"#ffd740"},
  {lvl:95, title:"Transcendent Degen",   icon:"⚡",color:"#ff00ff"},
  {lvl:100,title:"DEGEN GOD",            icon:"🔱",color:"#ffd740"},
];

export function getLevelTitle(lvl){return[...LEVEL_TITLES].reverse().find(t=>lvl>=t.lvl)||LEVEL_TITLES[0];}
export function getLevel(xp){let l=1;while(l<100&&xp>=(l+1)*(l+1)*10)l++;return l;}
export function xpForLevel(lvl){return lvl*lvl*10;}
export function xpForNextLevel(lvl){return Math.min((lvl+1)*(lvl+1)*10,100*100*10);}
export function calcGearScore(eq){
  return Object.values(eq||{}).reduce((s,id)=>{
    const item=ITEMS.find(i=>i.id===id);if(!item)return s;
    return s+Math.round((item.power||0)*(RARITIES[item.rarity]?.mult||1));
  },0);
}
export function calcTotalStats(eq){
  const t={};Object.keys(STATS).forEach(k=>t[k]=0);
  Object.values(eq||{}).forEach(id=>{
    const item=ITEMS.find(i=>i.id===id);if(!item?.stats)return;
    Object.entries(item.stats).forEach(([k,v])=>{t[k]=(t[k]||0)+v;});
  });return t;
}
export function rollLoot(luck=0){
  const r=Math.random();
  let rarity;
  if(r<RARITIES.mythic.chance+luck*0.003)rarity="mythic";
  else if(r<RARITIES.mythic.chance+RARITIES.legendary.chance+luck*0.01)rarity="legendary";
  else if(r<0.12+luck*0.02)rarity="epic";
  else if(r<0.25+luck*0.03)rarity="rare";
  else if(r<0.50)rarity="uncommon";
  else rarity="common";
  const pool=ITEMS.filter(i=>i.rarity===rarity);
  return pool[Math.floor(Math.random()*pool.length)]||ITEMS[0];
}

async function sbLoad(name){
  const r=await fetch(`${SB_URL}/rest/v1/hunter_profiles?name=eq.${encodeURIComponent(name)}&limit=1`,{headers:{apikey:SB_KEY,Authorization:`Bearer ${SB_KEY}`}});
  const d=await r.json();return Array.isArray(d)&&d.length>0?d[0]:null;
}
async function sbSave(p){
  const r=await fetch(`${SB_URL}/rest/v1/hunter_profiles?on_conflict=name`,{
    method:"POST",headers:{apikey:SB_KEY,Authorization:`Bearer ${SB_KEY}`,"Content-Type":"application/json",Prefer:"resolution=merge-duplicates"},
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
    fetch(`${SB_URL}/rest/v1/hunter_profiles?order=${c.order}&limit=50&select=name,xp,kills,level,gear_score,equipped`,{headers:{apikey:SB_KEY,Authorization:`Bearer ${SB_KEY}`}})
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
