import { getLifts, getGroupMembers, saveGroup as _saveGroup } from "./store";
import { scoreForLift } from "./ranking";
import { getWeekRange } from "./week";


export async function getLeaderboard({ exercise, gender, gymId }:{ exercise:string; gender?:string; gymId?:string; }){
    const lifts = await getLifts();
    const filtered = lifts.filter(l => l.exercise === exercise)
        .filter(l => !gender || gender==='any' || l.gender===gender)
        .filter(l => !gymId || l.gymId === gymId);


    const byUser = new Map<string, { userName:string; score:number; best:{weightKg:number; reps:number}; verified?:boolean }>();
    for (const l of filtered){
        const s = scoreForLift(l);
        const curr = byUser.get(l.userId);
        if (!curr || s > curr.score) byUser.set(l.userId, { userName: l.userName, score: s, best: { weightKg: l.weightKg, reps: l.reps }, verified: l.verified });
    }
    return Array.from(byUser.values()).sort((a,b)=> b.score - a.score).map((v,i)=> ({ rank:i+1, ...v }));
}


export async function saveGroup({ groupName, members }:{ groupName:string; members:string[] }){ await _saveGroup({ groupName, members }); }
export async function getGroupComparison(groupName: string){
    const lifts = await getLifts();
    const members = await getGroupMembers(groupName);
    const byUser = new Map<string, { bench?: string; squat?: string; deadlift?: string }>();
    for (const m of members) byUser.set(m, {});
    const maxLabel = (a?:string,b?:string)=>{ if(!a) return b; if(!b) return a; const pa=parseInt(a.split('×')[0]); const pb=parseInt(b.split('×')[0]); return pa>=pb?a:b; };
    for (const l of lifts){
        if (!byUser.has(l.userName)) continue;
        const label = `${l.weightKg}×${l.reps}`;
        if (l.exercise==='bench_press') byUser.get(l.userName)!.bench = maxLabel(byUser.get(l.userName)!.bench, label);
        if (l.exercise==='back_squat') byUser.get(l.userName)!.squat = maxLabel(byUser.get(l.userName)!.squat, label);
        if (l.exercise==='deadlift') byUser.get(l.userName)!.deadlift = maxLabel(byUser.get(l.userName)!.deadlift, label);
    }
    return Array.from(byUser.entries()).map(([userName, v])=> ({ userName, ...v }));
}


export async function getWeeklyChallenges(){
    const { weekLabel, start, end } = getWeekRange(new Date());
    const now = new Date();
    const status = now >= start && now < end ? 'U tijeku' : now < start ? 'Počinje uskoro' : 'Završeno';
    const EX = ['bench_press','back_squat','deadlift'];
    return EX.map(ex => ({ id: `${weekLabel}-${ex}`, title: `${ex.replace('_',' ')} Week`, exercise: ex, weekLabel, status }));
}


export async function getChallengeLeaderboard(exercise: string){
    const lifts = await getLifts();
    const { start, end } = getWeekRange(new Date());
    const byUser = new Map<string, { userName:string; score:number }>();
    for (const l of lifts){
        const t = new Date(l.date);
        if (l.exercise!==exercise) continue;
        if (t < start || t >= end) continue;
        const s = scoreForLift(l);
        const curr = byUser.get(l.userId);
        if (!curr || s > curr.score) byUser.set(l.userId, { userName: l.userName, score: s });
    }
    return Array.from(byUser.values()).sort((a,b)=> b.score - a.score).map((v,i)=> ({ rank:i+1, ...v, badge: i===0?'Gold': i===1?'Silver': i===2?'Bronze': undefined }));
}