// lib/debug.ts
import { SUPABASE_URL } from './supabase';

export async function runSupabaseDiagnostics() {
  const out: string[] = [];
  out.push(`SUPABASE_URL: ${SUPABASE_URL}`);

  // A. Plain connectivity (should return 204)
  try {
    const r = await fetch('https://google.com/generate_204');
    out.push(`google 204: ${r.status}`);
  } catch (e: any) {
    out.push(`google 204 failed: ${e?.message || e}`);
  }

  // B. Supabase health (200)
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/health`);
    out.push(`supabase health: ${r.status}`);
  } catch (e: any) {
    out.push(`supabase health failed: ${e?.message || e}`);
  }

  // C. Date/time (SSL fails if device clock is off)
  try {
    out.push(`device time: ${new Date().toISOString()}`);
  } catch {}

  alert(out.join('\n'));
}
