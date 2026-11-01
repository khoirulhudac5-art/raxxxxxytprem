'use client';
import {useState} from 'react';
import {BookOpen} from 'lucide-react';
export function EbookCover({url,title}:{url:string|null;title:string}){
 const [failed,setFailed]=useState<string|null>(null);
 return <div className="eb-cover">{url&&failed!==url?<img src={url} alt={'Cover '+title} loading="lazy" decoding="async" onError={()=>setFailed(url)}/>:<span className="eb-cover-fallback"><BookOpen size={36}/><span>Cover belum tersedia</span></span>}</div>;
}
export function EbookBanner({url,alt}:{url:string;alt:string}){
 const [failed,setFailed]=useState<string|null>(null);
 return failed===url?null:<><div className="eb-banner"><a href={url} target="_blank" rel="noopener noreferrer" aria-label="Perbesar banner di tab baru"><img src={url} alt={alt} decoding="async" fetchPriority="high" onError={()=>setFailed(url)}/></a></div><p className="eb-banner-hint">Ketuk banner untuk memperbesar teks dan gambar.</p></>;
}
