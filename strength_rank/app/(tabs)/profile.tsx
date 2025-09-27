import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

import { supabase } from '@/lib/supabase';
import { devSignIn, fetchCurrentStreak, fetchProfileAndCurrentPRs, getDevUserId } from '@/lib/data';
import type { Lift } from '@/lib/data';

import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { decode as atob } from 'base-64';

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
    edit: '✏️',
    total: '➕',
    ratio: '📈',
    streak: '🔥',
  };
  return <ThemedText style={{ fontSize: size }}>{map[name] || '•'}</ThemedText>;
}

function FieldRow({ label, value, icon }: { label: string; value?: string | number; icon?: string }) {
  return (
    <View style={styles.fieldRow}>
      <View style={{ width: 22 }}>{icon ? <Icon name={icon} /> : null}</View>
      <ThemedText style={styles.fieldLabel}>{label}</ThemedText>
      <ThemedText style={styles.fieldValue}>{value ?? '—'}</ThemedText>
    </View>
  );
}

function PRRow({ lift, kg }: { lift: Lift; kg?: number }) {
  return (
    <View style={styles.prRow}>
      <ThemedText type="defaultSemiBold" style={{ width: 140 }}>
        {lift}
      </ThemedText>
      <ThemedText>{kg != null ? `${kg} kg` : '—'}</ThemedText>
    </View>
  );
}

export default function ProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileView>({
    name: 'Loading…',
    handle: '@you',
    prs: { Squat: undefined, Bench: undefined, Deadlift: undefined, 'Overhead Press': undefined },
    avatarUri: null,
  });
  const [streakDays, setStreakDays] = useState(0);

  // Load profile + current PRs
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const userId = await getDevUserId();
        const [{ profile: p, prs }, streak] = await Promise.all([
          fetchProfileAndCurrentPRs(userId),
          fetchCurrentStreak(userId),
        ]);

        const prsRecord: Record<Lift, number | undefined> = {
          Squat: undefined,
          Bench: undefined,
          Deadlift: undefined,
          'Overhead Press': undefined,
        };
        (prs || []).forEach((row: any) => {
          if (LIFTS.includes(row.lift)) {
            prsRecord[row.lift as Lift] = Number(row.weight_kg);
          }
        });

        const mapped: ProfileView = {
          name: p?.full_name ?? 'Unknown',
          handle: p?.handle ?? '@unknown',
          email: p?.email_public ?? undefined,
          age: p?.age ?? undefined,
          gender: p?.gender ?? undefined,
          bodyweightKg: p?.bodyweight_kg ?? undefined,
          heightCm: p?.height_cm ?? undefined,
          location: p?.location ?? undefined,
          gym: p?.gym?.name ?? undefined,
          joinedISO: p?.joined_at ?? undefined,
          prs: prsRecord,
          avatarUri: p?.avatar_url ?? null,
        };

        if (!cancel) {
          setProfile(mapped);
          setStreakDays(streak);
        }
      } catch (e: any) {
        console.warn('Profile load failed:', e?.message || e);
        alert(`Profile load failed:\n${e?.message || e}`);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const total = useMemo(() => LIFTS.reduce((sum, l) => sum + (profile.prs[l] ?? 0), 0), [profile.prs]);
  const totalRatio = useMemo(
    () => (profile.bodyweightKg ? total / profile.bodyweightKg : 0),
    [total, profile.bodyweightKg]
  );

  const avatarSrc = profile.avatarUri ? { uri: profile.avatarUri } : require('@/assets/images/icon.png');

  const base64ToBytes = (b64: string) => {
    const bin = atob(b64);
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  };

  const onChangeAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        alert('Media library permission is required to change your avatar.');
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        selectionLimit: 1,
      });
      if (res.canceled || !res.assets?.length) return;

      const asset = res.assets[0];
      const localUri = asset.uri;

      // Optimistic local preview
      setProfile((cur) => ({ ...cur, avatarUri: localUri }));

      // Upload to Supabase
      try {
        await devSignIn();
        const userId = await getDevUserId();

        const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: 'base64' as any });
        const bytes = base64ToBytes(base64);

        const ext =
          (asset.fileName && asset.fileName.split('.').pop()) || (asset.mimeType?.split('/')[1]) || 'jpg';
        const mime = asset.mimeType || (ext === 'png' ? 'image/png' : 'image/jpeg');

        const path = `${userId}/${Date.now()}.${ext}`;
        const { data: up, error: upErr } = await supabase.storage.from('avatars').upload(path, bytes, {
          contentType: mime,
          upsert: true,
        });
        if (upErr) throw upErr;

        const { data: pub } = await supabase.storage.from('avatars').getPublicUrl(up.path);
        const publicUrl = pub.publicUrl;

        const { error: updErr } = await supabase
          .from('profiles')
          .update({ avatar_url: publicUrl })
          .eq('handle', profile.handle);
        if (updErr) throw updErr;

        setProfile((cur) => ({ ...cur, avatarUri: publicUrl }));
      } catch (e: any) {
        console.warn('Avatar upload failed:', e?.message || e);
        alert('Could not upload avatar. Showing it locally only.');
      }
    } catch (e: any) {
      console.warn('Picker error:', e?.message || e);
      // ⬇️ IMPORTANT: no back-ticks in this string to avoid breaking the JS parser
      alert(
        "Image Picker isn't available in this build. If you're using Expo Go, run npx expo install expo-image-picker and then restart with npx expo start -c."
      );
    }
  };

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header: avatar + name/handle */}
        <View style={styles.header}>
          <View style={styles.avatarWrap}>
            <Image source={avatarSrc} style={styles.avatar} contentFit="cover" />
            <Pressable style={styles.editBadge} onPress={onChangeAvatar}>
              <Icon name="edit" size={12} />
              <ThemedText style={{ marginLeft: 4, fontSize: 12 }}>Edit</ThemedText>
            </Pressable>
          </View>

          <View style={{ alignItems: 'center', marginTop: 10 }}>
            <ThemedText type="title">{profile.name}</ThemedText>
            <ThemedText style={{ opacity: 0.7 }}>{profile.handle}</ThemedText>
          </View>

          {/* Quick summary */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Icon name="total" />
              <ThemedText style={styles.summaryValue}>{total} kg</ThemedText>
              <ThemedText style={styles.summaryLabel}>Total</ThemedText>
            </View>
            <View style={styles.summaryItem}>
              <Icon name="ratio" />
              <ThemedText style={styles.summaryValue}>{totalRatio.toFixed(2)}</ThemedText>
              <ThemedText style={styles.summaryLabel}>Total / BW</ThemedText>
            </View>
          </View>
        </View>

        {/* Loading / Info */}
        {loading ? (
          <View style={{ paddingVertical: 20 }}>
            <ActivityIndicator />
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <ThemedText type="defaultSemiBold">Public Info</ThemedText>
              <FieldRow label="Email" value={profile.email} icon="email" />
              <FieldRow label="Age" value={profile.age} icon="age" />
              <FieldRow label="Gender" value={profile.gender} icon="gender" />
              <FieldRow
                label="Bodyweight"
                value={profile.bodyweightKg ? `${profile.bodyweightKg} kg` : undefined}
                icon="weight"
              />
              <FieldRow
                label="Height"
                value={profile.heightCm ? `${profile.heightCm} cm` : undefined}
                icon="height"
              />
              <FieldRow label="Location" value={profile.location} icon="location" />
              <FieldRow label="Gym" value={profile.gym} icon="gym" />
              <FieldRow
                label="Consistency streak"
                value={
                  streakDays > 0
                    ? `${streakDays} day${streakDays === 1 ? '' : 's'}`
                    : undefined
                }
                icon="streak"
              />
              <FieldRow
                label="Joined"
                value={profile.joinedISO ? new Date(profile.joinedISO).toDateString() : undefined}
                icon="joined"
              />
            </View>

            <View style={styles.card}>
              <ThemedText type="defaultSemiBold">PR Lifts</ThemedText>
              {LIFTS.map((l) => (
                <PRRow key={l} lift={l} kg={profile.prs[l]} />
              ))}
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </ThemedView>
  );
}

const AVATAR_SIZE = 108;

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: Platform.select({ ios: 56, android: 36, default: 24 }) },
  scroll: { paddingHorizontal: 16, paddingBottom: 24 },

  header: { alignItems: 'center', marginBottom: 10 },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
    backgroundColor: '#eee',
  },
  editBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
    backgroundColor: '#f7f7f7',
  },

  summaryRow: { marginTop: 12, flexDirection: 'row', gap: 10 },
  summaryItem: {
    minWidth: 120,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e3e3e3',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  summaryValue: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  summaryLabel: { opacity: 0.7 },

  card: {
    marginTop: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
    padding: 12,
    gap: 8,
    backgroundColor: 'transparent',
  },
  fieldRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  fieldLabel: { width: 110, opacity: 0.7 },
  fieldValue: { flex: 1, textAlign: 'right' },

  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
});
