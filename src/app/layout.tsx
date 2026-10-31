import type { Metadata } from 'next';
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import './globals.css';
export const metadata: Metadata = {title:'Rakyat Premium — Upgrade harimu',description:'Katalog produk digital Rakyat Premium. Temukan paket pilihan dan pesan melalui WhatsApp.'};
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="id"><body>{children}</body></html>; }
