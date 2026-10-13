// Explicit memory-only D1 verification. Does not load Wrangler config, credentials or persistent databases.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {saveLearningEvent,correctLearningEvent} from '../lib/learning/events.ts';
import {deleteLearningEvent} from '../lib/learning/deletions.ts';
import {filterRestoredLearningData} from '../lib/learning/restore-deletions.ts';
import {verifyLearningOwner} from '../lib/learning/auth.ts';
import {getLearningEvent,getLearningEventHistory,getLearningContext} from '../lib/learning/reads.ts';
import {signedOwner,input,now} from './helpers/learning-fixture.mjs';

const require=createRequire(fs.realpathSync(new URL('../node_modules/wrangler/package.json',import.meta.url)));
const {Miniflare}=await import(pathToFileURL(require.resolve('miniflare')).href);
const runtime=new Miniflare({modules:true,script:"export default {fetch(){return new Response('synthetic deletion test')}}",
  compatibilityDate:'2026-05-15',host:'127.0.0.1',port:0,d1Databases:{DB:'synthetic-delete',RESTORED:'synthetic-restore'},
  d1Persist:false,cachePersist:false,kvPersist:false,r2Persist:false,durableObjectsPersist:false});
function statements(sql){
  const result=[];let buffer='',trigger=false;
  for(const line of sql.split('\n')) {
    buffer+=line+'\n';if(/^CREATE TRIGGER/i.test(line.trim()))trigger=true;
    if(line.trim().endsWith(';')&&(!trigger||/END;\s*$/.test(line.trim()))){result.push(buffer.trim());buffer='';trigger=false;}
  }
  assert.equal(buffer.trim(),'');return result;
}
const tables=['learning_state','learning_events','event_revisions','ingest_receipts','processing_jobs','deleted_learning_events','deleted_learning_keys'];
const snapshot=async db=>Object.fromEntries(await Promise.all(tables.map(async name=>[name,(await db.prepare(`SELECT * FROM ${name} ORDER BY rowid`).all()).results])));
try {
  const db=await runtime.getD1Database('DB'),restored=await runtime.getD1Database('RESTORED');
  for(const destination of [db,restored]) {
    for(const file of ['0001_initial.sql','0002_learning_events.sql','0003_ingest_outbox.sql','0004_correction_authority.sql','0005_private_deletion.sql','0005_private_deletion.sql']) {
      for(const sql of statements(fs.readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8')))await destination.prepare(sql).run();
    }
    await destination.prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').bind('synthetic-owner','https://synthetic.cloudflareaccess.com','synthetic-sub','owner','active',now.toISOString()).run();
  }
  const auth=await signedOwner(),owner=await verifyLearningOwner(auth.jwt,auth.config,db,auth.verification);
  const original={...input(),source:{type:'studio',record_id:'synthetic-d1-source'}};
  const saved=await saveLearningEvent(db,owner,original,{now});
  const {schema_version,idempotency_key,...event}=original;
  const change={schema_version:1,idempotency_key:'synthetic-d1-correct',expected_revision:1,reason:'synthetic correction',event:{...event,content:{summary:'synthetic changed'}}};
  await correctLearningEvent(db,owner,saved.event_id,change,{now});
  const backup=await snapshot(db),deletion={schema_version:1,idempotency_key:'synthetic-d1-delete',expected_revision:2};
  for(const [table,operation] of [['learning_state','UPDATE'],['deleted_learning_events','INSERT'],['deleted_learning_keys','INSERT'],...['processing_jobs','ingest_receipts','event_revisions','learning_events'].map(n=>[n,'DELETE'])]) {
    for(const fail of ['ABORT','IGNORE']) {
      await db.prepare(`CREATE TRIGGER synthetic_failure BEFORE ${operation} ON ${table} BEGIN SELECT RAISE(${fail}${fail==='ABORT'?",'synthetic failure'":''}); END`).run();
      await assert.rejects(deleteLearningEvent(db,owner,saved.event_id,deletion,{now}),{code:'SERVICE_UNAVAILABLE'});
      assert.deepEqual(await snapshot(db),backup,`${table}/${fail}`);
      await db.prepare('DROP TRIGGER synthetic_failure').run();
    }
  }
  const receipts=await Promise.all([deleteLearningEvent(db,owner,saved.event_id,deletion,{now}),deleteLearningEvent(db,owner,saved.event_id,deletion,{now})]);
  assert.equal(receipts[0].data_version,3);assert.equal(receipts[1].data_version,3);
  assert.equal(await getLearningEvent(db,owner,saved.event_id,{now}),null);
  assert.equal(await getLearningEventHistory(db,owner,saved.event_id,{}, {now}),null);
  assert.deepEqual((await getLearningContext(db,owner,'teaching',{now})).events,[]);
  await assert.rejects(saveLearningEvent(db,owner,original,{now}),{code:'EVENT_DELETED'});
  await assert.rejects(saveLearningEvent(db,owner,{...original,idempotency_key:'new-key'},{now}),{code:'EVENT_DELETED'});
  await assert.rejects(correctLearningEvent(db,owner,saved.event_id,change,{now}),{code:'EVENT_DELETED'});
  const deleted=await snapshot(db);
  for(const table of ['learning_events','event_revisions','ingest_receipts','processing_jobs'])assert.equal(deleted[table].length,0);
  for(const table of ['learning_state','learning_events','event_revisions','ingest_receipts','processing_jobs']) {
    for(const row of backup[table]) {
      if(table==='ingest_receipts')await restored.prepare('UPDATE learning_state SET data_version=? WHERE owner_id=?').bind(row.data_version,row.owner_id).run();
      await restored.prepare(`INSERT INTO ${table}(${Object.keys(row).join(',')}) VALUES(${Object.keys(row).map(()=>'?').join(',')})`).bind(...Object.values(row)).run();
    }
  }
  const checkpoint={schema_version:1,owners:deleted.learning_state.map(({owner_id,data_version})=>({owner_id,data_version})),markers:deleted.deleted_learning_events,keys:deleted.deleted_learning_keys};
  const restoredBefore=await snapshot(restored);
  await restored.prepare("CREATE TRIGGER synthetic_failure BEFORE DELETE ON event_revisions BEGIN SELECT RAISE(IGNORE); END").run();
  await assert.rejects(filterRestoredLearningData(restored,checkpoint,{isolated:true,now}),{code:'SERVICE_UNAVAILABLE'});
  assert.deepEqual(await snapshot(restored),restoredBefore);
  await restored.prepare('DROP TRIGGER synthetic_failure').run();
  await filterRestoredLearningData(restored,checkpoint,{isolated:true,now});
  const filtered=await snapshot(restored);assert.equal(filtered.learning_state[0].data_version,4);
  for(const table of ['learning_events','event_revisions','ingest_receipts','processing_jobs'])assert.equal(filtered[table].length,0);
  for(const destination of [db,restored])assert.deepEqual((await destination.prepare('PRAGMA foreign_key_check').all()).results,[]);
  console.log('Memory D1 deletion: multi-revision purge, 14 rollback injections, concurrency, replay/source denial and filtered restore passed.');
} finally {await runtime.dispose();}
