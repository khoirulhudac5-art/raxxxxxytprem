// Read-only validation: node scripts/validate-backup.cjs <backup.json>
const fs = require('node:fs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

try {
 const path = process.argv[2];
 assert.ok(path, 'Berikan path file backup JSON.');
 const raw = fs.readFileSync(path);
 const backup = JSON.parse(raw.toString('utf8').replace(/^\uFEFF/, ''));
 assert.equal(backup.app, 'rakyat-premium', 'Identitas aplikasi tidak sesuai.');
 assert.equal(backup.version, 1, 'Versi backup tidak didukung.');
 assert.equal(backup.source, 'localStorage', 'Sumber backup tidak sesuai.');
 assert.ok(typeof backup.exportedAt === 'string' && Number.isFinite(Date.parse(backup.exportedAt)), 'Tanggal ekspor tidak valid.');
 assert.ok(Array.isArray(backup.products) && backup.products.length === 7, 'Migrasi ini mengharapkan tepat 7 produk.');
 const ids = new Set();
 let plans = 0;
 let images = 0;
 for (const product of backup.products) {
  assert.ok(product && typeof product === 'object', 'Produk tidak valid.');
  for (const key of ['id','name','description','category','icon','color','badge','imageUrl']) {
   assert.equal(typeof product[key], 'string', `Kolom produk ${key} harus teks.`);
  }
  for (const key of ['id','name','description','category','icon','color']) {
   assert.ok(product[key].trim(), `Kolom produk ${key} kosong.`);
  }
  assert.ok(!ids.has(product.id), 'ID produk duplikat.');
  ids.add(product.id);
  if (product.imageUrl) {
   const url = new URL(product.imageUrl);
   assert.ok(['http:', 'https:'].includes(url.protocol) && /\.(png|jpe?g|webp)$/i.test(url.pathname), 'URL gambar tidak valid.');
   images++;
  }
  assert.ok(Array.isArray(product.plans) && product.plans.length, 'Pilihan paket kosong.');
  for (const plan of product.plans) {
   assert.ok(plan && typeof plan.duration === 'string' && plan.duration.trim(), 'Durasi tidak valid.');
   assert.ok(Number.isSafeInteger(plan.price) && plan.price >= 0, 'Harga tidak valid.');
   plans++;
  }
 }
 assert.ok(backup.whatsapp && typeof backup.whatsapp.number === 'string' && /^[1-9]\d{7,14}$/.test(backup.whatsapp.number), 'Nomor WhatsApp tidak valid.');
 assert.ok(typeof backup.whatsapp.template === 'string' && backup.whatsapp.template.trim() && backup.whatsapp.template.length <= 4000, 'Template WhatsApp tidak valid.');
 for (const variable of ['produk','durasi','harga']) {
  assert.ok(backup.whatsapp.template.includes(`{${variable}}`), `Variabel ${variable} tidak ditemukan.`);
 }
 assert.deepEqual(JSON.parse(JSON.stringify(backup)), backup, 'JSON tidak dapat dipulihkan secara identik.');
 console.log(JSON.stringify({valid:true, products:backup.products.length, ids:[...ids], plans, images, whatsappValid:true, exportedAt:backup.exportedAt, sha256:crypto.createHash('sha256').update(raw).digest('hex')}, null, 2));
} catch (error) {
 console.error(`Validasi gagal: ${error.message}`);
 process.exitCode = 1;
}
