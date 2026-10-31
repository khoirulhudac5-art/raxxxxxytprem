'use client';
import { useEffect,useState,useRef,useCallback } from 'react';
import type { CrudProduct } from './product-crud';
import { refreshSupabaseProducts } from './product-refresh';
export function useProductCrud(enabled:boolean){
 const [products,setProducts]=useState<CrudProduct[]>([]),[ready,setReady]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const lock=useRef(false),generation=useRef(0);
 const request=async(input:unknown)=>{
  const response=await fetch('/admin/api/products',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),cache:'no-store'});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Permintaan gagal.');return data;
 };
 const refresh=useCallback(async()=>{
  if(!enabled)return;const id=++generation.current;
  try{const data=await request({operation:'list'});if(id===generation.current){setProducts(data.products);setError('');}}
  catch(e){if(id===generation.current)setError(e instanceof Error?e.message:'Pembacaan gagal.');}
  finally{if(id===generation.current)setReady(true);}
 },[enabled]);
 useEffect(()=>{if(enabled)void refresh();return()=>{generation.current++;};},[enabled,refresh]);
 async function mutate(input:unknown){
  if(!enabled||lock.current)return false;lock.current=true;setBusy(true);setError('');
  try{await request(input);refreshSupabaseProducts();await refresh();return true;}
  catch(e){setError(e instanceof Error?e.message:'Perubahan belum dikonfirmasi. Muat ulang sebelum mencoba lagi.');return false;}
  finally{lock.current=false;setBusy(false);}
 }
 return {products,ready,error,busy,refresh,mutate};
}
