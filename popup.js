(() => {
  const api=DevWatch,$=id=>document.getElementById(id);
  const labels={'dry-run':'ТЕСТ — без действий','click-sent':'Клик покупки отправлен','opened':'Токен открыт','stopped':'Ошибка — режимы выключены'};
  function render(data){
    const s=data.devWatchSummary;
    $('summary').textContent=s?`Карточек: ${s.cardCount}, без подтверждённого devAddress: ${s.missingDev}, совпадений: ${s.matches}. ${new Date(s.at).toLocaleTimeString()}`:'Пока нет данных';
    $('log').replaceChildren();
    for(const item of (data.devWatchLog||[]).slice(0,20)){
      const entry=document.createElement('div');entry.className='entry';
      const title=document.createElement('strong');title.textContent=`${labels[item.status]||item.status} · ${item.tokenTicker||item.tokenName||'token'}`;
      const text=document.createElement('div');text.textContent=`${item.action==='buy'?'BUY':'OPEN'} · ${new Date(item.at).toLocaleTimeString()} · ${item.tokenAddress}${item.error?' · '+item.error:''}`;
      entry.append(title,text);$('log').append(entry);
    }
    if(!$('log').children.length)$('log').textContent='Пусто';
  }
  async function refresh(){render(await chrome.storage.local.get(['devWatchSummary','devWatchLog']));}
  chrome.storage.local.get('devWatchSettings').then(d=>{const s=api.normalize(d.devWatchSettings);$('developers').value=s.developers.join('\n');for(const k of ['openEnabled','buyEnabled','dryRun'])$(k).checked=s[k];}).catch(()=>{$('status').textContent='Не удалось прочитать настройки';});
  $('save').addEventListener('click',async()=>{
    const values=$('developers').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean),invalid=values.filter(x=>!api.address(x));
    if(invalid.length){$('status').textContent=`Некорректных адресов: ${invalid.length}. Нужны полные Solana-адреса.`;return;}
    if(!values.length&&($('openEnabled').checked||$('buyEnabled').checked)){$('status').textContent='Сначала добавьте адреса девов';return;}
    const s={developers:values};for(const k of ['openEnabled','buyEnabled','dryRun'])s[k]=$(k).checked;
    try{await chrome.storage.local.set({devWatchSettings:api.normalize(s)});$('status').textContent=s.dryRun?'Сохранено. Тестовый режим: действий не будет.':'Сохранено. Выбранные режимы активны.';}catch{$('status').textContent='Не удалось сохранить';}
  });
  $('check').addEventListener('click',async()=>{try{const r=await chrome.runtime.sendMessage({type:'DEV_WATCH_CHECK'});$('status').textContent=r?.ok?'Данные прочитаны, действия не выполнялись':r?.error||'Нет ответа';await refresh();}catch(e){$('status').textContent=String(e.message);}});
  chrome.storage.onChanged.addListener((c,area)=>{if(area==='local'&&(c.devWatchSummary||c.devWatchLog))refresh();if(area==='local'&&c.devWatchSettings){const s=api.normalize(c.devWatchSettings.newValue);$('openEnabled').checked=s.openEnabled;$('buyEnabled').checked=s.buyEnabled;}});
  refresh().catch(()=>{});
})();
