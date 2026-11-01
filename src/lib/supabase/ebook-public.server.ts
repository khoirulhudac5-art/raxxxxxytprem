import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {getSupabaseEnvironment} from './env';
import {EBOOK_BUCKET,validEbookPath,validFreeDownload} from '../ebooks';
import type {PublicEbook,PublicCategory,PublicBanner,EbookDetailData} from '../ebook-public';
// Explicit projection NEVER reads a download URL into catalog data or paid detail data.
export const PUBLIC_EBOOK_COLUMNS='id,slug,title,description,category_id,cover_path,is_free,price,is_published';
function publicClient(){
 const {url,publishableKey}=getSupabaseEnvironment();
 // No request cookies/Admin session: RLS always runs as anon, including Admin previews.
 return createClient(url,publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(url,options)=>fetch(url,{...options,cache:'no-store'})}});
}
type Client=ReturnType<typeof publicClient>;
const failure=()=>new Error('Katalog e-book belum dapat dimuat.');
async function categories(client:Client):Promise<PublicCategory[]>{
 const r=await client.from('ebook_categories').select('id,name,is_active').eq('is_active',true).order('sort_order').order('id');
 if(r.error||!Array.isArray(r.data))throw failure();
 return r.data.filter(c=>c.is_active===true).map(c=>{if(typeof c.id!=='string'||typeof c.name!=='string')throw failure();return {id:c.id,name:c.name};});
}
function mapBook(row:Record<string,unknown>,cats:PublicCategory[],client:Client):PublicEbook|null{
 const category=cats.find(c=>c.id===row.category_id);
 if(row.is_published!==true||!category)return null;
 if(typeof row.id!=='string'||typeof row.slug!=='string'||!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(row.slug)||typeof row.title!=='string'||typeof row.description!=='string'||typeof row.is_free!=='boolean'||typeof row.price!=='number'||!Number.isSafeInteger(row.price)||(row.is_free?row.price!==0:row.price<=0))throw failure();
 const coverUrl=typeof row.cover_path==='string'&&validEbookPath(row.cover_path,'covers')?client.storage.from(EBOOK_BUCKET).getPublicUrl(row.cover_path).data.publicUrl:null;
 return {id:row.id,slug:row.slug,title:row.title,description:row.description,categoryId:category.id,category:category.name,coverUrl,isFree:row.is_free,price:row.price};
}
async function banner(client:Client):Promise<PublicBanner>{
 const r=await client.from('ebook_settings').select('banner_path,banner_alt,banner_enabled').eq('id','main').eq('banner_enabled',true).maybeSingle();
 if(r.error)throw failure();const b=r.data;
 if(!b||b.banner_enabled!==true||typeof b.banner_path!=='string'||!validEbookPath(b.banner_path,'banners'))return null;
 return {url:client.storage.from(EBOOK_BUCKET).getPublicUrl(b.banner_path).data.publicUrl,alt:b.banner_alt||'Pilihan e-book Rakyat Premium'};
}
export async function readPublicEbooks(client:Client=publicClient()){
 const [cats,hero]=await Promise.all([categories(client),banner(client)]);
 const books:PublicEbook[]=[];
 if(cats.length){
  // Supabase limits result sizes; deterministic pages avoid silently losing later books.
  for(let offset=0;;offset+=200){
   const r=await client.from('ebooks').select(PUBLIC_EBOOK_COLUMNS).eq('is_published',true).in('category_id',cats.map(c=>c.id)).order('sort_order').order('id').range(offset,offset+199);
   if(r.error||!Array.isArray(r.data))throw failure();
   for(const row of r.data){const book=mapBook(row,cats,client);if(book)books.push(book);}
   if(r.data.length<200)break;
   if(offset>=19800)throw failure();
  }
 }
 return {books,categories:cats,banner:hero};
}
export async function readPublicEbook(slug:string,client:Client=publicClient()):Promise<EbookDetailData|null>{
 if(!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)||slug.length>160)return null;
 const cats=await categories(client);if(!cats.length)return null;
 const r=await client.from('ebooks').select(PUBLIC_EBOOK_COLUMNS).eq('slug',slug).eq('is_published',true).in('category_id',cats.map(c=>c.id)).maybeSingle();
 if(r.error)throw failure();if(!r.data)return null;
 const book=mapBook(r.data,cats,client);if(!book)return null;
 let downloadUrl:string|null=null;
 if(book.isFree){
  // This request cannot select a paid URL, even if its type changes concurrently.
  const download=await client.from('ebooks').select('free_download_url').eq('id',book.id).eq('is_free',true).eq('is_published',true).in('category_id',cats.map(c=>c.id)).maybeSingle();
  if(download.error)throw failure();
  const url=download.data?.free_download_url;
  if(typeof url==='string'&&validFreeDownload(url))downloadUrl=url;
 }
 return {book,downloadUrl};
}
