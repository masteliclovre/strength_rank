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
import * as Location from 'expo-location';
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
  const [recentGyms, setRecentGyms] = useState<Gym[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(
    null
  );
  const [locationPrompt, setLocationPrompt] = useState<string | null>(null);

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

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== Location.PermissionStatus.GRANTED) {
          if (!cancelled) {
            setLocationPrompt('Enable location to find gyms near you.');
          }
          return;
        }

        const latestLocation = await Location.getCurrentPositionAsync({});
        if (cancelled) return;

        const coords = {
          latitude: latestLocation.coords.latitude,
          longitude: latestLocation.coords.longitude,
        };

        setUserLocation(coords);
        setLocationPrompt(null);
        mapRef.current?.animateToRegion(
          {
            ...coords,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          },
          450
        );
      } catch {
        if (!cancelled) {
          setLocationPrompt('Unable to fetch location right now.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const normalizeText = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, ' ')
      .trim()
      .toLowerCase();

  const distanceBetween = (a: { latitude: number; longitude: number }, b: Gym) => {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const R = 6371; // km
    const dLat = toRad(b.lat - a.latitude);
    const dLon = toRad(b.lng - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.lat);

    const haversine =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
    return R * c;
  };

  const filteredGyms = useMemo(() => {
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) {
      if (!userLocation) return gyms;
      return [...gyms].sort((a, b) => distanceBetween(userLocation, a) - distanceBetween(userLocation, b));
    }

    const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);

    const filtered = gyms.filter((g) => {
      const searchableText = `${normalizeText(g.name)} ${normalizeText(g.city || '')}`.trim();

      if (!searchableText) return false;

      return queryTokens.every((token) => searchableText.includes(token));
    });

    if (!userLocation) return filtered;

    return filtered.sort(
      (a, b) => distanceBetween(userLocation, a) - distanceBetween(userLocation, b)
    );
  }, [gyms, query, userLocation]);

  const selectedGym = useMemo(
    () => gyms.find((g) => g.id === selectedGymId) || null,
    [gyms, selectedGymId]
  );

  const centerOnGym = (g: Gym) => {
    Keyboard.dismiss();
    setSelectedGymId(g.id);
    setRecentGyms((prev) => {
      const cleaned = prev.filter((item) => item.id !== g.id);
      return [g, ...cleaned].slice(0, 10);
    });
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

  const openProfileFromHandle = (handle: string) => {
    const sanitized = handle.replace(/^@/, '');
    if (!sanitized) return;
    router.push({ pathname: '/user/[handle]', params: { handle: sanitized } });
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
          {userLocation && (
            <Marker
              coordinate={userLocation}
              title="You are here"
              pinColor="dodgerblue"
            />
          )}
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
      {locationPrompt && (
        <ThemedText style={{ textAlign: 'center', marginTop: 8, opacity: 0.7 }}>
          {locationPrompt}
        </ThemedText>
      )}

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
              <Pressable
                key={s.handle}
                onPress={() => openProfileFromHandle(s.handle)}
                style={({ pressed }) => [
                  styles.streakCard,
                  you && styles.streakCardYou,
                  pressed && styles.streakCardPressed,
                ]}
              >
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
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Recently searched gyms */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <ThemedText style={{ marginRight: 6 }}>🧭</ThemedText>
          <ThemedText type="defaultSemiBold">Recently searched gyms</ThemedText>
        </View>

        {recentGyms.length === 0 ? (
          <ThemedText style={{ opacity: 0.6 }}>Search for a gym to see it here.</ThemedText>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recentRow}
          >
            {recentGyms.map((gym) => (
              <Pressable
                key={gym.id}
                onPress={() => centerOnGym(gym)}
                style={({ pressed }) => [styles.recentCard, pressed && styles.recentCardPressed]}
              >
                <ThemedText type="defaultSemiBold" numberOfLines={1}>
                  {gym.name}
                </ThemedText>
                {gym.city ? (
                  <ThemedText style={{ opacity: 0.6 }} numberOfLines={1}>
                    {gym.city}
                  </ThemedText>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        )}
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
    alignItems: 'center',
  },
  streakCardPressed: { opacity: 0.75 },
  streakCardYou: { borderColor: '#bbb', backgroundColor: '#f5f5f5' },
  recentRow: { gap: 10, paddingRight: 4 },
  recentCard: {
    minWidth: 140,
    maxWidth: 200,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  recentCardPressed: { opacity: 0.75 },
});
