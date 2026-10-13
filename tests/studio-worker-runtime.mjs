// Executes the complete generated application Worker with synthetic identities and memory D1.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {input} from './helpers/learning-fixture.mjs';
import {createStudioWorkerEnvironment} from './helpers/studio-worker-environment.mjs';
const f=await createStudioWorkerEnvironment();
const {runtime,db,auth,work}=f;
const statuses=[];
const request=async(url,method='GET',body,token=auth.jwt,extra={})=>{
  const headers={'accept':'application/json',...(token?{'cf-access-jwt-assertion':token}:{}),...extra};
  if(body!==undefined){headers.origin='http://synthetic.invalid';headers['content-type']='application/json';}
  Object.assign(headers,extra);
  const response=await runtime.dispatchFetch('http://synthetic.invalid'+url,{method,headers,...(body!==undefined?{body:JSON.stringify(body)}:{})});
  statuses.push({url,method,status:response.status});return response;
};
try {
  const publicPage=await request('/studio','GET',undefined,null);assert.equal(publicPage.status,200);
  const publicHTML=await publicPage.text();assert.ok(publicHTML.includes('学习工作台'));assert.ok(publicHTML.includes('href="/studio/private"'));assert.ok(!publicHTML.includes('studio-supplement-input'));
  for(const path of ['/studio/roadmap','/studio/practice','/studio/projects','/studio/archive']){const r=await request(path,'GET',undefined,null);assert.equal(r.status,200);assert.ok(!(await r.text()).includes('synthetic private fact'));}
  const deniedWorkspace=await request('/studio/private/workspace','GET',undefined,null);assert.ok((await deniedWorkspace.text()).includes('无法验证访问权限'));
  const ownerWorkspace=await request('/studio/private/workspace');assert.equal(ownerWorkspace.status,200);assert.ok((await ownerWorkspace.text()).includes('实际过程与结果'));
  const previewWorkspace=await request('/studio/private/workspace','GET',undefined,f.unregistered.jwt);assert.ok((await previewWorkspace.text()).includes('私人保存尚未开放'));
  const anonymous=await request('/studio/private','GET',undefined,null);assert.equal(anonymous.status,200);const deniedHTML=await anonymous.text();
  assert.ok(deniedHTML.includes('无法验证访问权限'));assert.ok(!deniedHTML.includes('studio-supplement-input'));
  assert.equal((await request('/api/studio/context','GET',undefined,null)).status,401);
  assert.equal((await request('/api/studio/registration','GET',undefined,null)).status,401);
  const forged=await request('/studio/private','GET',undefined,'forged');assert.ok((await forged.text()).includes('无法验证访问权限'));
  const ownerPage=await request('/studio/private');assert.equal(ownerPage.status,200);const ownerHTML=await ownerPage.text();
  assert.ok(ownerHTML.includes('studio-supplement-input'),'owner should receive actual Studio SSR');
  assert.match(ownerPage.headers.get('cache-control'),/private|no-store/);
  const proposal=await request('/api/studio/registration','GET',undefined,f.unregistered.jwt);assert.equal(proposal.status,200);assert.match(proposal.headers.get('cache-control'),/no-store/);
  const candidate=await proposal.json();assert.equal(candidate.proposal.status,'disabled');assert.equal(candidate.registration_required,true);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM users WHERE identity_subject=?').bind('unregistered-synthetic-sub').first()).n,0);
  assert.equal((await request('/api/studio/context','GET',undefined,f.unregistered.jwt)).status,403);
  const preview=await request('/studio/private','GET',undefined,f.unregistered.jwt);assert.equal(preview.status,200);
  const previewHTML=await preview.text();assert.ok(previewHTML.includes('当前为只读预览'));assert.match(previewHTML,/<textarea[^>]*disabled/);assert.match(preview.headers.get('cache-control'),/private|no-store/);
  assert.equal((await request('/api/studio/events','POST',input('unregistered-preview'),f.unregistered.jwt)).status,403);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM users WHERE identity_subject=?').bind('unregistered-synthetic-sub').first()).n,0);
  console.log('Worker SSR owner/anonymous protection passed.');
  const create=await request('/api/studio/events','POST',input('synthetic-worker-create'));assert.equal(create.status,201);assert.match(create.headers.get('cache-control'),/no-store/);const saved=await create.json();
    const publicAfterSave=await request('/studio','GET',undefined,null);const publicAfterHTML=await publicAfterSave.text();assert.ok(!publicAfterHTML.includes('synthetic private fact'));assert.ok(!publicAfterHTML.includes(saved.event_id));
  const replay=await request('/api/studio/events','POST',input('synthetic-worker-create'));assert.equal((await replay.json()).replayed,true);
  const foreignOrigin=await request('/api/studio/events','POST',input('foreign-origin'),auth.jwt,{origin:'https://foreign.invalid'});assert.equal(foreignOrigin.status,403);
  const oversized=await request('/api/studio/events','POST',{...input('large'),content:{summary:'x'.repeat(65537)}});assert.equal(oversized.status,413);
  for(const url of ['/api/records','/api/snapshots']){
    const publicResponse=await request(url,'GET',undefined,null);assert.equal(publicResponse.status,200);
    const text=await publicResponse.text();assert.ok(!text.includes('synthetic private fact'));assert.ok(!text.includes(saved.event_id));
  }
  const current=await request('/api/studio/events/'+saved.event_id);assert.equal(current.status,200);assert.equal((await current.json()).event_id,saved.event_id);
  const {schema_version,idempotency_key,...event}=input();
  const patch=await request('/api/studio/events/'+saved.event_id,'PATCH',{schema_version:1,idempotency_key:'synthetic-worker-correct',expected_revision:1,reason:'synthetic correction',event:{...event,content:{summary:'synthetic worker corrected'}}});
  assert.equal(patch.status,201);assert.equal((await patch.json()).revision,2);
  const history=await request('/api/studio/events/'+saved.event_id+'/revisions');assert.equal(history.status,200);assert.equal((await history.json()).revisions.length,2);
  const context=await request('/api/studio/context?purpose=teaching');assert.equal(context.status,200);assert.equal((await context.json()).events[0].revision,2);
  const stale=await request('/api/studio/events/'+saved.event_id,'PATCH',{schema_version:1,idempotency_key:'stale-worker',expected_revision:1,reason:'synthetic stale',event});assert.equal(stale.status,409);
  const remove=await request('/api/studio/events/'+saved.event_id,'DELETE',{schema_version:1,idempotency_key:'synthetic-worker-delete',expected_revision:2});assert.equal(remove.status,200);assert.equal((await remove.json()).deleted,true);
  assert.equal((await request('/api/studio/events/'+saved.event_id)).status,404);
  assert.equal((await request('/api/studio/events/'+saved.event_id+'/revisions')).status,404);
  assert.equal((await request('/api/studio/events','POST',input('synthetic-worker-create'))).status,409);
  assert.deepEqual((await (await request('/api/studio/context')).json()).events,[]);
  await db.prepare("UPDATE users SET role='member' WHERE user_id='synthetic-owner'").run();
  assert.equal((await request('/api/studio/context')).status,403);
  await db.prepare("UPDATE users SET role='owner' WHERE user_id='synthetic-owner'").run();
  await db.prepare("UPDATE users SET status='disabled' WHERE user_id='synthetic-owner'").run();
  assert.equal((await request('/api/studio/context')).status,403);
  assert.ok((await (await request('/studio/private')).text()).includes('无法验证访问权限'));
  assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results,[]);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM records').first()).n,0);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM snapshots').first()).n,0);
  const summary={passed:true,certificateRequests:f.certificateRequests(),statuses,scope:'complete isolated build + generated Worker + actual Vinext routes + memory D1; synthetic Access JWT/JWKS'};
  fs.writeFileSync(path.join(work,'runtime-summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
}finally{await runtime.dispose();}
