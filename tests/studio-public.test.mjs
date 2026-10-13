import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizePublicLearning} from '../lib/studio-public.ts';

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
