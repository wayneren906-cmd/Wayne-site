import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,signedOwner,now} from './helpers/learning-fixture.mjs';
import {verifyLearningOwner} from '../lib/learning/auth.ts';
import {mutateStudioPlan,getStudioPlanDrafts,readPublicStudioPlans} from '../lib/studio-plans.ts';
import {handleStudioPlans} from '../lib/learning/http.ts';
import {exportPrivateLearningBackup,restorePrivateLearningBackup} from '../lib/learning/private-backup.ts';
const goal={id:'synthetic-goal',title:'Synthetic goal',status:'in_progress',summary:'Synthetic public explanation',next_step:'Synthetic next step',target_date:'2026-10-31'};
const save=(revision=0,key='plan-save',patch={})=>({plan_id:'personal-goals',action:'save_draft',expected_revision:revision,idempotency_key:key,content:{goals:[goal],private_note:'SYNTHETIC_PRIVATE_PLAN_NOTE',...patch}});
const publish=(revision=1,key='plan-publish')=>({plan_id:'personal-goals',action:'publish',expected_revision:revision,idempotency_key:key,confirm_public:true});
const withdraw=(revision=2,key='plan-withdraw')=>({plan_id:'personal-goals',action:'unpublish',expected_revision:revision,idempotency_key:key});
async function setup(t){const f=await fixture(t),auth=await signedOwner(),owner=await verifyLearningOwner(auth.jwt,auth.config,f.db,auth.verification);return {...f,auth,owner};}
const snapshot=f=>({plans:f.sqlite.prepare('SELECT * FROM studio_plan_records').all(),receipts:f.sqlite.prepare('SELECT * FROM studio_plan_receipts').all()});
async function blank(t){const f=await fixture(t);f.sqlite.exec('DELETE FROM integration_grants; DELETE FROM users;');return f;}
test('goal draft, publication, edited draft, withdrawal and old publication replay keep public/private boundaries',async t=>{
  const f=await setup(t);assert.deepEqual(await readPublicStudioPlans(f.db),[]);await mutateStudioPlan(f.db,f.owner,save(),{now});
  assert.deepEqual(await readPublicStudioPlans(f.db),[]);await mutateStudioPlan(f.db,f.owner,publish(),{now});
  const publicRow=(await readPublicStudioPlans(f.db))[0];assert.equal(publicRow.content.goals[0].title,goal.title);
  for(const secret of ['SYNTHETIC_PRIVATE_PLAN_NOTE','owner_id','idempotency_key','synthetic-owner'])assert.ok(!JSON.stringify(publicRow).includes(secret));
  await mutateStudioPlan(f.db,f.owner,save(2,'edited',{goals:[{...goal,title:'Synthetic private replacement'}]}),{now});
  assert.equal((await readPublicStudioPlans(f.db))[0].content.goals[0].title,goal.title);
  await mutateStudioPlan(f.db,f.owner,withdraw(3),{now});assert.deepEqual(await readPublicStudioPlans(f.db),[]);
  assert.equal((await mutateStudioPlan(f.db,f.owner,publish(),{now})).replayed,true);assert.deepEqual(await readPublicStudioPlans(f.db),[]);
  assert.equal((await getStudioPlanDrafts(f.db,f.owner))[0].draft.goals[0].title,'Synthetic private replacement');
});
test('goals reject fabricated ownership, invalid or duplicate identifiers, invalid dates, excess items and empty publication',async t=>{
  const f=await setup(t);
  for(const patch of [{goals:[{...goal,title:' '}]},{goals:[{...goal,target_date:'2026-02-30'}]},{goals:[goal,goal]},{goals:Array.from({length:9},(_,n)=>({...goal,id:'g-'+n}))},{goals:[{...goal,private_note:'leak'}]}])await assert.rejects(mutateStudioPlan(f.db,f.owner,save(0,'invalid',patch),{now}),{code:'INVALID_INPUT'});
  await assert.rejects(mutateStudioPlan(f.db,f.owner,{...save(),owner_id:'synthetic-other'},{now}),{code:'INVALID_INPUT'});
  await mutateStudioPlan(f.db,f.owner,save(0,'empty',{goals:[]}),{now});await assert.rejects(mutateStudioPlan(f.db,f.owner,publish(),{now}),{code:'INVALID_INPUT'});
  await assert.rejects(mutateStudioPlan(f.db,f.owner,{...publish(),confirm_public:false},{now}),{code:'INVALID_INPUT'});
});
test('goal CAS, concurrent duplicate retry and lost commit response preserve exact receipts',async t=>{
  const f=await setup(t);const results=await Promise.all([mutateStudioPlan(f.db,f.owner,save(),{now}),mutateStudioPlan(f.db,f.owner,save(),{now})]);
  assert.ok(results.every(row=>row.revision===1));assert.equal(snapshot(f).receipts.length,1);
  await assert.rejects(mutateStudioPlan(f.db,f.owner,save(0,'new-key'),{now}),{code:'REVISION_CONFLICT'});
  await assert.rejects(mutateStudioPlan(f.db,f.owner,save(0,'plan-save',{private_note:'changed'}),{now}),{code:'IDEMPOTENCY_CONFLICT'});
  let batches=0;const lost={...f.db,async batch(statements){const result=await f.db.batch(statements);if(++batches===2)throw Error('synthetic response loss');return result;}};
  assert.equal((await mutateStudioPlan(lost,f.owner,publish(),{now})).replayed,true);assert.equal(snapshot(f).receipts.length,2);
});
test('goal authorization rejects grants and forged principals, isolates owners and rechecks revoked authority within writes',async t=>{
  const f=await setup(t);
  for(const identity of [null,f.identity,JSON.parse(JSON.stringify(f.owner))]){await assert.rejects(getStudioPlanDrafts(f.db,identity),{code:'PRIVATE_ACCESS_DENIED'});await assert.rejects(mutateStudioPlan(f.db,identity,save(),{now}),{code:'PRIVATE_ACCESS_DENIED'});}
  await mutateStudioPlan(f.db,f.owner,save(),{now});
  const auth=await signedOwner('synthetic-other-sub'),other=await verifyLearningOwner(auth.jwt,auth.config,f.db,auth.verification);assert.deepEqual(await getStudioPlanDrafts(f.db,other),[]);
  let batches=0;const racing={...f.db,async batch(statements){if(++batches===2)f.sqlite.exec("UPDATE users SET status='disabled' WHERE user_id='synthetic-owner'");return f.db.batch(statements);}};
  await assert.rejects(mutateStudioPlan(racing,f.owner,publish(),{now}),{code:'PRIVATE_ACCESS_DENIED'});assert.equal(snapshot(f).plans[0].published_json,null);
});
test('failed and ignored goal writes roll back both publication and receipt; disabled owners have no public goals',async t=>{
  for(const [table,operation] of [['studio_plan_records','INSERT'],['studio_plan_records','UPDATE'],['studio_plan_receipts','INSERT']])for(const mode of ['ABORT','IGNORE']){
    const f=await setup(t);if(operation==='UPDATE'||table.includes('receipts'))await mutateStudioPlan(f.db,f.owner,save(),{now});const before=snapshot(f);
    f.sqlite.exec(`CREATE TRIGGER synthetic_plan_failure BEFORE ${operation} ON ${table} BEGIN SELECT RAISE(${mode}${mode==='ABORT'?',\'synthetic failure\'':''}); END;`);
    await assert.rejects(mutateStudioPlan(f.db,f.owner,before.plans.length?publish():save(),{now}),{code:'SERVICE_UNAVAILABLE'});assert.deepEqual(snapshot(f),before);
  }
  const f=await setup(t);await mutateStudioPlan(f.db,f.owner,save(),{now});await mutateStudioPlan(f.db,f.owner,publish(),{now});f.sqlite.exec("UPDATE users SET status='disabled'");assert.deepEqual(await readPublicStudioPlans(f.db),[]);
});
test('goal HTTP protects identity, origin, JSON format, unsupported methods and private caching',async t=>{
  const f=await setup(t),env={DB:f.db,...f.auth.config},options={now,verification:f.auth.verification};
  const request=(token=f.auth.cookie,method='GET',body,origin='https://synthetic.invalid',type='application/json')=>new Request('https://synthetic.invalid/api/studio/plans',{method,headers:{...(token?{'cookie':token}:{}),...(body?{origin,'content-type':type}:{})},...(body?{body:JSON.stringify(body)}:{})});
  assert.equal((await handleStudioPlans(request(null),env,options)).status,401);assert.equal((await handleStudioPlans(request('forged'),env,options)).status,403);
  assert.equal((await handleStudioPlans(request(f.auth.cookie,'POST',save(),'https://foreign.invalid'),env,options)).status,403);
  assert.equal((await handleStudioPlans(request(f.auth.cookie,'POST',save(),'https://synthetic.invalid','text/plain'),env,options)).status,415);
  assert.equal((await handleStudioPlans(request(f.auth.cookie,'DELETE'),env,options)).status,405);
  const result=await handleStudioPlans(request(f.auth.cookie,'POST',save()),env,options);assert.equal(result.status,200);assert.match(result.headers.get('cache-control'),/no-store/);assert.equal(result.headers.get('vary'),'Cookie');
  assert.equal((await (await handleStudioPlans(request(),env,options)).json()).plans[0].private_note,'SYNTHETIC_PRIVATE_PLAN_NOTE');
});
test('v3 goal backup requires an independent current plan floor and restores private at a new epoch without reviving old publications',async t=>{
  const f=await setup(t),key=crypto.getRandomValues(new Uint8Array(32));await mutateStudioPlan(f.db,f.owner,save(),{now});await mutateStudioPlan(f.db,f.owner,publish(),{now});
  const old=await exportPrivateLearningBackup(f.db,f.owner,key,{now});assert.equal(old.plan_revision,2);assert.ok(!JSON.stringify(old).includes('SYNTHETIC_PRIVATE_PLAN_NOTE'));
  await mutateStudioPlan(f.db,f.owner,withdraw(),{now});const current=await exportPrivateLearningBackup(f.db,f.owner,key,{now}),target=await blank(t);
  const options={isolated:true,expectedOwnerId:'synthetic-owner',minimumCheckpointVersion:0,now};
  for(const floor of [undefined,0,-1,2.5])await assert.rejects(restorePrivateLearningBackup(target.db,old.backup,current.checkpoint,key,{...options,minimumPlanRevision:floor}),{code:'INVALID_INPUT'});
  await assert.rejects(restorePrivateLearningBackup(target.db,old.backup,old.checkpoint,key,{...options,minimumPlanRevision:3}),{code:'INVALID_INPUT'});
  const result=await restorePrivateLearningBackup(target.db,old.backup,current.checkpoint,key,{...options,minimumPlanRevision:3});assert.equal(result.plan_revision,4);assert.equal(result.plans_restored,1);assert.equal(result.plan_publications_restored,0);
  target.sqlite.exec("UPDATE users SET status='active'");const owner=await verifyLearningOwner(f.auth.jwt,f.auth.config,target.db,f.auth.verification);
  assert.equal((await getStudioPlanDrafts(target.db,owner))[0].private_note,'SYNTHETIC_PRIVATE_PLAN_NOTE');assert.deepEqual(await readPublicStudioPlans(target.db),[]);
  assert.equal((await mutateStudioPlan(target.db,owner,publish(),{now})).replayed,true);assert.deepEqual(await readPublicStudioPlans(target.db),[]);
  await assert.rejects(mutateStudioPlan(target.db,owner,publish(2,'missing-old-key'),{now}),{code:'REVISION_CONFLICT'});
});
test('goal restoration write failures or ignores roll back all thirteen private tables',async t=>{
  const f=await setup(t),key=crypto.getRandomValues(new Uint8Array(32));await mutateStudioPlan(f.db,f.owner,save(),{now});await mutateStudioPlan(f.db,f.owner,publish(),{now});const backup=await exportPrivateLearningBackup(f.db,f.owner,key,{now});
  for(const [table,operation] of [['studio_plan_records','INSERT'],['studio_plan_records','UPDATE'],['studio_plan_receipts','INSERT']])for(const mode of ['ABORT','IGNORE']){
    const target=await blank(t);target.sqlite.exec(`CREATE TRIGGER synthetic_plan_restore_failure BEFORE ${operation} ON ${table} BEGIN SELECT RAISE(${mode}${mode==='ABORT'?',\'synthetic failure\'':''}); END;`);
    await assert.rejects(restorePrivateLearningBackup(target.db,backup.backup,backup.checkpoint,key,{isolated:true,expectedOwnerId:'synthetic-owner',minimumCheckpointVersion:0,minimumPlanRevision:2,now}),{code:'SERVICE_UNAVAILABLE'});
    for(const table of target.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('records','snapshots')").all())assert.equal(target.sqlite.prepare(`SELECT COUNT(*) n FROM ${table.name}`).get().n,0);
  }
});
