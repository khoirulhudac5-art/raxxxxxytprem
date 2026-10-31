export const categories = ['AI Tools', 'Desain & Video', 'Streaming', 'Produktivitas'] as const;
export type Product = { id: string; name: string; description: string; category: string; icon: string; color: string; badge: string; imageUrl?: string; plans: { duration: string; price: number }[] };
export function validImageUrl(value: string): boolean {
 try {
  const url = new URL(value);
  return ['http:', 'https:'].includes(url.protocol) && /\.(png|jpe?g|webp)$/i.test(url.pathname);
 } catch { return false; }
}
export const initialProducts: Product[] = [
 { id:'chatgpt', name:'ChatGPT Plus', description:'Teman berpikir untuk ide, menulis, dan pekerjaan sehari-hari.', category:'AI Tools', icon:'spark', color:'green', badge:'Favorit', plans:[{duration:'1 bulan',price:45000},{duration:'3 bulan',price:120000}] },
 { id:'capcut', name:'CapCut Pro', description:'Wujudkan video kreatif dengan proses editing yang lebih praktis.', category:'Desain & Video', icon:'video', color:'white', badge:'Populer', plans:[{duration:'1 bulan',price:25000},{duration:'3 bulan',price:65000}] },
 { id:'canva', name:'Canva Pro', description:'Dari presentasi sampai konten sosial, buat desain lebih mudah.', category:'Desain & Video', icon:'design', color:'cyan', badge:'', plans:[{duration:'1 bulan',price:15000},{duration:'1 tahun',price:100000}] },
 { id:'google', name:'Google AI Pro', description:'Jelajahi ide dan bantu produktivitas dengan kecerdasan AI.', category:'AI Tools', icon:'gem', color:'blue', badge:'', plans:[{duration:'1 bulan',price:35000},{duration:'3 bulan',price:90000}] },
 { id:'youtube', name:'YouTube Premium', description:'Nikmati waktu menonton dan dengarkan konten favoritmu.', category:'Streaming', icon:'play', color:'red', badge:'', plans:[{duration:'1 bulan',price:20000},{duration:'3 bulan',price:55000}] },
 { id:'spotify', name:'Spotify Premium', description:'Temani setiap aktivitas dengan musik dan podcast pilihan.', category:'Streaming', icon:'music', color:'lime', badge:'', plans:[{duration:'1 bulan',price:20000},{duration:'3 bulan',price:50000}] },
 { id:'zoom', name:'Zoom Pro', description:'Tetap terhubung untuk meeting, kelas, dan kolaborasi online.', category:'Produktivitas', icon:'camera', color:'blue', badge:'', plans:[{duration:'1 bulan',price:30000},{duration:'3 bulan',price:80000}] },
];
export const rupiah = (value: number) => new Intl.NumberFormat('id-ID', {style:'currency',currency:'IDR',maximumFractionDigits:0}).format(value);
export const STORAGE_KEY = 'rakyat-premium-products-v1';
export function validProducts(value: unknown): value is Product[] {
 return Array.isArray(value) && value.every(p => p && (p.imageUrl === undefined || typeof p.imageUrl === 'string') && ['id','name','description','category','icon','color','badge'].every(k => typeof p[k] === 'string') && p.plans?.length > 0 && Array.isArray(p.plans) && p.plans.every((q: {duration:unknown;price:unknown}) => typeof q.duration === 'string' && q.duration.trim() && typeof q.price === 'number' && Number.isFinite(q.price) && q.price >= 0)) && new Set(value.map(p=>p.id)).size === value.length;
}
