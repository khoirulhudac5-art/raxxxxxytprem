import type {Metadata} from 'next';
import {readPublicEbooks} from '@/lib/supabase/ebook-public.server';
import {EbookCatalog} from '@/components/ebook-catalog';
import {headers} from 'next/headers';
import {readLocalEbookPreview} from '@/lib/ebook-local-preview.server';
import {EbookPreviewNotice} from '@/components/ebook-preview-notice';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Katalog E-Book | Rakyat Premium',description:'Pilihan e-book gratis dan berbayar dari Rakyat Premium.'};
export default async function Page({searchParams}:{searchParams?:Promise<Record<string,string|string[]|undefined>>}){
 const search=await searchParams;
 const preview=process.env.NODE_ENV==='development'?await readLocalEbookPreview(search?.preview,(await headers()).get('host')):null;
 if(preview)return <><div className="eb-shell"><EbookPreviewNotice/></div><EbookCatalog {...preview} linkSuffix={preview.suffix}/></>;
 const data=await readPublicEbooks();return <EbookCatalog {...data}/>;
}
