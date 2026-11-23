'use client';

import {PublicText,PublicInput} from './public-copy';
import Link from 'next/link';
import {EbookSectionLink} from './ebook-section-link';
import {PublicStoreHeader} from './public-store-header';
import {useStoreSettings} from '@/lib/supabase/use-store-settings';
export function EbookStoreHeader(){const {settings,ready,error}=useStoreSettings();return <PublicStoreHeader contact={ready&&!error&&settings.number?`https://wa.me/${settings.number}`:''}/>;}
export function EbookStoreFooter(){return <footer className="rp-footer rp-shell"><div className="rp-footer-top"><div><Link href="/" className="rp-footer-brand" aria-label="Rakyat Premium, beranda"><svg className="store-footer-wordmark" viewBox="253 578 2165 347" role="img" aria-label="Rakyat Premium — digital store"><image href="/artwork/text-rakyatpremium.lossless.webp" width="2640" height="1485"/></svg></Link><p>Digital essentials. Thoughtfully selected.</p></div><nav aria-label="Navigasi footer"><Link href="/"><PublicText text="Aplikasi"/></Link><EbookSectionLink/><Link href="/#keunggulan"><PublicText text="Informasi layanan"/></Link></nav></div><div className="rp-footer-bottom"><span>© {new Date().getFullYear()} Rakyat Premium</span><span><PublicText text="Katalog digital independen."/></span></div></footer>;}
