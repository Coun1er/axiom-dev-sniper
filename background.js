import './settings.js';
import {readPulse} from './native-reader.js';
import {createEngine} from './engine.js';
const api=globalThis.DevWatch;
const settings=async()=>api.normalize((await chrome.storage.local.get('devWatchSettings')).devWatchSettings);
async function read(tabId,mode,request={}){
  const tab=await chrome.tabs.get(tabId);
  if(!api.allowed(tab.url))throw Error('Pulse is not open');
  const results=await chrome.scripting.executeScript({target:{tabId},world:'MAIN',func:readPulse,args:[mode,request]});
  const result=results.find(r=>r.frameId===0)?.result;
  if(!result||result.error)throw Error(result?.error||'No native Pulse data');
  return result;
}
async function active(tabId){const tab=await chrome.tabs.get(tabId);return api.allowed(tab.url)&&tab.active===true&&(await chrome.windows.get(tab.windowId)).focused===true;}
async function log(entry){const d=await chrome.storage.local.get({devWatchLog:[]});await chrome.storage.local.set({devWatchLog:[{...entry,at:Date.now()},...d.devWatchLog].slice(0,100)});}
async function buy(tabId,token){
  const target={tabId};let attached=false;
  async function prepare(){
    const s=await settings();
    if(s.dryRun||!s.buyEnabled||!s.developers.includes(token.devAddress)||!await active(tabId))throw Error('Mode, developer or active tab changed');
    const response=await chrome.debugger.sendCommand(target,'Runtime.evaluate',{expression:`(${readPulse.toString()})('prepare',${JSON.stringify({tokenAddress:token.tokenAddress,devAddress:token.devAddress})})`,returnByValue:true});
    const r=response?.result?.value;
    if(!r?.ok||!Number.isFinite(r.point?.x)||!Number.isFinite(r.point?.y))throw Error(r?.reason||'Preflight failed');
    return r.point;
  }
  try{
    await chrome.debugger.attach(target,'1.3');attached=true;
    let point=await prepare();
    await chrome.debugger.sendCommand(target,'Input.dispatchMouseEvent',{type:'mouseMoved',...point,button:'none',buttons:0,pointerType:'mouse'});
    point=await prepare();
    const params={...point,button:'left',buttons:1,clickCount:1,pointerType:'mouse'};
    await chrome.debugger.sendCommand(target,'Input.dispatchMouseEvent',{type:'mousePressed',...params});
    await chrome.debugger.sendCommand(target,'Input.dispatchMouseEvent',{type:'mouseReleased',...params,buttons:0});
  }finally{if(attached)try{await chrome.debugger.detach(target);}catch{}}
}
let lastSummary='';
const engine=createEngine({settings,read,active,buy,log,
  async summary(s){const key=JSON.stringify({...s,at:0});if(key!==lastSummary){lastSummary=key;await chrome.storage.local.set({devWatchSummary:s});}},
  async claimed(mint){return !!(await chrome.storage.local.get({devWatchClaims:{}})).devWatchClaims[mint];},
  async claim(mint,entry){const d=await chrome.storage.local.get({devWatchClaims:{}});if(Object.keys(d.devWatchClaims).length>=10000)throw Error('Safety ledger is full');d.devWatchClaims[mint]=entry;await chrome.storage.local.set(d);},
  async pause(){await chrome.storage.local.set({devWatchSettings:{...await settings(),openEnabled:false,buyEnabled:false}});}
});
chrome.runtime.onMessage.addListener((m,sender,reply)=>{
  if(m?.type==='DEV_WATCH_SCAN'&&sender.frameId===0&&api.allowed(sender.url)&&Number.isInteger(sender.tab?.id)){
    engine.scan(sender.tab.id).then(s=>reply({ok:true,summary:s})).catch(e=>reply({ok:false,error:String(e.message)}));return true;
  }
  if(m?.type==='DEV_WATCH_CHECK'&&sender.url===chrome.runtime.getURL('popup.html')){
    chrome.tabs.query({active:true,lastFocusedWindow:true}).then(tabs=>{const tab=tabs.find(t=>api.allowed(t.url));if(!tab)throw Error('Откройте Pulse в активной вкладке');return engine.scan(tab.id,true);}).then(s=>reply({ok:true,summary:s})).catch(e=>reply({ok:false,error:String(e.message)}));return true;
  }
});
