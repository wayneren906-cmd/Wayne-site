/** Keep the reading index short while retaining every older date. */
export function journalArchive<T extends {date:string}>(records:readonly T[]) {
  const sorted=[...records].sort((a,b)=>b.date.localeCompare(a.date));
  const months:{month:string;records:T[]}[]=[];
  for(const record of sorted.slice(7)){
    const month=record.date.slice(0,7);
    const last=months.at(-1);
    if(last?.month===month)last.records.push(record);
    else months.push({month,records:[record]});
  }
  return {recent:sorted.slice(0,7),months};
}
