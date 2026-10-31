'use client';
import { useEffect, useState } from 'react';
import { createClient } from './client';
import { defaultWhatsAppSettings, validWhatsAppSettings } from '../whatsapp';

export function useStoreSettings() {
 const [settings,setSettings]=useState(defaultWhatsAppSettings);
 const [ready,setReady]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>{
  let active=true;
  async function read(){
   try {
    const {data,error}=await createClient().schema('public').from('store_settings')
     .select('whatsapp_number,whatsapp_template').eq('id','main').single();
    const next={number:data?.whatsapp_number,template:data?.whatsapp_template};
    if(error || !validWhatsAppSettings(next))throw Error();
    if(active){setSettings(next);setReady(true);setError('');}
   }catch{if(active){setReady(false);setError('Pengaturan WhatsApp Supabase gagal dibaca. Muat ulang halaman untuk mencoba lagi.');}}
  }
  void read();
  window.addEventListener('focus',read);
  return ()=>{active=false;window.removeEventListener('focus',read);};
 },[]);
 return {settings,ready,error};
}
