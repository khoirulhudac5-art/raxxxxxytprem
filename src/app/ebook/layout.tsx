import type {ReactNode} from 'react';
import {EbookStoreHeader,EbookStoreFooter} from '@/components/ebook-store-shell';
import '../public-store.css';
import './ebook.css';
import {PublicStoreFrame} from '@/components/public-store-frame';
export default function EbookLayout({children}:{children:ReactNode}){return <PublicStoreFrame className="eb-store"><a className="rp-skip" href="#ebook-content">Langsung ke konten</a><EbookStoreHeader/><div id="ebook-content">{children}</div><EbookStoreFooter/></PublicStoreFrame>;}
