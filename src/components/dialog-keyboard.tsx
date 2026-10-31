'use client';
import { useEffect } from 'react';
export function DialogKeyboard({onClose}:{onClose:()=>void}) {
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null;
  const dialog=document.querySelector<HTMLElement>('[role="dialog"], [role="alertdialog"]');
  const oldOverflow=document.body.style.overflow; document.body.style.overflow='hidden';
  const elements=()=>Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea,select,a[href]')??[]);
  elements()[0]?.focus();
  const handler=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();if(e.key==='Tab'){const list=elements();const first=list[0],last=list[list.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};
  document.addEventListener('keydown',handler);
  return ()=>{document.removeEventListener('keydown',handler);document.body.style.overflow=oldOverflow;previous?.focus();};
 },[onClose]);
 return null;
}
