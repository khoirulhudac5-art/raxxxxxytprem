import Link from 'next/link';
import {Search,X} from 'lucide-react';
import './catalog-navigation.css';
export function CatalogTabs({active,ebookHref='/ebook'}:{active:'apps'|'ebooks';ebookHref?:string}){
 return <nav className="catalog-switch" aria-label="Jenis katalog"><Link href="/" aria-current={active==='apps'?'page':undefined}>Aplikasi</Link><Link href={ebookHref} aria-current={active==='ebooks'?'page':undefined}>E-Book</Link></nav>;
}
export function CatalogSearch({value,onChange,placeholder}:{value:string;onChange:(value:string)=>void;placeholder:string}){
 return <div className="catalog-search" role="search"><Search size={18} aria-hidden="true"/><input type="search" aria-label={placeholder.replace(/\.+$/,'')} placeholder={placeholder} value={value} onChange={e=>onChange(e.target.value)}/>{value&&<button type="button" aria-label="Hapus pencarian" onClick={()=>onChange('')}><X size={16}/></button>}</div>;
}
