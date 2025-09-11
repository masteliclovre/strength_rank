export const EXERCISES = ["bench_press","back_squat","deadlift","overhead_press","chin_up"];
export function est1RM(weightKg: number, reps: number){ return Math.round(weightKg * (1 + reps / 30)); }
export function scoreForLift(l: { weightKg:number; reps:number; }){ return est1RM(l.weightKg, l.reps); }
export function formatExerciseLabel(key: string){
const map: Record<string,string> = { bench_press:"Bench Press", back_squat:"Back Squat", deadlift:"Deadlift", overhead_press:"Overhead Press", chin_up:"Chin-up" };
return map[key] || key;
}