import test from 'node:test';
import assert from 'node:assert/strict';
import {journalArchive} from '../lib/ui/journal-archive.ts';

const records=dates=>dates.map(date=>({date}));
test('seven or fewer dates remain in the recent index',()=>{
  for(const length of [0,1,7]){
    const source=records(Array.from({length},(_,i)=>`2026-10-${String(i+1).padStart(2,'0')}`));
    const result=journalArchive(source);
    assert.equal(result.recent.length,length);
    assert.deepEqual(result.months,[]);
  }
});
test('older dates in the same month are archived without repeating recent dates',()=>{
  const source=records(Array.from({length:10},(_,i)=>`2026-10-${String(i+1).padStart(2,'0')}`));
  const original=structuredClone(source);
  const {recent,months}=journalArchive(source);
  assert.deepEqual(recent.map(r=>r.date),source.slice(3).reverse().map(r=>r.date));
  assert.deepEqual(months,[{month:'2026-10',records:source.slice(0,3).reverse()}]);
  assert.deepEqual(source,original,'sorting must not mutate shared calendar data');
  assert.equal(new Set([...recent,...months.flatMap(m=>m.records)].map(r=>r.date)).size,10);
});
test('month groups include their year and remain newest first across years',()=>{
  const recent=Array.from({length:7},(_,i)=>`2026-11-${String(i+1).padStart(2,'0')}`);
  const {months}=journalArchive(records(['2025-10-04',...recent,'2026-09-01','2026-10-02','2026-10-24']));
  assert.deepEqual(months.map(m=>[m.month,m.records.map(r=>r.date)]),[
    ['2026-10',['2026-10-24','2026-10-02']],['2026-09',['2026-09-01']],['2025-10',['2025-10-04']],
  ]);
});
