// Only the isolated generated Worker and synthetic memory D1 are used here.
import assert from 'node:assert/strict';
import {createStudioWorkerEnvironment} from './helpers/studio-worker-environment.mjs';
import {devPathIds} from '../content/devpath.ts';

const f=await createStudioWorkerEnvironment();
const checks=[];
async function request(path,status=200){
  const response=await f.runtime.dispatchFetch('http://synthetic.invalid'+path);
  assert.equal(response.status,status,path);
  const html=await response.text();
  assert.ok(!html.includes('PRIVATE_SENTINEL'),path+' keeps private fields out');
  checks.push({path,status});return html;
}
try{
  const overview=await request('/studio/devpath');
  assert.match(overview,/<h1[ >]/);assert.ok(overview.includes('学习、实践，'));
  assert.ok(overview.includes('生活体验'));
  assert.ok(overview.includes('href="/studio/devpath/spi-tft"'));
  for(const id of devPathIds){
    const html=await request('/studio/devpath/'+id);
    assert.match(html,/<h1[^>]*id="article-title"/);
    assert.ok(html.includes('https://wayneo.dev/studio/devpath/'+id));
  }
  assert.ok((await request('/studio/devpath/first-board')).includes('暂未收录'));
  await f.db.prepare('INSERT INTO records(date,items,practice,revision,updated_at) VALUES(?,?,?,?,?)').bind('2026-10-24',JSON.stringify([{label:'Synthetic evidence',text:'PUBLIC_CANONICAL_01',private_note:'PRIVATE_SENTINEL'}]),'Synthetic exercise',1,'2026-11-08T00:00:00Z').run();
  assert.ok((await request('/studio/devpath/first-board')).includes('PUBLIC_CANONICAL_01'));
  await f.db.prepare('UPDATE records SET items=?,revision=2 WHERE date=?').bind(JSON.stringify([{label:'Revised evidence',text:'PUBLIC_CANONICAL_02'}]),'2026-10-24').run();
  const updated=await request('/studio/devpath/first-board');assert.ok(updated.includes('PUBLIC_CANONICAL_02'));assert.ok(!updated.includes('PUBLIC_CANONICAL_01'));
  await request('/studio/devpath/unknown-entry',404);
  await f.db.prepare('ALTER TABLE records RENAME TO unavailable_records').run();
  assert.ok((await request('/studio/devpath/first-board')).includes('暂时无法读取'));
  assert.ok((await request('/studio/devpath/spi-tft')).includes('模拟数据'));
  await request('/studio/devpath');
  console.log(JSON.stringify({passed:true,checks,scope:'isolated Worker; synthetic memory D1; no production access'}));
}finally{await f.runtime.dispose();}
