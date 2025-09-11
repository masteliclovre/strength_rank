import { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity } from "react-native";
import { getWeeklyChallenges, getChallengeLeaderboard } from "@/lib/queries";


export default function Challenges(){
    const [list, setList] = useState<any[]>([]);
    const [activeEx, setActiveEx] = useState<string | null>(null);
    const [rows, setRows] = useState<any[]>([]);


    useEffect(()=>{ (async()=> setList(await getWeeklyChallenges()) )(); }, []);
    useEffect(()=>{ if(activeEx) (async()=> setRows(await getChallengeLeaderboard(activeEx)) )(); }, [activeEx]);


    return (
    <View style={{ padding: 16 }}>
        <Text style={{ color:'#fff', fontSize:18, fontWeight:'700', marginBottom:8 }}>Tjedni izazovi</Text>
        <FlatList
            data={list}
            keyExtractor={(i)=> i.id}
            renderItem={({ item }) => (
                <TouchableOpacity style={{ backgroundColor:'#111827', padding:12, borderRadius:12, marginBottom:8 }} onPress={()=> setActiveEx(item.exercise)}>
                    <Text style={{ color:'#fff', fontWeight:'600' }}>{item.title}</Text>
                    <Text style={{ color:'#9ca3af', fontSize:12 }}>{item.weekLabel} · {item.status}</Text>
                </TouchableOpacity>
            )}
        />


        {activeEx && (
            <View style={{ marginTop: 12 }}>
                <Text style={{ color:'#fff', fontWeight:'700' }}>Poredak — {activeEx}</Text>
                {rows.map((r:any)=> (
                    <View key={r.rank} style={{ flexDirection:'row', justifyContent:'space-between', paddingVertical:8, borderBottomWidth:1, borderBottomColor:'#111827' }}>
                        <Text style={{ color:'#9ca3af' }}>#{r.rank} {r.userName}</Text>
                        <Text style={{ color:'#fff' }}>{r.score} {r.badge ? `🏅${r.badge}` : ''}</Text>
                    </View>
        ))}
        </View>
        )}
    </View>
    );
}