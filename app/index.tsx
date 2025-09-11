import { Link } from "expo-router";
import { View, Text, TouchableOpacity } from "react-native";


export default function Home(){
return (
    <View style={{ padding: 16 }}>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 16 }}>Strength Rank — Mobile</Text>
        <Text style={{ color: '#9ca3af', marginBottom: 12 }}>Zabavni MVP: unos lifta, leaderboard, grupe prijatelja i tjedni izazovi s bedževima.</Text>


        <Link asChild href="/new-lift"><TouchableOpacity style={btn}><Text style={btnText}>➕ New Lift</Text></TouchableOpacity></Link>
        <Link asChild href="/leaderboard"><TouchableOpacity style={btn}><Text style={btnText}>🏆 Leaderboard</Text></TouchableOpacity></Link>
        <Link asChild href="/groups"><TouchableOpacity style={btn}><Text style={btnText}>👥 Group Compare</Text></TouchableOpacity></Link>
        <Link asChild href="/challenges"><TouchableOpacity style={btn}><Text style={btnText}>🥇 Challenges</Text></TouchableOpacity></Link>
    </View>
    );
}
const btn = { backgroundColor: '#1f2937', padding: 14, borderRadius: 14, marginTop: 10 };
const btnText = { color: '#fff', fontWeight: '600', textAlign: 'center' } as const;