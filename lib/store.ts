import AsyncStorage from "@react-native-async-storage/async-storage";
import { Lift } from "./types";


const LIFTS_KEY = "lifts";
const GROUPS_KEY = "groups"; // map name -> members[]


export async function getLifts(): Promise<Lift[]>{
    const s = await AsyncStorage.getItem(LIFTS_KEY); return s ? JSON.parse(s) : [];
}
export async function setLifts(arr: Lift[]){ await AsyncStorage.setItem(LIFTS_KEY, JSON.stringify(arr)); }
export async function addLift(l: Omit<Lift,'id'>){
    const lifts = await getLifts();
    const id = Math.random().toString(36).slice(2);
    lifts.push({ ...l, id });
    await setLifts(lifts);
}
export async function saveGroup({ groupName, members }: { groupName:string; members:string[] }){
    const s = await AsyncStorage.getItem(GROUPS_KEY); const map = s ? JSON.parse(s) : {};
    map[groupName] = members; await AsyncStorage.setItem(GROUPS_KEY, JSON.stringify(map));
}
export async function getGroupMembers(name: string): Promise<string[]>{
    const s = await AsyncStorage.getItem(GROUPS_KEY); const map = s ? JSON.parse(s) : {}; return map[name] || [];
}