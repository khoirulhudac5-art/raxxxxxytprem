import { NextRequest,NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkAdminAccess } from '@/lib/supabase/admin-access';
import { isSameOriginPost } from '@/lib/supabase/auth-request';
import { productCrudEnabled } from '@/lib/supabase/crud-flag';
import { CrudError,executeProductCrud } from '@/lib/supabase/product-crud';
export const dynamic='force-dynamic';
export async function POST(request:NextRequest){
 const response=new NextResponse(null,{headers:{'Cache-Control':'private, no-store'}});
 const reply=(data:unknown,status:number)=>{response.headers.set('Content-Type','application/json');response.headers.set('Cache-Control','private, no-store');return new NextResponse(JSON.stringify(data),{status,headers:response.headers});};
 if(!productCrudEnabled())return reply({error:'CRUD Supabase dinonaktifkan.'},404);
 if(!isSameOriginPost(request))return reply({error:'Permintaan ditolak.'},403);
 try{
  const client=await createClient(response);
  const access=await checkAdminAccess(async()=>client);
  if(access!=='admin')return reply({error:'Akses Admin diperlukan.'},access==='unauthenticated'?401:access==='denied'?403:503);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return reply({error:'Gunakan JSON.'},415);
  // Stream with a hard cap, including bodies without Content-Length.
  const reader=request.body?.getReader();let body='';let size=0;const decoder=new TextDecoder();
  if(reader){try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;
   if(size>32768){await reader.cancel();return reply({error:'Permintaan terlalu besar.'},413);}body+=decoder.decode(part.value,{stream:true});}body+=decoder.decode();}finally{reader.releaseLock();}}
  let input:unknown;try{input=JSON.parse(body);}catch{return reply({error:'JSON tidak valid.'},400);}
  return reply(await executeProductCrud(client,input),200);
 }catch(error){return reply({error:error instanceof CrudError?error.message:'Layanan produk belum tersedia.'},error instanceof CrudError?error.status:503);}
}
