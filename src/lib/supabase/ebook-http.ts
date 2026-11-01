import 'server-only';
import {NextRequest,NextResponse} from 'next/server';
import {createClient} from './server';
import {checkAdminAccess} from './admin-access';
import {isSameOriginPost} from './auth-request';
import {EbookError} from './ebook-admin';
export async function readEbookBody(request:NextRequest,limit:number){
 const reader=request.body?.getReader();const chunks:Uint8Array[]=[];let size=0;
 if(reader){try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>limit){await reader.cancel();throw new EbookError(413,'Ukuran file atau permintaan terlalu besar.');}chunks.push(part.value);}}finally{reader.releaseLock();}}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return bytes;
}
export async function ebookAdminRoute(request:NextRequest,work:(client:Awaited<ReturnType<typeof createClient>>)=>Promise<unknown>){
 const response=new NextResponse(null,{headers:{'Cache-Control':'private, no-store'}});
 const reply=(data:unknown,status:number)=>{response.headers.set('Content-Type','application/json');return new NextResponse(JSON.stringify(data),{status,headers:response.headers});};
 if(!isSameOriginPost(request))return reply({error:'Permintaan ditolak.'},403);
 try{
  const client=await createClient(response),access=await checkAdminAccess(async()=>client);
  if(access!=='admin')return reply({error:'Akses Admin diperlukan.'},access==='unauthenticated'?401:access==='denied'?403:503);
  return reply(await work(client),200);
 }catch(e){return reply({error:e instanceof EbookError?e.message:'Layanan e-book belum tersedia. Muat ulang untuk memeriksa hasil.'},e instanceof EbookError?e.status:503);}
}
