import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import type { Session } from '@supabase/supabase-js';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';

import { supabase } from '@/lib/supabase';
import { AppThemeProvider, useThemeContext } from '@/providers/theme-provider';

export const unstable_settings = { anchor: '(tabs)' };

function RootNavigator() {
  const { colorScheme } = useThemeContext();
  const router = useRouter();
  const segments = useSegments();
  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.warn('Failed to fetch auth session:', error.message ?? error);
        }
        setSession(data?.session ?? null);
        setCheckingSession(false);
      })
      .catch((error: any) => {
        if (!active) return;
        console.warn('Failed to fetch auth session:', error?.message || error);
        setSession(null);
        setCheckingSession(false);
      });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!active) return;
      setSession(newSession ?? null);
      setCheckingSession(false);
    });

    return () => {
      active = false;
      authListener?.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (checkingSession) return;
    const inAuthGroup = segments[0] === 'auth';
    if (!session && !inAuthGroup) {
      router.replace('/auth');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [checkingSession, router, segments, session]);

  const navigationTheme = useMemo(
    () => (colorScheme === 'dark' ? DarkTheme : DefaultTheme),
    [colorScheme]
  );


  return (
    <NavigationThemeProvider value={navigationTheme}>
      <Stack>

        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        <Stack.Screen name="user/[handle]" options={{ title: 'Athlete' }} />

      </Stack>
      <StatusBar style="auto" />
      {checkingSession ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: navigationTheme.colors.background,
          }}
        >
          <ActivityIndicator />
        </View>
      ) : null}
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <RootNavigator />
    </AppThemeProvider>
  );
}
