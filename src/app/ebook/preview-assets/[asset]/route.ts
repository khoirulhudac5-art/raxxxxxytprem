import {NextRequest} from 'next/server';
import {localEbookPreviewAllowed,readLocalEbookAsset} from '@/lib/ebook-local-preview.server';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest,{params}:{params:Promise<{asset:string}>}){
 if(process.env.NODE_ENV!=='development')return new Response(null,{status:404});
 if(!localEbookPreviewAllowed(process.env.NODE_ENV,request.headers.get('host'),request.nextUrl.searchParams.get('preview')))return new Response(null,{status:404});
 const {asset}=await params;
 try{const body=await readLocalEbookAsset(asset);return body===null?new Response(null,{status:404}):new Response(body,{headers:{'Content-Type':'image/svg+xml; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; sandbox"}});}catch{return new Response(null,{status:404});}
}
