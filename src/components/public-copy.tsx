'use client';
import {useSyncExternalStore,type ReactNode,type ComponentProps} from 'react';
export const PUBLIC_LANGUAGE_KEY='rakyat-premium-public-language-v1';
export const publicDictionary:Record<string,string>={
  "Aplikasi": "Apps",
  "Testimoni Pembeli": "Customer Reviews",
  "Hubungi kami melalui WhatsApp": "Contact us on WhatsApp",
  "Ganti tema terang atau gelap": "Switch light or dark theme",
  "Testimoni Pembeli di Telegram (tab baru)": "Customer reviews on Telegram (new tab)",
  "Cari aplikasi premium...": "Search premium apps...",
  "Cari e-book...": "Search e-books...",
  "Hapus pencarian": "Clear search",
  "Semua produk": "All products",
  "Kategori": "Category",
  "Semua kategori": "All categories",
  "Semua": "All",
  "Gratis": "Free",
  "Berbayar": "Paid",
  "GRATIS": "FREE",
  "BERBAYAR": "PAID",
  "Reset filter": "Reset filters",
  "Coba lagi": "Try again",
  "Lihat semua produk": "View all products",
  "Lihat pilihan produk": "Browse products",
  "Langsung ke katalog": "Skip to catalog",
  "Katalog produk": "Product catalog",
  "Informasi layanan": "Service information",
  "Katalog digital independen.": "Independent digital catalog.",
  "Katalog belum dapat dimuat.": "The catalog could not be loaded.",
  "Periksa koneksi dan coba kembali.": "Check your connection and try again.",
  "Belum menemukan yang kamu cari?": "Cannot find what you need?",
  "Katalog sedang disiapkan.": "The catalog is being prepared.",
  "Coba kata kunci lain atau lihat semua kategori.": "Try another keyword or browse all categories.",
  "Silakan kembali beberapa saat lagi.": "Please check back shortly.",
  "Menyiapkan pilihan premium untukmu…": "Preparing premium choices for you…",
  "{count} produk ditemukan": "{count} products found",
  "{count} e-book ditemukan": "{count} e-books found",
  "Pemesanan WhatsApp sementara belum tersedia. Silakan muat ulang halaman.": "WhatsApp ordering is temporarily unavailable. Please reload.",
  "Konfirmasi ketersediaan, detail layanan, dan ketentuan paket melalui WhatsApp sebelum melakukan pembayaran.": "Confirm availability, service details and package terms via WhatsApp before payment.",
  "Satu katalog, beragam kebutuhan": "One catalog, many possibilities",
  "Detail paket yang transparan": "Transparent package details",
  "Komunikasi langsung via WhatsApp": "Direct communication via WhatsApp",
  "KECIL LANGKAHNYA. BESAR BEDANYA.": "SMALL STEPS. BIG DIFFERENCE.",
  "Lebih nyaman dari awal.": "A better experience from the start.",
  "Pilih sesuai kebutuhan": "Choose what suits you",
  "Bandingkan durasi dan harga paket dalam satu tampilan yang sederhana.": "Compare package durations and prices in one simple view.",
  "Terhubung secara personal": "Connect personally",
  "Pesan langsung melalui WhatsApp untuk mendiskusikan pilihan dan ketersediaan.": "Message us on WhatsApp to discuss options and availability.",
  "Ketentuan yang jelas": "Clear terms",
  "Tanyakan cakupan garansi, aktivasi, dan bantuan untuk paket pilihanmu sebelum membeli.": "Ask about warranty, activation and support before buying.",
  "Pilihan tepat dimulai": "The right choice begins",
  "dari percakapan sederhana.": "with a simple conversation.",
  "Butuh bantuan memilih paket? Kami siap berdiskusi.": "Need help choosing a package? We are here to help.",
  "Tanya via WhatsApp": "Ask via WhatsApp",
  "Tidak ada e-book yang sesuai filter.": "No e-books match your filters.",
  "Katalog e-book sedang disiapkan.": "The e-book catalog is being prepared.",
  "Coba kategori atau jenis lainnya.": "Try another category or type.",
  "Download Gratis": "Free download",
  "Beli via WhatsApp": "Buy via WhatsApp",
  "Download belum tersedia": "Download unavailable",
  "Link download belum tersedia. Silakan coba kembali nanti.": "The download link is unavailable. Please try again later.",
  "Dokumen dibuka di tab baru melalui tautan penyedia.": "The document opens in a new tab using the provider link.",
  "Pemesanan belum tersedia": "Ordering unavailable",
  "Menyiapkan WhatsApp…": "Preparing WhatsApp…",
  "Nomor toko belum dapat dibaca. Muat ulang halaman untuk mencoba kembali.": "Store contact details could not be loaded. Please reload.",
  "Pembayaran dan pengiriman file dilakukan manual oleh Admin melalui WhatsApp.": "Payment and file delivery are handled manually by our team via WhatsApp.",
  "Kembali ke katalog": "Back to catalog",
  "Pilih paket": "Choose a package",
  "Total harga": "Total price",
  "Pesan via WhatsApp": "Order via WhatsApp",
  "Stok Habis": "Out of stock",
  "Habis": "Unavailable",
  "Produk belum dapat dimuat": "Product could not be loaded",
  "Periksa koneksi lalu coba kembali.": "Check your connection and try again.",
  "Produk tidak ditemukan": "Product not found",
  "Produk mungkin telah dihapus atau namanya berubah.": "This product may have been removed or renamed.",
  "Lihat katalog": "Browse catalog",
  "Konfirmasi ketersediaan dan ketentuan paket melalui WhatsApp sebelum pembayaran.": "Confirm availability and package terms via WhatsApp before payment.",
  "Pengaturan WhatsApp belum dapat dibaca. Muat ulang halaman untuk mencoba kembali.": "WhatsApp settings could not be loaded. Please reload."
};
Object.assign(publicDictionary,{"Kembali ke katalog e-book":"Back to e-book catalog","Cover belum tersedia":"Cover unavailable","Ketuk banner untuk memperbesar teks dan gambar.":"Tap the banner to enlarge the text and image.","TESTIMONI PELANGGAN":"CUSTOMER REVIEWS","Apa Kata Pelanggan?":"What do customers say?","Screenshot pengalaman pelanggan. Klik gambar untuk memperbesar.":"Screenshots of customer experiences. Click an image to enlarge.","Lihat Semua Testimoni":"View all reviews","Memuat testimoni...":"Loading reviews...","Testimoni belum dapat dimuat. Silakan coba kembali.":"Reviews could not be loaded. Please try again.","Testimoni pelanggan akan segera tersedia":"Customer reviews are coming soon","E-Book belum dapat dimuat":"E-books could not be loaded","Periksa koneksi, lalu coba kembali.":"Check your connection, then try again.","Simulasi visual saja. Tidak ada file yang diunduh atau pesanan yang dikirim.":"Visual preview only. No files are downloaded or orders sent."});
for(const [key,value]of Object.entries({...publicDictionary}))if(key.endsWith('...'))publicDictionary[key.slice(0,-3)]=value.replace(/\.\.\.$/,'');
export function translatePublic(text:string,language:string,values:Record<string,string|number>={}){let result=language==='en'?(publicDictionary[text]??text):text;for(const [key,value]of Object.entries(values))result=result.replaceAll('{'+key+'}',String(value));return result;}
function snapshot(){try{return localStorage.getItem(PUBLIC_LANGUAGE_KEY)==='en'?'en':'id';}catch{return 'id';}}
let volatileLanguage:string|null=null;
function subscribe(notify:()=>void){const changed=()=>notify();window.addEventListener('public-language-change',changed);window.addEventListener('storage',changed);return()=>{window.removeEventListener('public-language-change',changed);window.removeEventListener('storage',changed);};}
function useLanguage(){return useSyncExternalStore(subscribe,()=>volatileLanguage??snapshot(),()=> 'id');}
export function setPublicLanguage(language:string){const next=language==='en'?'en':'id';try{localStorage.setItem(PUBLIC_LANGUAGE_KEY,next);volatileLanguage=null;}catch{volatileLanguage=next;}window.dispatchEvent(new Event('public-language-change'));}
export function PublicLanguageRoot({children}:{children:ReactNode}){const language=useLanguage();return <div lang={language} data-public-language={language} style={{display:'contents'}}>{children}</div>;}
export function PublicLanguageSwitcher(){const language=useLanguage();return <select className="store-language" aria-label="Bahasa / Language" value={language} onChange={e=>setPublicLanguage(e.target.value)}><option value="id">ID</option><option value="en">EN</option></select>;}
export function PublicText({text,values}:{text:string;values?:Record<string,string|number>}){return <>{translatePublic(text,useLanguage(),values)}</>;}
export function PublicInput(props:ComponentProps<'input'>){const language=useLanguage();return <input {...props} placeholder={props.placeholder?translatePublic(props.placeholder,language):undefined} aria-label={props['aria-label']?translatePublic(props['aria-label'],language):undefined}/>;}
