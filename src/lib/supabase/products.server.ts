import 'server-only';
import { createClient } from './server';
import { readSharedProducts } from './product-source';

// Opt-in server reader. No page imports this function yet.
export async function getSupabaseProducts() {
 const result=await readSharedProducts(await createClient());
 if(result.status==='error') throw new Error(result.error);
 return result.products;
}
