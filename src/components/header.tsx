import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight } from 'lucide-react';
export function Header({admin=false}:{admin?:boolean}) {return <header className="header"><div className="container header-inner"><Link href="/" className="brand"><span className="brand-mark rounded-full"><Image src="/logo.png" alt="Logo Rakyat Premium" width={48} height={48} priority className="brand-logo"/></span><span>rakyat<span className="brand-light">premium</span><small>DIGITAL GOODNESS FOR EVERYONE</small></span></Link><nav aria-label="Navigasi utama"><Link href="/" className={!admin?'active':''}>Katalog<span className="desktop"> produk</span></Link><Link href="/admin" className={admin?'active':''}>Admin <ArrowUpRight size={13}/></Link></nav></div></header>}

