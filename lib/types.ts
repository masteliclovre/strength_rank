export type Lift = {
id: string;
userId: string;
userName: string;
exercise: string; // bench_press, back_squat...
reps: number;
weightKg: number;
date: string; // ISO
gymId?: string;
gender?: string; // any/male/female
age?: number;
equipment?: string;
verified?: boolean;
};