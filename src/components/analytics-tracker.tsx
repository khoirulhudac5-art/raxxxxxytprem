'use client';
import {useEffect,useRef} from 'react';
import {usePathname} from 'next/navigation';
import Link from 'next/link';
import {publicPage,type AnalyticsEvent} from '@/lib/analytics/contract';
function allowed(){
 return navigator.doNotTrack!=='1'&&!(navigator as Navigator&{globalPrivacyControl?:boolean}).globalPrivacyControl;
}
export function AnalyticsTracker({origin}:{origin:string|null}){
 const path=usePathname(),lastPage=useRef(''),pending=useRef(new Set<AbortController>()),recent=useRef(new Map<string,number>());
 // Remove identifiers from the previous opt-in implementation; never create new ones.
 useEffect(()=>{try{localStorage.removeItem('rp-analytics-browser-v1');localStorage.removeItem('rp-analytics-consent-v1');}catch{/* Storage may be blocked. */}},[]);
 useEffect(()=>{
  const page=publicPage(path);
  if(!page){lastPage.current='';return;}
  if(!origin||location.origin!==origin||!allowed()||new URLSearchParams(location.search).has('preview'))return;
  const send=(type:AnalyticsEvent['type'],catalog:AnalyticsEvent['catalog'],productId?:string)=>{
   if(!allowed())return;
   try{
    const key=`${type}:${catalog}:${productId||path}`,now=Date.now();
    if(now-(recent.current.get(key)||0)<1000)return;
    recent.current.set(key,now);if(recent.current.size>100)recent.current.delete(recent.current.keys().next().value!);
    const controller=new AbortController();pending.current.add(controller);
    const timer=setTimeout(()=>controller.abort(),4500);
    void fetch('/api/analytics',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',keepalive:true,signal:controller.signal,
     body:JSON.stringify({id:crypto.randomUUID(),type,catalog,page,...(productId?{productId}:{})}),
    }).catch(()=>{}).finally(()=>{clearTimeout(timer);pending.current.delete(controller);});
   }catch{/* Analytics must never block navigation or purchases. */}
  };
  const view=()=>{if(document.visibilityState==='visible'&&lastPage.current!==path){lastPage.current=path;send('page_view',page.startsWith('app')?'apps':'ebooks');}};
  const frame=requestAnimationFrame(view);document.addEventListener('visibilitychange',view);
  const click=(e:MouseEvent)=>{
   if(!e.isTrusted||e.defaultPrevented||(e.type==='click'?e.button!==0:e.button!==1))return;
   const element=e.target instanceof Element?e.target.closest<HTMLElement>('[data-analytics-event]'):null;
   if(!element)return;
   const {analyticsEvent:type,analyticsCatalog:catalog,analyticsProduct:productId}=element.dataset;
   if((type==='catalog_click'||type==='product_click'||type==='purchase_whatsapp_click')&&(catalog==='apps'||catalog==='ebooks'))send(type,catalog,productId);
  };
  // Capture before Next Link's bubbling handler prevents default for client navigation.
  document.addEventListener('click',click,true);document.addEventListener('auxclick',click,true);
  return()=>{cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',view);document.removeEventListener('click',click,true);document.removeEventListener('auxclick',click,true);};
 },[origin,path]);
 if(path.startsWith('/admin'))return null;
 return <aside aria-label="Privasi statistik" className="analytics-privacy"><Link href="/privasi">Privasi statistik</Link></aside>;
}
