export function isSupabasePreview(search: string, environment: string | undefined): boolean {
 return environment === 'development' && new URLSearchParams(search).get('source') === 'supabase-preview';
}
