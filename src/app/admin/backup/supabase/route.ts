import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkAdminAccess } from '@/lib/supabase/admin-access';
import { exportSupabaseBackup } from '@/lib/supabase/backup';

export const dynamic='force-dynamic';
export async function GET() {
 const cookieResponse=new NextResponse();
 const reply=(body:string,status:number,headers:Record<string,string>={})=>{
  const response=new NextResponse(body,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',...headers}});
  for(const cookie of cookieResponse.cookies.getAll()) response.cookies.set(cookie);
  return response;
 };
 try {
  const client=await createClient(cookieResponse);
  const access=await checkAdminAccess(async()=>client);
  if(access!=='admin') return reply(access==='unauthenticated'?'Login Admin diperlukan.':access==='denied'?'Akses ditolak.':'Akses Admin belum dapat diverifikasi.',access==='unauthenticated'?401:access==='denied'?403:503);
  const result=await exportSupabaseBackup(client);
  return reply(result.json,200,{'Content-Type':'application/json; charset=utf-8','Content-Disposition':`attachment; filename="${result.filename}"`});
 } catch {
  return reply('Ekspor dibatalkan: data kosong, tidak valid, berubah, atau gagal dibaca. Tidak ada file backup parsial yang diunduh. Coba lagi.',503);
 }
}
