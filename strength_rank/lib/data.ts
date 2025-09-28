// lib/data.ts
import { supabase } from './supabase';

export type Lift = 'Squat' | 'Bench' | 'Deadlift' | 'Overhead Press';

const LIFTS: Lift[] = ['Squat', 'Bench', 'Deadlift', 'Overhead Press'];

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

/** Look up a user's id by handle. */
export async function getUserIdByHandle(handle: string): Promise<string | null> {
  const normalized = handle.startsWith('@') ? handle : `@${handle}`;
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('handle', normalized)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

/** Fetch profile and PRs by handle (falls back to null if missing). */
export async function fetchProfileAndCurrentPRsByHandle(handle: string) {
  const userId = await getUserIdByHandle(handle);
  if (!userId) return { profile: null, prs: [] };
  return fetchProfileAndCurrentPRs(userId);
}

/**
 * Profile details + current PRs for a user.
 * Uses the materialized view `current_prs` when available, but also falls back to
 * computing the best attempt per lift from `lift_prs` so newly logged PRs show up
 * immediately even if the materialized view hasn't been refreshed yet.
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

  const rawPrsQ = supabase
    .from('lift_prs')
    .select('lift, weight_kg, bodyweight_kg, performed_at, verify')
    .eq('user_id', userId)
    .order('weight_kg', { ascending: false })
    .limit(400);

  const [pRes, prsRes, rawRes] = await Promise.all([profileQ, prsQ, rawPrsQ]);

  if (pRes.error) throw pRes.error;
  const prsErrorCode = (prsRes.error as any)?.code as string | undefined;
  if (prsRes.error && prsErrorCode && !['PGRST301', '42P01'].includes(prsErrorCode)) {
    throw prsRes.error;
  }
  if (prsRes.error && !prsErrorCode) throw prsRes.error;
  if (rawRes.error) throw rawRes.error;

  // Normalize gym relation (can be array or object depending on FK metadata)
  let gymRel: any = (pRes.data as any)?.gym;
  if (Array.isArray(gymRel)) gymRel = gymRel[0];

  const profile = pRes.data
    ? {
        ...pRes.data,
        gym: gymRel ? { name: gymRel.name, city: gymRel.city } : null,
      }
    : null;

  const normalizeRow = (row: any) => {
    const weight = Number(row?.weight_kg);
    if (!row?.lift || !LIFTS.includes(row.lift as Lift) || !weight || Number.isNaN(weight)) {
      return null;
    }
    const lift = row.lift as Lift;
    return {
      lift,
      weight_kg: weight,
      bodyweight_kg: row?.bodyweight_kg != null ? Number(row.bodyweight_kg) : null,
      performed_at: row?.performed_at ?? null,
      verify: row?.verify ?? null,
    };
  };

  const bestByLift = new Map<Lift, any>();

  (prsRes.data ?? []).forEach((row: any) => {
    const normalized = normalizeRow(row);
    if (normalized) {
      bestByLift.set(normalized.lift, normalized);
    }
  });

  (rawRes.data ?? []).forEach((row: any) => {
    const normalized = normalizeRow(row);
    if (!normalized) return;
    const current = bestByLift.get(normalized.lift);
    const currentWeight = current ? Number(current.weight_kg) : -Infinity;
    const nextWeight = Number(normalized.weight_kg);
    const currentDate = current?.performed_at ? Date.parse(current.performed_at) : -Infinity;
    const nextDate = normalized.performed_at ? Date.parse(normalized.performed_at) : -Infinity;
    if (
      !current ||
      nextWeight > currentWeight ||
      (nextWeight === currentWeight && nextDate > currentDate)
    ) {
      bestByLift.set(normalized.lift, normalized);
    }
  });

  const prs = LIFTS.map((l) => bestByLift.get(l)).filter(Boolean);

  return { profile, prs };
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
  performedAt?: string;
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
    performed_at: opts.performedAt ?? new Date().toISOString(),
  });
  if (error) throw error;
}

/** Compute a user's current daily streak based on lift entries. */
export async function fetchCurrentStreak(userId: string, maxEntries = 400): Promise<number> {
  const { data, error } = await supabase
    .from('lift_prs')
    .select('performed_at')
    .eq('user_id', userId)
    .order('performed_at', { ascending: false })
    .limit(maxEntries);

  if (error) throw error;

  const dates = new Set<string>();
  (data || []).forEach((row: any) => {
    if (!row?.performed_at) return;
    const iso = new Date(row.performed_at).toISOString().slice(0, 10);
    dates.add(iso);
  });

  const sorted = Array.from(dates).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  if (!sorted.length) return 0;

  const dayMs = 24 * 60 * 60 * 1000;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  let anchor = today.getTime();
  let streak = 0;

  for (const iso of sorted) {
    const day = new Date(`${iso}T00:00:00Z`).getTime();
    if (Number.isNaN(day)) continue;

    if (day > anchor) {
      anchor = day;
    }

    const diff = anchor - day;
    if (diff > dayMs) break;

    streak += 1;
    anchor = day - dayMs;
  }

  return streak;
}
