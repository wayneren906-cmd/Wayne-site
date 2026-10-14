import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,signedOwner,now,input} from './helpers/learning-fixture.mjs';
import {verifyLearningOwner} from '../lib/learning/auth.ts';
import {saveLearningEvent,correctLearningEvent} from '../lib/learning/events.ts';
import {deleteLearningEvent} from '../lib/learning/deletions.ts';
import {getStudioManagement} from '../lib/learning/reads.ts';
import {handleStudioManagement} from '../lib/learning/http.ts';
import {studioManagementSchema} from '../lib/learning/management-schema.ts';

async function environment(t){
  const f=await fixture(t),auth=await signedOwner();
  const owner=await verifyLearningOwner(auth.jwt,auth.config,f.db,auth.verification);
  return {...f,owner,auth,env:{DB:f.db,...auth.config},options:{now,verification:auth.verification}};
}

test('management empty data distinguishes no private records from an unconnected processor',async t=>{
  const f=await environment(t),result=await getStudioManagement(f.db,f.owner,{now});
  assert.equal(result.private_event_count,0);assert.equal(result.received_change_count,0);
  assert.equal(result.data_version,0);assert.equal(result.latest_received_at,null);
  assert.deepEqual(result.sources,[]);assert.deepEqual(result.jobs.recent,[]);
  assert.equal(result.processor_connected,false);assert.equal(result.jobs.truncated,false);
  assert.equal(studioManagementSchema.safeParse({...result,processor_connected:true}).success,false);
});

test('management returns owner-scoped metadata and hides content, arbitrary source labels, credentials and raw errors',async t=>{
  const f=await environment(t);
  const own=await saveLearningEvent(f.db,f.owner,{...input('own'),source:{type:'studio',record_id:'private-source-id'}},{now});
  // Simulate an imported/future source label. Management must never echo arbitrary source text.
  f.sqlite.prepare("UPDATE learning_events SET source_type='secret-source-marker' WHERE event_id=?").run(own.event_id);
  const otherAuth=await signedOwner('synthetic-other-sub');
  const other=await verifyLearningOwner(otherAuth.jwt,otherAuth.config,f.db,otherAuth.verification);
  await saveLearningEvent(f.db,other,input('foreign-owner'),{now});
  f.sqlite.prepare("UPDATE processing_jobs SET status='failed',attempts=2,last_error_code='PRIVATE_TOKEN_RAW_ERROR' WHERE event_id=?").run(own.event_id);
  const result=await getStudioManagement(f.db,f.owner,{now});
  assert.equal(result.private_event_count,1);assert.equal(result.received_change_count,1);assert.equal(result.data_version,1);
  assert.deepEqual(result.sources,[{type:'other',event_count:1,latest_received_at:now.toISOString()}]);
  assert.equal(result.jobs.counts.failed,1);assert.equal(result.jobs.recent[0].has_error,true);
  assert.equal(result.jobs.recent[0].is_current_revision,true);assert.equal(result.jobs.recent[0].attempts,2);
  for(const secret of ['synthetic private fact','secret-source-marker','private-source-id','PRIVATE_TOKEN_RAW_ERROR','idempotency_key','credential_key','payload_sha256','synthetic-other'])assert.ok(!JSON.stringify(result).includes(secret),secret);
});

test('management rejects integrations and forged principals and rechecks owner revocation in the snapshot',async t=>{
  const f=await environment(t);
  for(const principal of [null,f.identity,JSON.parse(JSON.stringify(f.owner))])await assert.rejects(getStudioManagement(f.db,principal,{now}),{code:'PRIVATE_ACCESS_DENIED'});
  for(const change of ["UPDATE users SET status='disabled' WHERE user_id='synthetic-owner'","UPDATE users SET role='member' WHERE user_id='synthetic-owner'"]){
    const racing={...f.db,async batch(statements){f.sqlite.exec(change);return f.db.batch(statements);}};
    await assert.rejects(getStudioManagement(racing,f.owner,{now}),{code:'PRIVATE_ACCESS_DENIED'});
    f.sqlite.exec("UPDATE users SET status='active',role='owner' WHERE user_id='synthetic-owner'");
  }
});

test('management preserves historical job revisions and deletion removes their metadata',async t=>{
  const f=await environment(t),saved=await saveLearningEvent(f.db,f.owner,input('initial'),{now});
  const {schema_version,idempotency_key,...event}=input('correction');
  const later=new Date(now.getTime()+60000);
  await correctLearningEvent(f.db,f.owner,saved.event_id,{schema_version:1,idempotency_key:'correct-once',expected_revision:1,reason:'synthetic correction',event:{...event,content:{summary:'synthetic corrected fact'}}},{now:later});
  const before=await getStudioManagement(f.db,f.owner,{now:later});
  assert.equal(before.private_event_count,1);assert.equal(before.received_change_count,2);assert.equal(before.jobs.counts.pending,2);
  assert.equal(before.jobs.recent.filter(job=>job.is_current_revision).length,1);
  assert.equal(before.jobs.recent.filter(job=>!job.is_current_revision).length,1);
  assert.equal(before.sources[0].event_count,1);assert.equal(before.sources[0].latest_received_at,later.toISOString());
  await deleteLearningEvent(f.db,f.owner,saved.event_id,{schema_version:1,idempotency_key:'delete-once',expected_revision:2},{now});
  const after=await getStudioManagement(f.db,f.owner,{now});
  assert.equal(after.private_event_count,0);assert.equal(after.received_change_count,0);assert.equal(after.jobs.counts.pending,0);
  assert.deepEqual(after.jobs.recent,[]);assert.deepEqual(after.sources,[]);assert.equal(after.data_version,3);
});

test('management bounds recent jobs while counts and source coverage include all retained records',async t=>{
  const f=await environment(t);
  for(let index=0;index<23;index++)await saveLearningEvent(f.db,f.owner,{...input('bounded-'+index),source:{type:index%2?'studio':'studio_supplement',record_id:null}},{now});
  const result=await getStudioManagement(f.db,f.owner,{now});
  assert.equal(result.jobs.recent.length,20);assert.equal(result.jobs.truncated,true);
  assert.equal(result.private_event_count,23);assert.equal(result.jobs.counts.pending,23);
  assert.equal(result.sources.reduce((count,source)=>count+source.event_count,0),23);
  assert.equal(result.sources.length,1);assert.equal(result.sources[0].type,'studio');
});

test('management HTTP denies anonymous, invalid and unregistered identities; authenticated responses are non-cacheable and read-only',async t=>{
  const f=await environment(t);
  const request=(jwt=f.auth.cookie,path='/api/studio/management',method='GET')=>new Request('https://synthetic.invalid'+path,{method,headers:jwt?{'cookie':jwt}:{}});
  assert.equal((await handleStudioManagement(request(null),f.env,f.options)).status,401);
  assert.equal((await handleStudioManagement(request('forged'),f.env,f.options)).status,403);
  const missing=await signedOwner('unregistered');
  assert.equal((await handleStudioManagement(request(missing.jwt),f.env,{now,verification:missing.verification})).status,403);
  for(const query of ['?owner_id=synthetic-other','?status=pending'])assert.equal((await handleStudioManagement(request(f.auth.cookie,'/api/studio/management'+query),f.env,f.options)).status,400);
  assert.equal((await handleStudioManagement(request(f.auth.cookie,undefined,'POST'),f.env,f.options)).status,405);
  const result=await handleStudioManagement(request(),f.env,f.options);
  assert.equal(result.status,200);assert.match(result.headers.get('cache-control'),/no-store/);
  assert.equal(result.headers.get('vary'),'Cookie');assert.equal(result.headers.get('access-control-allow-origin'),null);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM learning_state').get().n,0);
});

test('management rejects corrupt state and sanitizes database failures',async t=>{
  const f=await environment(t);
  await saveLearningEvent(f.db,f.owner,input('corrupt'),{now});
  f.sqlite.prepare('UPDATE learning_state SET data_version=0').run();
  await assert.rejects(getStudioManagement(f.db,f.owner,{now}),{code:'SERVICE_UNAVAILABLE'});
  const broken={...f.db,async batch(){throw Error('PRIVATE_DATABASE_DIAGNOSTIC');}};
  const result=await handleStudioManagement(new Request('https://synthetic.invalid/api/studio/management',{headers:{'cookie':f.auth.cookie}}),{...f.env,DB:broken},f.options);
  assert.equal(result.status,503);assert.ok(!(await result.text()).includes('PRIVATE_DATABASE_DIAGNOSTIC'));
});
