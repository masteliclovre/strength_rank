import { Stack } from "expo-router";
import { useEffect } from "react";
import { seedIfEmpty } from "@/lib/seed";


export default function RootLayout(){
    useEffect(()=>{ seedIfEmpty(); }, []);
    return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: '#111827' }, headerTintColor: '#fff', contentStyle: { backgroundColor: '#0b0f19' } }}>
        <Stack.Screen name="index" options={{ title: 'Strength Rank' }} />
        <Stack.Screen name="new-lift" options={{ title: 'Unesi lift' }} />
        <Stack.Screen name="leaderboard" options={{ title: 'Leaderboard' }} />
        <Stack.Screen name="groups" options={{ title: 'Grupa' }} />
        <Stack.Screen name="challenges" options={{ title: 'Challenges' }} />
    </Stack>
    );
}