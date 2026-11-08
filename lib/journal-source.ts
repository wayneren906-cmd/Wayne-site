import {journalEntries} from '../content/journal.ts';
import type {Entry} from './records.ts';

export function isSourceJournalDate(date:string):boolean {
  return journalEntries.some(entry=>entry.date===date);
}

// One authoritative source per date; duplicates must never be silently overwritten.
export function mergeJournalSources(records:Entry[],source:Entry[]=journalEntries):Entry[] {
  const dates=new Set<string>();
  const merged=[...source,...records];
  for(const record of merged){
    if(dates.has(record.date))throw new Error(`PUBLIC_CONTENT_ID_CONFLICT:journal:${record.date}`);
    dates.add(record.date);
  }
  return merged;
}
