import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, TextInput, View, ScrollView, Pressable, Platform, LayoutChangeEvent, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import { supabase } from '@/lib/supabase';
import { devSignIn, getDevUserId, savePRRow } from '@/lib/data';
import * as FileSystem from 'expo-file-system';
import { decode as atob } from 'base-64';


type Lift = 'Squat' | 'Bench' | 'Deadlift' | 'Overhead Press';
type OldPR = { id: string; date: string; lift: Lift; weightKg: number; bodyweightKg: number; age: number };

const LIFTS: Lift[] = ['Squat', 'Bench', 'Deadlift', 'Overhead Press'];

/** ---- Fallback history (only used if DB is empty) ---- */
const FALLBACK: OldPR[] = [
  { id: 'a1', date: '2025-04-10', lift: 'Bench',    weightKg: 65,  bodyweightKg: 62, age: 22 },
  { id: 'a2', date: '2025-06-05', lift: 'Bench',    weightKg: 70,  bodyweightKg: 61, age: 22 },
  { id: 'b1', date: '2025-03-12', lift: 'Squat',    weightKg: 150, bodyweightKg: 82, age: 24 },
  { id: 'b2', date: '2025-07-20', lift: 'Squat',    weightKg: 165, bodyweightKg: 83, age: 24 },
  { id: 'c1', date: '2025-02-18', lift: 'Deadlift', weightKg: 200, bodyweightKg: 84, age: 24 },
  { id: 'c2', date: '2025-08-29', lift: 'Deadlift', weightKg: 215, bodyweightKg: 84, age: 24 },
  { id: 'd1', date: '2025-05-14', lift: 'Overhead Press', weightKg: 60, bodyweightKg: 80, age: 24 },
];

/** ---- Helpers ---- */
function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }
function pct(n: number) { return `${Math.round(n)}%`; }
function estimatePercentile(lift: Lift, weightKg: number, bodyweightKg?: number) {
  const base: Record<Lift, number> = { Squat: 1.8, Bench: 1.25, Deadlift: 2.1, 'Overhead Press': 0.85 };
  const ratio = (weightKg || 0) / Math.max(bodyweightKg || 1, 1);
  const x = ratio / base[lift];
  const logistic = 1 / (1 + Math.exp(-4 * (x - 1)));
  return clamp(100 * logistic, 1, 99);
}

function Icon({ name, size = 16 }: { name: string; size?: number }) {
  const map: Record<string, string> = { video: '🎥', save: '💾', bolt: '⚡', up: '📈', user: '👤', chip: '🏷️' };
  return <ThemedText style={{ fontSize: size }}>{map[name] || '•'}</ThemedText>;
}

function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSel]}>
      <Icon name="chip" />
      <ThemedText style={{ marginLeft: 6, fontWeight: selected ? '700' : '500' }}>{label}</ThemedText>
    </Pressable>
  );
}

function ScatterChart({
  title, points, xLabel, yLabel, highlightLast = false,
}: {
  title: string;
  points: { x: number; y: number }[];
  xLabel: string;
  yLabel: string;
  highlightLast?: boolean;
}) {
  const [w, setW] = useState(0);
  const [h, setH] = useState(0);
  const pad = 12;

  const minX = Math.min(...points.map(p => p.x));
  const maxX = Math.max(...points.map(p => p.x));
  const minY = Math.min(...points.map(p => p.y));
  const maxY = Math.max(...points.map(p => p.y));
  const toPx = (p: { x: number; y: number }) => {
    const x = w <= 0 ? 0 : pad + ((p.x - minX) / Math.max(maxX - minX || 1, 1)) * (w - pad * 2);
    const y = h <= 0 ? 0 : (h - pad) - ((p.y - minY) / Math.max(maxY - minY || 1, 1)) * (h - pad * 2);
    return { x, y };
  };

  return (
    <View style={styles.card}>
      <ThemedText type="defaultSemiBold">{title}</ThemedText>
      <View
        style={styles.plot}
        onLayout={(e: LayoutChangeEvent) => {
          setW(e.nativeEvent.layout.width);
          setH(e.nativeEvent.layout.height);
        }}
      >
        <View style={[styles.axis, { left: pad, top: pad, bottom: pad }]} />
        <View style={[styles.axis, { left: pad, right: pad, bottom: pad }]} />
        {points.map((p, i) => {
          const { x, y } = toPx(p);
          const isLast = highlightLast && i === points.length - 1;
          return (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  left: x - (isLast ? 5 : 3),
                  top: y - (isLast ? 5 : 3),
                  width: isLast ? 10 : 6,
                  height: isLast ? 10 : 6,
                  borderRadius: isLast ? 5 : 3,
                  backgroundColor: isLast ? '#111' : '#666',
                },
              ]}
            />
          );
        })}
        <ThemedText style={[styles.axisLabel, { left: pad, top: 0 }]}>{yLabel}</ThemedText>
        <ThemedText style={[styles.axisLabel, { right: 0, bottom: 0 }]}>{xLabel}</ThemedText>
      </View>
    </View>
  );
}

export default function AddPRScreen() {
  const [lift, setLift] = useState<Lift>('Bench');
  const [weightKg, setWeightKg] = useState<string>('');
  const [bodyweightKg, setBodyweightKg] = useState<string>('');
  const [age, setAge] = useState<string>('');
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [selectedOld, setSelectedOld] = useState<OldPR | null>(null);
  const [oldForLift, setOldForLift] = useState<OldPR[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  const [result, setResult] = useState<null | {
    old?: OldPR; newWeight: number; deltaKg: number; oldPct?: number; newPct?: number; deltaPct?: number;
  }>(null);

  // Load history for selected lift from Supabase (falls back to local data if none)
  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoadingHistory(true);
      try {
        const userId = await getDevUserId(); // public read policy → no sign-in needed for SELECT
        const { data, error } = await supabase
          .from('lift_prs')
          .select('id, performed_at, lift, weight_kg, bodyweight_kg, age_at_lift')
          .eq('user_id', userId)
          .eq('lift', lift)
          .order('performed_at', { ascending: true })
          .limit(50);
        if (error) throw error;

        const mapped = (data || []).map((r: any) => ({
          id: r.id as string,
          date: (r.performed_at as string)?.slice(0, 10),
          lift: r.lift as Lift,
          weightKg: Number(r.weight_kg),
          bodyweightKg: r.bodyweight_kg != null ? Number(r.bodyweight_kg) : 0,
          age: r.age_at_lift != null ? Number(r.age_at_lift) : 0,
        })) as OldPR[];

        if (cancel) return;
        if (mapped.length === 0) {
          setOldForLift(FALLBACK.filter((h) => h.lift === lift).sort((a, b) => a.date.localeCompare(b.date)));
        } else {
          setOldForLift(mapped);
        }
        setSelectedOld(null);
      } catch {
        // If something goes wrong, still show fallback
        setOldForLift(FALLBACK.filter((h) => h.lift === lift).sort((a, b) => a.date.localeCompare(b.date)));
        setSelectedOld(null);
      } finally {
        if (!cancel) setLoadingHistory(false);
      }
    })();
    return () => { cancel = true; };
  }, [lift]);

  function selectOldPR(pr: OldPR) {
    setSelectedOld(pr);
    setWeightKg(String(pr.weightKg));
    setBodyweightKg(String(pr.bodyweightKg));
    setAge(String(pr.age));
  }

  const onAttachVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Media library permission is required to attach a video.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      selectionLimit: 1,
      quality: 0.8,
    });
    if (!res.canceled && res.assets?.length) {
      setVideoUri(res.assets[0].uri);
    }
  };

  async function uploadPRVideo(uri: string, userId: string): Promise<string> {
    // Read the file as base64 (works reliably on Android/iOS)
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });


    // Convert base64 -> Uint8Array (Supabase accepts ArrayBuffer/Uint8Array)
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);

    const fileName = `${userId}/${Date.now()}.mp4`;
    const { data, error } = await supabase
      .storage
      .from('pr-videos')
      .upload(fileName, bytes, {
        contentType: 'video/mp4',
        upsert: false,
      });

    if (error) throw error;

    const { data: pub } = supabase.storage.from('pr-videos').getPublicUrl(data.path);
    return pub.publicUrl;
  }


  async function onSave() {
    const w = parseFloat(weightKg) || 0;
    const bw = bodyweightKg ? parseFloat(bodyweightKg) : null;
    const a = age ? parseInt(age, 10) : null;

    if (!w || w <= 0) {
      alert('Please enter a valid lift weight (kg).');
      return;
    }

    setSaving(true);
    try {
      // ensure we’re authenticated as the dev user so RLS allows insert
      await devSignIn();
      const userId = await getDevUserId();

      // optional video upload
      let videoUrl: string | null = null;
      if (videoUri) {
        try {
          videoUrl = await uploadPRVideo(videoUri, userId);
        } catch (e: any) {
          console.warn('Video upload failed:', e?.message || e);
          alert('Could not upload video. Saving PR without video.');
        }
      }

      const performedAt = new Date().toISOString();

      // insert PR row
      await savePRRow({
        userId,
        lift,
        weightKg: w,
        bodyweightKg: bw,
        age: a,
        videoUrl,
        performedAt,
      });

      // update UI: recompute improvements + append to local history
      const old = selectedOld ?? oldForLift[oldForLift.length - 1];
      const oldW = old?.weightKg ?? 0;
      const deltaKg = w - oldW;
      const oldPct = old ? estimatePercentile(lift, old.weightKg, old.bodyweightKg) : undefined;
      const newPct = estimatePercentile(lift, w, bw ?? undefined);
      const deltaPct = (newPct ?? 0) - (oldPct ?? 0);
      setResult({ old, newWeight: w, deltaKg, oldPct, newPct, deltaPct });

      // append to local history so charts update without refetch
      const todayISO = performedAt.slice(0, 10);
      setOldForLift((cur) => [...cur, {
        id: `local-${Date.now()}`,
        date: todayISO,
        lift,
        weightKg: w,
        bodyweightKg: bw ?? 0,
        age: a ?? 0,
      }]);

      alert('Saved to Supabase!');
    } catch (e: any) {
      alert(`Save failed: ${e?.message || e}`);
    } finally {
      setSaving(false);
    }
  }

  const bwVsLift = useMemo(() => {
    const pts = oldForLift.map(h => ({ x: h.bodyweightKg, y: h.weightKg }));
    if (result) pts.push({ x: parseFloat(bodyweightKg) || 0, y: parseFloat(weightKg) || 0 });
    return pts;
  }, [oldForLift, result, bodyweightKg, weightKg]);

  const ageVsLift = useMemo(() => {
    const pts = oldForLift.map(h => ({ x: h.age, y: h.weightKg }));
    if (result) pts.push({ x: parseInt(age || '0', 10) || 0, y: parseFloat(weightKg) || 0 });
    return pts;
  }, [oldForLift, result, age, weightKg]);

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <ThemedText type="title">Add New PR</ThemedText>

        {/* Lift selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.liftRow}>
          {LIFTS.map((l) => (
            <Chip key={l} label={l} selected={lift === l} onPress={() => { setLift(l); setSelectedOld(null); setResult(null); }} />
          ))}
        </ScrollView>

        {/* Form */}
        <View style={styles.form}>
          <TextInput
            placeholder="Weight (kg)"
            keyboardType="decimal-pad"
            value={weightKg}
            onChangeText={setWeightKg}
            style={styles.input}
          />
          <TextInput
            placeholder="Bodyweight (kg)"
            keyboardType="decimal-pad"
            value={bodyweightKg}
            onChangeText={setBodyweightKg}
            style={styles.input}
          />
          <TextInput
            placeholder="Age"
            keyboardType="number-pad"
            value={age}
            onChangeText={setAge}
            style={styles.input}
          />

          {/* Attach video */}
          <Pressable onPress={onAttachVideo} style={styles.videoBtn}>
            <Icon name="video" />
            <ThemedText style={{ marginLeft: 8 }}>
              {videoUri ? 'Change attached video' : 'Attach video for verification'}
            </ThemedText>
          </Pressable>

          {/* Inline preview (optional) */}
          {videoUri && (
            <View style={{ marginTop: 8, borderRadius: 12, overflow: 'hidden' }}>
              <Video
                source={{ uri: videoUri }}
                style={{ width: '100%', height: 180 }}
                useNativeControls
                resizeMode={ResizeMode.COVER}
              />
            </View>
          )}

          {/* Save */}
          <Pressable onPress={saving ? undefined : onSave} style={styles.saveBtn}>
            {saving ? <ActivityIndicator /> : <Icon name="save" />}
            <ThemedText style={{ marginLeft: 8, fontWeight: '700' }}>
              {saving ? 'Saving…' : 'Save to Supabase'}
            </ThemedText>
          </Pressable>
        </View>

        {/* Old PR tabs */}
        <ThemedText type="defaultSemiBold" style={{ marginTop: 18 }}>Old PRs</ThemedText>
        {loadingHistory ? (
          <View style={{ paddingVertical: 10 }}>
            <ActivityIndicator />
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.oldRow}>
            {oldForLift.length === 0 ? (
              <ThemedText style={{ opacity: 0.7 }}>No previous PRs for {lift}</ThemedText>
            ) : (
              oldForLift.map((pr) => (
                <Pressable key={pr.id} onPress={() => selectOldPR(pr)} style={[styles.oldCard, selectedOld?.id === pr.id && styles.oldCardSel]}>
                  <ThemedText type="defaultSemiBold">{pr.weightKg} kg</ThemedText>
                  <ThemedText style={{ opacity: 0.7 }}>{pr.date}</ThemedText>
                  <ThemedText style={{ marginTop: 4 }}>BW {pr.bodyweightKg} • Age {pr.age}</ThemedText>
                  <ThemedText style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>(Tap to autofill)</ThemedText>
                </Pressable>
              ))
            )}
          </ScrollView>
        )}

        {/* Results */}
        {result && (
          <>
            <View style={[styles.card, { marginTop: 18 }]}>
              <ThemedText type="defaultSemiBold">Improvement Summary</ThemedText>
              <View style={styles.row}>
                <Icon name="bolt" />
                <ThemedText style={styles.rowText}>
                  Added <ThemedText type="defaultSemiBold">{result.deltaKg.toFixed(1)} kg</ThemedText> vs {result.old ? `${result.old.weightKg} kg (${result.old.date})` : 'previous PR'}
                </ThemedText>
              </View>
              <View style={styles.row}>
                <Icon name="up" />
                <ThemedText style={styles.rowText}>
                  People surpassed: {result.oldPct != null ? pct(result.oldPct) : '—'} → <ThemedText type="defaultSemiBold">{pct(result.newPct ?? 0)}</ThemedText>
                  {result.deltaPct != null && (<> (<ThemedText type="defaultSemiBold">+{Math.max(0, Math.round(result.deltaPct))} pp</ThemedText>)</>)}
                </ThemedText>
              </View>
              <View style={styles.row}>
                <Icon name="user" />
                <ThemedText style={styles.rowText}>
                  Strength ratio: {(((parseFloat(weightKg) || 0) / Math.max(parseFloat(bodyweightKg) || 1, 1))).toFixed(2)} (lift/BW)
                </ThemedText>
              </View>
            </View>

            <ScatterChart title="Bodyweight vs Lift weight" points={bwVsLift} xLabel="Bodyweight (kg)" yLabel="Lift (kg)" highlightLast />
            <ScatterChart title="Age vs Lift weight" points={ageVsLift} xLabel="Age (y)" yLabel="Lift (kg)" highlightLast />
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </ThemedView>
  );
}

/** ---- Styles ---- */
const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: Platform.select({ ios: 56, android: 36, default: 24 }) },
  scroll: { paddingHorizontal: 16, paddingBottom: 24 },
  liftRow: { gap: 8, marginTop: 12 },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#ccc',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    marginRight: 8, backgroundColor: '#fafafa',
  },
  chipSel: { backgroundColor: '#eaeaea', borderColor: '#bbb' },
  form: { marginTop: 14 },
  input: {
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#ccc',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10,
  },
  videoBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#ccc', backgroundColor: '#f7f7f7',
    marginBottom: 10,
  },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 12, backgroundColor: '#efefef',
  },
  oldRow: { gap: 10, paddingTop: 10, paddingBottom: 4 },
  oldCard: {
    minWidth: 150, padding: 12, borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#ddd', backgroundColor: '#fff',
  },
  oldCardSel: { borderColor: '#aaa', backgroundColor: '#f5f5f5' },
  card: {
    borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: '#ddd',
    padding: 12, marginTop: 12, backgroundColor: 'transparent', gap: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowText: { flexShrink: 1 },
  plot: {
    height: 180, marginTop: 10, borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#e3e3e3',
    position: 'relative', overflow: 'hidden', backgroundColor: '#fff',
  },
  axis: { position: 'absolute', backgroundColor: '#e5e5e5', width: 1, height: 1 },
  axisLabel: { position: 'absolute', fontSize: 10, opacity: 0.6, padding: 4 },
  dot: { position: 'absolute' },
});
