export type AnalyticsReport={
 days:1|7|30;timezone:string;from:string;through:string;retentionDays:number;
 totals:{visits:number;visitors:number;views:number;products:number;whatsapp:number;apps:number;ebooks:number};
 daily:{day:string;visits:number;visitors:number;views:number}[];
 top:{catalog:'apps'|'ebooks';product_id:string;name:string;clicks:number}[];
};
export function validReport(value:unknown):value is AnalyticsReport {
 if(!value||typeof value!=='object')return false;
 const r=value as AnalyticsReport;
 const count=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
 const date=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v);
 return [1,7,30].includes(r.days)&&r.timezone==='Asia/Jakarta'&&date(r.from)&&date(r.through)&&r.retentionDays===90&&
  !!r.totals&&['visits','visitors','views','products','whatsapp','apps','ebooks'].every(k=>count(r.totals[k as keyof typeof r.totals]))&&
  Array.isArray(r.daily)&&r.daily.length===r.days&&r.daily.every(d=>d&&date(d.day)&&[d.visits,d.visitors,d.views].every(count))&&
  Array.isArray(r.top)&&r.top.length<=10&&r.top.every(p=>p&&['apps','ebooks'].includes(p.catalog)&&typeof p.product_id==='string'&&typeof p.name==='string'&&count(p.clicks));
}
