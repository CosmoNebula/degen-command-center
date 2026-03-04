const ALLOWED=["frontend-api-v2.pump.fun","pump.fun","cdn.dexscreener.com","api.dexscreener.com","metadata.j7tracker.com","metadata.rapidlaunch.io","meta.uxento.io","ipfs.io","ipfs.extraction.live","data.solanatracker.io","graph.defined.fi","tokens.jup.ag","api.jup.ag","quote-api.jup.ag","cf-ipfs.com","nftstorage.link","arweave.net","gateway.pinata.cloud","dweb.link","cloudflare-ipfs.com","ipfs.nftstorage.link","quicknode.com","shdw-drive.genesysgo.net","img-cdn.magiceden.dev","creator-hub-sel.s3.us-west-2.amazonaws.com","bafkreia.ipfs.dweb.link","bafybei.ipfs.dweb.link"];

export async function onRequest(context){
  const url=new URL(context.request.url);
  const target=url.searchParams.get("url");
  if(context.request.method==="OPTIONS")return new Response(null,{headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type"}});
  if(!target)return new Response(JSON.stringify({error:"no url"}),{status:400,headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}});
  let t;
  try{t=new URL(target)}catch(e){return new Response(JSON.stringify({error:"bad url"}),{status:400,headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}})}
  if(!ALLOWED.some(function(d){return t.hostname===d||t.hostname.endsWith("."+d)}))return new Response(JSON.stringify({error:"blocked: "+t.hostname}),{status:403,headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}});
  try{
    const opts={headers:{}};
    if(context.request.method==="POST"){opts.method="POST";opts.headers["Content-Type"]="application/json";opts.body=await context.request.text();}
    const r=await fetch(target,opts);
    const ct=r.headers.get("content-type")||"";
    if(ct.startsWith("image/")){const buf=await r.arrayBuffer();return new Response(buf,{status:r.status,headers:{"Content-Type":ct,"Access-Control-Allow-Origin":"*","Cache-Control":"public,max-age=300"}});}
    const body=await r.text();
    return new Response(body,{status:r.status,headers:{"Content-Type":ct||"application/json","Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type","Cache-Control":"public,max-age=10"}});
  }catch(e){return new Response(JSON.stringify({error:e.message}),{status:502,headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}});}
}
