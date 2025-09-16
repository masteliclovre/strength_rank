import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, Pressable, FlatList, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { fetchLeaderboard } from '@/lib/data';
import { supabase } from '@/lib/supabase';

// ————————————————— Types & constants —————————————————
type Lift = 'Squat' | 'Bench' | 'Deadlift' | 'Overhead Press';
const LIFTS: Lift[] = ['Squat', 'Bench', 'Deadlift', 'Overhead Press'];

type Gender = 'Male' | 'Female' | 'Other';
type Athlete = {
  userId: string;
  handle: string;
  name: string;
  gender?: Gender;
  age?: number;
  bodyweightKg?: number;
  gym?: string;
  friendsWithYou: boolean;
  prs: Record<Lift, number | undefined>;
  avatar?: any;
};

const YOU_HANDLE = '@you'; // dev user (seeded)

// ————————————————— Small UI helpers —————————————————
function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSel]}>
      <ThemedText style={{ fontWeight: selected ? '700' : '500' }}>{label}</ThemedText>
    </Pressable>
  );
}

function Seg({ items, value, onChange }: { items: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.seg}>
      {items.map((it) => (
        <Pressable key={it} onPress={() => onChange(it)} style={[styles.segItem, value === it && styles.segItemSel]}>
          <ThemedText style={{ fontWeight: value === it ? '700' : '500' }}>{it}</ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

// Mini histogram (distribution of PRs)
function MiniHistogram({ values, youValue }: { values: number[]; youValue?: number }) {
  if (!values.length) return null;
  const bins = 8;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = (max - min) / Math.max(bins, 1) || 1;
  const counts = new Array(bins).fill(0);
  values.forEach((v) => {
    let idx = Math.floor((v - min) / step);
    if (idx >= bins) idx = bins - 1;
    counts[idx] += 1;
  });
  const maxC = Math.max(...counts, 1);
  const youIdx =
    youValue == null ? -1 : Math.min(bins - 1, Math.max(0, Math.floor((youValue - min) / step)));
  return (
    <View style={styles.histWrap}>
      {counts.map((c, i) => (
        <View key={i} style={[styles.histBar, { height: 8 + (60 * c) / maxC }, youIdx === i && styles.histBarYou]} />
      ))}
    </View>
  );
}

// Rank position bar
function RankPositionBar({ rank, total }: { rank: number; total: number }) {
  const pos = total <= 1 ? 0 : (rank - 1) / (total - 1); // 0..1 left->right
  return (
    <View style={styles.posWrap}>
      <View style={styles.posTrack} />
      <View style={[styles.posThumb, { left: `${pos * 100}%` }]} />
      <ThemedText style={styles.posLabel}>#{rank} of {total}</ThemedText>
    </View>
  );
}

// ————————————————— Main screen —————————————————
export default function LeaderboardScreen() {
  const [lift, setLift] = useState<Lift>('Deadlift');
  const [scope, setScope] = useState<'Global' | 'Filtered'>('Global');

  // Filters (apply when scope === 'Filtered')
  const [friendsOnly, setFriendsOnly] = useState<boolean>(false);
  const [gender, setGender] = useState<'All' | 'Male' | 'Female' | 'Other'>('All');
  const ageGroups = ['All', 'U23', '24-29', '30-39', '40+'] as const;
  const [ageGroup, setAgeGroup] = useState<typeof ageGroups[number]>('All');
  const weightClasses = ['All', '<60', '60-75', '75-90', '90-105', '105+'] as const;
  const [weightClass, setWeightClass] = useState<typeof weightClasses[number]>('All');
  const [gym, setGym] = useState<string>('All');

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Athlete[]>([]);
  const [followeeIds, setFolloweeIds] = useState<Set<string>>(new Set());

  // Fetch global leaderboard for selected lift
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setLoading(true);
        const data = await fetchLeaderboard(lift);
        if (cancel) return;
        const mapped: Athlete[] = (data || []).map((r: any) => ({
          userId: r.user_id,
          handle: r.profiles?.handle ?? '@unknown',
          name: r.profiles?.full_name ?? 'Unknown',
          gender: r.profiles?.gender ?? undefined,
          age: r.profiles?.age ?? undefined,
          bodyweightKg: r.profiles?.bodyweight_kg ?? undefined,
          gym: r.profiles?.gym?.name ?? undefined,
          friendsWithYou: false, // filled after we load follows
          prs: {
            Squat: lift === 'Squat' ? Number(r.weight_kg) : undefined,
            Bench: lift === 'Bench' ? Number(r.weight_kg) : undefined,
            Deadlift: lift === 'Deadlift' ? Number(r.weight_kg) : undefined,
            'Overhead Press': lift === 'Overhead Press' ? Number(r.weight_kg) : undefined,
          },
          avatar: r.profiles?.avatar_url
            ? { uri: r.profiles.avatar_url }
            : require('@/assets/images/icon.png'),
        }));
        setRows(mapped);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [lift]);

  // Fetch who @you follows (for Friends filter)
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        // find @you user id
        const { data: me } = await supabase.from('profiles').select('id').eq('handle', YOU_HANDLE).single();
        if (!me) return;
        const { data: follows } = await supabase.from('follows').select('followee_id').eq('follower_id', me.id);
        if (cancel) return;
        setFolloweeIds(new Set((follows || []).map((f) => f.followee_id)));
      } catch {
        setFolloweeIds(new Set());
      }
    })();
    return () => { cancel = true; };
  }, []);

  // Apply filters client-side
  const leaderboard: Athlete[] = useMemo(() => {
    let pool = rows.map((a) => ({
      ...a,
      friendsWithYou: followeeIds.has(a.userId),
    }));

    if (scope === 'Filtered') {
      if (friendsOnly) pool = pool.filter((a) => a.friendsWithYou);
      if (gender !== 'All') pool = pool.filter((a) => a.gender === (gender as any));
      if (ageGroup !== 'All') {
        pool = pool.filter((a) => {
          const x = a.age ?? -1;
          if (ageGroup === 'U23') return x >= 0 && x < 23;
          if (ageGroup === '24-29') return x >= 24 && x <= 29;
          if (ageGroup === '30-39') return x >= 30 && x <= 39;
          return x >= 40;
        });
      }
      if (weightClass !== 'All') {
        pool = pool.filter((a) => {
          const bw = a.bodyweightKg ?? -1;
          if (bw < 0) return false;
          if (weightClass === '<60') return bw < 60;
          if (weightClass === '60-75') return bw >= 60 && bw < 75;
          if (weightClass === '75-90') return bw >= 75 && bw < 90;
          if (weightClass === '90-105') return bw >= 90 && bw < 105;
          return bw >= 105;
        });
      }
      if (gym !== 'All') pool = pool.filter((a) => a.gym === gym);
    }

    // sort desc by PR for the current lift
    return pool.sort((a, b) => (b.prs[lift]! - a.prs[lift]!));
  }, [rows, followeeIds, scope, friendsOnly, gender, ageGroup, weightClass, gym, lift]);

  const youIndex = leaderboard.findIndex((a) => a.handle === YOU_HANDLE);
  const youRank = youIndex >= 0 ? youIndex + 1 : undefined;
  const youPR = leaderboard.find((a) => a.handle === YOU_HANDLE)?.prs[lift];
  const values = useMemo(() => leaderboard.map((a) => a.prs[lift] || 0), [leaderboard]);

  // Header content (above the list)
  const Header = (
    <View style={{ paddingHorizontal: 16 }}>
      <ThemedText type="title">Leaderboard</ThemedText>

      {/* LIFT TABS */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.liftTabs}>
        {LIFTS.map((l) => (
          <Chip key={l} label={l} selected={lift === l} onPress={() => setLift(l)} />
        ))}
      </ScrollView>

      {/* SCOPE */}
      <Seg items={['Global', 'Filtered']} value={scope} onChange={(v) => setScope(v as any)} />

      {/* FILTERS (active when scope === 'Filtered') */}
      {scope === 'Filtered' && (
        <View style={styles.filters}>
          <Chip label={friendsOnly ? 'Friends ✓' : 'Friends only'} selected={friendsOnly} onPress={() => setFriendsOnly((s) => !s)} />
          <Seg items={['All', 'Male', 'Female']} value={gender} onChange={(v) => setGender(v as any)} />
          <Seg items={[...ageGroups]} value={ageGroup} onChange={(v) => setAgeGroup(v as any)} />
          <Seg items={[...weightClasses]} value={weightClass} onChange={(v) => setWeightClass(v as any)} />
          <Seg items={['All', 'G4Y', 'Split Iron', 'Zg Barbell']} value={gym} onChange={(v) => setGym(v)} />
        </View>
      )}

      {/* YOUR PLACEMENT CARD */}
      <View style={styles.card}>
        <ThemedText type="defaultSemiBold">Your placement</ThemedText>
        {youRank != null ? (
          <>
            <RankPositionBar rank={youRank} total={leaderboard.length} />
            <View style={styles.youRow}>
              <Image source={require('@/assets/images/icon.png')} style={styles.avatar} />
              <ThemedText style={{ flex: 1 }}>You • {lift}</ThemedText>
              <ThemedText type="defaultSemiBold">{youPR} kg</ThemedText>
            </View>
          </>
        ) : (
          <ThemedText style={{ opacity: 0.7 }}>No result for this scope.</ThemedText>
        )}

        {/* Distribution */}
        {values.length > 0 && (
          <>
            <ThemedText style={{ marginTop: 8, opacity: 0.8 }}>Distribution of {lift} (kg)</ThemedText>
            <MiniHistogram values={values} youValue={youPR} />
          </>
        )}
      </View>
    </View>
  );

  return (
    <ThemedView style={styles.screen}>
      {loading ? (
        <View style={{ paddingTop: 24 }}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={leaderboard}
          keyExtractor={(a) => a.userId}
          ListHeaderComponent={Header}
          contentContainerStyle={{ paddingBottom: 32 }}
          renderItem={({ item, index }) => (
            <Row rank={index + 1} athlete={item} lift={lift} you={item.handle === YOU_HANDLE} />
          )}
        />
      )}
    </ThemedView>
  );
}

// ————————————————— Row component —————————————————
function Row({ rank, athlete, lift, you }: { rank: number; athlete: Athlete; lift: Lift; you?: boolean }) {
  const pr = athlete.prs[lift];
  return (
    <View style={[styles.row, you && styles.rowYou]}>
      <ThemedText type="defaultSemiBold" style={{ width: 36, textAlign: 'center' }}>#{rank}</ThemedText>
      <Image source={athlete.avatar || require('@/assets/images/icon.png')} style={styles.avatar} />
      <View style={{ flex: 1 }}>
        <ThemedText type={you ? 'defaultSemiBold' : 'default'}>{athlete.name}</ThemedText>
        <ThemedText style={{ opacity: 0.6, fontSize: 12 }}>
          {athlete.handle} • {athlete.gym ?? '—'} • {athlete.bodyweightKg ?? '—'}kg • {athlete.gender ?? '—'}
        </ThemedText>
      </View>
      <ThemedText type="defaultSemiBold">{pr} kg</ThemedText>
    </View>
  );
}

// ————————————————— Styles —————————————————
const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: Platform.select({ ios: 56, android: 36, default: 24 }) },

  liftTabs: { gap: 8, marginTop: 10, paddingBottom: 6 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: '#ccc',
    backgroundColor: '#fafafa', marginRight: 8,
  },
  chipSel: { backgroundColor: '#eaeaea', borderColor: '#bbb' },

  seg: { flexDirection: 'row', marginTop: 10, borderRadius: 10, overflow: 'hidden', alignSelf: 'flex-start' },
  segItem: { paddingVertical: 8, paddingHorizontal: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: '#ddd', backgroundColor: '#f7f7f7' },
  segItemSel: { backgroundColor: '#eaeaea' },

  filters: { marginTop: 10, gap: 8 },

  card: {
    marginTop: 14, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: '#ddd',
    padding: 12, backgroundColor: 'transparent',
  },

  posWrap: { marginTop: 6, marginBottom: 8 },
  posTrack: { height: 8, backgroundColor: '#eee', borderRadius: 999 },
  posThumb: {
    position: 'absolute', top: -4, width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#111', transform: [{ translateX: -8 }],
  },
  posLabel: { marginTop: 6, textAlign: 'center' },

  histWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 72, marginTop: 8 },
  histBar: { width: 14, backgroundColor: '#d8d8d8', borderRadius: 4 },
  histBarYou: { backgroundColor: '#111' },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee',
  },
  rowYou: { backgroundColor: '#f7f7f7' },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#eee' },
});
