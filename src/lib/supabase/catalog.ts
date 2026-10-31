import type { Product } from '../products';
import { validProducts } from '../products';

// ID order from the actual migration backup, not alphabetical database order.
export const migratedCatalogOrder: readonly string[] = ['chatgpt','capcut','canva','google','youtube','spotify','zoom'];

export function orderCatalog(products: Product[], referenceOrder: readonly string[]): Product[] {
 if (new Set(referenceOrder).size !== referenceOrder.length) throw new Error('Referensi urutan memiliki ID duplikat.');
 const ranks = new Map(referenceOrder.map((id,index)=>[id,index]));
 // Unknown IDs follow known products, preserving incoming order. No ID sort here.
 return products.map((product,index)=>({product,index})).sort((a,b)=>
  (ranks.get(a.product.id) ?? referenceOrder.length) - (ranks.get(b.product.id) ?? referenceOrder.length) || a.index-b.index
 ).map(item=>item.product);
}

export function compareCatalogs(local: Product[], remote: Product[]) {
 const localById = new Map(local.map(p=>[p.id,p]));
 const remoteById = new Map(remote.map(p=>[p.id,p]));
 const fields = ['name','description','category','icon','color','badge'] as const;
 const missingIds = local.filter(p=>!remoteById.has(p.id)).map(p=>p.id);
 const addedIds = remote.filter(p=>!localById.has(p.id)).map(p=>p.id);
 const changedIds = local.filter(p=>{
  const other=remoteById.get(p.id);
  return other && (fields.some(key=>p[key]!==other[key]) || (p.imageUrl ?? '')!==(other.imageUrl ?? '') ||
   p.plans.length!==other.plans.length || p.plans.some((plan,index)=>
    plan.duration!==other.plans[index].duration || plan.price!==other.plans[index].price || (plan.available??true)!==(other.plans[index].available??true)));
 }).map(p=>p.id);
 const sameOrder = local.length===remote.length && local.every((p,index)=>p.id===remote[index].id);
 return {sameOrder, sameData:!missingIds.length && !addedIds.length && !changedIds.length,
  localOrder:local.map(p=>p.id), remoteOrder:remote.map(p=>p.id), missingIds, addedIds, changedIds};
}

// Explicit read-only adapter for a future browser comparison. Never uses samples.
export function readStoredCatalog(storage: Pick<Storage,'getItem'>, key: string): Product[] {
 try {
  const raw = storage.getItem(key);
  if (raw === null) throw new Error();
  const data: unknown = JSON.parse(raw);
  if (!validProducts(data)) throw new Error();
  return data;
 } catch { throw new Error('Katalog localStorage tidak tersedia atau tidak valid; perbandingan dibatalkan.'); }
}

export type CatalogReadState =
 | {status:'idle'|'loading'; products:Product[]; error:null}
 | {status:'ready'; products:Product[]; error:null}
 | {status:'empty'; products:Product[]; error:null; scope:'visible_rows'}
 | {status:'error'; products:Product[]; error:string};

export async function loadCatalogPreview(load:()=>Promise<Product[]>, referenceOrder:readonly string[]): Promise<CatalogReadState> {
 try {
  const products = orderCatalog(await load(),referenceOrder);
  return products.length ? {status:'ready', products, error:null} : {status:'empty', products:[], error:null, scope:'visible_rows'};
 } catch {
  // No sample/local fallback and no raw errors that could contain URLs or credentials.
  return {status:'error', products:[], error:'Produk Supabase gagal dibaca. Periksa koneksi, izin, atau format data lalu coba lagi.'};
 }
}
