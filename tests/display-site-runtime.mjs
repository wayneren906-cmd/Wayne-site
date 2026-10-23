// Complete local application + memory D1 only. No production writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createStudioWorkerEnvironment} from './helpers/studio-worker-environment.mjs';

const f=await createStudioWorkerEnvironment();
const checks=[];
async function request(url,options={}){
  const response=await f.runtime.dispatchFetch('http://synthetic.invalid'+url,{redirect:'manual',...options});
  checks.push({url,status:response.status});return response;
}
try{
  await f.db.prepare('INSERT INTO records(date,items,practice,revision,updated_at) VALUES(?,?,?,?,?)').bind('2026-10-15',JSON.stringify([{label:'公开设计',text:'Synthetic public design reading'}]),'Synthetic public practice',1,new Date().toISOString()).run();
  await f.db.prepare('INSERT INTO studio_project_records(owner_id,project_id,revision,draft_json,private_note,updated_at) VALUES(?,?,?,?,?,?)').bind('synthetic-owner','wayneo',1,JSON.stringify({status:'not_started',description:'PRIVATE_DRAFT_SENTINEL',summary:'PRIVATE_DRAFT_SENTINEL',next_step:'',milestones:{interface:'not_started',implementation:'not_started',verification:'not_started'}}),'PRIVATE_NOTE_SENTINEL',new Date().toISOString()).run();
  const contentResponse=await request('/api/public/content');assert.equal(contentResponse.status,200);
  const content=await contentResponse.json();assert.equal(content.items.filter(item=>item.type==='project').length,1);
  assert.equal(content.items.find(item=>item.type==='project').url,'/studio/wayneo');
  assert.ok(content.items.some(item=>item.id==='journal:2026-10-15'));
  assert.ok(!JSON.stringify(content).includes('PRIVATE_'));
  const records=await(await request('/api/records')).json();assert.equal(records.canEdit,false);assert.equal(records.signedIn,false);
  for(const url of ['/','/learning','/studio','/studio/wayneo','/studio/collection']){
    const response=await request(url);assert.equal(response.status,200,url);
    const html=await response.text();assert.ok(!html.includes('PRIVATE_DRAFT_SENTINEL'));assert.ok(!html.includes('PRIVATE_NOTE_SENTINEL'));
    assert.doesNotMatch(html,/>登录编辑\s*<|>记一笔\s*<|>管理\s*(?:↗)?\s*</);
    assert.ok(!html.includes('href="/studio/private/management"'),url+' has no management destination');
    assert.ok(!html.includes('href="/search'),url+' has no global search link');
    if(url==='/studio'){
      assert.ok(html.includes('href="/studio/wayneo"'),'Studio links to the project detail');
      assert.ok(!html.includes('data-project-demo'),'Studio keeps the interactive project details on a separate page');
    }
  }
  const retiredSearch=await request('/search?q=extern');assert.ok([303,307,308].includes(retiredSearch.status));
  assert.equal(new URL(retiredSearch.headers.get('location'),'http://synthetic.invalid').pathname,'/studio');
  for(const token of [null,f.auth.cookie])for(const url of ['/admin','/login','/studio/private','/studio/private/projects','/studio/private/projects/preview?project=wayneo','/studio/%70rivate/workspace']){
    const response=await request(url,{headers:token?{cookie:token}:{}});assert.ok([301,302,303,307,308].includes(response.status),url);
    assert.match(response.headers.get('cache-control')??'',/no-store/);
    assert.ok(['/studio','/learning'].includes(new URL(response.headers.get('location'),'http://synthetic.invalid').pathname));
    assert.ok(!(await response.text()).includes('PRIVATE_'));
  }
  for(const url of ['/studio/projects','/projects','/studio/roadmap','/studio/practice','/studio/archive']){
    const response=await request(url);assert.ok([301,302,303,307,308].includes(response.status),url);
    assert.equal(new URL(response.headers.get('location'),'http://synthetic.invalid').pathname,'/studio');
  }
  for(const url of ['/api/admin/records','/api/studio/projects','/api/studio/plans','/api/studio/events','/api/studio/events/synthetic-event','/api/auth/accounts'])for(const method of ['POST','PATCH','DELETE']){
    const response=await request(url,{method,headers:{cookie:f.auth.cookie,origin:'http://synthetic.invalid','content-type':'application/json'},body:'{}'});
    assert.equal(response.status,405,url+' '+method);
  }
  const sync=await request('/api/sync/records',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});assert.notEqual(sync.status,405,'external sync is not retired indiscriminately');
  assert.equal((await f.db.prepare('SELECT COUNT(*) n FROM records').first()).n,1);
  assert.equal((await f.db.prepare('SELECT COUNT(*) n FROM studio_project_records').first()).n,1);
  // A missing public source must be an explicit read failure, not a successful empty catalog.
  await f.db.prepare('ALTER TABLE records RENAME TO synthetic_unavailable_records').run();
  const unavailable=await request('/api/public/content');assert.equal(unavailable.status,503);
  assert.ok(!(await unavailable.text()).includes('PRIVATE_'));
  const collectionWithoutRecords=await request('/studio/collection');assert.equal(collectionWithoutRecords.status,200);
  const collectionHTML=await collectionWithoutRecords.text();assert.ok(collectionHTML.includes('冰与火之歌'));assert.ok(collectionHTML.includes('CS2'));assert.ok(!collectionHTML.includes('PRIVATE_'));
  await f.db.prepare('ALTER TABLE synthetic_unavailable_records RENAME TO records').run();
  const summary={passed:true,checks,scope:'display-only local generated Worker and memory D1; synthetic public and private records'};
  fs.writeFileSync(path.join(f.work,'display-runtime-summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
}finally{await f.runtime.dispose();}
