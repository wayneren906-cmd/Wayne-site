import test from 'node:test';
import assert from 'node:assert/strict';
import {readPublicContent,readPublicJournalRecords} from '../lib/public-content.ts';

const row={date:'2026-10-15',items:JSON.stringify([{label:'C 语言',text:'Synthetic public pointer note',private_note:'DO_NOT_EXPOSE'}]),practice:'Synthetic public exercise',revision:1,updated_at:'2026-10-15T08:00:00.000Z',private_note:'DO_NOT_EXPOSE_ROW'};
function database(rows=[row]){
  return {prepare(sql){assert.match(sql,/\brecords\b/i);assert.doesNotMatch(sql,/learning_events|studio_project_records/i);return {async all(){return {success:true,results:rows};}};}};
}

test('public content joins the fixed Wayneo feature and legacy public records without private fields',async()=>{
  const items=await readPublicContent(database());
  assert.equal(items.filter(item=>item.type==='project').length,1);
  assert.equal(items.find(item=>item.type==='project').id,'project:wayneo');
  const journal=items.find(item=>item.id==='journal:2026-10-15');
  assert.ok(journal.text.includes('Synthetic public pointer note'));
  assert.ok(journal.url.includes('/learning?date=2026-10-15'));
  assert.ok(journal.topics.includes('C 语言'));
  assert.ok(!JSON.stringify(items).includes('DO_NOT_EXPOSE'));
  const records=await readPublicJournalRecords(database());
  assert.equal(records[0].items[0].text,'Synthetic public pointer note');
  assert.ok(!JSON.stringify(records).includes('DO_NOT_EXPOSE'));
});

test('public content does not turn a failed legacy read into a successful empty catalog',async()=>{
  const db={prepare(){return {async all(){throw Error('Synthetic D1 failure');}};}};
  await assert.rejects(()=>readPublicContent(db));
  await assert.rejects(()=>readPublicContent({prepare(){return {async all(){return {success:false,results:[]};}};}}));
});

test('duplicate public ids fail explicitly rather than silently shadowing a record',async()=>{
  await assert.rejects(()=>readPublicContent(database([row,{...row,practice:'Duplicate id'}])));
});
