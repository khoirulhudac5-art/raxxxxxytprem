// Read lazily so existing pages can build without Supabase configuration.
export function getSupabaseEnvironment() {
 const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
 const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
 if (!url || !publishableKey) {
  throw new Error('Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY di .env.local.');
 }
 let parsed: URL;
 try { parsed = new URL(url); }
 catch { throw new Error('NEXT_PUBLIC_SUPABASE_URL harus berupa URL HTTP/HTTPS yang valid.'); }
 if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL harus berupa URL HTTP/HTTPS tanpa kredensial.');
 }
 // This factory intentionally accepts modern publishable keys only.
 if (!publishableKey.startsWith('sb_publishable_')) {
  throw new Error('Gunakan publishable key Supabase (sb_publishable_), bukan secret atau service-role key.');
 }
 return {url, publishableKey};
}
