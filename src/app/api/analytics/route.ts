import {NextRequest,NextResponse} from 'next/server';
import {createHmac} from 'node:crypto';
import {analyticsOrigin,analyticsWriter} from '@/lib/analytics/server';
import {validateEvent} from '@/lib/analytics/contract';
import {createClient} from '@/lib/supabase/server';
import {checkAdminAccess} from '@/lib/supabase/admin-access';
export const runtime='nodejs';
export const dynamic='force-dynamic';
// Cheap per-instance fuse; authoritative shared quotas live in the transactional RPC.
let minute=0,requests=0;
function reply(status:number){return new NextResponse(null,{status,headers:{'Cache-Control':'private, no-store'}});}
export async function POST(request:NextRequest){
 const origin=analyticsOrigin();
 if(!origin)return reply(204);
 // Prefetch requests are never visitor activity, even if sent to this endpoint.
 if(request.headers.has('next-router-prefetch')||/prefetch/i.test(`${request.headers.get('purpose')||''} ${request.headers.get('sec-purpose')||''}`))return reply(204);
 if(request.nextUrl.origin!==origin||request.headers.get('origin')!==origin||request.headers.get('sec-fetch-site')!=='same-origin')return reply(403);
 if(request.headers.get('sec-gpc')==='1'||request.headers.get('dnt')==='1')return reply(204);
 if(/bot|crawler|spider|headless|lighthouse|preview/i.test(request.headers.get('user-agent')||''))return reply(204);
 const current=Math.floor(Date.now()/60000);if(current!==minute){minute=current;requests=0;}
 if(++requests>1500)return reply(429);
 if(request.headers.get('content-type')?.split(';')[0]!=='application/json')return reply(415);
 try {
  const reader=request.body?.getReader();if(!reader)return reply(400);
  let size=0;const chunks:Uint8Array[]=[];
  try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>2048){await reader.cancel();return reply(413);}chunks.push(part.value);}}finally{reader.releaseLock();}
  const body=new Uint8Array(size);let offset=0;for(const c of chunks){body.set(c,offset);offset+=c.length;}
  let parsed:unknown;try{parsed=JSON.parse(new TextDecoder().decode(body));}catch{return reply(400);}
  const event=validateEvent(parsed);if(!event)return reply(400);
  // Admin visits to public pages are excluded; Auth failures with a session fail closed.
  if(request.cookies.getAll().some(c=>c.name.startsWith('sb-'))){
   const access=await checkAdminAccess(()=>createClient());
   if(access==='admin'||access==='unavailable')return reply(204);
  }
  const visitor=createHmac('sha256',process.env.ANALYTICS_VISITOR_HMAC_SECRET!).update(`${event.visitor}:${event.issuedAt}`).digest('hex');
  const {data,error}=await analyticsWriter().rpc('analytics_ingest_v1',{
   p_id:event.id,p_visitor:visitor,p_type:event.type,p_catalog:event.catalog,p_product:event.productId??null,p_page:event.page,
  });
  if(error)return reply(503);
  return reply(data===true?204:429);
 }catch{return reply(503);}
}
