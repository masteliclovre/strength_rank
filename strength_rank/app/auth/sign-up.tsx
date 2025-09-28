import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Link } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useThemeContext } from '@/providers/theme-provider';

export default function SignUpScreen() {
  const { colorScheme } = useThemeContext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const themeColors = Colors[colorScheme];
  const borderColor = colorScheme === 'dark' ? '#3f3f46' : '#d4d4d8';
  const inputBackground = colorScheme === 'dark' ? '#1f1f23' : '#f9fafb';

  const handleSignUp = useCallback(async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password || !confirmPassword) {
      setErrorMessage('Fill in all fields to continue.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);
      setInfoMessage(null);
      const { error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
      });
      if (error) {
        setErrorMessage(error.message ?? 'Could not create your account.');
      } else {
        setInfoMessage('Check your email for a confirmation link to finish signing up.');
      }
    } catch (error: any) {
      setErrorMessage(error?.message || 'Could not create your account.');
    } finally {
      setLoading(false);
    }
  }, [confirmPassword, email, password]);

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', default: undefined })}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <ThemedText type="title">Create your account</ThemedText>
            <ThemedText style={styles.subtitle}>Join Strength Rank and start tracking your lifts.</ThemedText>
          </View>

          <View style={styles.form}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colorScheme === 'dark' ? '#71717a' : '#a1a1aa'}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              style={[
                styles.input,
                {
                  backgroundColor: inputBackground,
                  borderColor,
                  color: themeColors.text,
                },
              ]}
              editable={!loading}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus?.()}
            />
            <TextInput
              ref={passwordRef}
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={colorScheme === 'dark' ? '#71717a' : '#a1a1aa'}
              secureTextEntry
              textContentType="newPassword"
              style={[
                styles.input,
                {
                  backgroundColor: inputBackground,
                  borderColor,
                  color: themeColors.text,
                },
              ]}
              editable={!loading}
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus?.()}
            />
            <TextInput
              ref={confirmRef}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm password"
              placeholderTextColor={colorScheme === 'dark' ? '#71717a' : '#a1a1aa'}
              secureTextEntry
              textContentType="password"
              style={[
                styles.input,
                {
                  backgroundColor: inputBackground,
                  borderColor,
                  color: themeColors.text,
                },
              ]}
              editable={!loading}
              returnKeyType="done"
              onSubmitEditing={() => {
                if (!loading) handleSignUp();
              }}
            />

            {errorMessage ? <ThemedText style={styles.error}>{errorMessage}</ThemedText> : null}
            {infoMessage ? <ThemedText style={styles.info}>{infoMessage}</ThemedText> : null}

            <Pressable
              accessibilityRole="button"
              onPress={handleSignUp}
              style={[styles.primaryButton, { backgroundColor: themeColors.tint }]}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.primaryButtonText}>Sign up</ThemedText>
              )}
            </Pressable>
          </View>

          <View style={styles.footer}>
            <ThemedText style={styles.footerText}>Already have an account?</ThemedText>
            <Link href="/auth" replace style={[styles.footerLink, { color: themeColors.tint }]}>Sign in</Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: Platform.select({ ios: 60, android: 40, default: 32 }) },
  scroll: { flexGrow: 1, justifyContent: 'space-between' },
  header: { gap: 8 },
  subtitle: { opacity: 0.7 },
  form: { marginTop: 32, gap: 16 },
  input: {
    paddingHorizontal: 16,
    paddingVertical: Platform.select({ ios: 14, android: 10, default: 12 }),
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
  },
  error: {
    color: '#ef4444',
    textAlign: 'center',
  },
  info: {
    color: '#22c55e',
    textAlign: 'center',
  },
  primaryButton: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  footer: {
    marginTop: 32,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    alignItems: 'center',
  },
  footerText: { opacity: 0.7 },
  footerLink: { fontWeight: '600' },
});
