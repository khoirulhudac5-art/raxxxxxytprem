import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {checkAdminAccess} from '@/lib/supabase/admin-access';
import {AdminAccessMessage} from '@/components/admin-access-message';
import {EbookManager} from '@/components/ebook-manager';
export const dynamic='force-dynamic';
export default async function Page(){
 const access=await checkAdminAccess(()=>createClient());
 if(access==='unauthenticated')redirect('/admin/login');
 if(access!=='admin')return <AdminAccessMessage unavailable={access==='unavailable'}/>;
 return <EbookManager/>;
}
