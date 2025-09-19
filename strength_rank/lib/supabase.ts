// lib/supabase.ts
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

// ⬇️ paste your real values from Supabase → Settings → API
export const SUPABASE_URL = 'https://oufakcckiuqoaavozmuw.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91ZmFrY2NraXVxb2Fhdm96bXV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5MzAyMjQsImV4cCI6MjA3MzUwNjIyNH0.4aQJflzz0ylWHgC-9wHjl-i75gBSraUnnwiP7zWOgHE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
auth: {
persistSession: true,
autoRefreshToken: true,
detectSessionInUrl: false, // RN/Expo
},
});
