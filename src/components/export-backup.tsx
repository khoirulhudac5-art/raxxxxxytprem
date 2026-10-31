'use client';
import { useState } from 'react';
import { Download } from 'lucide-react';
import { createBackup } from '@/lib/backup';

export function ExportBackup() {
 const [status,setStatus] = useState('');
 const [error,setError] = useState('');
 function download() {
  setStatus('');
  setError('');
  try {
   // Read the browser's current storage at click time, never the sample/state fallback.
   const backup = createBackup(window.localStorage);
   const blob = new Blob([backup.json], {type:'application/json;charset=utf-8'});
   if (!blob.size) throw new Error('File backup kosong. Unduhan dibatalkan.');
   const url = URL.createObjectURL(blob);
   const link = document.createElement('a');
   try {
    link.href = url;
    link.download = backup.filename;
    document.body.appendChild(link);
    link.click();
   } finally {
    link.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url), 1000);
   }
   setStatus(`Unduhan backup ${backup.count} produk beserta pengaturan WhatsApp telah dimulai. Data tersimpan tidak diubah.`);
  } catch (cause) {
   setError(cause instanceof Error ? cause.message : 'Backup gagal dibuat. Tidak ada data yang diubah.');
  }
 }
 return <div>
  <button type="button" className="secondary-button" onClick={download}><Download size={16}/> Export Backup JSON</button>
  <p className="status" role="status">{status}</p>
  {error && <p className="notice" role="alert">{error}</p>}
 </div>;
}
