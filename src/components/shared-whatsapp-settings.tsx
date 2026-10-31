'use client';
import { useStoreSettings } from '@/lib/supabase/use-store-settings';
export function SharedWhatsAppSettings(){
 const {settings,ready,error}=useStoreSettings();
 return <section className="whatsapp-settings"><h2>Pengaturan WhatsApp</h2>
  <p>Nomor dan template menggunakan pengaturan Supabase yang sudah ada.</p>
  {error ? <p role="alert">{error}</p> : ready ? <><p>Nomor: {settings.number}</p><pre style={{whiteSpace:'pre-wrap'}}>{settings.template}</pre><p>Pengeditan pengaturan database belum diaktifkan.</p></> : <p>Memuat pengaturan…</p>}
 </section>;
}
