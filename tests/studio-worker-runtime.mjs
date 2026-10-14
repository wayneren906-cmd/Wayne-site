// Executes the complete generated application Worker with synthetic identities and memory D1.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {input} from './helpers/learning-fixture.mjs';
import {emptyProjectContent} from '../lib/ui/project-protocol.ts';
import {createStudioWorkerEnvironment} from './helpers/studio-worker-environment.mjs';
const f=await createStudioWorkerEnvironment();
const {runtime,db,auth,work}=f;
const statuses=[];
const request=async(url,method='GET',body,token=auth.cookie,extra={})=>{
  const headers={'accept':'application/json',...(token?{'cookie':token}:{}),...extra};
  if(body!==undefined){headers.origin='http://synthetic.invalid';headers['content-type']='application/json';}
  Object.assign(headers,extra);
  const response=await runtime.dispatchFetch('http://synthetic.invalid'+url,{method,headers,...(body!==undefined?{body:JSON.stringify(body)}:{})});
  statuses.push({url,method,status:response.status});return response;
};
try {
  const visitor=await request('/api/auth/session','GET',undefined,null);assert.deepEqual(await visitor.json(),{signed_in:false});
  const badLogin=await request('/api/auth/login','POST',{email:'owner@example.com',password:'Synthetic-wrong-password'},null);assert.equal(badLogin.status,401);
  const login=await request('/api/auth/login','POST',{email:'OWNER@EXAMPLE.COM',password:'Synthetic-worker-password-42'},null);assert.equal(login.status,200);assert.equal((await login.json()).signed_in,true);
  const sessionCookie=login.headers.get('set-cookie').split(';')[0];assert.ok(login.headers.get('set-cookie').includes('HttpOnly'));
  const nativeSession=await request('/api/auth/session','GET',undefined,sessionCookie);assert.equal((await nativeSession.json()).email,'owner@example.com');
  const nativeManagement=await request('/api/studio/management','GET',undefined,sessionCookie);assert.equal(nativeManagement.status,200);
  const logout=await request('/api/auth/logout','POST',{},sessionCookie);assert.equal(logout.status,200);
  assert.equal((await request('/api/studio/management','GET',undefined,sessionCookie)).status,403);
  const publicPage=await request('/studio','GET',undefined,null);assert.equal(publicPage.status,200);
  const publicHTML=await publicPage.text();assert.ok(publicHTML.includes('PERSONAL DASHBOARD'));assert.ok(publicHTML.includes('href="/studio/private"'));assert.ok(!publicHTML.includes('studio-supplement-input'));
  assert.ok(publicHTML.includes('href="/login"'));
  assert.equal((await request('/api/studio/management','GET',undefined,null)).status,401);
  assert.equal((await request('/api/studio/management','GET',undefined,f.unregistered.cookie)).status,403);
  const management=await request('/api/studio/management');assert.equal(management.status,200);
  const initialManagement=await management.json();assert.equal(initialManagement.private_event_count,0);assert.equal(initialManagement.processor_connected,false);
  assert.match(management.headers.get('cache-control'),/no-store/);
  const ownerManagement=await request('/studio/private/management');assert.equal(ownerManagement.status,200);assert.match(ownerManagement.headers.get('cache-control'),/private|no-store/);assert.ok((await ownerManagement.text()).includes('任务执行器尚未接入'));
  for(const identity of [null,f.unregistered.cookie]){const deniedManagement=await request('/studio/private/management','GET',undefined,identity);const html=await deniedManagement.text();assert.ok(html.includes('无法验证管理权限'));assert.ok(!html.includes('management-metrics'));}
  assert.equal((await request('/api/studio/projects','GET',undefined,null)).status,401);
  assert.equal((await request('/api/studio/projects','GET',undefined,f.unregistered.cookie)).status,403);
  for(const identity of [null,f.unregistered.cookie]){const response=await request('/studio/private/projects','GET',undefined,identity);const html=await response.text();assert.ok(html.includes('无法验证管理权限'));assert.ok(!html.includes('class="project-editor"'));}
  const projectPage=await request('/studio/private/projects');assert.equal(projectPage.status,200);assert.match(projectPage.headers.get('cache-control'),/private|no-store/);assert.ok((await projectPage.text()).includes('保存私人草稿'));
  const draft={action:'save_draft',project_id:'c-engine',expected_revision:0,idempotency_key:'synthetic-project-draft',content:{...emptyProjectContent(),summary:'synthetic publishable project status',private_note:'SYNTHETIC_PRIVATE_PROJECT_NOTE'}};
  assert.equal((await request('/api/studio/projects','POST',draft)).status,200);
  assert.ok(!(await (await request('/studio','GET',undefined,null)).text()).includes('synthetic publishable project status'));
  assert.equal((await request('/api/studio/projects','POST',{action:'publish',project_id:'c-engine',expected_revision:1,idempotency_key:'synthetic-publish',confirm_public:true})).status,200);
  for(const path of ['/studio','/studio/projects']){const html=await(await request(path,'GET',undefined,null)).text();assert.ok(html.includes('synthetic publishable project status'));assert.ok(!html.includes('SYNTHETIC_PRIVATE_PROJECT_NOTE'));}
  assert.equal((await request('/api/studio/projects','POST',{action:'unpublish',project_id:'c-engine',expected_revision:2,idempotency_key:'synthetic-unpublish'})).status,200);
  assert.ok(!(await(await request('/studio','GET',undefined,null)).text()).includes('synthetic publishable project status'));
  for(const identity of [null,f.unregistered.cookie]){
    assert.equal((await request('/api/studio/plans','GET',undefined,identity)).status,identity?403:401);
    assert.ok((await(await request('/studio/private/plans','GET',undefined,identity)).text()).includes('无法验证管理权限'));
  }
  const planPage=await request('/studio/private/plans');assert.equal(planPage.status,200);assert.match(planPage.headers.get('cache-control'),/private|no-store/);assert.ok((await planPage.text()).includes('保存私人草稿'));
  const planDraft={action:'save_draft',plan_id:'personal-goals',expected_revision:0,idempotency_key:'synthetic-plan-draft',content:{goals:[{id:'synthetic-goal',title:'Synthetic Worker goal',status:'in_progress',summary:'Synthetic goal explanation',next_step:'Synthetic next step',target_date:'2026-10-31'}],private_note:'SYNTHETIC_PRIVATE_GOAL_NOTE'}};
  assert.equal((await request('/api/studio/plans','POST',planDraft)).status,200);
  assert.ok(!(await(await request('/studio','GET',undefined,null)).text()).includes('Synthetic Worker goal'));
  const planPublish={action:'publish',plan_id:'personal-goals',expected_revision:1,idempotency_key:'synthetic-plan-publish',confirm_public:true};
  assert.equal((await request('/api/studio/plans','POST',planPublish)).status,200);
  const goalsHTML=await(await request('/studio','GET',undefined,null)).text();assert.ok(goalsHTML.includes('Synthetic Worker goal'));assert.ok(!goalsHTML.includes('SYNTHETIC_PRIVATE_GOAL_NOTE'));
  assert.equal((await request('/api/studio/plans','POST',{action:'unpublish',plan_id:'personal-goals',expected_revision:2,idempotency_key:'synthetic-plan-withdraw'})).status,200);
  assert.equal((await request('/api/studio/plans','POST',planPublish)).status,200);assert.ok(!(await(await request('/studio','GET',undefined,null)).text()).includes('Synthetic Worker goal'));
  for(const path of ['/studio/roadmap','/studio/practice','/studio/projects','/studio/archive']){const r=await request(path,'GET',undefined,null);assert.equal(r.status,200);assert.ok(!(await r.text()).includes('synthetic private fact'));}
  const deniedWorkspace=await request('/studio/private/workspace','GET',undefined,null);assert.ok((await deniedWorkspace.text()).includes('无法验证访问权限'));
  const ownerWorkspace=await request('/studio/private/workspace');assert.equal(ownerWorkspace.status,200);assert.ok((await ownerWorkspace.text()).includes('实际过程与结果'));
  const previewWorkspace=await request('/studio/private/workspace','GET',undefined,f.unregistered.cookie);assert.ok((await previewWorkspace.text()).includes('无法验证访问权限'));
  const anonymous=await request('/studio/private','GET',undefined,null);assert.equal(anonymous.status,200);const deniedHTML=await anonymous.text();
  assert.ok(deniedHTML.includes('无法验证访问权限'));assert.ok(!deniedHTML.includes('studio-supplement-input'));
  assert.equal((await request('/api/studio/context','GET',undefined,null)).status,401);
  const oldAccess=await request('/api/studio/context','GET',undefined,null,{'cf-access-jwt-assertion':auth.jwt});assert.equal(oldAccess.status,401);
  const forged=await request('/studio/private','GET',undefined,'forged');assert.ok((await forged.text()).includes('无法验证访问权限'));
  const ownerPage=await request('/studio/private');assert.equal(ownerPage.status,200);assert.ok((await ownerPage.text()).includes('studio-supplement-input'));assert.match(ownerPage.headers.get('cache-control'),/private|no-store/);
  for(const token of [null,f.unregistered.cookie,auth.cookie])assert.equal((await request('/api/studio/registration','GET',undefined,token)).status,410);
  const denied=await request('/studio/private','GET',undefined,f.unregistered.cookie);assert.ok((await denied.text()).includes('无法验证访问权限'));
  assert.equal((await request('/api/studio/events','POST',input('unregistered-preview'),f.unregistered.cookie)).status,403);
  console.log('Worker SSR owner/anonymous protection passed.');
  const create=await request('/api/studio/events','POST',input('synthetic-worker-create'));assert.equal(create.status,201);assert.match(create.headers.get('cache-control'),/no-store/);const saved=await create.json();
    const publicAfterSave=await request('/studio','GET',undefined,null);const publicAfterHTML=await publicAfterSave.text();assert.ok(!publicAfterHTML.includes('synthetic private fact'));assert.ok(!publicAfterHTML.includes(saved.event_id));
  const replay=await request('/api/studio/events','POST',input('synthetic-worker-create'));assert.equal((await replay.json()).replayed,true);
  const foreignOrigin=await request('/api/studio/events','POST',input('foreign-origin'),auth.cookie,{origin:'https://foreign.invalid'});assert.equal(foreignOrigin.status,403);
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
