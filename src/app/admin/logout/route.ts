import { logAuthFailure } from '@/lib/supabase/auth-diagnostics';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isSameOriginPost } from '@/lib/supabase/auth-request';
export async function POST(request: NextRequest) {
 if(!isSameOriginPost(request)) return new NextResponse('Permintaan tidak diizinkan.',{status:403});
 const response=NextResponse.redirect(new URL('/admin/login',request.url),303);
 response.headers.set('Cache-Control','private, no-store');
 try {const client=await createClient(response);const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;}
 catch(error) {logAuthFailure('signOut',error);response.headers.set('Location',new URL('/admin?logout=failed',request.url).toString());}
 return response;
}
