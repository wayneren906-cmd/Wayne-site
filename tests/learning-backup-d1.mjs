// Trusted offline backup service -> actual memory D1; no production config or disk backup payloads.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {signedOwner,input,now} from './helpers/learning-fixture.mjs';
import {sqlStatements} from './helpers/studio-worker-environment.mjs';
import {verifyLearningOwner,verifyLearningGrant} from '../lib/learning/auth.ts';
import {saveLearningEvent,correctLearningEvent} from '../lib/learning/events.ts';
import {deleteLearningEvent} from '../lib/learning/deletions.ts';
import {exportPrivateLearningBackup,restorePrivateLearningBackup} from '../lib/learning/private-backup.ts';
import {mutateStudioProject,readPublicStudioProjects} from '../lib/studio-projects.ts';
import {emptyProjectContent} from '../lib/ui/project-protocol.ts';
const root=path.resolve(import.meta.dirname,'..'),require=createRequire(fs.realpathSync(path.join(root,'node_modules/wrangler/package.json')));
const {Miniflare}=await import(pathToFileURL(require.resolve('miniflare')).href);
const runtime=new Miniflare({modules:true,script:"export default {fetch(){return new Response('synthetic backup test')}}",compatibilityDate:'2026-05-15',
  host:'127.0.0.1',port:0,d1Databases:{DB:'synthetic-backup-source',RESTORED:'synthetic-backup-destination'},
  d1Persist:false,cachePersist:false,kvPersist:false,r2Persist:false,durableObjectsPersist:false});
try{
  const db=await runtime.getD1Database('DB'),restored=await runtime.getD1Database('RESTORED');
  for(const destination of [db,restored])for(const file of fs.readdirSync(path.join(root,'migrations')).filter(n=>n.endsWith('.sql')).sort())
    for(const sql of sqlStatements(fs.readFileSync(path.join(root,'migrations',file),'utf8')))await destination.prepare(sql).run();
  const auth=await signedOwner();
  await db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').bind('synthetic-owner',auth.config.CF_ACCESS_TEAM_DOMAIN,'synthetic-sub','owner','active',now.toISOString()).run();
  const owner=await verifyLearningOwner(auth.jwt,auth.config,db,auth.verification),key=crypto.getRandomValues(new Uint8Array(32));
  const token='c'.repeat(64),digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),n=>n.toString(16).padStart(2,'0')).join('');
  await db.prepare('INSERT INTO integration_grants(grant_id,owner_id,token_sha256,scopes,expires_at,created_at) VALUES(?,?,?,?,?,?)')
    .bind('synthetic-backup-grant','synthetic-owner',digest,'["events:read","events:write","events:correct","context:read"]',now.getTime()/1000+3600,now.toISOString()).run();
  const grant=await verifyLearningGrant(token,db,now.getTime()/1000);
  const original={...input('d1-backup-original'),source:{type:'studio',record_id:'synthetic-backup-source'}};
  const saved=await saveLearningEvent(db,grant,original,{now});const {schema_version,idempotency_key,...event}=original;
  await correctLearningEvent(db,grant,saved.event_id,{schema_version:1,idempotency_key:'d1-backup-correct',expected_revision:1,reason:'synthetic correction',event:{...event,content:{summary:'synthetic corrected D1 backup fact'}}},{now});
  const kept=await saveLearningEvent(db,owner,input('d1-backup-kept'),{now});
  await mutateStudioProject(db,owner,{action:'save_draft',project_id:'c-engine',expected_revision:0,idempotency_key:'d1-project-draft',content:{...emptyProjectContent(),summary:'synthetic D1 project progress',private_note:'synthetic D1 PRIVATE PROJECT NOTE'}},{now});
  const publish={action:'publish',project_id:'c-engine',expected_revision:1,idempotency_key:'d1-project-publish',confirm_public:true};
  await mutateStudioProject(db,owner,publish,{now});
  const old=await exportPrivateLearningBackup(db,owner,key,{now});
  await deleteLearningEvent(db,owner,saved.event_id,{schema_version:1,idempotency_key:'d1-backup-delete',expected_revision:2},{now});
  await mutateStudioProject(db,owner,{action:'unpublish',project_id:'c-engine',expected_revision:2,idempotency_key:'d1-project-withdraw'},{now});
  const surviving=await exportPrivateLearningBackup(db,owner,key,{now});
  const options={isolated:true,expectedOwnerId:'synthetic-owner',minimumCheckpointVersion:4,minimumProjectRevisions:surviving.project_revisions,now};
  const tables=['users','integration_grants','learning_state','learning_events','event_revisions','ingest_receipts','processing_jobs','deleted_learning_events','deleted_learning_keys','studio_project_records','studio_project_receipts'];
  const empty=async()=>{for(const table of tables)assert.equal((await restored.prepare(`SELECT COUNT(*) n FROM ${table}`).first()).n,0,table);};
  let injections=0;
  for(const [table,operation] of [['users','INSERT'],['integration_grants','INSERT'],['learning_state','INSERT'],['learning_events','INSERT'],['event_revisions','INSERT'],['ingest_receipts','INSERT'],['learning_state','UPDATE'],['deleted_learning_events','INSERT'],['deleted_learning_keys','INSERT'],['studio_project_records','INSERT'],['studio_project_records','UPDATE'],['studio_project_receipts','INSERT'],['integration_grants','UPDATE'],['users','UPDATE']]){
    for(const failure of ['ABORT','IGNORE']){
      await restored.prepare(`CREATE TRIGGER synthetic_restore_failure BEFORE ${operation} ON ${table} BEGIN SELECT RAISE(${failure}${failure==='ABORT'?",'synthetic failure'":''}); END`).run();
      await assert.rejects(restorePrivateLearningBackup(restored,old.backup,surviving.checkpoint,key,options),{code:'SERVICE_UNAVAILABLE'});
      await empty();await restored.prepare('DROP TRIGGER synthetic_restore_failure').run();injections++;
    }
  }
  const result=await restorePrivateLearningBackup(restored,old.backup,surviving.checkpoint,key,options);
  assert.equal(result.data_version,5);assert.equal(result.owner_status,'disabled');
  assert.equal(result.projects_restored,1);assert.equal(result.project_revisions['c-engine'],4);
  const project=await restored.prepare('SELECT private_note,published_json FROM studio_project_records').first();
  assert.equal(project.private_note,'synthetic D1 PRIVATE PROJECT NOTE');assert.equal(project.published_json,null);
  assert.equal((await restored.prepare('SELECT COUNT(*) n FROM learning_events').first()).n,1);
  assert.equal((await restored.prepare('SELECT event_id FROM learning_events').first()).event_id,kept.event_id);
  assert.equal((await restored.prepare('SELECT COUNT(*) n FROM processing_jobs').first()).n,0);
  assert.deepEqual((await restored.prepare('PRAGMA foreign_key_check').all()).results,[]);
  await assert.rejects(verifyLearningOwner(auth.jwt,auth.config,restored,auth.verification),{code:'PRIVATE_ACCESS_DENIED'});
  await assert.rejects(verifyLearningGrant(token,restored,now.getTime()/1000),{code:'PRIVATE_ACCESS_DENIED'});
  await restored.prepare("UPDATE users SET status='active'").run();
  const reauthorized=await verifyLearningOwner(auth.jwt,auth.config,restored,auth.verification);
  assert.deepEqual(await readPublicStudioProjects(restored),[]);
  assert.equal((await mutateStudioProject(restored,reauthorized,publish,{now})).replayed,true);
  assert.deepEqual(await readPublicStudioProjects(restored),[]);
  await assert.rejects(mutateStudioProject(restored,reauthorized,{...publish,idempotency_key:'d1-stale-new-publish-key',expected_revision:2},{now}),{code:'REVISION_CONFLICT'});
  await assert.rejects(verifyLearningGrant(token,restored,now.getTime()/1000),{code:'PRIVATE_ACCESS_DENIED'});
  await assert.rejects(saveLearningEvent(restored,reauthorized,{...original,idempotency_key:'d1-backup-delayed'},{now}),{code:'EVENT_DELETED'});
  await assert.rejects(restorePrivateLearningBackup(restored,old.backup,surviving.checkpoint,key,options),{code:'SERVICE_UNAVAILABLE'});
  console.log(JSON.stringify({passed:true,injections,restored_version:5,retained_events:1,projects_restored:1,project_revision:4,project_publications_restored:0,deleted_source_denied:true,owner_disabled:true,scope:'encrypted offline backup/restore service + memory D1'}));
}finally{await runtime.dispose();}
