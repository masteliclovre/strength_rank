// lib/data.ts
import { supabase } from './supabase';

export type Lift = 'Squat' | 'Bench' | 'Deadlift' | 'Overhead Press';

const DEV_HANDLE = '@you';

/** Sign in the seeded dev user so inserts pass RLS. */
export async function devSignIn() {
  return supabase.auth.signInWithPassword({
    email: 'you@example.com',
    password: 'password',
  });
}

/** Ensure the @you profile exists; return its user id. */
async function ensureDevProfile(): Promise<string> {
  // Try to find by handle
  const { data: byHandle } = await supabase
    .from('profiles')
    .select('id')
    .eq('handle', DEV_HANDLE)
    .maybeSingle();

  if (byHandle?.id) return byHandle.id as string;

  // Ensure we’re authenticated
  let { data: s1 } = await supabase.auth.getSession();
  if (!s1?.session) {
    const { error } = await devSignIn();
    if (error) {
      throw new Error(
        `Dev sign-in failed. Create user you@example.com (password "password") in Supabase Auth → Users and confirm it. ${error.message}`
      );
    }
    s1 = (await supabase.auth.getSession()).data;
  }
  const user = s1.session?.user;
  if (!user) throw new Error('No auth user after sign-in.');

  // If a profiles row with this id exists, return it
  const { data: byId } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();
  if (byId?.id) return byId.id as string;

  // Otherwise create a minimal profile row (RLS must allow id = auth.uid())
  const { error: upErr } = await supabase.from('profiles').upsert({
    id: user.id,
    handle: DEV_HANDLE,
    full_name: 'You',
    email_public: user.email ?? 'you@example.com',
    joined_at: new Date().toISOString(),
  });
  if (upErr) {
    throw new Error(
      `Could not create profiles row for dev user. Check RLS (insert must allow id=auth.uid()). ${upErr.message}`
    );
  }
  return user.id;
}

/** Public helper used by screens. */
export async function getDevUserId() {
  return ensureDevProfile();
}

/** PROFILE + current PRs for a user. */
export async function fetchProfileAndCurrentPRs(userId: string) {
  const profileQ = supabase
    .from('profiles')
    .select(
      `
      id, handle, full_name, email_public, gender, age,
      bodyweight_kg, height_cm, location, gym_id, avatar_url, joined_at,
      gym:gyms(name, city)
    `
)
.eq('id', userId)
    .maybeSingle();

  const prsQ = supabase
    .from('current_prs')
    .select('lift, weight_kg, bodyweight_kg, performed_at, verify')
    .eq('user_id', userId);

  const [profile, prs] = await Promise.all([profileQ, prsQ]);
  if (profile.error) throw profile.error;
  if (prs.error) throw prs.error;
  return { profile: profile.data, prs: prs.data || [] };
}

/** HOME feed (recent lifts from people you follow) — two-step join. */
export async function fetchHomeFeedFor(userId: string, limit = 30) {
  const { data: follows, error: fErr } = await supabase
    .from('follows')
    .select('followee_id')
    .eq('follower_id', userId);
  if (fErr) throw fErr;
  const ids = (follows || []).map((x) => x.followee_id);
  if (ids.length === 0) return [];

  const { data: lifts, error: lErr } = await supabase
    .from('lift_prs')
    .select('id, user_id, lift, weight_kg, bodyweight_kg, performed_at, video_url, verify')
    .in('user_id', ids)
    .order('performed_at', { ascending: false })
    .limit(limit);
  if (lErr) throw lErr;

  const uniqIds = Array.from(new Set((lifts || []).map((r) => r.user_id)));
  if (uniqIds.length === 0) return [];

  const { data: profs, error: pErr } = await supabase
    .from('profiles')
    .select('id, full_name, handle, avatar_url')
    .in('id', uniqIds);
  if (pErr) throw pErr;

  const profMap = new Map((profs || []).map((p: any) => [p.id, p]));
  return (lifts || []).map((r: any) => ({
    ...r,
    profile: profMap.get(r.user_id) || null,
  }));
}

/**
 * LEADERBOARD via DB view `public.current_prs_joined`.
 * The view should include:
 *   user_id, lift, weight_kg, bodyweight_kg, performed_at, verify,
 *   full_name, handle, gender, age, profile_bodyweight_kg, gym_id, avatar_url, gym_name
 */
export async function fetchLeaderboard(lift: Lift) {
  const { data, error } = await supabase
    .from('current_prs_joined')
    .select(
      `
      user_id,
      lift,
      weight_kg,
      bodyweight_kg,
      performed_at,
      verify,
      full_name,
      handle,
      gender,
      age,
      profile_bodyweight_kg,
      gym_id,
      avatar_url,
      gym_name
    `
)
.eq('lift', lift)
    .order('weight_kg', { ascending: false });

  if (error) throw error;
  const rows = data || [];

  // Shape to match the app’s expectation: a `profiles` object (with gym.name nested)
  return rows.map((r: any, i: number) => ({
    rank: i + 1,
    user_id: r.user_id,
    lift: r.lift,
    weight_kg: Number(r.weight_kg),
    bodyweight_kg: r.bodyweight_kg != null ? Number(r.bodyweight_kg) : null,
    performed_at: r.performed_at,
    verify: r.verify,
    profiles: {
      full_name: r.full_name,
      handle: r.handle,
      gender: r.gender,
      age: r.age,
      bodyweight_kg: r.profile_bodyweight_kg,
      gym: { name: r.gym_name },
      avatar_url: r.avatar_url,
    },
  }));
}

/** Insert a new PR row (requires auth; we sign in the dev user elsewhere). */
export async function savePRRow(opts: {
  userId: string;
  lift: Lift;
  weightKg: number;
  bodyweightKg?: number | null;
  age?: number | null;
  videoUrl?: string | null;
}) {
  const { error } = await supabase.from('lift_prs').insert({
    user_id: opts.userId,
    lift: opts.lift,
    weight_kg: opts.weightKg,
    reps: 1,
    bodyweight_kg: opts.bodyweightKg ?? null,
    age_at_lift: opts.age ?? null,
    video_url: opts.videoUrl ?? null,
    verify: 'unverified',
  });
  if (error) throw error;
}
