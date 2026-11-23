'use client';
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {Moon,Sun} from 'lucide-react';
import './public-store-theme.css';
import {PublicLanguageRoot} from './public-copy';

export const PUBLIC_THEME_KEY='rakyat-premium-public-theme-v1';
type Theme='dark'|'light';
const ThemeContext=createContext({theme:'dark' as Theme,toggle:()=>{}});
// Runs before the public content paints. It never changes html/body or Admin.
const bootstrap=`try{var s=document.currentScript,p=s&&s.parentElement,t=localStorage.getItem('${PUBLIC_THEME_KEY}');if(p)p.dataset.theme=t==='light'?'light':'dark'}catch{}`;
export function PublicStoreFrame({children,className=''}:{children:ReactNode;className?:string}){
 const [theme,setTheme]=useState<Theme>('dark');
 useEffect(()=>{
  const restore=()=>{try{setTheme(localStorage.getItem(PUBLIC_THEME_KEY)==='light'?'light':'dark');}catch{setTheme('dark');}};
  restore();const sync=(event:StorageEvent)=>{if(event.key===PUBLIC_THEME_KEY||event.key===null)restore();};
  window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);
 },[]);
 function toggle(){const next=theme==='dark'?'light':'dark';setTheme(next);try{localStorage.setItem(PUBLIC_THEME_KEY,next);}catch{/* Theme still works when browser storage is unavailable. */}}
 return <ThemeContext.Provider value={{theme,toggle}}><PublicLanguageRoot><div className={'rp-store '+className} data-storefront="public" data-theme={theme} suppressHydrationWarning><script dangerouslySetInnerHTML={{__html:bootstrap}}/>{children}</div></PublicLanguageRoot></ThemeContext.Provider>;
}
export function PublicThemeToggle(){
 const {theme,toggle}=useContext(ThemeContext);
 return <button type="button" className="store-theme-toggle" aria-label="Ganti tema terang atau gelap" aria-pressed={theme==='light'} onClick={toggle}><Sun className="store-sun" size={16} aria-hidden="true"/><Moon className="store-moon" size={19} aria-hidden="true"/></button>;
}
