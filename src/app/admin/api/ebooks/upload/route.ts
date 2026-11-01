import {NextRequest} from 'next/server';
import {ebookAdminRoute,readEbookBody} from '@/lib/supabase/ebook-http';
import {EbookError} from '@/lib/supabase/ebook-error';
import {verifyStoredEbookImage} from '@/lib/supabase/ebook-image.server';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function POST(request:NextRequest){return ebookAdminRoute(request,async client=>{
 // Confirmation only: binary/multipart bodies are rejected, never proxied.
 if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')throw new EbookError(415,'Endpoint ini hanya menerima metadata JSON, bukan isi file.');
 const bytes=await readEbookBody(request,1024);let input:unknown;
 try{input=JSON.parse(new TextDecoder().decode(bytes));}catch{throw new EbookError(400,'JSON tidak valid.');}
 if(!input||typeof input!=='object'||Array.isArray(input))throw new EbookError(400,'Metadata gambar tidak valid.');
 const v=input as Record<string,unknown>;
 if((v.kind!=='covers'&&v.kind!=='banners')||typeof v.path!=='string'||Object.keys(v).some(k=>!['path','kind'].includes(k)))throw new EbookError(400,'Metadata gambar tidak valid.');
 return verifyStoredEbookImage(client,v.path,v.kind);
});}
