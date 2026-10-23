// Compare an explicitly downloaded public snapshot with the new app, in memory D1 only.
import assert from 'node:assert/strict';
import {createStudioWorkerEnvironment} from './helpers/studio-worker-environment.mjs';
import {loadPublicRecords,seedPublicRecords} from './helpers/public-record-preview.mjs';

const file=process.argv[2];assert.ok(file,'Provide a local public records snapshot');
const records=loadPublicRecords(file).sort((a,b)=>b.date.localeCompare(a.date));
const f=await createStudioWorkerEnvironment();
try{
  await seedPublicRecords(f.db,records);
  const response=await f.runtime.dispatchFetch('http://synthetic.invalid/api/records');assert.equal(response.status,200);
  const actual=await response.json();assert.deepEqual(actual.records,records,'all public record fields must survive unchanged');
  const search=await(await f.runtime.dispatchFetch('http://synthetic.invalid/api/public/content')).json();
  const journals=search.items.filter(item=>item.type==='journal');assert.equal(journals.length,records.length);
  for(const record of records){
    const item=journals.find(item=>item.id==='journal:'+record.date);assert.ok(item);
    for(const note of record.items)assert.ok(item.text.includes(note.text));
    assert.ok(!item.text.includes('undefined'));
  }
  assert.equal((await f.db.prepare('SELECT COUNT(*) n FROM records').first()).n,records.length);
  console.log(JSON.stringify({passed:true,count:records.length,dates:records.map(record=>record.date),allPublicFieldsUnchanged:true,searchContainsEveryRecord:true,scope:'downloaded public snapshot -> local isolated Worker + memory D1; no production writes'}));
}finally{await f.runtime.dispose();}
