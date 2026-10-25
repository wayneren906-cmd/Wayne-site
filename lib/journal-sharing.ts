import {dateSchema, type Entry} from './records.ts';

export function journalEntryPath(date:string, snapshot = ''):string {
  dateSchema.parse(date);
  const params=new URLSearchParams({date});
  if(snapshot)params.set('snapshot',dateSchema.parse(snapshot));
  return '/learning?'+params;
}

export function describeJournalEntry(record:Entry, snapshot = '') {
  const parts=record.items.map(item=>`${item.label}：${item.text}`);
  if(record.practice)parts.push(`练习与补充：${record.practice}`);
  const text=parts.join('；').replace(/\s+/g,' ').trim();
  const characters=Array.from(text);
  return {
    title:`${record.date} 学习手记${snapshot?`（快照 ${snapshot}）`:''}`,
    description:characters.length>160?characters.slice(0,159).join('')+'…':text,
  };
}
