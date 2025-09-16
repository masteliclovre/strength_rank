// scripts/seed.ts
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(url, service);

type Lift = 'Squat'|'Bench'|'Deadlift'|'Overhead Press';

const lifters = [
{ email:'you@example.com',    password:'password', full_name:'You',    handle:'@you',    gender:'Male',   age:24, bw:84,  gym:'G4Y',         loc:'Split' },
{ email:'mislav@example.com', password:'password', full_name:'Mislav', handle:'@mislav', gender:'Male',   age:26, bw:82,  gym:'G4Y',         loc:'Split' },
{ email:'iva@example.com',    password:'password', full_name:'Iva',    handle:'@iva',    gender:'Female', age:23, bw:60,  gym:'G4Y',         loc:'Split' },
{ email:'marko@example.com',  password:'password', full_name:'Marko',  handle:'@marko',  gender:'Male',   age:28, bw:90,  gym:'Split Iron',  loc:'Split' },
{ email:'ana@example.com',    password:'password', full_name:'Ana',    handle:'@ana',    gender:'Female', age:29, bw:65,  gym:'Split Iron',  loc:'Split' },
{ email:'petar@example.com',  password:'password', full_name:'Petar',  handle:'@petar',  gender:'Male',   age:21, bw:76,  gym:'Zg Barbell',  loc:'Zagreb' },
{ email:'lea@example.com',    password:'password', full_name:'Lea',    handle:'@lea',    gender:'Female', age:31, bw:58,  gym:'Zg Barbell',  loc:'Zagreb' },
{ email:'toni@example.com',   password:'password', full_name:'Toni',   handle:'@toni',   gender:'Male',   age:35, bw:100, gym:'G4Y',         loc:'Split' },
{ email:'eva@example.com',    password:'password', full_name:'Eva',    handle:'@eva',    gender:'Female', age:27, bw:63,  gym:'G4Y',         loc:'Split' },
] as const;

const prMap: Record<string, Partial<Record<Lift, number>>> = {
'@you':   { Squat:165, Bench:70,  Deadlift:215, 'Overhead Press':60 },
'@mislav':{ Squat:175, Bench:115, Deadlift:220, 'Overhead Press':70 },
'@iva':   { Squat:130, Bench:72.5,Deadlift:160, 'Overhead Press':45 },
'@marko': { Squat:190, Bench:120, Deadlift:240, 'Overhead Press':80 },
'@ana':   { Squat:140, Bench:75,  Deadlift:175, 'Overhead Press':50 },
'@petar': { Squat:165, Bench:105, Deadlift:210, 'Overhead Press':60 },
'@lea':   { Squat:125, Bench:67.5,Deadlift:165, 'Overhead Press':42.5 },
'@toni':  { Squat:210, Bench:135, Deadlift:260, 'Overhead Press':90 },
'@eva':   { Squat:135, Bench:80,  Deadlift:170, 'Overhead Press':47.5 },
};

async function main() {
  // gyms
  const gyms = ['G4Y','Split Iron','Zg Barbell'];
  const gymIds: Record<string,string> = {};
  for (const g of gyms) {
    const { data } = await admin.from('gyms')
      .upsert({ name:g, city: g==='Zg Barbell' ? 'Zagreb':'Split', country:'Croatia' })
      .select('id,name').single();
    if (data) gymIds[g] = data.id;
  }

  // users + profiles
  const users: Record<string, string> = {}; // handle -> user_id
  for (const u of lifters) {
    const { data:authUser, error } = await admin.auth.admin.createUser({
      email: u.email, password: u.password, email_confirm: true,
      user_metadata: { full_name: u.full_name, handle: u.handle }
    });
    if (error) throw error;
    const id = authUser.user!.id;
    users[u.handle] = id;

    await admin.from('profiles').upsert({
      id,
      handle: u.handle,
      full_name: u.full_name,
      email_public: u.email,
      gender: u.gender,
      age: u.age,
      bodyweight_kg: u.bw,
      height_cm: 180,
      gym_id: gymIds[u.gym],
      location: `${u.loc}, Croatia`,
      avatar_url: null,
      joined_at: new Date().toISOString(),
    });
  }

  // follows (make some mutuals)
  const pairs: [string,string][] = [
    ['@you','@mislav'],['@you','@iva'],['@you','@eva'],
    ['@mislav','@you'],['@iva','@you'],['@eva','@you'],
  ];
  for (const [a,b] of pairs) {
    await admin.from('follows').upsert({ follower_id: users[a], followee_id: users[b] });
  }

  // PRs
  const today = new Date();
  for (const handle of Object.keys(prMap)) {
    const uid = users[handle];
    const prs = prMap[handle];
    for (const lift of Object.keys(prs) as Lift[]) {
      const weight = prs[lift]!;
      await admin.from('lift_prs').insert({
        user_id: uid,
        lift,
        weight_kg: weight,
        reps: 1,
        bodyweight_kg: lifters.find(l => l.handle === handle)!.bw,
        age_at_lift: lifters.find(l => l.handle === handle)!.age,
        gym_id: gymIds[lifters.find(l => l.handle === handle)!.gym],
        performed_at: new Date(today.getTime() - Math.random()*90*86400000).toISOString(),
        video_url: null,
        verify: Math.random() > 0.5 ? 'ai_verified' : 'unverified'
      });
    }
  }

  await admin.from('lift_prs').select('count', { count: 'exact', head: true });

  // Best-effort refresh of the materialized view (optional)
try {
  await admin.rpc('exec', { q: 'refresh materialized view public.current_prs;' });
} catch (e: any) {
  console.warn('Skipping materialized view refresh:', e?.message ?? e);
}

  console.log('Seed done.');
}

main().catch(e => { console.error(e); process.exit(1); });
