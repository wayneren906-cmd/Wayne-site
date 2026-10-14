import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,input,now,signedOwner} from './helpers/learning-fixture.mjs';
import {verifyLearningOwner} from '../lib/learning/auth.ts';
import {saveLearningEvent} from '../lib/learning/events.ts';
import {exportPrivateLearningBackup,restorePrivateLearningBackup} from '../lib/learning/private-backup.ts';
import {mutateStudioProject,getStudioProjectDrafts,readPublicStudioProjects} from '../lib/studio-projects.ts';
import {emptyProjectContent} from '../lib/ui/project-protocol.ts';
import {mutateStudioPlan} from '../lib/studio-plans.ts';

const tables=['users','integration_grants','learning_state','learning_events','event_revisions','ingest_receipts','processing_jobs','deleted_learning_events','deleted_learning_keys','studio_project_records','studio_project_receipts','studio_plan_records','studio_plan_receipts'];
const snapshot=sqlite=>Object.fromEntries(tables.map(table=>[table,sqlite.prepare(`SELECT * FROM ${table}`).all()]));
const options={isolated:true,expectedOwnerId:'synthetic-owner',minimumCheckpointVersion:0,now};
const draft=(revision=0,key='project-save',summary='synthetic draft')=>({action:'save_draft',project_id:'c-engine',expected_revision:revision,idempotency_key:key,content:{...emptyProjectContent(),summary,private_note:'SYNTHETIC_PRIVATE_BACKUP_NOTE'}});
const publish={action:'publish',project_id:'c-engine',expected_revision:1,idempotency_key:'project-publish',confirm_public:true};

async function setup(t,{project=true,learning=true}={}){
  const f=await fixture(t),auth=await signedOwner(),owner=await verifyLearningOwner(auth.jwt,auth.config,f.db,auth.verification);
  if(learning)await saveLearningEvent(f.db,owner,input('studio-backup-learning'),{now});
  if(project){await mutateStudioProject(f.db,owner,draft(),{now});await mutateStudioProject(f.db,owner,publish,{now});await mutateStudioProject(f.db,owner,draft(2,'project-edit','synthetic unpublished draft'),{now});}
  return {...f,auth,owner,key:crypto.getRandomValues(new Uint8Array(32))};
}
async function blank(t){const f=await fixture(t);f.sqlite.exec('DELETE FROM integration_grants;DELETE FROM users;');return f;}
async function decode(envelope,key){
  const imported=await crypto.subtle.importKey('raw',key,{name:'AES-GCM'},false,['decrypt']);
  const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:Buffer.from(envelope.iv,'hex'),additionalData:new TextEncoder().encode('wayneo:v1:'+envelope.purpose)},imported,Buffer.from(envelope.ciphertext,'hex'));
  return JSON.parse(new TextDecoder().decode(bytes));
}
async function seal(value,purpose,key){
  const imported=await crypto.subtle.importKey('raw',key,{name:'AES-GCM'},false,['encrypt']),iv=crypto.getRandomValues(new Uint8Array(12));
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode('wayneo:v1:'+purpose)},imported,new TextEncoder().encode(JSON.stringify(value)));
  return {schema_version:1,purpose,iv:Buffer.from(iv).toString('hex'),ciphertext:Buffer.from(encrypted).toString('hex')};
}

test('v3 encrypts learning, private notes, draft/public snapshots and receipts from one authorized database snapshot',async t=>{
  const f=await setup(t);let reads=0;const db={...f.db,async batch(statements){reads++;return f.db.batch(statements);}};
  const bundle=await exportPrivateLearningBackup(db,f.owner,f.key,{now});assert.equal(reads,1);
  assert.ok(!JSON.stringify(bundle).includes('SYNTHETIC_PRIVATE_BACKUP_NOTE'));
  assert.ok(!JSON.stringify(bundle).includes('synthetic unpublished draft'));
  const decoded=await decode(bundle.backup,f.key);assert.equal(decoded.schema_version,3);
  assert.equal(Object.keys(decoded.tables).length,13);assert.equal(decoded.tables.studio_project_receipts.length,3);
  assert.equal(JSON.parse(decoded.tables.studio_project_records[0].published_json).summary,'synthetic draft');
  assert.equal(JSON.parse(decoded.tables.studio_project_records[0].draft_json).summary,'synthetic unpublished draft');
  assert.deepEqual(bundle.project_revisions,{'c-engine':3});
});

test('restore preserves project drafts/notes/receipts, advances revision and keeps every publication private after reauthorization',async t=>{
  const f=await setup(t),bundle=await exportPrivateLearningBackup(f.db,f.owner,f.key,{now}),target=await blank(t);
  const result=await restorePrivateLearningBackup(target.db,bundle.backup,bundle.checkpoint,f.key,{...options,minimumProjectRevisions:bundle.project_revisions});
  assert.equal(result.projects_restored,1);assert.equal(result.project_publications_restored,0);assert.deepEqual(result.project_revisions,{'c-engine':4});
  assert.equal(target.sqlite.prepare('SELECT status FROM users').get().status,'disabled');
  assert.deepEqual(target.sqlite.prepare('SELECT * FROM studio_project_receipts ORDER BY idempotency_key').all(),f.sqlite.prepare('SELECT * FROM studio_project_receipts ORDER BY idempotency_key').all());
  target.sqlite.exec("UPDATE users SET status='active'");const owner=await verifyLearningOwner(f.auth.jwt,f.auth.config,target.db,f.auth.verification);
  const row=(await getStudioProjectDrafts(target.db,owner))[0];assert.equal(row.revision,4);assert.equal(row.private_note,'SYNTHETIC_PRIVATE_BACKUP_NOTE');assert.equal(row.draft.summary,'synthetic unpublished draft');assert.equal(row.publication,null);
  assert.deepEqual(await readPublicStudioProjects(target.db),[]);
  assert.equal((await mutateStudioProject(target.db,owner,publish,{now})).replayed,true);
  assert.deepEqual(await readPublicStudioProjects(target.db),[],'historical publication receipts do not restore public visibility');
  assert.deepEqual(target.sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
});

test('a surviving newer project checkpoint protects against withdrawal resurrection without any learning-version change',async t=>{
  const f=await setup(t,{learning:false}),old=await exportPrivateLearningBackup(f.db,f.owner,f.key,{now});
  await mutateStudioProject(f.db,f.owner,{action:'unpublish',project_id:'c-engine',expected_revision:3,idempotency_key:'new-withdrawal'},{now});
  const current=await exportPrivateLearningBackup(f.db,f.owner,f.key,{now});assert.equal(old.data_version,current.data_version);
  const target=await blank(t);
  await assert.rejects(restorePrivateLearningBackup(target.db,old.backup,old.checkpoint,f.key,{...options,minimumProjectRevisions:current.project_revisions}),{code:'INVALID_INPUT'});
  await restorePrivateLearningBackup(target.db,old.backup,current.checkpoint,f.key,{...options,minimumProjectRevisions:current.project_revisions});
  target.sqlite.exec("UPDATE users SET status='active'");const owner=await verifyLearningOwner(f.auth.jwt,f.auth.config,target.db,f.auth.verification);
  assert.equal((await getStudioProjectDrafts(target.db,owner))[0].revision,5);
  await assert.rejects(mutateStudioProject(target.db,owner,{...publish,expected_revision:3,idempotency_key:'delayed-new-publication-key'},{now}),{code:'REVISION_CONFLICT'});
  assert.deepEqual(await readPublicStudioProjects(target.db),[]);
});

test('project restore requires explicit fresh revision floors and refuses to silently omit projects created after the backup',async t=>{
  const f=await setup(t),bundle=await exportPrivateLearningBackup(f.db,f.owner,f.key,{now}),target=await blank(t),before=snapshot(target.sqlite);
  for(const minimumProjectRevisions of [undefined,{}, {'c-engine':0},{'c-engine':4},{'c-engine':3,'embedded-controller':1}]){
    await assert.rejects(restorePrivateLearningBackup(target.db,bundle.backup,bundle.checkpoint,f.key,{...options,minimumProjectRevisions}),{code:'INVALID_INPUT'});assert.deepEqual(snapshot(target.sqlite),before);
  }
  await mutateStudioProject(f.db,f.owner,{...draft(0,'second-project'),project_id:'embedded-controller'},{now});
  const current=await exportPrivateLearningBackup(f.db,f.owner,f.key,{now});
  await assert.rejects(restorePrivateLearningBackup(target.db,bundle.backup,current.checkpoint,f.key,{...options,minimumProjectRevisions:current.project_revisions}),{code:'INVALID_INPUT'});assert.deepEqual(snapshot(target.sqlite),before);
});

test('legacy v1 learning backup remains readable but cannot bypass the newer project checkpoint',async t=>{
  const f=await setup(t,{project:false}),bundle=await exportPrivateLearningBackup(f.db,f.owner,f.key,{now}),decoded=await decode(bundle.backup,f.key),checkpoint=await decode(bundle.checkpoint,f.key);
  delete decoded.tables.studio_project_records;delete decoded.tables.studio_project_receipts;delete decoded.tables.studio_plan_records;delete decoded.tables.studio_plan_receipts;decoded.schema_version=1;
  const legacyBackup=await seal(decoded,'private_backup',f.key),legacyCheckpoint=await seal(checkpoint.learning,'deletion_checkpoint',f.key),target=await blank(t);
  const result=await restorePrivateLearningBackup(target.db,legacyBackup,legacyCheckpoint,f.key,options);assert.equal(result.projects_restored,0);
  assert.equal(target.sqlite.prepare('SELECT COUNT(*) n FROM learning_events').get().n,1);
  await mutateStudioProject(f.db,f.owner,draft(),{now});const current=await exportPrivateLearningBackup(f.db,f.owner,f.key,{now}),fresh=await blank(t);
  await assert.rejects(restorePrivateLearningBackup(fresh.db,legacyBackup,current.checkpoint,f.key,{...options,minimumProjectRevisions:current.project_revisions}),{code:'INVALID_INPUT'});
});

test('project restore aborts and rolls back all thirteen tables on failed or ignored project writes',async t=>{
  const f=await setup(t),bundle=await exportPrivateLearningBackup(f.db,f.owner,f.key,{now}),target=await blank(t),before=snapshot(target.sqlite);
  for(const [table,operation] of [['studio_project_records','INSERT'],['studio_project_records','UPDATE'],['studio_project_receipts','INSERT']])for(const mode of ['ABORT','IGNORE']){
    target.sqlite.exec(`CREATE TRIGGER synthetic_backup_failure BEFORE ${operation} ON ${table} BEGIN SELECT RAISE(${mode}${mode==='ABORT'?',\'synthetic failure\'':''}); END;`);
    await assert.rejects(restorePrivateLearningBackup(target.db,bundle.backup,bundle.checkpoint,f.key,{...options,minimumProjectRevisions:bundle.project_revisions}),{code:'SERVICE_UNAVAILABLE'});
    assert.deepEqual(snapshot(target.sqlite),before);target.sqlite.exec('DROP TRIGGER synthetic_backup_failure');
  }
});

test('legacy v2 project archives stay readable but cannot omit a newer personal-goal checkpoint',async t=>{
  const f=await setup(t),bundle=await exportPrivateLearningBackup(f.db,f.owner,f.key,{now}),decoded=await decode(bundle.backup,f.key),checkpoint=await decode(bundle.checkpoint,f.key);
  delete decoded.tables.studio_plan_records;delete decoded.tables.studio_plan_receipts;decoded.schema_version=2;
  delete checkpoint.plan_revision;checkpoint.schema_version=2;
  const old=await seal(decoded,'private_backup',f.key),oldCheckpoint=await seal(checkpoint,'deletion_checkpoint',f.key),target=await blank(t);
  const result=await restorePrivateLearningBackup(target.db,old,oldCheckpoint,f.key,{...options,minimumProjectRevisions:bundle.project_revisions});assert.equal(result.projects_restored,1);assert.equal(result.plans_restored,0);
  await mutateStudioPlan(f.db,f.owner,{action:'save_draft',plan_id:'personal-goals',expected_revision:0,idempotency_key:'backup-new-plan',content:{goals:[],private_note:'synthetic note'}},{now});
  const current=await exportPrivateLearningBackup(f.db,f.owner,f.key,{now}),fresh=await blank(t);
  await assert.rejects(restorePrivateLearningBackup(fresh.db,old,current.checkpoint,f.key,{...options,minimumProjectRevisions:current.project_revisions,minimumPlanRevision:current.plan_revision}),{code:'INVALID_INPUT'});
  await assert.rejects(restorePrivateLearningBackup(fresh.db,old,oldCheckpoint,f.key,{...options,minimumProjectRevisions:current.project_revisions,minimumPlanRevision:current.plan_revision}),{code:'INVALID_INPUT'});
});

test('project backup validates ownership, content schema and receipt associations before mutation',async t=>{
  const f=await setup(t),bundle=await exportPrivateLearningBackup(f.db,f.owner,f.key,{now}),target=await blank(t),before=snapshot(target.sqlite);
  for(const change of [data=>{data.tables.studio_project_records[0].owner_id='foreign';},data=>{data.tables.studio_project_receipts[0].revision=100;},data=>{data.tables.studio_project_records[0].published_json=JSON.stringify({...emptyProjectContent(),summary:'synthetic',private_note:'should never be published'});}]){
    const decoded=await decode(bundle.backup,f.key);change(decoded);const corrupt=await seal(decoded,'private_backup',f.key);
    await assert.rejects(restorePrivateLearningBackup(target.db,corrupt,bundle.checkpoint,f.key,{...options,minimumProjectRevisions:bundle.project_revisions}),{code:'INVALID_INPUT'});assert.deepEqual(snapshot(target.sqlite),before);
  }
});

test('lost restore response leaves projects private and the owner disabled; a second restore cannot overwrite the result',async t=>{
  const f=await setup(t),bundle=await exportPrivateLearningBackup(f.db,f.owner,f.key,{now}),target=await blank(t);
  const lost={...target.db,async batch(statements){await target.db.batch(statements);throw Error('synthetic lost restore response');}};
  await assert.rejects(restorePrivateLearningBackup(lost,bundle.backup,bundle.checkpoint,f.key,{...options,minimumProjectRevisions:bundle.project_revisions}),{code:'SERVICE_UNAVAILABLE'});
  assert.equal(target.sqlite.prepare('SELECT status FROM users').get().status,'disabled');assert.equal(target.sqlite.prepare('SELECT published_json FROM studio_project_records').get().published_json,null);
  await assert.rejects(restorePrivateLearningBackup(target.db,bundle.backup,bundle.checkpoint,f.key,{...options,minimumProjectRevisions:bundle.project_revisions}),{code:'SERVICE_UNAVAILABLE'});
});
