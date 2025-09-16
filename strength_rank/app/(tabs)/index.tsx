import React, { useMemo, useState, useEffect } from 'react';
import { Image } from 'expo-image';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  TextInput,
  View,
  FlatList,
  Pressable,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Link } from 'expo-router';

import { fetchHomeFeedFor, getDevUserId } from '@/lib/data';

/** ---------------- Types ---------------- */
type FeedItem = {
  id: string;
  user: { handle: string; name: string; avatar?: any };
  lift: 'Squat' | 'Bench' | 'Deadlift' | 'Overhead Press';
  weightKg: number;
  date: string;
  videoThumb?: any;
  stats: {
    surpassedPercent: number;
    progressionKgLast90d: number;
    bodyweightKg?: number;
  };
  verified: boolean;
};

/** ------------- MOCK fallback (used only if Supabase fetch fails) ------------- */
const MOCK: FeedItem[] = [
  {
    id: '1',
    user: { handle: '@mislav', name: 'Mislav', avatar: require('@/assets/images/icon.png') },
    lift: 'Deadlift',
    weightKg: 220,
    date: '2025-09-01',
    videoThumb: require('@/assets/images/partial-react-logo.png'),
    stats: { surpassedPercent: 86, progressionKgLast90d: 15, bodyweightKg: 84 },
    verified: true,
  },
  {
    id: '2',
    user: { handle: '@iva', name: 'Iva', avatar: require('@/assets/images/icon.png') },
    lift: 'Bench',
    weightKg: 72.5,
    date: '2025-09-03',
    videoThumb: require('@/assets/images/partial-react-logo.png'),
    stats: { surpassedPercent: 68, progressionKgLast90d: 7.5, bodyweightKg: 60 },
    verified: false,
  },
];

/** ---------------- Component ---------------- */
export default function HomeScreen() {
  const [query, setQuery] = useState('');
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const userId = await getDevUserId();
        const rows: any[] = await fetchHomeFeedFor(userId, 30);
        if (cancelled) return;

        // Map Supabase rows -> FeedItem
        const mapped: FeedItem[] = (rows || []).map((r) => ({
          id: r.id,
          user: {
            handle: r.profiles?.handle ?? '@unknown',
            name: r.profiles?.full_name ?? 'Unknown',
            avatar: r.profiles?.avatar_url
              ? { uri: r.profiles.avatar_url }
              : require('@/assets/images/icon.png'),
          },
          lift: r.lift,
          weightKg: Number(r.weight_kg),
          date: r.performed_at,
          videoThumb: require('@/assets/images/partial-react-logo.png'), // swap to real thumbnail or <Video> later
          stats: {
            surpassedPercent: 0, // placeholder until you have a real percentile
            progressionKgLast90d: 0, // placeholder
            bodyweightKg: r.bodyweight_kg != null ? Number(r.bodyweight_kg) : undefined,
          },
          verified: r.verify !== 'unverified',
        }));

        setFeed(mapped);
      } catch (e) {
        // Fallback to mock if Supabase isn’t ready yet
        setFeed(MOCK);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Build search suggestions from current feed
  const filtered = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const unique = new Map<string, { handle: string; name: string }>();
    for (const m of feed) unique.set(m.user.handle, { handle: m.user.handle, name: m.user.name });
    return [...unique.values()].filter(
      (u) => u.name.toLowerCase().includes(q) || u.handle.toLowerCase().includes(q)
    );
  }, [query, feed]);

  return (
    <ThemedView style={styles.screen}>
      {/* Header */}
      <ThemedView style={styles.header}>
        <ThemedText type="title">Strength Rank</ThemedText>
      </ThemedView>

      {/* Search */}
      <View style={styles.searchRow}>
        <IonIcon name="search" size={18} />
        <TextInput
          placeholder="Search..."
          value={query}
          onChangeText={setQuery}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

      {/* Search results */}
      {query.length > 0 && (
        <View style={styles.searchResults}>
          {filtered.length === 0 ? (
            <ThemedText style={{ padding: 10 }}>No matches</ThemedText>
          ) : (
            filtered.map((u) => (
              <Link key={u.handle} href="/profile" asChild>
                <Pressable style={styles.searchResultItem}>
                  <IonIcon name="person-circle" size={22} />
                  <ThemedText>
                    {u.name} <ThemedText type="defaultSemiBold">{u.handle}</ThemedText>
                  </ThemedText>
                </Pressable>
              </Link>
            ))
          )}
        </View>
      )}

      {/* Feed */}
      {loading ? (
        <View style={{ paddingTop: 24 }}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={feed}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => <PostCard item={item} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <ThemedText style={{ textAlign: 'center', marginTop: 24 }}>
              No posts yet.
            </ThemedText>
          }
        />
      )}
    </ThemedView>
  );
}

/** SMALL inline icon helper to avoid extra deps setup */
function IonIcon({
  name,
  size = 18,
  color = '#666',
}: {
  name: any;
  size?: number;
  color?: string;
}) {
  const map: Record<string, string> = {
    search: '🔍',
    'person-circle': '👤',
    'checkmark-circle': '✅',
    'close-circle': '⭕',
    play: '▶️',
    time: '⏱️',
    trending: '📈',
  };
  return <ThemedText style={{ fontSize: size, color }}>{map[name] || '•'}</ThemedText>;
}

function PostCard({ item }: { item: FeedItem }) {
  return (
    <ThemedView style={styles.card}>
      {/* Header row */}
      <View style={styles.cardHeader}>
        <Image source={item.user.avatar} style={styles.avatar} />
        <View style={{ flex: 1 }}>
          <ThemedText type="defaultSemiBold">{item.user.name}</ThemedText>
          <ThemedText style={{ opacity: 0.7 }}>{item.user.handle}</ThemedText>
        </View>
        <View style={styles.verifyPill}>
          <IonIcon name={item.verified ? 'checkmark-circle' : 'close-circle'} />
          <ThemedText style={{ marginLeft: 4 }}>
            {item.verified ? 'Verified' : 'Unverified'}
          </ThemedText>
        </View>
      </View>

      {/* Media + Stats */}
      <View style={styles.mediaRow}>
        <View style={styles.videoWrap}>
          <Image source={item.videoThumb} style={styles.video} contentFit="cover" />
          <View style={styles.playOverlay}>
            <IonIcon name="play" size={24} color="#fff" />
          </View>
        </View>

        <View style={styles.statsBox}>
          <ThemedText type="defaultSemiBold">
            {item.lift} • {item.weightKg} kg
          </ThemedText>
          <View style={styles.statRow}>
            <IonIcon name="trending" />
            <ThemedText style={styles.statText}>
              Surpassed{' '}
              <ThemedText type="defaultSemiBold">
                {item.stats.surpassedPercent}%
              </ThemedText>{' '}
              of lifters
            </ThemedText>
          </View>
          <View style={styles.statRow}>
            <IonIcon name="time" />
            <ThemedText style={styles.statText}>
              +{item.stats.progressionKgLast90d} kg (last 90d)
            </ThemedText>
          </View>
          {item.stats.bodyweightKg ? (
            <ThemedText style={{ opacity: 0.7 }}>
              BW: {item.stats.bodyweightKg} kg • {new Date(item.date).toDateString()}
            </ThemedText>
          ) : null}
        </View>
      </View>

      {/* Actions row (placeholder) */}
      <View style={styles.actions}>
        <Pressable style={styles.actionBtn}>
          <ThemedText>Like</ThemedText>
        </Pressable>
        <Pressable style={styles.actionBtn}>
          <ThemedText>Comment</ThemedText>
        </Pressable>
        <Pressable style={styles.actionBtn}>
          <ThemedText>Share</ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

/** ---------------- Styles ---------------- */
const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: Platform.select({ ios: 56, android: 50, default: 50 }) },
  header: { paddingHorizontal: 16, paddingBottom: 8 },
  searchRow: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ccc',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: { flex: 1, paddingVertical: 0, fontSize: 16 },
  searchResults: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e3e3e3',
    overflow: 'hidden',
  },
  searchResultItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  listContent: { padding: 16, paddingBottom: 40 },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#eee' },
  verifyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
  },
  mediaRow: {
    flexDirection: 'row',
    gap: 10,
  },
  videoWrap: { flex: 3, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  video: { width: '100%', height: 180, backgroundColor: '#fafafa' },
  playOverlay: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  statsBox: {
    flex: 2,
    padding: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#eee',
    gap: 8,
    justifyContent: 'center',
  },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statText: { fontSize: 14 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 2 },
  actionBtn: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#f6f6f6' },
});
