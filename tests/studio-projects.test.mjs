import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture,signedOwner,now} from './helpers/learning-fixture.mjs';
import {verifyLearningOwner} from '../lib/learning/auth.ts';
import {mutateStudioProject,getStudioProjectDrafts,readPublicStudioProjects} from '../lib/studio-projects.ts';
import {handleStudioProjects} from '../lib/learning/http.ts';
import {emptyProjectContent} from '../lib/ui/project-protocol.ts';

async function environment(t){
  const f=await fixture(t),auth=await signedOwner();
  const migration=readFileSync(new URL('../migrations/0006_studio_projects.sql',import.meta.url),'utf8');f.sqlite.exec(migration);
  const owner=await verifyLearningOwner(auth.jwt,auth.config,f.db,auth.verification);
  return {...f,owner,auth,migration,env:{DB:f.db,...auth.config},options:{now,verification:auth.verification}};
}
const save=(revision=0,key='save-1',patch={})=>({action:'save_draft',project_id:'c-engine',expected_revision:revision,idempotency_key:key,content:{...emptyProjectContent(),status:'in_progress',summary:'synthetic public progress',next_step:'synthetic next step',private_note:'synthetic PRIVATE NOTE',...patch}});
const publish=(revision,key='publish-1')=>({action:'publish',project_id:'c-engine',expected_revision:revision,idempotency_key:key,confirm_public:true});
const withdraw=(revision,key='unpublish-1')=>({action:'unpublish',project_id:'c-engine',expected_revision:revision,idempotency_key:key});
const snapshot=f=>({projects:f.sqlite.prepare('SELECT * FROM studio_project_records ORDER BY owner_id,project_id').all(),receipts:f.sqlite.prepare('SELECT * FROM studio_project_receipts ORDER BY owner_id,idempotency_key').all()});

test('project migration is additive, repeatable and contains no seed publication or draft',async t=>{
  const f=await environment(t),before=snapshot(f);f.sqlite.exec(f.migration);assert.deepEqual(snapshot(f),before);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM records').get().n,0);
  assert.deepEqual(await readPublicStudioProjects(f.db),[]);assert.deepEqual(await getStudioProjectDrafts(f.db,f.owner),[]);
});

test('private project draft only becomes public after explicit publication, never exposing notes, keys or owner identities',async t=>{
  const f=await environment(t),saved=await mutateStudioProject(f.db,f.owner,save(),{now});assert.equal(saved.revision,1);
  assert.deepEqual(await readPublicStudioProjects(f.db),[]);
  await assert.rejects(mutateStudioProject(f.db,f.owner,{...publish(1),confirm_public:false},{now}),{code:'INVALID_INPUT'});
  const receipt=await mutateStudioProject(f.db,f.owner,publish(1),{now});assert.equal(receipt.revision,2);
  const result=await readPublicStudioProjects(f.db);assert.equal(result.length,1);assert.equal(result[0].content.summary,'synthetic public progress');
  for(const secret of ['PRIVATE NOTE','owner_id','synthetic-owner','idempotency_key','draft_json'])assert.ok(!JSON.stringify(result).includes(secret),secret);
});

test('editing an already published project preserves its old public snapshot until the new draft is explicitly published',async t=>{
  const f=await environment(t);await mutateStudioProject(f.db,f.owner,save(),{now});await mutateStudioProject(f.db,f.owner,publish(1),{now});
  await mutateStudioProject(f.db,f.owner,save(2,'private-edit',{summary:'synthetic unpublished replacement',private_note:'different PRIVATE NOTE'}),{now});
  assert.equal((await readPublicStudioProjects(f.db))[0].content.summary,'synthetic public progress');
  const privateRow=(await getStudioProjectDrafts(f.db,f.owner))[0];assert.equal(privateRow.revision,3);assert.equal(privateRow.publication.revision,2);assert.equal(privateRow.draft.summary,'synthetic unpublished replacement');
  await mutateStudioProject(f.db,f.owner,publish(3,'publish-new'),{now});assert.equal((await readPublicStudioProjects(f.db))[0].content.summary,'synthetic unpublished replacement');
  await mutateStudioProject(f.db,f.owner,withdraw(4),{now});assert.deepEqual(await readPublicStudioProjects(f.db),[]);
  assert.equal((await getStudioProjectDrafts(f.db,f.owner))[0].private_note,'different PRIVATE NOTE');
  await mutateStudioProject(f.db,f.owner,publish(3,'publish-new'),{now});assert.deepEqual(await readPublicStudioProjects(f.db),[],'replaying a prior publication receipt must not republish withdrawn content');
});

test('project CAS and idempotency protect retries, concurrency, changed payloads and missing drafts',async t=>{
  const f=await environment(t);
  const [a,b]=await Promise.all([mutateStudioProject(f.db,f.owner,save(),{now}),mutateStudioProject(f.db,f.owner,save(),{now})]);
  assert.equal(a.revision,1);assert.equal(b.revision,1);assert.equal(snapshot(f).receipts.length,1);
  await assert.rejects(mutateStudioProject(f.db,f.owner,save(0,'save-1',{summary:'changed'}),{now}),{code:'IDEMPOTENCY_CONFLICT'});
  await assert.rejects(mutateStudioProject(f.db,f.owner,save(0,'different-key'),{now}),{code:'REVISION_CONFLICT'});
  await assert.rejects(mutateStudioProject(f.db,f.owner,{...publish(0),project_id:'embedded-controller'},{now}),{code:'REVISION_CONFLICT'});
});

test('project publication rejects empty descriptions, contradictory completion states and injected private ownership',async t=>{
  const f=await environment(t);await mutateStudioProject(f.db,f.owner,save(0,'empty',{summary:''}),{now});
  await assert.rejects(mutateStudioProject(f.db,f.owner,publish(1),{now}),{code:'INVALID_INPUT'});
  await assert.rejects(mutateStudioProject(f.db,f.owner,save(1,'wrong-completion',{status:'completed'}),{now}),{code:'INVALID_INPUT'});
  await assert.rejects(mutateStudioProject(f.db,f.owner,{...save(1),owner_id:'synthetic-other'},{now}),{code:'INVALID_INPUT'});
  await mutateStudioProject(f.db,f.owner,save(1,'complete',{status:'completed',milestones:{interface:'completed',implementation:'completed',verification:'completed'}}),{now});
  assert.equal((await getStudioProjectDrafts(f.db,f.owner))[0].draft.status,'completed');
});

test('project draft reads and writes require a branded owner, isolate owners and recheck revocation inside writes',async t=>{
  const f=await environment(t);
  for(const identity of [null,f.identity,JSON.parse(JSON.stringify(f.owner))]){
    await assert.rejects(getStudioProjectDrafts(f.db,identity),{code:'PRIVATE_ACCESS_DENIED'});
    await assert.rejects(mutateStudioProject(f.db,identity,save(),{now}),{code:'PRIVATE_ACCESS_DENIED'});
  }
  await mutateStudioProject(f.db,f.owner,save(),{now});
  const auth=await signedOwner('synthetic-other-sub'),other=await verifyLearningOwner(auth.jwt,auth.config,f.db,auth.verification);
  assert.deepEqual(await getStudioProjectDrafts(f.db,other),[]);
  await assert.rejects(mutateStudioProject(f.db,other,publish(1),{now}),{code:'REVISION_CONFLICT'});
  let batches=0;const racing={...f.db,async batch(statements){if(++batches===2)f.sqlite.exec("UPDATE users SET status='disabled' WHERE user_id='synthetic-owner'");return f.db.batch(statements);}};
  await assert.rejects(mutateStudioProject(racing,f.owner,publish(1),{now}),{code:'PRIVATE_ACCESS_DENIED'});
  assert.equal(snapshot(f).projects[0].published_json,null);assert.equal(snapshot(f).receipts.length,1);
});

test('every failed or ignored required project write rolls back the draft and its publication atomically',async t=>{
  for(const table of ['studio_project_records','studio_project_receipts'])for(const mode of ['ABORT','IGNORE']){
    const f=await environment(t);await mutateStudioProject(f.db,f.owner,save(),{now});const before=snapshot(f);
    const action=table==='studio_project_records'?'UPDATE':'INSERT';
    f.sqlite.exec(`CREATE TRIGGER synthetic_project_fail BEFORE ${action} ON ${table} BEGIN SELECT RAISE(${mode}${mode==='ABORT'?',\'synthetic failure\'':''}); END;`);
    await assert.rejects(mutateStudioProject(f.db,f.owner,publish(1),{now}),{code:'SERVICE_UNAVAILABLE'});assert.deepEqual(snapshot(f),before);
  }
});

test('project commit response loss recovers the exact receipt without creating duplicate revisions',async t=>{
  const f=await environment(t);let batches=0;
  const lost={...f.db,async batch(statements){const result=await f.db.batch(statements);if(++batches===2)throw Error('synthetic commit response loss');return result;}};
  const receipt=await mutateStudioProject(lost,f.owner,save(),{now});assert.equal(receipt.replayed,true);assert.equal(receipt.revision,1);assert.equal(snapshot(f).receipts.length,1);
});

test('public project snapshots hide disabled owners and reject malformed publication data instead of returning draft fallbacks',async t=>{
  const f=await environment(t);await mutateStudioProject(f.db,f.owner,save(),{now});await mutateStudioProject(f.db,f.owner,publish(1),{now});
  f.sqlite.exec("UPDATE users SET status='disabled' WHERE user_id='synthetic-owner'");assert.deepEqual(await readPublicStudioProjects(f.db),[]);
  f.sqlite.exec("UPDATE users SET status='active' WHERE user_id='synthetic-owner'");
  f.sqlite.prepare('UPDATE studio_project_records SET published_json=?').run(JSON.stringify({...emptyProjectContent(),summary:'synthetic',private_note:'PRIVATE NOTE'}));
  await assert.rejects(readPublicStudioProjects(f.db),{code:'SERVICE_UNAVAILABLE'});
});

test('project HTTP denies forged or anonymous identity, cross-origin writes and unsupported input while retaining no-store',async t=>{
  const f=await environment(t),request=(token=f.auth.jwt,method='GET',body,origin='https://synthetic.invalid')=>new Request('https://synthetic.invalid/api/studio/projects',{method,headers:{...(token?{'cf-access-jwt-assertion':token}:{}),...(body?{'content-type':'application/json',origin}:{})},...(body?{body:JSON.stringify(body)}:{})});
  assert.equal((await handleStudioProjects(request(null),f.env,f.options)).status,401);assert.equal((await handleStudioProjects(request('forged'),f.env,f.options)).status,403);
  assert.equal((await handleStudioProjects(request(f.auth.jwt,'POST',save(),'https://foreign.invalid'),f.env,f.options)).status,403);
  const result=await handleStudioProjects(request(f.auth.jwt,'POST',save()),f.env,f.options);assert.equal(result.status,200);assert.match(result.headers.get('cache-control'),/no-store/);assert.equal(result.headers.get('vary'),'cf-access-jwt-assertion');
  assert.equal((await handleStudioProjects(request(f.auth.jwt,'POST',{...publish(1),confirm_public:false}),f.env,f.options)).status,400);
  const read=await handleStudioProjects(request(),f.env,f.options);assert.equal((await read.json()).projects[0].private_note,'synthetic PRIVATE NOTE');
});
