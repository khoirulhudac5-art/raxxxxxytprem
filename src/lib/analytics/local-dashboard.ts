import 'server-only';
// Read-only dashboard preview, completely separate from public event collection.
export function localTestDashboardEnabled(host:string|null){
 if(process.env.NODE_ENV!=='development'||process.env.ANALYTICS_TEST_DASHBOARD_ENABLED!=='true')return false;
 if(process.env.NEXT_PUBLIC_SUPABASE_URL!=='https://kzsoobgkqftzheqjtwxs.supabase.co')return false;
 try{
  const url=new URL('http://'+(host||''));
  return !url.username&&!url.password&&url.pathname==='/'&&
   ['localhost','127.0.0.1','[::1]'].includes(url.hostname);
 }catch{return false;}
}
