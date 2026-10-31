'use client';
import { useEffect, useState } from 'react';
import { createClient } from './client';
import { fetchSupabaseProducts } from './products';
import { CatalogReadState, loadCatalogPreview, migratedCatalogOrder } from './catalog';
import { readSharedProducts } from './product-source';
import { subscribeProductsRefresh } from './product-refresh';

// Shared Supabase reader for the public catalog and read-only Admin.
// Disabled means no client/query.
export function useCatalogPreview(enabled=false, referenceOrder?:readonly string[]) {
 const [state,setState] = useState<CatalogReadState>({status:'idle',products:[],error:null});
 const [attempt,setAttempt] = useState(0);
 const orderKey = JSON.stringify(referenceOrder ?? migratedCatalogOrder);
 useEffect(()=>{
  if (!enabled) return;
  const refresh=()=>setAttempt(value=>value+1);
  const unsubscribe=subscribeProductsRefresh(refresh);
  // Refresh other devices too, without requiring Realtime configuration.
  const timer=typeof window!=='undefined' ? window.setInterval(()=>{
   if(document.visibilityState==='visible')refresh();
  },5000) : undefined;
  if (typeof window!=='undefined') window.addEventListener('focus',refresh);
  return ()=>{unsubscribe();if(typeof window!=='undefined'){window.removeEventListener('focus',refresh);window.clearInterval(timer);}};
 },[enabled]);
 useEffect(()=>{
  let active = true;
  if (!enabled) { setState({status:'idle',products:[],error:null}); return; }
  setState(previous=>previous.status==='idle' ? {status:'loading',products:[],error:null} : previous);
  const order: string[] = JSON.parse(orderKey);
  const read = referenceOrder === undefined
   ? async()=>{try{return await readSharedProducts(createClient());}catch{return loadCatalogPreview(async()=>{throw new Error();},order);}}
   : ()=>loadCatalogPreview(()=>fetchSupabaseProducts(createClient()),order);
  void read().then(result=>{
   if (active) setState(result);
  });
  return ()=>{ active=false; }; // Late responses cannot replace a newer request.
 },[enabled,orderKey,referenceOrder===undefined,attempt]);
 const refresh=()=>setAttempt(value=>value+1);
 return {state,retry:refresh,refresh};
}
