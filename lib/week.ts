export function getWeekRange(d = new Date()){
const day = (d.getDay() + 6) % 7; // 0=pon
const start = new Date(d); start.setDate(d.getDate() - day); start.setHours(0,0,0,0);
const end = new Date(start); end.setDate(start.getDate() + 7);
const weekLabel = `${start.getFullYear()}-W${weekNumber(start)}`;
return { start, end, weekLabel };
}
function weekNumber(date: Date){
const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
const dayNum = (tmp.getUTCDay() + 6) % 7; tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3);
const firstThursday = new Date(Date.UTC(tmp.getUTCFullYear(),0,4));
const diff = (tmp.getTime() - firstThursday.getTime()) / 86400000; return 1 + Math.floor(diff / 7);
}