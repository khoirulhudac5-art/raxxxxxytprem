export const EVENT_TYPES = ['page_view','catalog_click','product_click','purchase_whatsapp_click'] as const;
export type AnalyticsEvent = {
 id:string;
 type:typeof EVENT_TYPES[number]; catalog:'apps'|'ebooks'; productId?:string;
 page:'apps_catalog'|'ebooks_catalog'|'app_detail'|'ebook_detail';
};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateEvent(value:unknown):AnalyticsEvent|null {
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const v=value as Record<string,unknown>;
 if(Object.keys(v).some(k=>!['id','type','catalog','productId','page'].includes(k)))return null;
 if(typeof v.id!=='string'||!uuid.test(v.id))return null;
 if(!EVENT_TYPES.includes(v.type as AnalyticsEvent['type'])||!['apps','ebooks'].includes(String(v.catalog)))return null;
 if(!['apps_catalog','ebooks_catalog','app_detail','ebook_detail'].includes(String(v.page)))return null;
 const sourceCatalog=String(v.page).startsWith('app')?'apps':'ebooks';
 if(v.type!=='catalog_click'&&v.catalog!==sourceCatalog)return null;
 const productEvent=v.type==='product_click'||v.type==='purchase_whatsapp_click';
 if(productEvent?(typeof v.productId!=='string'||!v.productId.trim()||v.productId.length>160):v.productId!==undefined)return null;
 if(v.type==='purchase_whatsapp_click'&&!String(v.page).endsWith('_detail'))return null;
 if(v.type==='product_click'&&!String(v.page).endsWith('_catalog'))return null;
 return v as AnalyticsEvent;
}
export function publicPage(path:string):AnalyticsEvent['page']|null {
 if(path==='/')return 'apps_catalog';
 if(path==='/ebook')return 'ebooks_catalog';
 if(/^\/produk\/[a-z0-9-]+$/.test(path))return 'app_detail';
 if(/^\/ebook\/[a-z0-9-]+$/.test(path))return 'ebook_detail';
 return null;
}
