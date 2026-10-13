import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,input,now,signedOwner,token} from './helpers/learning-fixture.mjs';
import {verifyLearningOwner,verifyLearningGrant} from '../lib/learning/auth.ts';
import {saveLearningEvent,correctLearningEvent} from '../lib/learning/events.ts';
import {deleteLearningEvent} from '../lib/learning/deletions.ts';
import {getLearningEvent} from '../lib/learning/reads.ts';
import {exportPrivateLearningBackup,restorePrivateLearningBackup} from '../lib/learning/private-backup.ts';

const key=()=>crypto.getRandomValues(new Uint8Array(32));
const tables=['users','integration_grants','learning_state','learning_events','event_revisions','ingest_receipts','processing_jobs','deleted_learning_events','deleted_learning_keys'];
const snapshot=sqlite=>Object.fromEntries(tables.map(t=>[t,sqlite.prepare(`SELECT * FROM ${t}`).all()]));
async function setup(t){
  const f=await fixture(t,['events:write','events:correct','events:read','context:read']);const auth=await signedOwner();
  const owner=await verifyLearningOwner(auth.jwt,auth.config,f.db,auth.verification);
  const original={...input('backup-original'),source:{type:'studio',record_id:'synthetic-backup-source'}};
  const saved=await saveLearningEvent(f.db,f.identity,original,{now});
  const {schema_version,idempotency_key,...event}=original;
  await correctLearningEvent(f.db,f.identity,saved.event_id,{schema_version:1,idempotency_key:'backup-correction',expected_revision:1,reason:'synthetic correction',event:{...event,content:{summary:'synthetic corrected backup fact'}}},{now});
  const kept=await saveLearningEvent(f.db,f.identity,input('backup-kept'),{now});
  return {...f,auth,owner,saved,kept,original};
}
async function blank(t){const f=await fixture(t);f.sqlite.exec('DELETE FROM integration_grants; DELETE FROM users;');return f;}
const options={isolated:true,expectedOwnerId:'synthetic-owner',minimumCheckpointVersion:0,now};

test('encrypted full backup restores revisions/receipts exactly with disabled owner, revoked grants and no old jobs',async t=>{
  const f=await setup(t),k=key();const exported=await exportPrivateLearningBackup(f.db,f.owner,k,{now});
  const serialized=JSON.stringify(exported);
  for(const secret of ['synthetic private fact','synthetic corrected backup fact','synthetic-owner','synthetic-grant','payload_json','token_sha256'])assert.ok(!serialized.includes(secret));
  const fresh=await exportPrivateLearningBackup(f.db,f.owner,k,{now});assert.notEqual(fresh.backup.iv,exported.backup.iv);
  const restored=await blank(t);const result=await restorePrivateLearningBackup(restored.db,exported.backup,exported.checkpoint,k,options);
  assert.equal(result.data_version,4);assert.equal(result.owner_status,'disabled');assert.equal(result.grants_revoked,true);
  for(const [table,order] of [['learning_events','event_id'],['event_revisions','event_id,revision'],['ingest_receipts','receipt_id']])assert.deepEqual(restored.sqlite.prepare(`SELECT * FROM ${table} ORDER BY ${order}`).all(),f.sqlite.prepare(`SELECT * FROM ${table} ORDER BY ${order}`).all());
  assert.equal(restored.sqlite.prepare('SELECT COUNT(*) n FROM processing_jobs').get().n,0);
  assert.deepEqual(restored.sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
  await assert.rejects(verifyLearningGrant(token,restored.db,now.getTime()/1000),{code:'PRIVATE_ACCESS_DENIED'});
  await assert.rejects(verifyLearningOwner(f.auth.jwt,f.auth.config,restored.db,f.auth.verification),{code:'PRIVATE_ACCESS_DENIED'});
  restored.sqlite.exec("UPDATE users SET status='active'");
  const reauthorized=await verifyLearningOwner(f.auth.jwt,f.auth.config,restored.db,f.auth.verification);
  assert.equal((await getLearningEvent(restored.db,reauthorized,f.saved.event_id,{now})).content.summary,'synthetic corrected backup fact');
  await assert.rejects(verifyLearningGrant(token,restored.db,now.getTime()/1000),{code:'PRIVATE_ACCESS_DENIED'});
});

test('older encrypted backup plus independently surviving checkpoint cannot revive deleted event/source/keys',async t=>{
  const f=await setup(t),k=key();const old=await exportPrivateLearningBackup(f.db,f.owner,k,{now});
  await deleteLearningEvent(f.db,f.owner,f.saved.event_id,{schema_version:1,idempotency_key:'backup-delete',expected_revision:2},{now});
  const surviving=await exportPrivateLearningBackup(f.db,f.owner,k,{now});
  const restored=await blank(t);
  await restorePrivateLearningBackup(restored.db,old.backup,surviving.checkpoint,k,{...options,minimumCheckpointVersion:4});
  assert.equal(restored.sqlite.prepare('SELECT data_version FROM learning_state').get().data_version,5);
  assert.equal(restored.sqlite.prepare('SELECT COUNT(*) n FROM learning_events').get().n,1);
  assert.equal(restored.sqlite.prepare('SELECT event_id FROM learning_events').get().event_id,f.kept.event_id);
  assert.equal(restored.sqlite.prepare('SELECT COUNT(*) n FROM event_revisions WHERE event_id=?').get(f.saved.event_id).n,0);
  restored.sqlite.exec("UPDATE users SET status='active'");
  const owner=await verifyLearningOwner(f.auth.jwt,f.auth.config,restored.db,f.auth.verification);
  await assert.rejects(saveLearningEvent(restored.db,owner,{...f.original,idempotency_key:'delayed-new-key'},{now}),{code:'EVENT_DELETED'});
  assert.deepEqual(restored.sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
});

test('tampered ciphertext, wrong key/purpose/owner, stale checkpoint and absent isolation reject before writing',async t=>{
  const f=await setup(t),k=key(),bundle=await exportPrivateLearningBackup(f.db,f.owner,k,{now});const restored=await blank(t),before=snapshot(restored.sqlite);
  const bad={...bundle.backup,ciphertext:(bundle.backup.ciphertext[0]==='0'?'1':'0')+bundle.backup.ciphertext.slice(1)};
  for(const [backup,checkpoint,secret,opts] of [[bad,bundle.checkpoint,k,options],[bundle.backup,bundle.checkpoint,key(),options],
    [bundle.checkpoint,bundle.backup,k,options],[bundle.backup,bundle.checkpoint,k,{...options,expectedOwnerId:'synthetic-other'}],
    [bundle.backup,bundle.checkpoint,k,{...options,minimumCheckpointVersion:4}],[bundle.backup,bundle.checkpoint,k,{...options,isolated:false}]]){
    await assert.rejects(restorePrivateLearningBackup(restored.db,backup,checkpoint,secret,opts),{code:'INVALID_INPUT'});assert.deepEqual(snapshot(restored.sqlite),before);
  }
});

test('each restore mutation abort/ignore rolls back entire destination including authority changes',async t=>{
  const f=await setup(t),k=key(),bundle=await exportPrivateLearningBackup(f.db,f.owner,k,{now}),restored=await blank(t),before=snapshot(restored.sqlite);
  for(const [table,operation] of [['users','INSERT'],['integration_grants','INSERT'],['learning_state','INSERT'],['learning_events','INSERT'],['event_revisions','INSERT'],['ingest_receipts','INSERT'],['learning_state','UPDATE'],['integration_grants','UPDATE'],['users','UPDATE']]){
    for(const failure of ['ABORT','IGNORE']){
      restored.sqlite.exec(`CREATE TRIGGER synthetic_restore_failure BEFORE ${operation} ON ${table} BEGIN SELECT RAISE(${failure}${failure==='ABORT'?",'synthetic failure'":''}); END`);
      await assert.rejects(restorePrivateLearningBackup(restored.db,bundle.backup,bundle.checkpoint,k,options),{code:'SERVICE_UNAVAILABLE'});
      assert.deepEqual(snapshot(restored.sqlite),before,`${table}/${operation}/${failure}`);restored.sqlite.exec('DROP TRIGGER synthetic_restore_failure');
    }
  }
});

test('backup requires verified active owner; a nonempty destination cannot be overwritten',async t=>{
  const f=await setup(t),k=key();
  for(const principal of [null,f.identity,JSON.parse(JSON.stringify(f.owner))])await assert.rejects(exportPrivateLearningBackup(f.db,principal,k,{now}),{code:'PRIVATE_ACCESS_DENIED'});
  const bundle=await exportPrivateLearningBackup(f.db,f.owner,k,{now}),before=snapshot(f.sqlite);
  await assert.rejects(restorePrivateLearningBackup(f.db,bundle.backup,bundle.checkpoint,k,options),{code:'SERVICE_UNAVAILABLE'});assert.deepEqual(snapshot(f.sqlite),before);
  f.sqlite.exec("UPDATE users SET status='disabled' WHERE user_id='synthetic-owner'");
  await assert.rejects(exportPrivateLearningBackup(f.db,f.owner,k,{now}),{code:'PRIVATE_ACCESS_DENIED'});
});

test('restore supports historical revoked/narrow grants without temporarily committing enabled authority',async t=>{
  const f=await setup(t),k=key();f.sqlite.prepare('UPDATE integration_grants SET scopes=?,revoked_at=?').run('["context:read"]',now.toISOString());
  const bundle=await exportPrivateLearningBackup(f.db,f.owner,k,{now}),restored=await blank(t);
  await restorePrivateLearningBackup(restored.db,bundle.backup,bundle.checkpoint,k,options);
  const grant=restored.sqlite.prepare('SELECT * FROM integration_grants').get();assert.equal(grant.scopes,'["context:read"]');assert.equal(grant.revoked_at,now.toISOString());
  assert.equal(restored.sqlite.prepare('SELECT status FROM users').get().status,'disabled');
});

test('empty owner backup restores a disabled owner with a fresh monotonic state',async t=>{
  const f=await fixture(t),auth=await signedOwner(),owner=await verifyLearningOwner(auth.jwt,auth.config,f.db,auth.verification),k=key();
  const bundle=await exportPrivateLearningBackup(f.db,owner,k,{now});assert.equal(bundle.data_version,0);
  const restored=await blank(t);const result=await restorePrivateLearningBackup(restored.db,bundle.backup,bundle.checkpoint,k,options);
  assert.equal(result.data_version,1);assert.equal(restored.sqlite.prepare('SELECT COUNT(*) n FROM learning_events').get().n,0);
  assert.equal(restored.sqlite.prepare('SELECT status FROM users').get().status,'disabled');
});

test('backup authorization is fresh within its snapshot and corrupt history cannot become a backup',async t=>{
  const f=await setup(t),k=key();const racing={...f.db,async batch(statements){f.sqlite.exec("UPDATE users SET status='disabled' WHERE user_id='synthetic-owner'");return f.db.batch(statements);}};
  await assert.rejects(exportPrivateLearningBackup(racing,f.owner,k,{now}),{code:'PRIVATE_ACCESS_DENIED'});
  f.sqlite.exec("UPDATE users SET status='active' WHERE user_id='synthetic-owner'");
  f.sqlite.prepare('UPDATE learning_events SET current_revision=3 WHERE event_id=?').run(f.saved.event_id);
  await assert.rejects(exportPrivateLearningBackup(f.db,f.owner,k,{now}),{code:'INVALID_INPUT'});
});

test('response loss after restore leaves the complete closed destination, never a writable partial import',async t=>{
  const f=await setup(t),k=key(),bundle=await exportPrivateLearningBackup(f.db,f.owner,k,{now}),restored=await blank(t);
  const lost={...restored.db,async batch(statements){await restored.db.batch(statements);throw Error('synthetic response loss');}};
  await assert.rejects(restorePrivateLearningBackup(lost,bundle.backup,bundle.checkpoint,k,options),{code:'SERVICE_UNAVAILABLE'});
  assert.equal(restored.sqlite.prepare('SELECT COUNT(*) n FROM learning_events').get().n,2);
  assert.equal(restored.sqlite.prepare('SELECT status FROM users').get().status,'disabled');
  assert.equal(restored.sqlite.prepare('SELECT COUNT(*) n FROM integration_grants WHERE revoked_at IS NULL').get().n,0);
  assert.deepEqual(restored.sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
  await assert.rejects(restorePrivateLearningBackup(restored.db,bundle.backup,bundle.checkpoint,k,options),{code:'SERVICE_UNAVAILABLE'});
});
