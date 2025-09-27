// lib/data.ts
import { supabase } from './supabase';

export type Lift = 'Squat' | 'Bench' | 'Deadlift' | 'Overhead Press';

// Dev convenience: who is “you” while we don’t have a full auth UI yet
const DEV_HANDLE = '@you';

/** Resolve the seeded dev user's id by handle (@you). */
export async function getDevUserId(): Promise<string> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('handle', DEV_HANDLE)
    .single();
  if (error || !data) throw error ?? new Error('No @you profile found.');
  return data.id as string;
}

/** Sign in the seeded dev user so RLS allows inserts/updates from the app. */
export async function devSignIn() {
  return supabase.auth.signInWithPassword({
    email: 'you@example.com',
    password: 'password',
  });
}

/**
 * Profile details + current PRs for a user.
 * Uses the materialized view `current_prs` to fetch each lift's best.
 */
export async function fetchProfileAndCurrentPRs(userId: string) {
  // Profile (try to fetch related gym as "gym"; Supabase may return an object or a 1-elem array)
  const profileQ = supabase
    .from('profiles')
    .select(
      `
        id, handle, full_name, email_public, gender, age,
        bodyweight_kg, height_cm, location, gym_id, avatar_url, joined_at,
        gym:gyms ( name, city )
      `
)
.eq('id', userId)
    .maybeSingle(); // tolerate missing

  // Current PRs (one row per lift)
  const prsQ = supabase
    .from('current_prs')
    .select('lift, weight_kg, bodyweight_kg, performed_at, verify')
    .eq('user_id', userId);

  const [pRes, prsRes] = await Promise.all([profileQ, prsQ]);

  if (pRes.error) throw pRes.error;
  if (prsRes.error) throw prsRes.error;

  // Normalize gym relation (can be array or object depending on FK metadata)
  let gymRel: any = (pRes.data as any)?.gym;
  if (Array.isArray(gymRel)) gymRel = gymRel[0];

  const profile = pRes.data
    ? {
        ...pRes.data,
        gym: gymRel ? { name: gymRel.name, city: gymRel.city } : null,
      }
    : null;

  return { profile, prs: prsRes.data ?? [] };
}

/** Home feed: recent lifts from people you follow (kept for later). */
export async function fetchHomeFeedFor(userId: string, limit = 30) {
  const { data: follows, error: fErr } = await supabase
    .from('follows')
    .select('followee_id')
    .eq('follower_id', userId);

  if (fErr) throw fErr;

  const ids = (follows ?? []).map((x) => x.followee_id);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('lift_prs')
    .select(
      `
        id, lift, weight_kg, bodyweight_kg, performed_at, video_url, verify, user_id,
        profiles:user_id ( full_name, handle, avatar_url )
      `
)
.in('user_id', ids)
    .order('performed_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

/**
 * Leaderboard for a given lift.
 * Prefers `current_prs_joined` view; falls back to joining from `current_prs`.
 */
export async function fetchLeaderboard(lift: Lift) {
  // Try the convenience joined view
  const joined = await supabase
    .from('current_prs_joined')
    .select(
      `
        user_id, lift, weight_kg, bodyweight_kg, performed_at, verify,
        full_name, handle, gender, age, profile_bodyweight_kg, gym_id, avatar_url, gym_name
      `
)
.eq('lift', lift)
    .order('weight_kg', { ascending: false });

  // If the view doesn't exist, fallback to a manual join
  if (joined.error && (joined.error as any).code === 'PGRST205') {
    const fallback = await supabase
      .from('current_prs')
      .select(
        `
          user_id, lift, weight_kg, bodyweight_kg, performed_at, verify,
          profiles:user_id (
            full_name, handle, gender, age, bodyweight_kg, gym_id, avatar_url
)
`
)
.eq('lift', lift)
      .order('weight_kg', { ascending: false });

    if (fallback.error) throw fallback.error;

    const rows = (fallback.data ?? []).map((r: any, i: number) => ({
      rank: i + 1,
      user_id: r.user_id,
      lift: r.lift,
      weight_kg: r.weight_kg,
      bodyweight_kg: r.bodyweight_kg,
      performed_at: r.performed_at,
      verify: r.verify,
      full_name: r.profiles?.full_name ?? null,
      handle: r.profiles?.handle ?? null,
      gender: r.profiles?.gender ?? null,
      age: r.profiles?.age ?? null,
      profile_bodyweight_kg: r.profiles?.bodyweight_kg ?? null,
      gym_id: r.profiles?.gym_id ?? null,
      avatar_url: r.profiles?.avatar_url ?? null,
      gym_name: null,
    }));

    return rows;
  }

  if (joined.error) throw joined.error;
  return (joined.data ?? []).map((r: any, i: number) => ({ rank: i + 1, ...r }));
}

/** Save a new PR row for a user. */
export async function savePRRow(opts: {
  userId: string;
  lift: Lift;
  weightKg: number;
  bodyweightKg?: number | null;
  age?: number | null;
  videoUrl?: string | null;
  gymId?: string | null;
}) {
  const { error } = await supabase.from('lift_prs').insert({
    user_id: opts.userId,
    lift: opts.lift,
    weight_kg: opts.weightKg,
    reps: 1,
    bodyweight_kg: opts.bodyweightKg ?? null,
    age_at_lift: opts.age ?? null,
    video_url: opts.videoUrl ?? null,
    gym_id: opts.gymId ?? null,
    verify: 'unverified',
  });
  if (error) throw error;
}
