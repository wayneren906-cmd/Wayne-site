import {dateSchema} from '../records.ts';

export type JournalLocation = {date:string; month:string; query:string; snapshot:string};
export const emptyJournalLocation:JournalLocation = {date:'',month:'all',query:'',snapshot:''};

export function readJournalLocation(search:string):JournalLocation {
  const p=new URLSearchParams(search);
  const validDate=(key:string)=>dateSchema.safeParse(p.get(key)).success?p.get(key)!:'';
  const date=validDate('date');
  const month=p.get('month')??'';
  return {date,month:!date&&/^\d{4}-(0[1-9]|1[0-2])$/.test(month)?month:'all',query:date?'':p.get('q')??'',snapshot:validDate('snapshot')};
}

export function readJournalSearchParams(params:Record<string,string|string[]|undefined>):JournalLocation {
  const search=new URLSearchParams();
  for(const key of ['date','month','q','snapshot']){
    const value=params[key];
    if(value!==undefined)search.set(key,Array.isArray(value)?value[0]??'':value);
  }
  return readJournalLocation(search.toString());
}

export function journalLocationURL(href:string,location:JournalLocation):string {
  const url=new URL(href);
  for(const [key,value] of Object.entries({date:location.date,month:location.month==='all'?'':location.month,q:location.query,snapshot:location.snapshot})) {
    if(value)url.searchParams.set(key,value);else url.searchParams.delete(key);
  }
  return url.pathname+url.search+url.hash;
}
