import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizePublicActivity,summarizePublicLearning} from '../lib/studio-public.ts';

test('public Studio counts journal activity without inventing mastery or exposing extra fields',()=>{
  const records=[{date:'2026-10-01',items:[{label:'C语言',text:'synthetic public note'}],practice:'synthetic',revision:1,updatedAt:'synthetic',privateSecret:'never project'},
    {date:'2026-10-02',items:[{label:'C语言',text:'synthetic second note'},{label:'数学',text:'synthetic math'}],practice:'',revision:1,updatedAt:'synthetic'}];
  const result=summarizePublicLearning(records);assert.equal(result.recordedDays,2);assert.equal(result.entryCount,3);assert.equal(result.latestDate,'2026-10-02');
  assert.deepEqual(result.topics,[{label:'C语言',count:2},{label:'数学',count:1}]);assert.equal(result.recent[0].date,'2026-10-02');
  assert.ok(!JSON.stringify(result).includes('never project'));assert.ok(!('mastery' in result));assert.equal(records[0].date,'2026-10-01');
});
test('public Studio empty data has zero recorded activity and an unknown latest date',()=>{
  assert.deepEqual(summarizePublicLearning([]),{recordedDays:0,entryCount:0,latestDate:null,topics:[],recent:[]});
});

test('public activity fills missing months across years and includes older entries in cumulative totals',()=>{
  const record=(date,count)=>({date,items:Array.from({length:count},()=>({label:'synthetic',text:'public note'})),practice:'private field excluded',revision:1,updatedAt:'not a sync timestamp'});
  const records=[record('2026-02-02',3),record('2024-12-01',2),record('2026-02-01',1),record('2025-12-31',4)];
  const original=JSON.stringify(records);
  const result=summarizePublicActivity(records);
  assert.equal(result.length,12);
  assert.deepEqual(result[0],{month:'2025-03',recordedDays:0,entryCount:0,cumulativeEntries:2});
  assert.deepEqual(result.at(-2),{month:'2026-01',recordedDays:0,entryCount:0,cumulativeEntries:6});
  assert.deepEqual(result.at(-1),{month:'2026-02',recordedDays:2,entryCount:4,cumulativeEntries:10});
  assert.equal(JSON.stringify(records),original);
  assert.ok(!JSON.stringify(result).includes('private field'));
  assert.ok(!JSON.stringify(result).includes('sync timestamp'));
});

test('public activity has no invented timeline when no records have been published',()=>{
  assert.deepEqual(summarizePublicActivity([]),[]);
});
