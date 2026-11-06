import { createSupabaseServerClient } from './supabaseServer';
import { supabaseAdmin } from './supabaseAdmin';

export async function getCurrentUserRole(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Failed to fetch role:', error);
    return null;
  }

  return data?.role ?? null;
}