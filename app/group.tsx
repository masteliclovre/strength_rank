import { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList } from "react-native";
import { saveGroup, getGroupComparison } from "@/lib/queries";


export default function Groups(){
    const [groupName, setGroupName] = useState("Demo grupa");
    const [members, setMembers] = useState("Demo User, Ana, Marko");
    const [rows, setRows] = useState<any[]>([]);


    const load = async () => {
        await saveGroup({ groupName, members: members.split(',').map(s=>s.trim()).filter(Boolean) });
        setRows(await getGroupComparison(groupName));
    };
    useEffect(()=>{ load(); }, []);


    return (
        <View style={{ padding: 16 }}>
            <Text style={{ color:'#fff', fontSize:18, fontWeight:'700', marginBottom:8 }}>Grupa</Text>
            <Field label="Naziv"><TextInput style={input} value={groupName} onChangeText={setGroupName}/></Field>
            <Field label="Članovi (zarezom)"><TextInput style={input} value={members} onChangeText={setMembers}/></Field>
            <TouchableOpacity style={btn} onPress={load}><Text style={btnText}>Spremi i osvježi</Text></TouchableOpacity>


            <FlatList
                style={{ marginTop: 12 }}
                data={rows}
                keyExtractor={(item, i)=> i.toString()}
                renderItem={({ item }) => (
                <View style={row}>
                    <Text style={name}>{item.userName}</Text>
                    <Text style={muted}>Bench: {item.bench || '-'}</Text>
                    <Text style={muted}>Squat: {item.squat || '-'}</Text>
                    <Text style={muted}>Deadlift: {item.deadlift || '-'}</Text>
                </View>
                )}
            />
        </View>
    );
}
const input = { backgroundColor:'#111827', color:'#fff', padding:12, borderRadius:12 } as const;
const btn = { backgroundColor:'#1f2937', padding: 14, borderRadius: 14, marginTop: 10 } as const;
const btnText = { color:'#fff', fontWeight:'600', textAlign:'center' } as const;
const row = { paddingVertical:10, borderBottomWidth:1, borderBottomColor:'#111827' } as const;
const name = { color:'#fff', fontWeight:'600' } as const;
const muted = { color:'#9ca3af', fontSize:12 } as const;
function Field({ label, children }: any){ return (<View style={{ marginBottom:10 }}><Text style={{ color:'#d1d5db', marginBottom:4 }}>{label}</Text>{children}</View>); }