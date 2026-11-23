import Link from 'next/link';
import {Send,MessageCircle} from 'lucide-react';
import {PublicLanguageSwitcher,PublicText} from './public-copy';
import {PublicThemeToggle} from './public-store-frame';
export function PublicStoreHeader({contact=''}:{contact?:string}){
 return <header className="store-header"><div className="rp-shell store-header-inner">
  <Link href="/" className="store-brand" aria-label="Rakyat Premium, beranda"><svg className="store-canva-logo" viewBox="750 325 1141 836" role="img" aria-label="Logo Rakyat Premium"><image href="/artwork/logo-rakyatpremium.lossless.webp" width="2640" height="1485"/></svg><svg className="store-canva-wordmark" viewBox="253 578 2165 347" role="img" aria-label="Rakyat Premium — digital store"><image href="/artwork/text-rakyatpremium.lossless.webp" width="2640" height="1485"/></svg></Link>
  <nav className="store-header-actions" aria-label="Navigasi utama"><a className="store-testimonials" href="https://t.me/Tst_rakprem" target="_blank" rel="noopener noreferrer" aria-label="Testimoni Pembeli di Telegram (tab baru)"><Send size={17} aria-hidden="true"/><span><PublicText text="Testimoni Pembeli"/></span></a>{contact&&<a className="store-whatsapp" href={contact} target="_blank" rel="noopener noreferrer" aria-label="Hubungi kami melalui WhatsApp"><MessageCircle size={19} aria-hidden="true"/><span>WhatsApp</span></a>}</nav>
  <div className="store-header-controls"><PublicLanguageSwitcher/><PublicThemeToggle/></div>
 </div></header>;
}
