import 'server-only';
// Explicit server-side opt-in, scoped to the approved database. Keep unset until approval.
export function productCrudEnabled() {
 return process.env.SUPABASE_PRODUCT_CRUD_ENABLED==='true' &&
  !!process.env.SUPABASE_PRODUCT_CRUD_APPROVED_URL &&
  process.env.SUPABASE_PRODUCT_CRUD_APPROVED_URL===process.env.NEXT_PUBLIC_SUPABASE_URL;
}
