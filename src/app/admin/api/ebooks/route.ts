import {NextRequest} from 'next/server';
import {ebookAdminRoute,readEbookBody} from '@/lib/supabase/ebook-http';
import {executeEbookAdmin,EbookError} from '@/lib/supabase/ebook-admin';
export const dynamic='force-dynamic';
export async function POST(request:NextRequest){return ebookAdminRoute(request,async client=>{
 if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')throw new EbookError(415,'Gunakan JSON.');
 const bytes=await readEbookBody(request,65536);let input:unknown;
 try{input=JSON.parse(new TextDecoder().decode(bytes));}catch{throw new EbookError(400,'JSON tidak valid.');}
 return executeEbookAdmin(client,input);
});}
