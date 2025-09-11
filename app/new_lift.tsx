import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { addLift } from "@/lib/store";
import { EXERCISES, formatExerciseLabel } from "@/lib/ranking";


export default function NewLift(){
    const [userName, setUserName] = useState("Demo User");
    const [userId, setUserId] = useState("u1");
    const [exercise, setExercise] = useState<string>("bench_press");
    const [reps, setReps] = useState("5");
    const [weightKg, setWeightKg] = useState("60");
    const [gymId, setGymId] = useState("ZG_ARENA");


    const save = async () => {
        const r = parseInt(reps, 10), w = parseInt(weightKg, 10);
        if (!r || !w) return Alert.alert("Greška", "Unesi ispravne vrijednosti.");
        await addLift({ id: '', userId, userName, exercise, reps: r, weightKg: w, date: new Date().toISOString(), gymId, verified: false });
        Alert.alert("Spremljeno", "Lift dodan! Pogledaj leaderboard.");
    };


    return (
    <View style={{ padding: 16 }}>
        <Field label="Korisničko ime"><TextInput style={input} value={userName} onChangeText={setUserName}/></Field>
        <Field label="User ID"><TextInput style={input} value={userId} onChangeText={setUserId}/></Field>
        <Field label="Vježba"><TextInput style={input} value={formatExerciseLabel(exercise)} onChangeText={()=>{}} placeholder="bench_press"/></Field>
        <Text style={{ color:'#9ca3af', marginTop:4, marginBottom:8 }}>Vježbe: {EXERCISES.join(', ')}</Text>
        <Field label="Ponavljanja"><TextInput style={input} value={reps} onChangeText={setReps} keyboardType="numeric"/></Field>
        <Field label="Kilaža (kg)"><TextInput style={input} value={weightKg} onChangeText={setWeightKg} keyboardType="numeric"/></Field>
        <Field label="Lokacija (Gym ID)"><TextInput style={input} value={gymId} onChangeText={setGymId}/></Field>
        <TouchableOpacity style={btn} onPress={save}><Text style={btnText}>Spremi</Text></TouchableOpacity>
        <Text style={{ color:'#6b7280', fontSize:12, marginTop:8 }}>Tip: upiši točan ključ vježbe (npr. bench_press, back_squat, deadlift, overhead_press, chin_up).</Text>
    </View>
    );
}


function Field({ label, children }: any){
    return (<View style={{ marginBottom: 10 }}><Text style={{ color:'#d1d5db', marginBottom: 4 }}>{label}</Text>{children}</View>);
}
const input = { backgroundColor:'#111827', color:'#fff', padding:12, borderRadius:12 } as const;