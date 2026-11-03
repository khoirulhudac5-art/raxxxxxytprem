import {redirect} from 'next/navigation';
import {headers} from 'next/headers';
import {Header} from '@/components/header';
import {AdminAccessMessage} from '@/components/admin-access-message';
import {AnalyticsDashboard} from '@/components/analytics-dashboard';
import {createClient} from '@/lib/supabase/server';
import {checkAdminAccess} from '@/lib/supabase/admin-access';
import {analyticsOrigin} from '@/lib/analytics/server';
import {localTestDashboardEnabled} from '@/lib/analytics/local-dashboard';
import {validReport} from '@/lib/analytics/report';
import './analytics.css';
export const dynamic='force-dynamic';
export const metadata={title:'Analytics Admin | Rakyat Premium',robots:{index:false,follow:false}};
export default async function AnalyticsPage({searchParams}:{searchParams:Promise<{days?:string}>}){
 const client=await createClient();const access=await checkAdminAccess(async()=>client);
 if(access==='unauthenticated')redirect('/admin/login');
 if(access!=='admin')return <AdminAccessMessage unavailable={access==='unavailable'}/>;
 const params=await searchParams,days=params.days==='1'?1:params.days==='30'?30:7;
 const testMode=localTestDashboardEnabled((await headers()).get('host'));
 if(!analyticsOrigin()&&!testMode)return <><Header admin/><AnalyticsDashboard days={days} state="disabled"/></>;
 try{
  const {data,error}=await client.rpc('analytics_summary_v1',{p_days:days});
  if(error||!validReport(data))throw new Error('Invalid report');
  return <><Header admin/><AnalyticsDashboard days={days} state="ready" report={data} testMode={testMode}/></>;
 }catch{return <><Header admin/><AnalyticsDashboard days={days} state="error" testMode={testMode}/></>;}
}
