import { productCrudEnabled } from '@/lib/supabase/crud-flag';
import { redirect } from 'next/navigation';
import AdminWorkspace from '@/components/admin-workspace';
import { AdminAccessMessage } from '@/components/admin-access-message';
import { createClient } from '@/lib/supabase/server';
import { checkAdminAccess } from '@/lib/supabase/admin-access';
export const dynamic = 'force-dynamic';
export default async function AdminPage({searchParams}:{searchParams:Promise<{logout?:string;source?:string}>}) {
 const access=await checkAdminAccess(()=>createClient());
 if(access==='unauthenticated') redirect('/admin/login');
 if(access!=='admin') return <AdminAccessMessage unavailable={access==='unavailable'}/>;
 const params=await searchParams;
 const crud=productCrudEnabled();
 return <>{params.logout==='failed' && <p className="notice" role="alert">Logout gagal. Coba lagi; sesi belum dinyatakan berakhir.</p>}<AdminWorkspace key={crud?'supabase-crud':'supabase-readonly'} supabaseCrud={crud} supabasePreview={!crud}/></>;
}
