import { supabase } from './supabase';

type NullableUserId = string | null;

/** Ensure the current client is authenticated and return the user id if possible. */
export async function ensureSignedIn(): Promise<NullableUserId> {
  const [{ data: sessionData, error: sessionError }, { data: userData, error: userError }] = await Promise.all([
    supabase.auth.getSession(),
    supabase.auth.getUser(),
  ]);

  if (sessionError) throw sessionError;
  if (userError) throw userError;

  return sessionData?.session?.user?.id ?? userData?.user?.id ?? null;
}

/** Resolve the current user's id if known without forcing a sign-in. */
export async function resolveCurrentUserId(): Promise<NullableUserId> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data?.user?.id ?? null;
}

/** Sign the current session out. */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
