import { Header } from './header';
export function AdminAccessMessage({unavailable=false}:{unavailable?:boolean}) {
 return <><Header admin/><main className="container admin-main"><section className="whatsapp-settings" role="alert">
  <h1>{unavailable?'Pemeriksaan akses gagal':'Akses ditolak'}</h1>
  <p>{unavailable?'Sesi atau izin Admin belum dapat diverifikasi. Periksa koneksi lalu coba lagi.':'Akun ini tidak terdaftar sebagai Admin Rakyat Premium.'}</p>
  <div className="modal-actions"><a className="secondary-button" href="/">Kembali ke katalog</a><a className="secondary-button" href="/admin">Coba lagi</a>
   <form action="/admin/logout" method="post"><button className="primary-button" type="submit">Logout</button></form>
  </div></section></main></>;
}
