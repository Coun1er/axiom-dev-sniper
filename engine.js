import './settings.js';
const api=globalThis.DevWatch;
export function createEngine(deps){
  let queue=Promise.resolve();const drySeen=new Set();
  async function run(tabId,diagnostic=false){
    const result=await deps.read(tabId,'scan');
    const initial=api.normalize(await deps.settings());
    const matches=result.rows.filter(r=>initial.developers.includes(r.devAddress));
    const summary={at:Date.now(),cardCount:result.cardCount,missingDev:result.missingDev,matches:matches.length,rows:result.rows.slice(0,60)};
    await deps.summary(summary);
    if(diagnostic||!api.mode(initial))return summary;
    for(const token of matches){
      const s=api.normalize(await deps.settings()),action=api.mode(s);
      if(!action||!s.developers.includes(token.devAddress))continue;
      if(s.dryRun){
        const key=action+':'+token.tokenAddress;
        if(!drySeen.has(key)){drySeen.add(key);await deps.log({...token,action,status:'dry-run'});}
        continue;
      }
      if(!await deps.active(tabId))return summary;
      if(await deps.claimed(token.tokenAddress))continue;
      const ready=await deps.read(tabId,'prepare',token);
      if(!ready?.ok)continue;
      const latest=api.normalize(await deps.settings());
      if(latest.dryRun||api.mode(latest)!==action||!latest.developers.includes(token.devAddress))continue;
      // Reserve before any side effect. Never retry an ambiguous financial click.
      try{
        await deps.claim(token.tokenAddress,{devAddress:token.devAddress,action,at:Date.now(),status:'reserved'});
        if(action==='buy')await deps.buy(tabId,token);else{
          const opened=await deps.read(tabId,'open',token);
          if(!opened?.ok)throw Error(opened?.reason||'open-failed');
        }
        await deps.log({...token,action,status:action==='buy'?'click-sent':'opened'});
      }catch(e){
        await deps.pause();
        try{await deps.log({...token,action,status:'stopped',error:String(e.message||e).slice(0,200)});}catch{}
        return summary;
      }
    }
    return summary;
  }
  return {scan(tabId,diagnostic=false){const next=queue.catch(()=>{}).then(()=>run(tabId,diagnostic));queue=next;return next;}};
}
