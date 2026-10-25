(() => {
  if(window!==window.top)return;
  let timer=null,busy=false,again=false;
  async function scan(){
    timer=null;
    if(location.pathname.replace(/\/$/,'')!=='/pulse'||document.visibilityState!=='visible')return;
    if(busy){again=true;return;}
    busy=true;
    try{await chrome.runtime.sendMessage({type:'DEV_WATCH_SCAN'});}catch{}
    finally{busy=false;if(again){again=false;schedule();}}
  }
  function schedule(){if(timer===null)timer=setTimeout(scan,100);}
  new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true});
  chrome.storage.onChanged.addListener((c,area)=>{if(area==='local'&&c.devWatchSettings)schedule();});
  addEventListener('scroll',schedule,true);addEventListener('popstate',schedule);addEventListener('visibilitychange',schedule);
  // React data can hydrate without a DOM text mutation. Read current native props.
  setInterval(schedule,750);schedule();
})();
