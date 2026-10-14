import type {Entry} from './records.ts';

export type PublicActivityMonth = {month:string;recordedDays:number;entryCount:number;cumulativeEntries:number};

// Historical window ending at the latest published date; no fabricated sync timestamp.
export function summarizePublicActivity(records:readonly Entry[]):PublicActivityMonth[]{
  if(!records.length)return [];
  const months=new Map<string,{recordedDays:number;entryCount:number}>();
  for(const record of records){
    const month=record.date.slice(0,7),previous=months.get(month)??{recordedDays:0,entryCount:0};
    months.set(month,{recordedDays:previous.recordedDays+1,entryCount:previous.entryCount+record.items.length});
  }
  const latest=[...months.keys()].sort().at(-1)!;
  const [year,month]=latest.split('-').map(Number);
  const start=new Date(Date.UTC(year,month-12,1));
  const first=start.toISOString().slice(0,7);
  let cumulativeEntries=0;
  for(const [key,value] of months)if(key<first)cumulativeEntries+=value.entryCount;
  return Array.from({length:12},(_,index)=>{
    const key=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+index,1)).toISOString().slice(0,7);
    const activity=months.get(key)??{recordedDays:0,entryCount:0};
    cumulativeEntries+=activity.entryCount;
    return {month:key,...activity,cumulativeEntries};
  });
}
// Only projects fields already exposed by the public Journal; counts are not mastery.
export function summarizePublicLearning(records:readonly Entry[]){
  const ordered=[...records].sort((a,b)=>b.date.localeCompare(a.date)),topics=new Map<string,number>();
  for(const r of ordered)for(const i of r.items)topics.set(i.label,(topics.get(i.label)??0)+1);
  return {recordedDays:ordered.length,entryCount:ordered.reduce((n,r)=>n+r.items.length,0),latestDate:ordered[0]?.date??null,
    topics:[...topics].map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label)).slice(0,6),
    recent:ordered.slice(0,4).map(r=>({date:r.date,items:r.items.map(i=>({label:i.label,text:i.text}))}))};
}
