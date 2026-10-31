import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchSupabaseProducts } from './products';
import { loadCatalogPreview, migratedCatalogOrder } from './catalog';

// Shared preview contract: both pages use the approved migration order, independent
// of per-device localStorage. This contains IDs only, never fallback product data.
export function readSharedProducts(client: SupabaseClient) {
 return loadCatalogPreview(()=>fetchSupabaseProducts(client),migratedCatalogOrder);
}
