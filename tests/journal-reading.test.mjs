import test from 'node:test';
import assert from 'node:assert/strict';
import {readJournalData} from '../lib/journal-reading.ts';
import {latestRecordUpdate} from '../lib/records.ts';
import {journalEntryPath, describeJournalEntry} from '../lib/journal-sharing.ts';
import {readJournalSearchParams} from '../lib/ui/journal-location.ts';

const record={date:'2026-10-15',items:[{label:'C 语言',text:'Synthetic public\n pointer note'}],practice:'Synthetic exercise',revision:2,updatedAt:'2026-10-15T08:00:00Z'};
function database({unavailable=false,snapshot=null}={}){
  return {prepare(sql){
    assert.doesNotMatch(sql,/learning_events|studio_project_records|admin_accounts/);
    return {bind(){return this;},async all(){if(unavailable)throw Error('PRIVATE_INTERNAL_ERROR');return {success:true,results:[{...record,items:JSON.stringify(record.items.map(item=>({...item,private_note:'PRIVATE_NESTED'}))),updated_at:record.updatedAt,private_note:'PRIVATE_ROW'}]};},async first(){return sql.includes('WHERE date=')?snapshot:{updated_at:'2026-10-16T00:00:00Z'};}};
  }};
}

test('server reading contains only public fields, with the latest record update rather than snapshot time',async()=>{
  const data=await readJournalData(database());
  assert.deepEqual(data.records.find(item=>item.date===record.date),record);
  assert.equal(data.lastSync,latestRecordUpdate(data.records));
  assert.ok(data.records.some(item=>item.date==='2026-11-08'));
  assert.equal(data.error,'');
  assert.equal(data.snapshot,null);
  assert.ok(!JSON.stringify(data).includes('PRIVATE_'));
});

test('latest update follows write time, including edits to older study dates and timezone offsets',()=>{
  assert.equal(latestRecordUpdate([
    {...record,date:'2026-10-27',updatedAt:'2026-10-28T00:00:00+08:00'},
    {...record,date:'2026-10-24',updatedAt:'2026-10-27T17:22:47.616Z'},
  ]),'2026-10-27T17:22:47.616Z');
  assert.equal(latestRecordUpdate([]),null);
  assert.equal(latestRecordUpdate([{updatedAt:'invalid'}]),null);
});

test('failed initial reading is a retryable error, never a successful empty journal or internal error leak',async()=>{
  const data=await readJournalData(database({unavailable:true}));
  assert.equal(data.records.length,0);
  assert.equal(data.lastSync,null);
  assert.equal(data.error,'暂时无法读取记录，请重试。');
  assert.ok(!JSON.stringify(data).includes('PRIVATE_'));
});

test('historical reading projects public fields and never substitutes the current record for a missing snapshot',async()=>{
  const historical={...record,practice:'Historical exercise',private_note:'PRIVATE_HISTORY',items:[{...record.items[0],private_note:'PRIVATE_ITEM'}]};
  const data=await readJournalData(database({snapshot:{data:JSON.stringify([historical]),updated_at:'2026-10-16T00:00:00Z'}}),'2026-10-16');
  assert.equal(data.snapshot.date,'2026-10-16');
  assert.equal(data.snapshot.records[0].practice,'Historical exercise');
  assert.ok(!JSON.stringify(data).includes('PRIVATE_'));
  const missing=await readJournalData(database(),'2026-10-16');
  assert.deepEqual(missing.snapshot.records,[]);
  assert.ok(missing.snapshot.error);
});

test('single-record links exclude stale filters and retain the selected historical snapshot',()=>{
  assert.equal(journalEntryPath(record.date),'/learning?date=2026-10-15');
  assert.equal(journalEntryPath(record.date,'2026-10-16'),'/learning?date=2026-10-15&snapshot=2026-10-16');
  assert.throws(()=>journalEntryPath('2026-02-30'));
  assert.throws(()=>journalEntryPath(record.date,'invalid'));
});

test('sharing describes the actual record with compact, unicode-safe public text',()=>{
  const description=describeJournalEntry(record);
  assert.equal(description.title,'2026-10-15 学习手记');
  assert.equal(description.description,'C 语言：Synthetic public pointer note；练习与补充：Synthetic exercise');
  const long=describeJournalEntry({...record,items:[{label:'笔记',text:'📖'.repeat(180)}]});
  assert.ok(Array.from(long.description).length<=160);
  assert.ok(!/[\uD800-\uDBFF]$/.test(long.description));
  assert.ok(describeJournalEntry(record,'2026-10-16').title.includes('快照 2026-10-16'));
});

test('server query parsing follows browser date precedence and first-value handling',()=>{
  assert.deepEqual(readJournalSearchParams({date:['2026-10-15','2026-10-14'],q:'missing',month:'2026-09',snapshot:'2026-10-16'}),{date:'2026-10-15',query:'',month:'all',snapshot:'2026-10-16'});
  assert.deepEqual(readJournalSearchParams({date:'2026-02-30',q:'输入 & 输出',month:'2026-10'}),{date:'',query:'输入 & 输出',month:'2026-10',snapshot:''});
});
