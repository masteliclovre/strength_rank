import { supabase } from './supabase';
import { devSignIn, getDevUserId } from './data';

type NullableUserId = string | null;

/** Ensure the current client is authenticated and return the user id if possible. */
export async function ensureSignedIn(): Promise<NullableUserId> {
  const { data } = await supabase.auth.getUser();
  if (data?.user?.id) return data.user.id;

  try {
    await devSignIn();
  } catch {
    // ignore
  }

  const again = await supabase.auth.getUser();
  if (again.data?.user?.id) return again.data.user.id;

  try {
    const id = await getDevUserId();
    if (id) return id;
  } catch {
    // ignore
  }

  try {
    const { data: you } = await supabase.from('profiles').select('id').eq('handle', '@you').single();
    if (you?.id) return you.id;
  } catch {
    // ignore
  }

  return null;
}

/** Resolve the current user's id if known without forcing a sign-in. */
export async function resolveCurrentUserId(): Promise<NullableUserId> {
  const { data } = await supabase.auth.getUser();
  if (data?.user?.id) return data.user.id;

  try {
    const id = await getDevUserId();
    if (id) return id;
  } catch {
    // ignore
  }

  try {
    const { data: you } = await supabase.from('profiles').select('id').eq('handle', '@you').single();
    if (you?.id) return you.id;
  } catch {
    // ignore
  }

  return null;
}
