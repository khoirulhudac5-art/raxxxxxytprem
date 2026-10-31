import type { SupabaseClient } from '@supabase/supabase-js';
import type { Product } from '../products';

export const PRODUCT_COLUMNS = 'id,name,description,category,icon,color,badge,image_url,plans';

function isObject(value: unknown): value is Record<string, unknown> {
 return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Validate the API boundary instead of trusting a TypeScript cast of JSONB.
export function mapSupabaseProducts(value: unknown): Product[] {
 if (!Array.isArray(value)) throw new Error('Respons produk Supabase bukan daftar.');
 const ids = new Set<string>();
 return value.map((row, index) => {
  if (!isObject(row)) throw new Error(`Produk Supabase pada baris ${index + 1} tidak valid.`);
  const text = (key: string): string => {
   if (typeof row[key] !== 'string') throw new Error(`Kolom ${key} pada baris ${index + 1} harus berupa teks.`);
   return row[key];
  };
  const id = text('id');
  const name = text('name');
  if (!id.trim() || !name.trim() || ids.has(id)) throw new Error('ID/nama produk kosong atau ID duplikat.');
  ids.add(id);
  if (!Array.isArray(row.plans) || !row.plans.length) throw new Error(`Paket pada baris ${index + 1} kosong/tidak valid.`);
  const plans = row.plans.map(plan => {
   if (!isObject(plan) || typeof plan.duration !== 'string' || !plan.duration.trim() ||
    typeof plan.price !== 'number' || !Number.isSafeInteger(plan.price) || plan.price < 0) {
    throw new Error(`Durasi/harga pada baris ${index + 1} tidak valid.`);
   }
   return {duration: plan.duration, price: plan.price};
  });
  return {id, name, description:text('description'), category:text('category'),
   icon:text('icon'), color:text('color'), badge:text('badge'), imageUrl:text('image_url'), plans};
 });
}

// Accept either existing SSR factory's client; importing this module performs no query.
// This returns a separate list and never seeds, saves, or falls back to localStorage.
export async function fetchSupabaseProducts(client: SupabaseClient): Promise<Product[]> {
 const {data, error} = await client.schema('public').from('products')
  .select(PRODUCT_COLUMNS).order('id', {ascending:true});
 if (error) throw new Error(`Pembacaan produk Supabase gagal (kode ${error.code || 'tidak tersedia'}).`);
 return mapSupabaseProducts(data);
}
