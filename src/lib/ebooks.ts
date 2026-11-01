export type EbookCategory={id:string;slug:string;name:string;is_active:boolean;sort_order:number;revision:number};
export type Ebook={id:string;slug:string;title:string;description:string;category_id:string;cover_path:string|null;is_free:boolean;price:number;free_download_url:string|null;is_published:boolean;sort_order:number;revision:number};
export type EbookSettings={id:'main';banner_path:string|null;banner_alt:string;banner_enabled:boolean;revision:number};
export type EbookAdminData={ebooks:Ebook[];categories:EbookCategory[];settings:EbookSettings};
export const EBOOK_BUCKET='ebook-images';
export const EBOOK_IMAGE_LIMIT=5*1024*1024;
export const ebookSlug=(name:string)=>name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export const validEbookPath=(path:string,kind:'covers'|'banners')=>new RegExp('^'+kind+'/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\\.(png|jpg|jpeg|webp)$').test(path);
export function validFreeDownload(value:string){
 if(value.length>2048||!/\S/.test(value)||/[\s\x00-\x1f\x7f]/.test(value))return false;
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!!u.hostname&&/^https:\/\/[A-Za-z0-9][A-Za-z0-9.-]*(:[0-9]{1,5})?([/?#][^\s\x00-\x1f\x7f]*)?$/.test(value);}catch{return false;}
}
