'use client';
import { useState } from 'react';
import { Save } from 'lucide-react';
import { useWhatsAppSettings } from '@/lib/use-whatsapp-settings';
import { WhatsAppSettings, validWhatsAppSettings } from '@/lib/whatsapp';

function SettingsForm({settings,save}:{settings:WhatsAppSettings;save:(value:WhatsAppSettings)=>boolean}) {
 const [draft,setDraft] = useState(settings);
 const [status,setStatus] = useState('');
 return <form onSubmit={e=>{
  e.preventDefault();
  const next = {number:draft.number.trim(),template:draft.template};
  if (!validWhatsAppSettings(next)) { setStatus('Isi nomor internasional 8–15 digit tanpa +, spasi, atau 0 di depan, serta template pesan yang tidak kosong.'); return; }
  if (save(next)) setStatus('Pengaturan WhatsApp berhasil disimpan di browser ini.');
  else setStatus('');
 }}>
  <label>Nomor WhatsApp tujuan<input type="tel" inputMode="numeric" required pattern="[1-9][0-9]{7,14}" maxLength={15} placeholder="628xxxxxxxxxx" aria-describedby="whatsapp-number-help" value={draft.number} onChange={e=>{setDraft({...draft,number:e.target.value});setStatus('');}}/></label>
  <p id="whatsapp-number-help">Format internasional: 8–15 digit, tanpa tanda +, spasi, atau 0 di depan. Contoh: 6281234567890.</p>
  <label>Template pesan otomatis<textarea required maxLength={4000} rows={6} aria-describedby="whatsapp-template-help" value={draft.template} onChange={e=>{setDraft({...draft,template:e.target.value});setStatus('');}}/></label>
  <p id="whatsapp-template-help">Variabel otomatis: {'{produk}'} = nama produk, {'{durasi}'} = durasi pilihan, {'{harga}'} = harga pilihan dalam rupiah.</p>
  <button type="submit" className="primary-button"><Save size={16}/> Simpan Pengaturan</button>
  <p role="status" className="status">{status}</p>
 </form>;
}

export function WhatsAppSettingsPanel() {
 const {settings,ready,error,save} = useWhatsAppSettings();
 return <section className="whatsapp-settings" aria-labelledby="whatsapp-settings-title">
  <h2 id="whatsapp-settings-title">Pengaturan WhatsApp</h2>
  <p>Pengaturan disimpan menggunakan localStorage pada browser ini dan belum tersinkronisasi antarperangkat. Pengaturan dapat hilang jika data browser dihapus.</p>
  {error && <p role="alert" className="notice">{error}</p>}
  {ready ? <SettingsForm settings={settings} save={save}/> : <p>Memuat pengaturan…</p>}
 </section>;
}
