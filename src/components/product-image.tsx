'use client';
import { useState } from 'react';
import { Sparkles, Video, Palette, Gem, Play, Music2, Camera } from 'lucide-react';
import { Product, validImageUrl } from '@/lib/products';

const icons = {spark:Sparkles,video:Video,design:Palette,gem:Gem,play:Play,music:Music2,camera:Camera};

function ImageWithFallback({product, preview, loading}:{product:Product; preview:boolean; loading?:'lazy'|'eager'}) {
 const [failed,setFailed] = useState(false);
 const url = product.imageUrl?.trim() ?? '';
 const Icon = icons[product.icon as keyof typeof icons] ?? Sparkles;
 const showImage = validImageUrl(url) && !failed;
 return <>
  <span className={`product-icon ${product.color}`}>
   {showImage ? <img className="product-image" src={url} loading={loading} decoding={loading?'async':undefined} alt={preview ? `Preview ${product.name || 'gambar produk'}` : product.name} onError={()=>setFailed(true)}/> : <Icon size={29} strokeWidth={1.8}/>}
  </span>
  {preview && url && !showImage && <span role="status">{failed ? 'Gambar gagal dimuat. Ikon bawaan digunakan.' : 'Gunakan URL HTTP/HTTPS dengan format PNG, JPG, JPEG, atau WebP.'}</span>}
 </>;
}

export function ProductImage({product, preview=false, loading}:{product:Product; preview?:boolean; loading?:'lazy'|'eager'}) {
 return <ImageWithFallback key={product.imageUrl?.trim() ?? ''} product={product} preview={preview} loading={loading}/>;
}
