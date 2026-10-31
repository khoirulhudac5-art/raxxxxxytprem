'use client';
import { useEffect, useState } from 'react';
import { defaultWhatsAppSettings, validWhatsAppSettings, WHATSAPP_STORAGE_KEY, WhatsAppSettings } from './whatsapp';

const CHANGE_EVENT = 'rakyat-whatsapp-settings-changed';
export function useWhatsAppSettings() {
 const [settings,setSettings] = useState(defaultWhatsAppSettings);
 const [ready,setReady] = useState(false);
 const [error,setError] = useState('');
 useEffect(()=>{
  function read() {
   try {
    const raw = localStorage.getItem(WHATSAPP_STORAGE_KEY);
    const value: unknown = raw === null ? null : JSON.parse(raw);
    if (raw !== null && !validWhatsAppSettings(value)) throw Error();
    setSettings(value === null ? defaultWhatsAppSettings : value as WhatsAppSettings);
    setError('');
   } catch {
    setSettings(defaultWhatsAppSettings);
    setError('Pengaturan WhatsApp tidak dapat dibaca. Simpan ulang pengaturan di Admin.');
   }
   setReady(true);
  }
  read();
  const onStorage = (event: StorageEvent) => { if (event.key === null || event.key === WHATSAPP_STORAGE_KEY) read(); };
  window.addEventListener('storage',onStorage);
  window.addEventListener(CHANGE_EVENT,read);
  return ()=>{ window.removeEventListener('storage',onStorage); window.removeEventListener(CHANGE_EVENT,read); };
 },[]);
 function save(next: WhatsAppSettings) {
  if (!validWhatsAppSettings(next)) { setError('Isi nomor internasional yang valid dan template pesan.'); return false; }
  try {
   localStorage.setItem(WHATSAPP_STORAGE_KEY,JSON.stringify(next));
   setSettings(next);
   setError('');
   window.dispatchEvent(new Event(CHANGE_EVENT));
   return true;
  } catch { setError('Pengaturan gagal disimpan. Pastikan penyimpanan browser diizinkan dan ruang masih tersedia.'); return false; }
 }
 return {settings,ready,error,save};
}
