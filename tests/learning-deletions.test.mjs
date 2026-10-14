import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture, input, now, signedOwner} from './helpers/learning-fixture.mjs';
import {saveLearningEvent, correctLearningEvent} from '../lib/learning/events.ts';
import {deleteLearningEvent} from '../lib/learning/deletions.ts';
import {filterRestoredLearningData} from '../lib/learning/restore-deletions.ts';
import {getLearningEvent, getLearningEventHistory, getLearningContext} from '../lib/learning/reads.ts';
import {verifyLearningOwner} from '../lib/learning/auth.ts';
import {handleStudioEvent} from '../lib/learning/http.ts';

const deletion = (key='synthetic-delete', revision=2) => ({schema_version:1,idempotency_key:key,expected_revision:revision});
const tables = ['learning_state','learning_events','event_revisions','ingest_receipts','processing_jobs','deleted_learning_events','deleted_learning_keys','records','snapshots'];
const snapshot = sqlite => Object.fromEntries(tables.map(name => [name,sqlite.prepare(`SELECT * FROM ${name}`).all()]));
async function setup(t) {
  const f = await fixture(t,['events:read','context:read','events:write','events:correct']);
  const auth = await signedOwner();
  const owner = await verifyLearningOwner(auth.jwt,auth.config,f.db,auth.verification);
  const original = {...input(),source:{type:'studio',record_id:'synthetic-source'}};
  const saved = await saveLearningEvent(f.db,f.identity,original,{now});
  const {schema_version,idempotency_key,...event} = original;
  const correction = {schema_version:1,idempotency_key:'synthetic-correct',expected_revision:1,reason:'synthetic reason',event:{...event,content:{summary:'synthetic corrected body'}}};
  await correctLearningEvent(f.db,f.identity,saved.event_id,correction,{now});
  return {...f,auth,owner,saved,original,correction};
}
const checkpoint = sqlite => ({schema_version:1,owners:sqlite.prepare('SELECT owner_id,data_version FROM learning_state').all(),
  markers:sqlite.prepare('SELECT * FROM deleted_learning_events').all(),keys:sqlite.prepare('SELECT * FROM deleted_learning_keys').all()});

test('deletion purges all revisions/receipts/jobs, preserves unrelated facts and original content-free receipt',async t=>{
  const f=await setup(t),{db,sqlite,owner,saved,identity}=f;
  const unrelated=await saveLearningEvent(db,identity,input('unrelated'),{now});
  const receipt=await deleteLearningEvent(db,owner,saved.event_id,deletion(),{now});
  assert.deepEqual(receipt,{event_id:saved.event_id,deleted_revision:2,data_version:4,deleted_at:now.toISOString(),deleted:true,replayed:false});
  assert.deepEqual(await deleteLearningEvent(db,owner,saved.event_id,deletion(),{now}),{...receipt,replayed:true});
  assert.equal(await getLearningEvent(db,owner,saved.event_id,{now}),null);
  assert.equal(await getLearningEventHistory(db,owner,saved.event_id,{}, {now}),null);
  assert.deepEqual((await getLearningContext(db,owner,'teaching',{now})).events.map(e=>e.event_id),[unrelated.event_id]);
  for(const table of ['learning_events','event_revisions','ingest_receipts','processing_jobs']) assert.equal(sqlite.prepare(`SELECT COUNT(*) n FROM ${table} WHERE event_id=?`).get(saved.event_id).n,0);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM deleted_learning_keys').get().n,2);
  const text=JSON.stringify(checkpoint(sqlite));
  for(const secret of ['synthetic corrected body','synthetic private fact','synthetic reason','payload_sha256','payload_json']) assert.ok(!text.includes(secret));
  assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
  await assert.rejects(deleteLearningEvent(db,owner,unrelated.event_id,deletion(),{now}),{code:'IDEMPOTENCY_CONFLICT'});
});

test('deletion denies grant/forged/foreign/missing/stale identities and revoked owner without mutation',async t=>{
  const {db,sqlite,owner,identity,saved}=await setup(t);const before=snapshot(sqlite);
  for(const who of [null,identity,JSON.parse(JSON.stringify(owner))]) await assert.rejects(deleteLearningEvent(db,who,saved.event_id,deletion(),{now}),{code:'PRIVATE_ACCESS_DENIED'});
  const otherAuth=await signedOwner('synthetic-other-sub');
  const other=await verifyLearningOwner(otherAuth.jwt,otherAuth.config,db,otherAuth.verification);
  for(const event of [saved.event_id,'missing']) await assert.rejects(deleteLearningEvent(db,other,event,deletion(),{now}),{code:'EVENT_NOT_FOUND'});
  await assert.rejects(deleteLearningEvent(db,owner,saved.event_id,deletion('stale',1),{now}),{code:'REVISION_CONFLICT'});
  for(const value of [{...deletion(),reason:'do not retain'},deletion('bad',0),deletion('bad',1.2)]) await assert.rejects(deleteLearningEvent(db,owner,saved.event_id,value,{now}),{code:'INVALID_INPUT'});
  assert.deepEqual(snapshot(sqlite),before);
  sqlite.exec("UPDATE users SET status='disabled' WHERE user_id='synthetic-owner'");
  await assert.rejects(deleteLearningEvent(db,owner,saved.event_id,deletion(),{now}),{code:'PRIVATE_ACCESS_DENIED'});
});

test('every deletion mutation ABORT/IGNORE rolls back the complete old state including replay blockers',async t=>{
  const {db,sqlite,owner,saved}=await setup(t);const before=snapshot(sqlite);
  for(const [table,operation] of [['learning_state','UPDATE'],['deleted_learning_events','INSERT'],['deleted_learning_keys','INSERT'],...['processing_jobs','ingest_receipts','event_revisions','learning_events'].map(n=>[n,'DELETE'])]) {
    for(const failure of ['ABORT','IGNORE']) {
      sqlite.exec(`CREATE TRIGGER synthetic_failure BEFORE ${operation} ON ${table} BEGIN SELECT RAISE(${failure}${failure==='ABORT'?",'synthetic failure'":''}); END`);
      await assert.rejects(deleteLearningEvent(db,owner,saved.event_id,deletion(),{now}),{code:'SERVICE_UNAVAILABLE'});
      assert.deepEqual(snapshot(sqlite),before,`${table}/${failure}`);
      sqlite.exec('DROP TRIGGER synthetic_failure');
    }
  }
});

test('deleted retry keys, event IDs and source identities cannot resurrect facts or original receipts',async t=>{
  const {db,sqlite,owner,identity,saved,original,correction}=await setup(t);
  await deleteLearningEvent(db,owner,saved.event_id,deletion(),{now});const before=snapshot(sqlite);
  for(const event of [original,{...original,idempotency_key:'new-key'},{...original,source:{type:'studio',record_id:null}}]) await assert.rejects(saveLearningEvent(db,identity,event,{now}),{code:'EVENT_DELETED'});
  for(const change of [correction,{...correction,idempotency_key:'new-correction',expected_revision:2}]) await assert.rejects(correctLearningEvent(db,identity,saved.event_id,change,{now}),{code:'EVENT_DELETED'});
  assert.deepEqual(snapshot(sqlite),before);
  // Unknown provenance cannot identify a genuinely new submission by a different key.
  const newFact=await saveLearningEvent(db,identity,input('explicit-new-fact'),{now});
  assert.notEqual(newFact.event_id,saved.event_id);
});

test('concurrent deletion and lost response replay only one deletion/version; different keys cannot erase twice',async t=>{
  const {db,sqlite,owner,saved}=await setup(t);
  const results=await Promise.all([deleteLearningEvent(db,owner,saved.event_id,deletion(),{now}),deleteLearningEvent(db,owner,saved.event_id,deletion(),{now})]);
  assert.equal(results[0].data_version,results[1].data_version);assert.equal(sqlite.prepare('SELECT data_version FROM learning_state').get().data_version,3);
  await assert.rejects(deleteLearningEvent(db,owner,saved.event_id,deletion('different'),{now}),{code:'EVENT_NOT_FOUND'});
  const f=await setup(t);const lost={...f.db,async batch(statements){await f.db.batch(statements);throw Error('lost response');}};
  assert.equal((await deleteLearningEvent(lost,f.owner,f.saved.event_id,deletion(),{now})).replayed,true);
});

test('in-flight create/correction and owner revocation cannot cross the deletion transaction',async t=>{
  const f=await setup(t);
  const racing={...f.db,async batch(statements){await deleteLearningEvent(f.db,f.owner,f.saved.event_id,deletion(),{now});return f.db.batch(statements);}};
  await assert.rejects(correctLearningEvent(racing,f.identity,f.saved.event_id,{...f.correction,idempotency_key:'racing',expected_revision:2},{now}),{code:'EVENT_DELETED'});
  const g=await setup(t);
  const sourceRace={...g.db,async batch(statements){await deleteLearningEvent(g.db,g.owner,g.saved.event_id,deletion(),{now});return g.db.batch(statements);}};
  await assert.rejects(saveLearningEvent(sourceRace,g.identity,{...g.original,idempotency_key:'source-race'},{now}),{code:'EVENT_DELETED'});
  const h=await setup(t),before=snapshot(h.sqlite);
  const revoked={...h.db,async batch(statements){h.sqlite.exec("UPDATE users SET status='disabled' WHERE user_id='synthetic-owner'");return h.db.batch(statements);}};
  await assert.rejects(deleteLearningEvent(revoked,h.owner,h.saved.event_id,deletion(),{now}),{code:'PRIVATE_ACCESS_DENIED'});
  assert.deepEqual(snapshot(h.sqlite),before);
});

test('isolated restore of pre-delete backup merges surviving ledger, filters bodies and advances high-water version',async t=>{
  const f=await setup(t),backup=snapshot(f.sqlite);
  await deleteLearningEvent(f.db,f.owner,f.saved.event_id,deletion(),{now});const ledger=checkpoint(f.sqlite);
  const restored=await fixture(t,['events:read','context:read','events:write','events:correct']);
  for(const table of ['learning_state','learning_events','event_revisions','ingest_receipts','processing_jobs']) {
    for(const row of backup[table]) {
      // Reconstruct synthetic older snapshot through the existing receipt version guard.
      if(table==='ingest_receipts') restored.sqlite.prepare('UPDATE learning_state SET data_version=? WHERE owner_id=?').run(row.data_version,row.owner_id);
      restored.sqlite.prepare(`INSERT INTO ${table}(${Object.keys(row).join(',')}) VALUES(${Object.keys(row).map(()=>'?').join(',')})`).run(...Object.values(row));
    }
  }
  await filterRestoredLearningData(restored.db,ledger,{isolated:true,now});
  assert.equal(restored.sqlite.prepare('SELECT data_version FROM learning_state').get().data_version,4);
  for(const table of ['learning_events','event_revisions','ingest_receipts','processing_jobs']) assert.equal(restored.sqlite.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n,0);
  await assert.rejects(saveLearningEvent(restored.db,restored.identity,f.original,{now}),{code:'EVENT_DELETED'});
  assert.deepEqual(restored.sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
  await filterRestoredLearningData(restored.db,ledger,{isolated:true,now});
  assert.equal(restored.sqlite.prepare('SELECT data_version FROM learning_state').get().data_version,5);
  const before=snapshot(restored.sqlite);
  await assert.rejects(filterRestoredLearningData(restored.db,{...ledger,markers:[{...ledger.markers[0],data_version:2}]},{isolated:true,now}),{code:'SERVICE_UNAVAILABLE'});
  assert.deepEqual(snapshot(restored.sqlite),before);
  await assert.rejects(filterRestoredLearningData(restored.db,ledger,{isolated:false,now}),{code:'INVALID_INPUT'});
});

test('DELETE HTTP requires signed owner and same-origin JSON; replay/no-store and missing isolation remain correct',async t=>{
  const f=await setup(t),env={DB:f.db,...f.auth.config},options={now,verification:f.auth.verification};
  const request=(jwt=f.auth.cookie,origin='https://synthetic.invalid',body=deletion())=>new Request('https://synthetic.invalid/api/studio/events/'+f.saved.event_id,
    {method:'DELETE',headers:{...(jwt?{'cookie':jwt}:{}),origin,'content-type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await handleStudioEvent(request(null),env,f.saved.event_id,options)).status,401);
  assert.equal((await handleStudioEvent(request(f.auth.cookie,'https://foreign.invalid'),env,f.saved.event_id,options)).status,403);
  assert.equal((await handleStudioEvent(request(f.auth.cookie,undefined,deletion('stale',1)),env,f.saved.event_id,options)).status,409);
  const response=await handleStudioEvent(request(),env,f.saved.event_id,options);assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);
  assert.equal((await response.json()).deleted,true);
  assert.equal((await (await handleStudioEvent(request(),env,f.saved.event_id,options)).json()).replayed,true);
  assert.equal((await handleStudioEvent(request(),env,'missing',options)).status,409); // same owner key, different target
  assert.equal((await handleStudioEvent(request(f.auth.cookie,undefined,deletion('missing')),env,'missing',options)).status,404);
  f.sqlite.exec(readFileSync(new URL('../migrations/0005_private_deletion.sql',import.meta.url),'utf8'));
});

test('surviving marker hides stale backup bodies even before isolated physical cleanup',async t=>{
  const f=await setup(t);
  f.sqlite.prepare('INSERT INTO deleted_learning_events VALUES(?,?,?,?,?,?,?,?)').run('synthetic-owner',f.saved.event_id,'studio','synthetic-source',2,3,now.toISOString(),'surviving-delete');
  assert.equal(await getLearningEvent(f.db,f.owner,f.saved.event_id,{now}),null);
  assert.equal(await getLearningEventHistory(f.db,f.owner,f.saved.event_id,{}, {now}),null);
  const context=await getLearningContext(f.db,f.owner,'teaching',{now});
  assert.deepEqual(context.events,[]);assert.equal(context.latest_observed_event_at,null);
  assert.ok(!context.unknown_ranges.includes('older_events_omitted'));
});

test('restore removes alternate event IDs of the deleted source and captures their retry keys',async t=>{
  const f=await setup(t);
  await deleteLearningEvent(f.db,f.owner,f.saved.event_id,deletion(),{now});const ledger=checkpoint(f.sqlite);
  const restored=await fixture(t);
  const alternate=await saveLearningEvent(restored.db,restored.identity,{...f.original,idempotency_key:'alternate-backup-key'},{now});
  assert.notEqual(alternate.event_id,f.saved.event_id);
  await filterRestoredLearningData(restored.db,ledger,{isolated:true,now});
  assert.equal(restored.sqlite.prepare('SELECT COUNT(*) n FROM learning_events').get().n,0);
  await assert.rejects(saveLearningEvent(restored.db,restored.identity,{...input('alternate-backup-key'),source:{type:'studio',record_id:null}},{now}),{code:'EVENT_DELETED'});
  assert.equal(restored.sqlite.prepare('SELECT event_id FROM deleted_learning_keys WHERE idempotency_key=?').get('alternate-backup-key').event_id,f.saved.event_id);
});

test('restore mutation failures cannot leave a partially filtered database or regress versions',async t=>{
  const f=await setup(t);
  const ledger={schema_version:1,owners:[{owner_id:'synthetic-owner',data_version:8}],
    markers:[{owner_id:'synthetic-owner',event_id:f.saved.event_id,source_type:'studio',source_record_id:'synthetic-source',deleted_revision:2,data_version:3,deleted_at:now.toISOString(),idempotency_key:'restore-delete'}],keys:[]};
  const before=snapshot(f.sqlite);
  for(const [table,operation] of [['deleted_learning_events','INSERT'],['deleted_learning_keys','INSERT'],['learning_state','UPDATE'],...['processing_jobs','ingest_receipts','event_revisions','learning_events'].map(n=>[n,'DELETE'])]) {
    for(const failure of ['ABORT','IGNORE']) {
      f.sqlite.exec(`CREATE TRIGGER synthetic_restore_failure BEFORE ${operation} ON ${table} BEGIN SELECT RAISE(${failure}${failure==='ABORT'?",'synthetic failure'":''}); END`);
      await assert.rejects(filterRestoredLearningData(f.db,ledger,{isolated:true,now}),{code:'SERVICE_UNAVAILABLE'});
      assert.deepEqual(snapshot(f.sqlite),before,`${table}/${failure}`);
      f.sqlite.exec('DROP TRIGGER synthetic_restore_failure');
    }
  }
  f.sqlite.exec("UPDATE learning_state SET data_version=10 WHERE owner_id='synthetic-owner'");
  await filterRestoredLearningData(f.db,ledger,{isolated:true,now});
  assert.equal(f.sqlite.prepare('SELECT data_version FROM learning_state').get().data_version,11);
});
