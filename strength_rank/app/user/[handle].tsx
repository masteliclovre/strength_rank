import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ensureSignedIn, resolveCurrentUserId } from '@/lib/auth';
import {
  fetchCurrentStreak,
  fetchProfileAndCurrentPRs,
  getUserIdByHandle,
  type Lift,
} from '@/lib/data';
import { supabase } from '@/lib/supabase';

const LIFTS: Lift[] = ['Squat', 'Bench', 'Deadlift', 'Overhead Press'];

type ProfileView = {
  name: string;
  handle: string;
  email?: string;
  age?: number;
  gender?: 'Male' | 'Female' | 'Other';
  bodyweightKg?: number;
  heightCm?: number;
  location?: string;
  gym?: string;
  joinedISO?: string;
  prs: Record<Lift, number | undefined>;
  avatarUri?: string | null;
};

function getWeightCategory(bodyweightKg?: number | null) {
  if (bodyweightKg == null) return undefined;
  const bw = Number(bodyweightKg);
  if (!Number.isFinite(bw) || bw <= 0) return undefined;
  if (bw < 60) return '<60';
  if (bw < 75) return '60-75';
  if (bw < 90) return '75-90';
  if (bw < 105) return '90-105';
  return '105+';
}

function Icon({ name, size = 14 }: { name: string; size?: number }) {
  const map: Record<string, string> = {
    email: '✉️',
    age: '🗓️',
    weight: '⚖️',
    height: '📏',
    gender: '🚻',
    location: '📍',
    gym: '🏋️',
    joined: '🕒',
    total: '➕',
    ratio: '📈',
    streak: '🔥',
    category: '🏷️',
  };
  return <ThemedText style={{ fontSize: size }}>{map[name] || '•'}</ThemedText>;
}

function FieldRow({
  label,
  value,
  icon,
}: {
  label: string;
  value?: string | number;
  icon?: string;
}) {
  return (
    <View style={styles.fieldRow}>
      <View style={{ width: 22 }}>{icon ? <Icon name={icon} /> : null}</View>
      <ThemedText style={styles.fieldLabel}>{label}</ThemedText>
      <ThemedText style={styles.fieldValue}>{value ?? '—'}</ThemedText>
    </View>
  );
}

function PRRow({
  lift,
  kg,
  bodyweightKg,
}: {
  lift: Lift;
  kg?: number;
  bodyweightKg?: number | null;
}) {
  const ratio = kg != null && bodyweightKg && bodyweightKg > 0 ? kg / bodyweightKg : null;
  const subtitle =
    kg == null ? 'No entry yet' : ratio != null ? `${ratio.toFixed(2)}× BW` : '—';
  return (
    <View style={styles.prRow}>
      <View>
        <ThemedText type="defaultSemiBold">{lift}</ThemedText>
        <ThemedText style={styles.prSubtitle}>{subtitle}</ThemedText>
      </View>
      <ThemedText style={styles.prValue}>{kg != null ? `${kg} kg` : '—'}</ThemedText>
    </View>
  );
}

export default function UserProfileScreen() {
  const params = useLocalSearchParams<{ handle?: string }>();
  const handleParam = (params.handle as string) ?? '';
  const normalizedHandle = handleParam.startsWith('@') ? handleParam : `@${handleParam}`;

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [streakDays, setStreakDays] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [isMe, setIsMe] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        setProfile(null);
        setStreakDays(0);
        setUserId(null);
        setIsFollowing(false);

        if (!normalizedHandle || normalizedHandle.length < 2) {
          setError('No handle provided.');
          return;
        }

        const id = await getUserIdByHandle(normalizedHandle);
        if (!id) {
          setError('We could not find that athlete.');
          return;
        }
        if (cancel) return;

        setUserId(id);

        const [meId, profileData, streak] = await Promise.all([
          resolveCurrentUserId(),
          fetchProfileAndCurrentPRs(id),
          fetchCurrentStreak(id),
        ]);
        if (cancel) return;

        setIsMe(!!meId && meId === id);

        const prsRecord: Record<Lift, number | undefined> = {
          Squat: undefined,
          Bench: undefined,
          Deadlift: undefined,
          'Overhead Press': undefined,
        };
        (profileData.prs || []).forEach((row: any) => {
          if (LIFTS.includes(row.lift)) {
            prsRecord[row.lift as Lift] = Number(row.weight_kg);
          }
        });

        const mapped: ProfileView = {
          name: profileData.profile?.full_name ?? 'Unknown',
          handle: profileData.profile?.handle ?? normalizedHandle,
          email: profileData.profile?.email_public ?? undefined,
          age: profileData.profile?.age ?? undefined,
          gender: profileData.profile?.gender ?? undefined,
          bodyweightKg: profileData.profile?.bodyweight_kg ?? undefined,
          heightCm: profileData.profile?.height_cm ?? undefined,
          location: profileData.profile?.location ?? undefined,
          gym: profileData.profile?.gym?.name ?? undefined,
          joinedISO: profileData.profile?.joined_at ?? undefined,
          prs: prsRecord,
          avatarUri: profileData.profile?.avatar_url ?? null,
        };

        setProfile(mapped);
        setStreakDays(streak);

        if (meId && meId !== id) {
          try {
            const { data: followRow } = await supabase
              .from('follows')
              .select('id')
              .eq('follower_id', meId)
              .eq('followee_id', id)
              .maybeSingle();
            if (!cancel) setIsFollowing(!!followRow);
          } catch {
            if (!cancel) setIsFollowing(false);
          }
        }
      } catch (e) {
        if (!cancel) {
          console.warn('User profile load failed:', e);
          setError('Unable to load this profile right now.');
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    })();

    return () => {
      cancel = true;
    };
  }, [normalizedHandle]);

  const total = useMemo(() => {
    if (!profile) return 0;
    return LIFTS.reduce((sum, l) => sum + (profile.prs[l] ?? 0), 0);
  }, [profile]);

  const bodyweightKg = profile?.bodyweightKg ?? null;
  const totalRatio = useMemo(() => {
    if (!bodyweightKg || bodyweightKg <= 0) return null;
    return total / bodyweightKg;
  }, [bodyweightKg, total]);

  const weightCategory = useMemo(
    () => getWeightCategory(bodyweightKg),
    [bodyweightKg]
  );

  const streakLabel = streakDays > 0 ? `${streakDays} day${streakDays === 1 ? '' : 's'}` : undefined;

  const toggleFollow = async () => {
    if (!userId || isMe) return;
    setFollowBusy(true);
    try {
      const meId = await ensureSignedIn();
      if (!meId) {
        alert('Sign in is required to follow athletes.');
        return;
      }
      if (meId === userId) return;

      if (isFollowing) {
        const { error: delErr } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', meId)
          .eq('followee_id', userId);
        if (delErr) throw delErr;
        setIsFollowing(false);
      } else {
        const { error: insErr } = await supabase
          .from('follows')
          .insert({ follower_id: meId, followee_id: userId });
        if (insErr && (insErr as any).code !== '23505') throw insErr;
        setIsFollowing(true);
      }
    } catch (e: any) {
      console.warn('Follow toggle failed:', e?.message || e);
      alert(`Could not update follow status.\n${e?.message || e}`);
    } finally {
      setFollowBusy(false);
    }
  };

  const avatarSource = profile?.avatarUri
    ? { uri: profile.avatarUri }
    : require('@/assets/images/icon.png');

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={styles.card}>
          <View style={{ alignItems: 'center' }}>
            <Image source={avatarSource} style={styles.avatar} />
            {!isMe && userId ? (
              <Pressable
                onPress={toggleFollow}
                disabled={followBusy}
                style={[styles.followBtn, isFollowing && styles.followBtnActive]}
              >
                {followBusy ? (
                  <ActivityIndicator />
                ) : (
                  <ThemedText style={{ fontWeight: '700' }}>
                    {isFollowing ? 'Following' : 'Follow'}
                  </ThemedText>
                )}
              </Pressable>
            ) : null}
          </View>

          <View style={{ alignItems: 'center', marginTop: 10 }}>
            <ThemedText type="title">{profile?.name ?? normalizedHandle}</ThemedText>
            <ThemedText style={{ opacity: 0.7 }}>{normalizedHandle}</ThemedText>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Icon name="total" />
              <ThemedText style={styles.summaryValue}>{total} kg</ThemedText>
              <ThemedText style={styles.summaryLabel}>Total</ThemedText>
            </View>
            <View style={styles.summaryItem}>
              <Icon name="ratio" />
              <ThemedText style={styles.summaryValue}>
                {totalRatio != null ? totalRatio.toFixed(2) : '—'}
              </ThemedText>
              <ThemedText style={styles.summaryLabel}>Total / BW</ThemedText>
            </View>
            <View style={styles.summaryItem}>
              <Icon name="streak" />
              <ThemedText style={styles.summaryValue}>{streakLabel ?? '—'}</ThemedText>
              <ThemedText style={styles.summaryLabel}>Streak</ThemedText>
            </View>
          </View>

          {!isMe && isFollowing ? (
            <View style={styles.infoBanner}>
              <ThemedText style={{ fontSize: 12, opacity: 0.7 }}>
                This athlete will now appear in your Friends-only leaderboard filter.
              </ThemedText>
            </View>
          ) : null}
        </View>

        {loading ? (
          <View style={{ paddingVertical: 20 }}>
            <ActivityIndicator />
          </View>
        ) : error ? (
          <View style={[styles.card, { alignItems: 'center' }]}>
            <ThemedText style={{ opacity: 0.7, textAlign: 'center' }}>{error}</ThemedText>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <ThemedText type="defaultSemiBold">Public Info</ThemedText>
              <FieldRow label="Email" value={profile?.email} icon="email" />
              <FieldRow label="Age" value={profile?.age} icon="age" />
              <FieldRow label="Gender" value={profile?.gender} icon="gender" />
              <FieldRow label="Weight category" value={weightCategory} icon="category" />
              <FieldRow label="Location" value={profile?.location} icon="location" />
              <FieldRow label="Consistency streak" value={streakLabel} icon="streak" />
            </View>

            <View style={[styles.card, styles.prCard]}>
              <ThemedText type="defaultSemiBold">PR Lifts</ThemedText>
              <View style={styles.prList}>
                {LIFTS.map((l) => (
                  <PRRow key={l} lift={l} kg={profile?.prs[l]} bodyweightKg={bodyweightKg} />
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: 24 },
  card: {
    marginTop: 12,
    marginHorizontal: 16,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
    backgroundColor: 'transparent',
    padding: 16,
  },
  avatar: { width: 110, height: 110, borderRadius: 55, backgroundColor: '#eee' },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
  },
  summaryItem: {
    alignItems: 'center',
    gap: 6,
  },
  summaryValue: { fontSize: 18, fontWeight: '700' },
  summaryLabel: { fontSize: 12, opacity: 0.6 },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  fieldLabel: { width: 120, opacity: 0.7 },
  fieldValue: { flex: 1, textAlign: 'right' },
  prRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#f4f4f4',
  },
  prSubtitle: { fontSize: 12, opacity: 0.6, marginTop: 2 },
  prValue: { fontSize: 16, fontWeight: '700' },
  prList: { gap: 10, marginTop: 12 },
  prCard: { paddingBottom: 20 },
  followBtn: {
    marginTop: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#111',
  },
  followBtnActive: {
    backgroundColor: '#eaeaea',
  },
  infoBanner: {
    marginTop: 14,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
  },
});
