import { authFetch,logAuthFailure } from '@/lib/supabase/auth-diagnostics';
import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseEnvironment } from '@/lib/supabase/env';
export async function middleware(request: NextRequest) {
 let response=NextResponse.next({request});
 response.headers.set('Cache-Control','private, no-store');
 try {
  const {url,publishableKey}=getSupabaseEnvironment();
  const client=createServerClient(url,publishableKey,{global:{fetch:authFetch},cookies:{
   getAll:()=>request.cookies.getAll(),
   setAll(cookiesToSet,headers) {
    for(const {name,value} of cookiesToSet)request.cookies.set(name,value);
    const previous=response;
    response=NextResponse.next({request});
    for(const cookie of previous.cookies.getAll())response.cookies.set(cookie);
    for(const name of ['cache-control','expires','pragma']) {
     const value=previous.headers.get(name);if(value)response.headers.set(name,value);
    }
    response.headers.set('Cache-Control','private, no-store');
    for(const {name,value,options} of cookiesToSet)response.cookies.set(name,value,options);
    for(const [name,value] of Object.entries(headers))response.headers.set(name,value);
   },
  }});
  const claims=await client.auth.getClaims();
  if(claims?.error && claims.error.name!=='AuthSessionMissingError')logAuthFailure('middleware.getClaims',claims.error);
 } catch(error) {logAuthFailure('middleware.refresh',error); /* Server page still fails closed. */ }
 return response;
}
export const config={matcher:['/admin/:path*']};
