import { storeConfig } from './config';
import { Product, rupiah } from './products';

export type WhatsAppSettings = { number: string; template: string };
export const WHATSAPP_STORAGE_KEY = 'rakyat-premium-whatsapp-v1';
export const defaultWhatsAppSettings: WhatsAppSettings = {
 number: storeConfig.whatsappNumber,
 template: 'Halo Rakyat Premium! Saya ingin pesan:\nProduk: {produk}\nDurasi: {durasi}\nHarga contoh: {harga}\nMohon konfirmasi harga, ketersediaan, dan detail paket. Terima kasih.',
};
export const validWhatsAppNumber = (number: string) => /^[1-9]\d{7,14}$/.test(number);
export function validWhatsAppSettings(value: unknown): value is WhatsAppSettings {
 if (!value || typeof value !== 'object') return false;
 const settings = value as Partial<WhatsAppSettings>;
 return typeof settings.number === 'string' && validWhatsAppNumber(settings.number) &&
  typeof settings.template === 'string' && !!settings.template.trim() && settings.template.length <= 4000;
}
export function whatsAppLink(settings: WhatsAppSettings, product: Product, plan: Product['plans'][number]): string {
 if (!plan || (plan.available!==undefined&&plan.available!==true) || !validWhatsAppSettings(settings)) return '';
 const variables = {produk:product.name, durasi:plan.duration, harga:rupiah(plan.price)};
 const message = settings.template.replace(/\{(produk|durasi|harga)\}/g, (_, key: keyof typeof variables) => variables[key]);
 return `https://wa.me/${settings.number}?text=${encodeURIComponent(message)}`;
}
