// Self-contained function serialized by chrome.scripting into the MAIN world.
// Only current card React props are inspected. No application stores/auth/hooks/WS.
export function readPulse(mode='scan',request={}){
  const address=v=>typeof v==='string'&&/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);
  if(!/^\/pulse\/?$/.test(location.pathname))return {rows:[],cardCount:0,missingDev:0,error:'not-pulse'};
  const selector='[class~="group/pulseRow"]';
  const rows=[],seen=new Set();let missingDev=0,cardCount=0;
  for(const row of document.querySelectorAll(selector)){
    const box=row.getBoundingClientRect();
    if(box.width<=0||box.height<=0||box.bottom<=0||box.top>=innerHeight)continue;
    cardCount++;
    let nativeMint='';
    for(const a of row.querySelectorAll('a[href]')){
      const m=a.getAttribute('href')?.match(/^https:\/\/(?:www\.)?pump\.fun\/coin\/([1-9A-HJ-NP-Za-km-z]{32,44})(?:[/?#]|$)/);
      if(m){nativeMint=m[1];break;}
    }
    const candidates=new Map(),visited=new WeakSet();
    function inspect(p,depth=0){
      if(!p||typeof p!=='object'||p instanceof Node||Array.isArray(p)||depth>2||visited.has(p))return;
      visited.add(p);
      const mint=p.tokenAddress,dev=p.devAddress,chain=String(p.chain||'sol').toLowerCase();
      if(address(mint)&&address(dev)&&['sol','solana'].includes(chain)&&(!nativeMint||nativeMint===mint)){
        const key=mint+':'+dev;
        candidates.set(key,{tokenAddress:mint,devAddress:dev,pairAddress:address(p.pairAddress)?p.pairAddress:'',tokenName:typeof p.tokenName==='string'?p.tokenName.slice(0,100):'',tokenTicker:typeof p.tokenTicker==='string'?p.tokenTicker.slice(0,40):'',source:'native-react-devAddress'});
      }
      for(const k of ['token','pair','data','tokenInfo','pairInfo'])inspect(p[k],depth+1);
    }
    for(const el of [row,...row.querySelectorAll('button,i,span')].slice(0,160)){
      const keys=Object.keys(el);
      inspect(el[keys.find(k=>k.startsWith('__reactProps'))]);
      let fiber=el[keys.find(k=>k.startsWith('__reactFiber'))];
      for(let n=0;fiber&&n<10;n++,fiber=fiber.return){inspect(fiber.memoizedProps);}
    }
    // Conflicting owners / recycled row: do not guess or trade.
    if(candidates.size!==1){missingDev++;continue;}
    const item=[...candidates.values()][0];
    if(mode!=='scan'&&(item.tokenAddress!==request.tokenAddress||item.devAddress!==request.devAddress))continue;
    const button=[...row.querySelectorAll('button[class*="group/quickBuyButton"]')].find(b=>!b.disabled&&b.getAttribute('aria-disabled')!=='true'&&b.getBoundingClientRect().width>0&&b.getBoundingClientRect().height>0);
    item.buttonReady=!!button;
    item.amount=button?.textContent?.match(/\d+(?:\.\d+)?\s*SOL\b/)?.[0]||'';
    if(mode==='scan'){if(!seen.has(item.tokenAddress)){seen.add(item.tokenAddress);rows.push(item);}continue;}
    if(!button||document.visibilityState!=='visible')return {ok:false,reason:'button-unavailable'};
    const r=button.getBoundingClientRect(),point={x:r.left+r.width/2,y:r.top+r.height/2};
    if(point.x<0||point.y<0||point.x>=innerWidth||point.y>=innerHeight||!button.contains(document.elementFromPoint(point.x,point.y)))return {ok:false,reason:'button-covered'};
    if(mode==='open'){button.click();return {ok:true,...item};}
    return {ok:true,...item,point};
  }
  return mode==='scan'?{rows,cardCount,missingDev}:{ok:false,reason:'token-or-dev-changed'};
}
