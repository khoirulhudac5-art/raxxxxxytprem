import { redirect } from 'next/navigation';
import { Header } from '@/components/header';
import { AdminAccessMessage } from '@/components/admin-access-message';
import { createClient } from '@/lib/supabase/server';
import { checkAdminAccess } from '@/lib/supabase/admin-access';
export const dynamic = 'force-dynamic';
const errors:Record<string,string>={invalid:'Email atau password tidak valid.',unavailable:'Login belum dapat diproses. Periksa koneksi dan coba lagi.'};
export default async function AdminLogin({searchParams}:{searchParams:Promise<{error?:string}>}) {
 const access=await checkAdminAccess(()=>createClient());
 if(access==='admin') redirect('/admin');
 if(access==='denied') return <AdminAccessMessage/>;
 const params=await searchParams;
 return <><Header admin/><main className="container admin-main"><section className="whatsapp-settings admin-login" aria-labelledby="login-title">
  <span className="eyebrow">WORKSPACE</span><h1 id="login-title">Login Admin</h1><p>Masuk menggunakan akun Admin yang sudah terdaftar.</p>
  {params.error && errors[params.error] && <p className="notice" role="alert">{errors[params.error]}</p>}
  {access==='unavailable' && <p className="notice" role="alert">Pemeriksaan sesi belum tersedia. Periksa konfigurasi dan koneksi Supabase.</p>}
  <form action="/admin/login/submit" method="post">
   <label>Email<input name="email" type="email" autoComplete="username" required maxLength={254}/></label>
   <label>Password<input name="password" type="password" autoComplete="current-password" required maxLength={4096}/></label>
   <div className="modal-actions"><a className="secondary-button" href="/">Kembali ke katalog</a><button className="primary-button" type="submit">Masuk</button></div>
  </form></section></main></>;
}
