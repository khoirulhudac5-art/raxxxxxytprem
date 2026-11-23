import Image from 'next/image';
const artwork={apps:{src:'/artwork/katalog-apps-transparan.lossless.webp',alt:'KATALOG — APPS PREMIUM'},ebooks:{src:'/artwork/katalog-ebook-transparan.lossless.webp',alt:'KATALOG — E-BOOK'}};
export function CatalogArtwork({kind}:{kind:keyof typeof artwork}){
 const image=artwork[kind];
 return <section className="store-artwork" aria-label={image.alt}><svg width="0" height="0" className="store-artwork-filter" aria-hidden="true" focusable="false"><defs><filter id={`catalog-ink-${kind}`} colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values="0.098039 0 0 0 0 0 0.192157 0 0 0 0 0 0.298039 0 0 0 0 0 1 0"/></filter></defs></svg><h1 className="store-visually-hidden">{kind==='apps'?'Katalog Apps Premium':'Katalog E-Book'}</h1><div className={`store-artwork-canvas store-artwork-${kind}`}><Image src={image.src} alt={image.alt} width={2640} height={1485} priority unoptimized sizes="(max-width: 767px) 75vw, 570px"/></div></section>;
}
