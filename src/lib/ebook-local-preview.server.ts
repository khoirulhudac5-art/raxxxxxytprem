import 'server-only';
import type {PublicEbook,PublicCategory} from './ebook-public';
export const LOCAL_EBOOK_PREVIEW='local-ebooks';
export function localEbookPreviewAllowed(environment:string|undefined,host:string|null,mode:unknown){
 return environment==='development'&&mode===LOCAL_EBOOK_PREVIEW&&!!host&&/^(localhost|127\.0\.0\.1|\[::1\])(:[0-9]+)?$/i.test(host);
}
const assets=new Set(['canva.svg','ai.svg','marketing.svg','design.svg','banner.svg']);
export async function readLocalEbookAsset(asset:string){
 if(process.env.NODE_ENV!=='development'||!assets.has(asset))return null;
 const {readFile}=await import('node:fs/promises');
 return readFile(process.cwd()+'/.tools/ebook-local-preview/'+asset,'utf8');
}
export async function readLocalEbookPreview(mode:unknown,host:string|null){
 // Literal environment branch is eliminated in production; fixtures are outside public/src.
 if(process.env.NODE_ENV!=='development')return null;
 if(!localEbookPreviewAllowed(process.env.NODE_ENV,host,mode))return null;
 const {readFile}=await import('node:fs/promises');
 const input=JSON.parse(await readFile(process.cwd()+'/.tools/ebook-local-preview/catalog.json','utf8'));
 if(input.version!==1||!Array.isArray(input.books)||input.books.length!==4)throw Error('Fixture preview lokal belum tersedia.');
 const suffix='?preview='+LOCAL_EBOOK_PREVIEW;
 const categories:PublicCategory[]=input.categories.map((c:PublicCategory)=>({id:c.id,name:c.name}));
 const books:PublicEbook[]=input.books.map((b:PublicEbook&{asset:string})=>{
  if(!assets.has(b.asset)||b.asset==='banner.svg')throw Error('Cover preview tidak valid.');
  return {id:b.id,slug:b.slug,title:b.title,description:b.description,categoryId:b.categoryId,category:b.category,isFree:b.isFree,price:b.price,coverUrl:'/ebook/preview-assets/'+b.asset+suffix};
 });
 return {books,categories,banner:{url:'/ebook/preview-assets/banner.svg'+suffix,alt:'Banner contoh katalog e-book — preview lokal'},suffix};
}
