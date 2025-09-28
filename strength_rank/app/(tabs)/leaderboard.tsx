import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';
import { ensureSignedIn, resolveCurrentUserId } from '@/lib/auth';
import { pickPrVideoFromGallery, uploadPrVideo, type PrVideoAsset } from '@/lib/pr-video';

// Types
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

const YOU_HANDLE = '@you';

// Small UI bits
function Chip({
  label,
  selected,
  onPress,
  disabled,
  style,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.chip,
        style,
        selected && styles.chipSel,
        disabled && { opacity: 0.4 },
      ]}
    >
      <ThemedText style={[styles.chipText, selected && styles.chipTextSel]}>{label}</ThemedText>
    </Pressable>
  );
}

function Seg({
  items,
  value,
  onChange,
}: {
  items: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.seg}>
      {items.map((it) => (
        <Pressable
          key={it}
          onPress={() => onChange(it)}
          style={[styles.segItem, value === it && styles.segItemSel]}
        >
          <ThemedText style={{ fontWeight: value === it ? '700' : '500' }}>{it}</ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

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
        <View
          key={i}
          style={[styles.histBar, { height: 8 + (60 * c) / maxC }, youIdx === i && styles.histBarYou]}
        />
      ))}
    </View>
  );
}

function RankPositionBar({ rank, total }: { rank: number; total: number }) {
  const pos = total <= 1 ? 0 : (rank - 1) / (total - 1);
  return (
    <View style={styles.posWrap}>
      <View style={styles.posTrack} />
      <View style={[styles.posThumb, { left: `${pos * 100}%` }]} />
      <ThemedText style={styles.posLabel}>
        #{rank} of {total}
      </ThemedText>
    </View>
  );
}

// Add PR modal
function AddPrModal({
  visible,
  onClose,
  initialLift,
  gymId,
  gymName,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  initialLift: Lift;
  gymId: string;
  gymName: string;
  onSaved: () => void;
}) {
  const [lift, setLift] = useState<Lift>(initialLift);
  const [weight, setWeight] = useState<string>('');
  const [reps, setReps] = useState<string>('1');
  const [saving, setSaving] = useState(false);
  const [myBw, setMyBw] = useState<number | undefined>(undefined);
  const [videoAsset, setVideoAsset] = useState<PrVideoAsset | null>(null);

  useEffect(() => setLift(initialLift), [initialLift]);

  useEffect(() => {
    if (!visible) {
      setWeight('');
      setReps('1');
      setVideoAsset(null);
    }
  }, [visible]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const u = await ensureSignedIn();
        if (!u) return;
        const { data: prof } = await supabase
          .from('profiles')
          .select('bodyweight_kg')
          .eq('id', u)
          .single();
        if (!cancel && prof?.bodyweight_kg != null) setMyBw(Number(prof.bodyweight_kg));
      } catch { /* ignore */ }
    })();
    return () => { cancel = true; };
  }, []);

  const attachVideo = async () => {
    const asset = await pickPrVideoFromGallery();
    if (asset) {
      setVideoAsset(asset);
    }
  };

  const removeVideo = () => setVideoAsset(null);

  const save = async () => {
    const w = Number(weight);
    const r = Math.max(1, Number(reps) || 1);
    if (!w || Number.isNaN(w)) {
      alert('Enter a valid weight in kg.');
      return;
    }
    try {
      setSaving(true);
      const userId = await ensureSignedIn();
      if (!userId) throw new Error('Not signed in.');

      let uploadedVideoUrl: string | null = null;
      if (videoAsset) {
        try {
          uploadedVideoUrl = await uploadPrVideo(videoAsset, userId);
        } catch (e: any) {
          console.warn('Video upload failed:', e?.message || e);
          alert('Could not upload video. Saving PR without video.');
        }
      }

      const { error } = await supabase.from('lift_prs').insert({
        user_id: userId,
        lift,
        weight_kg: w,
        reps: r,
        bodyweight_kg: myBw ?? null,
        age_at_lift: null,
        gym_id: gymId,
        performed_at: new Date().toISOString().slice(0, 10),
        video_url: uploadedVideoUrl,
        verify: 'unverified',
      } as any);

      if (error) throw error;
      setWeight('');
      setReps('1');
      setVideoAsset(null);
      onClose();
      onSaved();
      alert(`PR saved: ${lift} ${w} kg @ ${gymName}`);
    } catch (e: any) {
      alert(`Could not save PR: ${e?.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalWrap}
      >
        <View style={styles.modalCard}>
          <ThemedText type="title">Add PR</ThemedText>
          <ThemedText style={{ opacity: 0.7, marginBottom: 8 }}>{gymName}</ThemedText>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.liftTabs}
          >
            {LIFTS.map((l) => (
              <Chip key={l} label={l} selected={lift === l} onPress={() => setLift(l)} />
            ))}
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <View style={styles.inputWrap}>
              <ThemedText style={styles.inputLabel}>Weight (kg)</ThemedText>
              <TextInput
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
                placeholder="e.g. 180"
                style={styles.input}
              />
            </View>
            <View style={styles.inputWrapSmall}>
              <ThemedText style={styles.inputLabel}>Reps</ThemedText>
              <TextInput
                value={reps}
                onChangeText={setReps}
                keyboardType="number-pad"
                placeholder="1"
                style={styles.input}
              />
            </View>
          </View>

          <Pressable onPress={attachVideo} style={styles.modalVideoBtn}>
            <ThemedText style={{ fontWeight: '600' }}>
              {videoAsset ? 'Change attached video' : 'Attach video from gallery'}
            </ThemedText>
          </Pressable>
          {videoAsset ? (
            <>
              <View style={styles.modalVideoPreview}>
                <Video
                  source={{ uri: videoAsset.uri }}
                  style={{ width: '100%', height: 180 }}
                  useNativeControls
                  resizeMode={ResizeMode.COVER}
                />
              </View>
              <View style={styles.modalVideoActions}>
                <ThemedText style={styles.modalVideoMeta} numberOfLines={1}>
                  {videoAsset.fileName || videoAsset.uri}
                </ThemedText>
                <Pressable onPress={removeVideo}>
                  <ThemedText style={styles.modalVideoRemove}>Remove video</ThemedText>
                </Pressable>
              </View>
            </>
          ) : (
            <ThemedText style={styles.modalVideoMeta}>
              Optional: attach a clip to help verifiers.
            </ThemedText>
          )}

          <View style={{ marginTop: 8 }}>
            <ThemedText style={styles.inputLabel}>Bodyweight (kg, auto)</ThemedText>
            <TextInput
              value={myBw != null ? String(myBw) : ''}
              onChangeText={(t) => setMyBw(Number(t) || undefined)}
              keyboardType="decimal-pad"
              placeholder="auto from profile"
              style={styles.input}
            />
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <Pressable onPress={onClose} style={[styles.btn, { backgroundColor: '#eee' }]}>
              <ThemedText>Cancel</ThemedText>
            </Pressable>
            <Pressable onPress={save} disabled={saving} style={styles.btn}>
              {saving ? <ActivityIndicator /> : <ThemedText style={{ fontWeight: '700' }}>Save PR</ThemedText>}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// Main screen
export default function LeaderboardScreen() {
  const params = useLocalSearchParams<{ gymId?: string; gymName?: string }>();
  const gymId = (params.gymId as string) ?? '';
  const gymName = (params.gymName as string) ?? 'Gym';

  const [lift, setLift] = useState<Lift>('Deadlift');
  const [scope, setScope] = useState<'Global' | 'Filtered'>('Global');

  const [friendsOnly, setFriendsOnly] = useState(false);
  const genderOptions = ['All', 'Male', 'Female', 'Other'] as const;
  const [gender, setGender] = useState<(typeof genderOptions)[number]>('All');
  const ageGroups = ['All', 'U23', '24-29', '30-39', '40+'] as const;
  const [ageGroup, setAgeGroup] = useState<(typeof ageGroups)[number]>('All');
  const weightClasses = ['All', '<60', '60-75', '75-90', '90-105', '105+'] as const;
  const [weightClass, setWeightClass] = useState<(typeof weightClasses)[number]>('All');

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Athlete[]>([]);
  const [followeeIds, setFolloweeIds] = useState<Set<string>>(new Set());
  const [refreshTick, setRefreshTick] = useState(0);

  const [showAddPr, setShowAddPr] = useState(false);
  const openAddPr = () => setShowAddPr(true);
  const closeAddPr = () => setShowAddPr(false);

  // Fetch attempts for this gym & lift; compute current PR per user
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setLoading(true);

        const { data: attempts, error: prsErr } = await supabase
          .from('lift_prs')
          .select('user_id, lift, weight_kg, performed_at, verify, gym_id')
          .eq('lift', lift)
          .eq('gym_id', gymId)
          .order('weight_kg', { ascending: false })
          .limit(1500);

        if (prsErr) throw prsErr;

        const maxByUser = new Map<string, any>();
        (attempts || []).forEach((r) => {
          const cur = maxByUser.get(r.user_id);
          if (!cur || Number(r.weight_kg) > Number(cur.weight_kg)) {
            maxByUser.set(r.user_id, r);
          }
        });
        const prs = Array.from(maxByUser.values());
        const userIds = prs.map((r) => r.user_id);

        let profs: any[] = [];
        if (userIds.length) {
          const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name, handle, gender, age, bodyweight_kg, avatar_url, gym:gyms(name)')
            .in('id', userIds);
          if (error) throw error;
          profs = data || [];
        }

        const profById = new Map(profs.map((p) => [p.id, p]));
        const mapped: Athlete[] = prs.map((r: any) => {
          const p = profById.get(r.user_id) || {};
          const rec: Record<Lift, number | undefined> = {
            Squat: undefined,
            Bench: undefined,
            Deadlift: undefined,
            'Overhead Press': undefined,
          };
          rec[lift] = Number(r.weight_kg);
          return {
            userId: r.user_id,
            handle: p.handle ?? '@unknown',
            name: p.full_name ?? 'Unknown',
            gender: p.gender ?? undefined,
            age: p.age ?? undefined,
            bodyweightKg: p.bodyweight_kg ?? undefined,
            gym: p.gym?.name ?? undefined,
            friendsWithYou: false,
            prs: rec,
            avatar: p.avatar_url ? { uri: p.avatar_url } : require('@/assets/images/icon.png'),
          };
        });

        if (!cancel) setRows(mapped);
      } catch {
        if (!cancel) setRows([]);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [lift, gymId, refreshTick]);

  // Followees (for friends filter)
  useFocusEffect(
    useCallback(() => {
      let cancel = false;
      (async () => {
        try {
          const meId = await resolveCurrentUserId();
          if (!meId) return;
          const { data: follows } = await supabase
            .from('follows')
            .select('followee_id')
            .eq('follower_id', meId);
          if (cancel) return;
          setFolloweeIds(new Set((follows || []).map((f) => f.followee_id)));
        } catch {
          setFolloweeIds(new Set());
        }
      })();
      return () => {
        cancel = true;
      };
    }, [])
  );

  const rowsWithFriends = useMemo(
    () => rows.map((a) => ({ ...a, friendsWithYou: followeeIds.has(a.userId) })),
    [rows, followeeIds]
  );

  const filtered = useMemo(() => {
    let pool = rowsWithFriends;
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
    }
    return pool;
  }, [rowsWithFriends, scope, friendsOnly, gender, ageGroup, weightClass]);

  const sortedData = useMemo(
    () => [...filtered].sort((a, b) => (b.prs[lift]! - a.prs[lift]!)),
    [filtered, lift]
  );

  const youIndex = sortedData.findIndex((a) => a.handle === YOU_HANDLE);
  const youRank = youIndex >= 0 ? youIndex + 1 : undefined;
  const youPR = sortedData.find((a) => a.handle === YOU_HANDLE)?.prs[lift];
  const values = useMemo(() => sortedData.map((a) => a.prs[lift] || 0), [sortedData, lift]);

  const Header = (
    <View style={{ paddingHorizontal: 16 }}>
      <ThemedText type="title">
        Leaderboard <ThemedText style={{ opacity: 0.6 }}>— {gymName}</ThemedText>
      </ThemedText>

      {/* Lifts */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.liftTabs}
      >
        {LIFTS.map((l) => (
          <Chip key={l} label={l} selected={lift === l} onPress={() => setLift(l)} />
        ))}
      </ScrollView>

      {/* Scope + filters */}
      <View style={styles.filterCard}>
        <ThemedText type="defaultSemiBold">Refine leaderboard</ThemedText>
        <Seg items={['Global', 'Filtered']} value={scope} onChange={(v) => setScope(v as any)} />
        {scope === 'Filtered' && (
          <View style={styles.filterSections}>
            <View style={styles.filterSection}>
              <ThemedText style={styles.filterLabel}>Community</ThemedText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterPillRow}
              >
                <Chip
                  label="All members"
                  selected={!friendsOnly}
                  onPress={() => setFriendsOnly(false)}
                />
                <Chip
                  label="Friends only"
                  selected={friendsOnly}
                  onPress={() => setFriendsOnly(true)}
                />
              </ScrollView>
            </View>

            <View style={styles.filterSection}>
              <ThemedText style={styles.filterLabel}>Gender</ThemedText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterPillRow}
              >
                {genderOptions.map((option) => (
                  <Chip
                    key={option}
                    label={option}
                    selected={gender === option}
                    onPress={() => setGender(option)}
                  />
                ))}
              </ScrollView>
            </View>

            <View style={styles.filterSection}>
              <ThemedText style={styles.filterLabel}>Age group</ThemedText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterPillRow}
              >
                {ageGroups.map((group) => (
                  <Chip
                    key={group}
                    label={group}
                    selected={ageGroup === group}
                    onPress={() => setAgeGroup(group)}
                  />
                ))}
              </ScrollView>
            </View>

            <View style={styles.filterSection}>
              <ThemedText style={styles.filterLabel}>Weight class</ThemedText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterPillRow}
              >
                {weightClasses.map((group) => (
                  <Chip
                    key={group}
                    label={group}
                    selected={weightClass === group}
                    onPress={() => setWeightClass(group)}
                  />
                ))}
              </ScrollView>
            </View>
          </View>
        )}
      </View>

      {/* Your placement + distribution */}
      <View style={styles.card}>
        <ThemedText type="defaultSemiBold">Your placement</ThemedText>
        {youRank != null ? (
          <>
            <RankPositionBar rank={youRank} total={sortedData.length} />
            <View style={styles.youRow}>
              <Image source={require('@/assets/images/icon.png')} style={styles.avatar} />
              <ThemedText style={{ flex: 1 }}>You • {lift}</ThemedText>
              <ThemedText type="defaultSemiBold">{youPR} kg</ThemedText>
            </View>
          </>
        ) : (
          <ThemedText style={{ opacity: 0.7 }}>No result for this scope.</ThemedText>
        )}

        {values.length > 0 && (
          <>
            <ThemedText style={{ marginTop: 8, opacity: 0.8 }}>
              Distribution of {lift} (kg)
            </ThemedText>
            <MiniHistogram values={values} youValue={youPR} />
          </>
        )}
      </View>

      {/* Exercises + actions */}
      <View style={styles.card}>
        <ThemedText type="defaultSemiBold">Exercises at {gymName}</ThemedText>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {LIFTS.map((l) => (
            <Chip key={l} label={l} selected={l === lift} onPress={() => setLift(l)} />
          ))}
        </View>

        <View style={{ marginTop: 10 }}>
          <Pressable style={styles.btn} onPress={openAddPr}>
            <ThemedText style={{ fontWeight: '700' }}>Add PR for {lift}</ThemedText>
          </Pressable>
        </View>
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
          data={sortedData}
          keyExtractor={(a) => a.userId}
          ListHeaderComponent={Header}
          contentContainerStyle={{ paddingBottom: 32 }}
          renderItem={({ item, index }) => (
            <Row rank={index + 1} athlete={item} lift={lift} you={item.handle === YOU_HANDLE} />
          )}
        />
      )}

      {/* Add PR Modal */}
      {gymId ? (
        <AddPrModal
          visible={showAddPr}
          onClose={closeAddPr}
          initialLift={lift}
          gymId={gymId}
          gymName={gymName}
          onSaved={() => setRefreshTick((t) => t + 1)}
        />
      ) : null}
    </ThemedView>
  );
}

// Row
function Row({
  rank,
  athlete,
  lift,
  you,
}: {
  rank: number;
  athlete: Athlete;
  lift: Lift;
  you?: boolean;
}) {
  const router = useRouter();
  const openProfile = () => {
    const handleParam = athlete.handle.replace(/^@/, '');
    if (!handleParam) return;
    router.push({ pathname: '/user/[handle]', params: { handle: handleParam } });
  };

  const pr = athlete.prs[lift];
  return (
    <Pressable
      onPress={openProfile}
      style={({ pressed }) => [styles.row, you && styles.rowYou, pressed && styles.rowPressed]}
    >
      <ThemedText type="defaultSemiBold" style={{ width: 36, textAlign: 'center' }}>
        #{rank}
      </ThemedText>
      <Image source={athlete.avatar || require('@/assets/images/icon.png')} style={styles.avatar} />
      <View style={{ flex: 1 }}>
        <ThemedText type={you ? 'defaultSemiBold' : 'default'}>{athlete.name}</ThemedText>
        <ThemedText style={{ opacity: 0.6, fontSize: 12 }}>
          {athlete.handle} • {athlete.gym ?? '—'} • {athlete.bodyweightKg ?? '—'}kg •{' '}
          {athlete.gender ?? '—'}
        </ThemedText>
      </View>
      <ThemedText type="defaultSemiBold">{pr} kg</ThemedText>
    </Pressable>
  );
}

// Styles
const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: Platform.select({ ios: 56, android: 36, default: 24 }) },

  liftTabs: { gap: 8, marginTop: 10, paddingBottom: 6 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d5d5d5',
    backgroundColor: '#fff',
    marginRight: 8,
    marginBottom: 8,
  },
  chipSel: { backgroundColor: '#111', borderColor: '#111' },
  chipText: { fontWeight: '600' },
  chipTextSel: { color: '#fff' },

  seg: {
    flexDirection: 'row',
    marginTop: 12,
    borderRadius: 999,
    backgroundColor: '#f0f0f0',
    padding: 4,
    alignSelf: 'stretch',
  },
  segItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  segItemSel: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 2,
  },

  filterCard: {
    marginTop: 16,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e3e3e3',
    padding: 16,
    backgroundColor: '#fafafa',
  },
  filterSections: {
    paddingTop: 16,
  },
  filterSection: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    opacity: 0.6,
  },
  filterPillRow: { flexDirection: 'row', paddingTop: 10, paddingBottom: 6, paddingRight: 8 },

  card: {
    marginTop: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
    padding: 12,
    backgroundColor: 'transparent',
  },

  posWrap: { marginTop: 6, marginBottom: 8 },
  posTrack: { height: 8, backgroundColor: '#eee', borderRadius: 999 },
  posThumb: {
    position: 'absolute',
    top: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#111',
    transform: [{ translateX: -8 }],
  },
  posLabel: { marginTop: 6, textAlign: 'center' },

  histWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 72, marginTop: 8 },
  histBar: { width: 14, backgroundColor: '#d8d8d8', borderRadius: 4 },
  histBarYou: { backgroundColor: '#111' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  rowPressed: { opacity: 0.75 },
  rowYou: { backgroundColor: '#f7f7f7' },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#eee' },

  youRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#efefef',
    alignSelf: 'flex-start',
  },

  // Modal
  modalWrap: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  modalVideoBtn: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
    backgroundColor: '#f7f7f7',
  },
  modalVideoPreview: {
    marginTop: 10,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  modalVideoActions: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalVideoMeta: { fontSize: 12, opacity: 0.7, flex: 1 },
  modalVideoRemove: { color: '#b00020', fontWeight: '600' },
  inputWrap: { flex: 1 },
  inputWrapSmall: { width: 90 },
  inputLabel: { fontSize: 12, opacity: 0.7, marginBottom: 4 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
});
