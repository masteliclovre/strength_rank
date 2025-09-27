// app/(tabs)/index.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import MapView, { Callout, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';

type Gym = { id: string; name: string; city?: string | null; lat: number; lng: number };

const STREAKS = [
  { handle: '@toni', name: 'Toni', days: 23 },
  { handle: '@iva', name: 'Iva', days: 19 },
  { handle: '@you', name: 'You', days: 17 },
  { handle: '@mislav', name: 'Mislav', days: 15 },
  { handle: '@eva', name: 'Eva', days: 12 },
];

const youIndex = STREAKS.findIndex((s) => s.handle === '@you');
const streakScrollRef = React.createRef<ScrollView>();

export default function HomeScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView | null>(null);

  const [gyms, setGyms] = useState<Gym[]>([]);
  const [query, setQuery] = useState('');
  const [selectedGymId, setSelectedGymId] = useState<string | null>(null);

  // Load gyms
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('gyms')
          .select('id, name, city, lat, lng')
          .not('lat', 'is', null)
          .not('lng', 'is', null)
          .order('name', { ascending: true })
          .limit(2000);

        if (error) throw error;

        const rows =
          (data || [])
            .filter((g: any) => g.lat != null && g.lng != null)
            .map((g: any) => ({
              id: g.id,
              name: g.name,
              city: g.city,
              lat: Number(g.lat),
              lng: Number(g.lng),
            })) as Gym[];

        if (!cancel) setGyms(rows);
      } catch {
        if (!cancel) setGyms([]);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const filteredGyms = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return gyms;
    return gyms.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        (g.city || '').toLowerCase().includes(q)
    );
  }, [gyms, query]);

  const selectedGym = useMemo(
    () => gyms.find((g) => g.id === selectedGymId) || null,
    [gyms, selectedGymId]
  );

  const centerOnGym = (g: Gym) => {
    Keyboard.dismiss();
    setSelectedGymId(g.id);
    mapRef.current?.animateToRegion(
      {
        latitude: g.lat,
        longitude: g.lng,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      450
    );
  };

  const openLeaderboard = (g: Gym) => {
    router.push({
      pathname: '/(tabs)/leaderboard',
      params: { gymId: g.id, gymName: g.name },
    });
  };

  // Everything except the search results goes in the header of the FlatList
  const Header = (
    <View>
      {/* Brand header */}
      <View style={styles.header}>
        <Image
          source={require('@/assets/images/logo.png')}
          style={styles.logo}
          contentFit="contain"
        />
        <ThemedText type="title" style={styles.headerTitle}>
          Strength Rank
        </ThemedText>
      </View>

      {/* Map */}
      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={{
            latitude: 44.7,
            longitude: 16.3,
            latitudeDelta: 5,
            longitudeDelta: 5,
          }}
        >
          {gyms.map((g) => (
            <Marker
              key={g.id}
              coordinate={{ latitude: g.lat, longitude: g.lng }}
              title={g.name}
              onPress={() => setSelectedGymId(g.id)}
              pinColor="red"
            >
              <Callout onPress={() => centerOnGym(g)}>
                <ThemedText type="defaultSemiBold">{g.name}</ThemedText>
                <ThemedText style={{ opacity: 0.7 }}>{g.city}</ThemedText>
                <ThemedText style={{ marginTop: 4 }}>Tap to focus</ThemedText>
              </Callout>
            </Marker>
          ))}
        </MapView>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <ThemedText style={{ opacity: 0.7, marginRight: 6 }}>🔎</ThemedText>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search gyms (name or city)…"
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

      {/* Selected gym card */}
      {selectedGym && (
        <View style={styles.card}>
          <ThemedText type="defaultSemiBold">{selectedGym.name}</ThemedText>
          <ThemedText style={{ opacity: 0.7 }}>{selectedGym.city}</ThemedText>
          <Pressable
            style={[styles.btn, { marginTop: 10 }]}
            onPress={() => openLeaderboard(selectedGym)}
          >
            <ThemedText style={{ fontWeight: '700' }}>Open leaderboard</ThemedText>
            <ThemedText style={{ marginLeft: 6, opacity: 0.7 }}>
              ({selectedGym.name})
            </ThemedText>
          </Pressable>
        </View>
      )}

      {/* Streaks (horizontal scroll is fine) */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <ThemedText style={{ marginRight: 6 }}>🔥</ThemedText>
          <ThemedText type="defaultSemiBold">Consistency streaks</ThemedText>
        </View>

        <ScrollView
          ref={streakScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.streakRow}
          onContentSizeChange={() => {
            if (youIndex > -1) {
              const cardW = 120;
              const gap = 10;
              const pad = 16;
              const x =
                Math.max(
                  0,
                  youIndex * (cardW + gap) - Dimensions.get('window').width / 2 + cardW / 2
                ) + pad;
              (streakScrollRef.current as any)?.scrollTo?.({ x, animated: true });
            }
          }}
        >
          {STREAKS.map((s) => {
            const you = s.handle === '@you';
            return (
              <View key={s.handle} style={[styles.streakCard, you && styles.streakCardYou]}>
                <ThemedText type="defaultSemiBold" style={{ textAlign: 'center' }}>
                  {s.name}
                </ThemedText>
                <ThemedText style={{ textAlign: 'center', opacity: 0.6 }}>
                  {s.handle}
                </ThemedText>
                <ThemedText
                  style={{ textAlign: 'center', marginTop: 8, fontSize: 18, fontWeight: '700' }}
                >
                  {s.days} days
                </ThemedText>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );

  return (
    <ThemedView style={styles.screen}>
      <FlatList
        data={query.length > 0 ? filteredGyms : []} // search results list
        keyExtractor={(g) => g.id}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => centerOnGym(item)}>
            <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
            <ThemedText style={{ opacity: 0.6 }}>{item.city}</ThemedText>
          </Pressable>
        )}
        ListHeaderComponent={Header}
        contentContainerStyle={{ paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: Platform.select({ ios: 56, android: 36, default: 24 }) },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 8,
    marginTop: 10,
  },
  logo: { width: 36, height: 36, borderRadius: 8, backgroundColor: 'transparent' },
  headerTitle: { fontSize: 22 },

  mapWrap: { height: 220, marginHorizontal: 12, borderRadius: 16, overflow: 'hidden' },
  map: { ...StyleSheet.absoluteFillObject },

  searchRow: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ccc',
    backgroundColor: '#fff',
  },
  searchInput: { flex: 1, paddingVertical: 0, fontSize: 16 },

  card: {
    marginTop: 10,
    marginHorizontal: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
    backgroundColor: 'transparent',
    padding: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },

  row: {
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 12,
  },

  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#efefef',
    alignSelf: 'flex-start',
  },

  streakRow: { paddingHorizontal: 4, gap: 10 },
  streakCard: {
    width: 120,
    padding: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  streakCardYou: { borderColor: '#bbb', backgroundColor: '#f5f5f5' },
});
