import { logAuthFailure } from '@/lib/supabase/auth-diagnostics';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isSameOriginPost } from '@/lib/supabase/auth-request';
export async function POST(request: NextRequest) {
 if(!isSameOriginPost(request)) return new NextResponse('Permintaan tidak diizinkan.',{status:403});
 const response=NextResponse.redirect(new URL('/admin',request.url),303);
 response.headers.set('Cache-Control','private, no-store');
 const fail=(code:string)=>{response.headers.set('Location',new URL(`/admin/login?error=${code}`,request.url).toString());return response;};
 try {
  const form=await request.formData();const email=form.get('email'),password=form.get('password');
  if(typeof email!=='string'||typeof password!=='string'||!email.trim()||!password||email.length>254||password.length>4096) return fail('invalid');
  const client=await createClient(response);
  const {error}=await client.auth.signInWithPassword({email:email.trim(),password});
  if(error){logAuthFailure('signInWithPassword',error);return fail(error.status===400||error.status===401||error.status===422?'invalid':'unavailable');}
  return response; // /admin independently verifies identity AND is_admin().
 } catch(error) {logAuthFailure('login-submit',error);return fail('unavailable');}
}
