import 'server-only';
import {createClient} from '@supabase/supabase-js';
export function analyticsOrigin():string|null {
 if(process.env.ANALYTICS_ENABLED!=='true'||process.env.NODE_ENV!=='production')return null;
 if(process.env.VERCEL_ENV&&process.env.VERCEL_ENV!=='production')return null;
 try {
  const u=new URL(process.env.ANALYTICS_PUBLIC_ORIGIN||'');
  // Require a real HTTPS DNS origin. No localhost, IP literals, credentials or paths.
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.pathname!=='/'||u.search||u.hash||!u.hostname.includes('.')||/^[\d.]+$/.test(u.hostname)||u.hostname.includes(':')||/(^|\.)(localhost|local|internal|test|invalid)$/.test(u.hostname))return null;
  if(!process.env.ANALYTICS_INGEST_SECRET||(process.env.ANALYTICS_VISITOR_HMAC_SECRET?.length??0)<32)return null;
  if(!process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.ANALYTICS_APPROVED_SUPABASE_URL!==process.env.NEXT_PUBLIC_SUPABASE_URL)return null;
  // The synthetic security-test database must never collect main-site traffic.
  const database=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if(database.protocol!=='https:'||database.username||database.password||database.pathname!=='/'||database.search||database.hash||database.port||database.hostname==='kzsoobgkqftzheqjtwxs.supabase.co')return null;
  return u.origin;
 }catch{return null;}
}
// Completely separate from the publishable/SSR client. Never import in a Client Component.
export function analyticsWriter(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 if(!url||process.env.ANALYTICS_APPROVED_SUPABASE_URL!==url)throw new Error('Analytics database not approved');
 return createClient(url,process.env.ANALYTICS_INGEST_SECRET!,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  global:{fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(4000),cache:'no-store'})},
 });
}
