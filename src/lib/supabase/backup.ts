import type { SupabaseClient } from '@supabase/supabase-js';
import { mapSupabaseProducts, PRODUCT_COLUMNS } from './products';
import { migratedCatalogOrder, orderCatalog } from './catalog';
import { validWhatsAppSettings } from '../whatsapp';

const timestamp = (value:unknown):string => {
 if (typeof value!=='string' || !Number.isFinite(Date.parse(value))) throw new Error('Timestamp backup tidak valid.');
 return value;
};

async function readBackupData(client:SupabaseClient) {
 const rows: Record<string,unknown>[]=[];
 let expected:number|undefined;
 const pageSize=200;
 for (let offset=0; ; offset+=pageSize) {
  const result=await client.schema('public').from('products')
   .select(`${PRODUCT_COLUMNS},created_at,updated_at`,{count:'exact'})
   .order('id',{ascending:true}).range(offset,offset+pageSize-1);
  if(result.error || !Array.isArray(result.data) || typeof result.count!=='number') throw new Error('Pembacaan produk backup gagal.');
  if(expected!==undefined && result.count!==expected) throw new Error('Data berubah saat ekspor. Coba lagi.');
  expected=result.count;
  if(result.data.length===0 && rows.length<expected) throw new Error('Respons produk terpotong.');
  rows.push(...result.data);
  if(rows.length>=expected) break;
  if(result.data.length<pageSize) throw new Error('Batas API menyebabkan backup tidak lengkap.');
 }
 if(!rows.length || rows.length!==expected) throw new Error('Produk kosong atau backup tidak lengkap.');
 const mapped=mapSupabaseProducts(rows);
 const ordered=orderCatalog(mapped,migratedCatalogOrder);
 const byId=new Map(rows.map(row=>[row.id,row]));
 const products=ordered.map(product=>({ ...product,
  createdAt:timestamp(byId.get(product.id)?.created_at),updatedAt:timestamp(byId.get(product.id)?.updated_at),
 }));
 const settings=await client.schema('public').from('store_settings')
  .select('id,whatsapp_number,whatsapp_template,updated_at',{count:'exact'}).order('id',{ascending:true});
 if(settings.error || settings.count!==1 || !Array.isArray(settings.data) || settings.data.length!==1) throw new Error('Pengaturan toko kosong, ganda, atau tidak lengkap.');
 const row=settings.data[0];
 if(row.id!=='main' || !validWhatsAppSettings({number:row.whatsapp_number,template:row.whatsapp_template})) throw new Error('Pengaturan WhatsApp backup tidak valid.');
 const storeSettings={id:'main',whatsappNumber:row.whatsapp_number as string,whatsappTemplate:row.whatsapp_template as string,updatedAt:timestamp(row.updated_at)};
 return {products,productOrder:products.map(p=>p.id),storeSettings};
}

// Caller must authorize on the server before calling. Only SELECTs; no local fallback.
export async function exportSupabaseBackup(client:SupabaseClient, now=new Date()) {
 const first=await readBackupData(client);
 const second=await readBackupData(client);
 if(JSON.stringify(first)!==JSON.stringify(second)) throw new Error('Data berubah saat ekspor. Coba lagi.');
 const backup={app:'rakyat-premium',version:2,source:'supabase',exportedAt:now.toISOString(),
  consistency:'two-matching-reads-not-transactional',
  warnings:['Ekspor ini bukan snapshot transaksi database.','Gambar dicadangkan sebagai URL, bukan file gambar.'],
  ...second,whatsapp:{number:second.storeSettings.whatsappNumber,template:second.storeSettings.whatsappTemplate},
  counts:{products:second.products.length,plans:second.products.reduce((total,p)=>total+p.plans.length,0)},
 };
 const json=JSON.stringify(backup,null,2);
 const parsed=JSON.parse(json);
 if(!parsed.products.length || parsed.counts.products!==backup.counts.products || parsed.counts.plans!==backup.counts.plans) throw new Error('Verifikasi JSON backup gagal.');
 return {json,filename:`rakyat-premium-supabase-backup-${now.toISOString().replace(/[:.]/g,'-')}.json`};
}
