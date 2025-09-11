import { useEffect, useState } from "react";
import { View, Text, TextInput, FlatList } from "react-native";
import { getLeaderboard } from "@/lib/queries";
import { EXERCISES, formatExerciseLabel } from "@/lib/ranking";


export default function Leaderboard(){
    const [exercise, setExercise] = useState("bench_press");
    const [gender, setGender] = useState("any");
    const [gymId, setGymId] = useState<string|undefined>(undefined);
    const [rows, setRows] = useState<any[]>([]);


    useEffect(()=>{ (async()=> setRows(await getLeaderboard({ exercise, gender, gymId })) )(); }, [exercise, gender, gymId]);


    return (
    <View style={{ padding: 16 }}>
        <Text style={title}>Leaderboard — {formatExerciseLabel(exercise)}</Text>
        <Text style={hint}>Vježbe: {EXERCISES.join(', ')}</Text>
        <Field label="Vježba"><TextInput style={input} value={exercise} onChangeText={setExercise}/></Field>
        <Field label="Spol (any/male/female)"><TextInput style={input} value={gender} onChangeText={setGender}/></Field>
        <Field label="Gym ID (opcionalno)"><TextInput style={input} value={gymId||''} onChangeText={t=>setGymId(t||undefined)}/></Field>


        <FlatList
            data={rows}
            keyExtractor={(item)=> item.rank.toString()+item.userName}
            renderItem={({ item }) => (
            <View style={row}>
                <Text style={rank}>#{item.rank}</Text>
                <View style={{ flex:1 }}>
                    <Text style={name}>{item.userName}</Text>
                    <Text style={muted}>{item.best.weightKg} kg × {item.best.reps} {item.verified ? '✓' : ''}</Text>
                </View>
                <Text style={score}>{item.score}</Text>
            </View>
            )}
        />
    </View>
    );
}
const title = { color:'#fff', fontSize:18, fontWeight:'700', marginBottom:8 } as const;
const hint = { color:'#9ca3af', marginBottom:10 } as const;
const row = { flexDirection:'row', alignItems:'center', gap:8, paddingVertical:10, borderBottomWidth:1, borderBottomColor:'#111827' } as const;
const rank = { color:'#9ca3af', width:36, textAlign:'center' } as const;
const name = { color:'#fff', fontWeight:'600' } as const;
const muted = { color:'#9ca3af', fontSize:12 } as const;
const score = { color:'#fff', fontWeight:'700' } as const;
const input = { backgroundColor:'#111827', color:'#fff', padding:12, borderRadius:12 } as const;
function Field({ label, children }: any){ return (<View style={{ marginBottom:10 }}><Text style={{ color:'#d1d5db', marginBottom:4 }}>{label}</Text>{children}</View>); }