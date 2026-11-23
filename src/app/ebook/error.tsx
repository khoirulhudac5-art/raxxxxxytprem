'use client';

import {PublicText} from '@/components/public-copy';
export default function ErrorPage({reset}:{reset:()=>void}){return <main className="eb-shell eb-main eb-state" role="alert"><h1><PublicText text="E-Book belum dapat dimuat"/></h1><p><PublicText text="Periksa koneksi, lalu coba kembali."/></p><button className="eb-button" onClick={reset}>Coba lagi</button></main>;}
