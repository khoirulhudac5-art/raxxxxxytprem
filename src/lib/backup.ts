import { STORAGE_KEY, validProducts } from './products';
import { WHATSAPP_STORAGE_KEY, validWhatsAppSettings } from './whatsapp';

function readJson(storage: Pick<Storage, 'getItem'>, key: string, label: string): unknown {
 let raw: string | null;
 try { raw = storage.getItem(key); }
 catch { throw new Error('localStorage tidak dapat diakses. Izinkan penyimpanan browser lalu coba lagi.'); }
 if (raw === null) throw new Error(`${label} belum tersimpan di browser ini. Simpan data melalui Admin sebelum ekspor. Backup tidak menggunakan data contoh.`);
 try { return JSON.parse(raw); }
 catch { throw new Error(`${label} berisi JSON yang rusak. Backup dibatalkan tanpa mengubah data.`); }
}

export function createBackup(storage: Pick<Storage, 'getItem'>, now = new Date()) {
 const products = readJson(storage, STORAGE_KEY, 'Data produk');
 let productsValid = false;
 try {
  productsValid = validProducts(products) && products.length > 0 && products.every(product =>
   [product.id, product.name, product.category, product.description].every(value => !!value.trim()) &&
   product.plans.every(plan => Number.isSafeInteger(plan.price)));
 } catch { /* Malformed nested data must not produce a partial backup. */ }
 if (!productsValid || !validProducts(products)) throw new Error('Data produk kosong atau strukturnya tidak valid. Backup dibatalkan tanpa mengubah data.');
 const whatsapp = readJson(storage, WHATSAPP_STORAGE_KEY, 'Pengaturan WhatsApp');
 if (!validWhatsAppSettings(whatsapp)) throw new Error('Pengaturan WhatsApp tidak valid. Periksa nomor dan template di Admin sebelum ekspor.');

 const backup = {
  app: 'rakyat-premium',
  version: 1,
  exportedAt: now.toISOString(),
  source: 'localStorage',
  products: products.map(product => ({...product, imageUrl: product.imageUrl ?? ''})),
  whatsapp,
 };
 const json = JSON.stringify(backup, null, 2);
 const restored: typeof backup = JSON.parse(json);
 if (!validProducts(restored.products) || !restored.products.length || !validWhatsAppSettings(restored.whatsapp)) {
  throw new Error('Verifikasi file backup gagal. Tidak ada data yang diubah.');
 }
 return {json, filename: `rakyat-premium-backup-${now.toISOString().replace(/[:.]/g, '-')}.json`, count: products.length};
}
