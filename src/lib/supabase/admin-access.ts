import 'server-only';
import { logAuthFailure } from './auth-diagnostics';
import type { SupabaseClient } from '@supabase/supabase-js';
export type AdminAccess = 'admin'|'unauthenticated'|'denied'|'unavailable';
// Verify identity on Auth server, then membership via the existing SECURITY DEFINER helper.
export async function checkAdminAccess(getClient:()=>Promise<SupabaseClient>): Promise<AdminAccess> {
 try {
  const client=await getClient();
  const {data,error}=await client.auth.getUser();
  if(error){if(error.name!=='AuthSessionMissingError')logAuthFailure('getUser',error);return error.name==='AuthSessionMissingError' || error.status===401 || error.status===403 ? 'unauthenticated' : 'unavailable';}
  if(!data.user) return 'unauthenticated';
  const membership=await client.rpc('is_admin');
  if(membership.error){logAuthFailure('is_admin',membership.error);return 'unavailable';}
  return membership.data===true ? 'admin' : 'denied';
 } catch(error) {logAuthFailure('access-check',error);return 'unavailable';}
}
