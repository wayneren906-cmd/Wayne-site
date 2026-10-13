import type {Entry} from './records.ts';
// Only projects fields already exposed by the public Journal; counts are not mastery.
export function summarizePublicLearning(records:readonly Entry[]){
  const ordered=[...records].sort((a,b)=>b.date.localeCompare(a.date)),topics=new Map<string,number>();
  for(const r of ordered)for(const i of r.items)topics.set(i.label,(topics.get(i.label)??0)+1);
  return {recordedDays:ordered.length,entryCount:ordered.reduce((n,r)=>n+r.items.length,0),latestDate:ordered[0]?.date??null,
    topics:[...topics].map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label)).slice(0,6),
    recent:ordered.slice(0,4).map(r=>({date:r.date,items:r.items.map(i=>({label:i.label,text:i.text}))}))};
}
