'use client';
import { useEffect, useState } from 'react';
import { initialProducts, Product, STORAGE_KEY, validProducts } from './products';
export function useProducts(enabled=true) {
 const [products,setProducts] = useState<Product[]>(initialProducts);
 const [ready,setReady] = useState(false);
 const [error,setError] = useState('');
 useEffect(()=>{ if(!enabled)return; const read = ()=>{ try { const raw=localStorage.getItem(STORAGE_KEY); if(raw) { const data:unknown=JSON.parse(raw); if(!validProducts(data)) throw Error(); setProducts(data); } else setProducts(initialProducts); } catch { setError('Data browser tidak dapat dibaca. Katalog contoh ditampilkan; penyimpanan baru akan mengganti data lama.'); } setReady(true); }; read(); window.addEventListener('storage',read); return ()=>window.removeEventListener('storage',read); },[enabled]);
 function save(next:Product[]) { try { localStorage.setItem(STORAGE_KEY,JSON.stringify(next)); setProducts(next); setError(''); return true; } catch { setError('Penyimpanan gagal. Pastikan penyimpanan browser diizinkan dan ruang masih tersedia.'); return false; } }
 return {products,ready,error,save};
}
