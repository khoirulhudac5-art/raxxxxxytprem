import './analytics.css';
export default function Loading(){return <main className="container an-dashboard" aria-busy="true" aria-label="Memuat statistik"><span className="eyebrow">ANALYTICS</span><h1>Menyiapkan insight…</h1><p role="status">Memverifikasi akses dan membaca statistik.</p><div className="an-cards">{[1,2,3,4,5].map(i=><div className="an-card an-skeleton" key={i}/>)}</div></main>;}
