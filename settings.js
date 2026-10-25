(() => {
  const address=v=>typeof v==='string'&&/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);
  function normalize(v={}){
    if(!v||typeof v!=='object')v={};
    return {developers:[...new Set((Array.isArray(v.developers)?v.developers:[]).filter(address))],openEnabled:v.openEnabled===true,buyEnabled:v.buyEnabled===true,dryRun:v.dryRun!==false};
  }
  function mode(s){return s.buyEnabled?'buy':s.openEnabled?'open':null;}
  function allowed(url){try{const u=new URL(url);return u.protocol==='https:'&&(u.hostname==='axiom.trade'||u.hostname.endsWith('.axiom.trade'))&&u.pathname.replace(/\/$/,'')==='/pulse';}catch{return false;}}
  globalThis.DevWatch={address,normalize,mode,allowed};
})();
