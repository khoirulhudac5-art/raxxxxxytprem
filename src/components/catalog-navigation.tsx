'use client';
import type {MouseEvent} from 'react';
import {PublicText,PublicInput} from './public-copy';
import Link from 'next/link';
import {Search,X,LayoutGrid,BookOpen} from 'lucide-react';
import './catalog-navigation.css';
function press(event:MouseEvent<HTMLAnchorElement>){
 if(typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const tab=event.currentTarget;tab.classList.remove('is-pressed');void tab.offsetWidth;tab.classList.add('is-pressed');
}
const bubbles=<span className="catalog-bubbles" aria-hidden="true"><i/><i/><i/></span>;
export function CatalogTabs({active,ebookHref='/ebook'}:{active:'apps'|'ebooks';ebookHref?:string}){
 return <nav className="catalog-switch" aria-label="Jenis katalog"><Link href="/#top" onClick={press} onAnimationEnd={event=>{if(event.animationName==='catalog-bubble')event.currentTarget.classList.remove('is-pressed');}} data-analytics-event="catalog_click" data-analytics-catalog="apps" aria-current={active==='apps'?'page':undefined}><LayoutGrid size={15} strokeWidth={1.5} aria-hidden="true"/><PublicText text="Aplikasi"/>{bubbles}</Link><Link href={ebookHref+'#top'} onClick={press} onAnimationEnd={event=>{if(event.animationName==='catalog-bubble')event.currentTarget.classList.remove('is-pressed');}} data-analytics-event="catalog_click" data-analytics-catalog="ebooks" aria-current={active==='ebooks'?'page':undefined}><BookOpen size={15} strokeWidth={1.5} aria-hidden="true"/>E-Book{bubbles}</Link></nav>;
}
export function CatalogSearch({value,onChange,placeholder}:{value:string;onChange:(value:string)=>void;placeholder:string}){
 return <div className="catalog-search" role="search"><Search size={18} aria-hidden="true"/><PublicInput type="search" aria-label={placeholder.replace(/\.+$/,'')} placeholder={placeholder} value={value} onChange={e=>onChange(e.target.value)}/>{value&&<button type="button" aria-label="Hapus pencarian" onClick={()=>onChange('')}><X size={16}/></button>}</div>;
}
