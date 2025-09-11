import { getLifts, addLift } from "./store";


export async function seedIfEmpty(){
    const lifts = await getLifts(); if (lifts.length) return;
    const users = [
        { id:"u1", name:"Ana", gender:"female", age:27, gymId:"ZG_ARENA" },
        { id:"u2", name:"Marko", gender:"male", age:31, gymId:"ZG_ARENA" },
        { id:"u3", name:"Luka", gender:"male", age:24, gymId:"ST_CITY" },
        { id:"u4", name:"Mia", gender:"female", age:29, gymId:"RI_TOWER" }
    ];
    const exs = ['bench_press','back_squat','deadlift','overhead_press','chin_up'];
    const jitter = (n:number,p=0.2)=> Math.round(n*(1+(Math.random()*2-1)*p));


    for (const u of users){
        for (const ex of exs){
            const base = ex==='deadlift'?140: ex==='back_squat'?110: ex==='bench_press'?80: 45;
            const entries = 6 + Math.floor(Math.random()*3);
            for (let i=entries;i>0;i--){
                const d = new Date(); d.setDate(d.getDate() - i*7 + Math.floor(Math.random()*3));
                const reps = [3,5,5,8][Math.floor(Math.random()*4)] || 5;
                const weightKg = jitter(base, 0.25);
                await addLift({ id:'', userId: u.id, userName: u.name, exercise: ex, reps, weightKg, date: d.toISOString(), gymId: u.gymId, gender: (u as any).gender, age: (u as any).age, verified: Math.random()<0.3 });
            }
        }
    }
}