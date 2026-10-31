import 'server-only';
import { authFetch } from './auth-diagnostics';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';
import { getSupabaseEnvironment } from './env';

// New client per request. Without a response, cookies are read-only (Server Components).
// Route Handlers that change/refresh Auth must pass AND return the same NextResponse.
// Next.js 15 middleware refreshes Admin cookies before Server Component rendering.
export async function createClient(response?: NextResponse) {
 const {url, publishableKey} = getSupabaseEnvironment();
 const cookieStore = await cookies();
 return createServerClient(url, publishableKey, {
  global:{fetch:authFetch},
  cookies: {
   getAll() { return cookieStore.getAll(); },
   ...(response ? {
    setAll(cookiesToSet, headers) {
     for (const {name, value, options} of cookiesToSet) {
      response.cookies.set(name, value, options);
     }
     for (const [name, value] of Object.entries(headers)) {
      response.headers.set(name, value);
     }
    },
   } satisfies Pick<import('@supabase/ssr').CookieMethodsServer, 'setAll'> : {}),
  },
 });
}
