// Real generated Worker and memory D1; no production reads or writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createStudioWorkerEnvironment} from './helpers/studio-worker-environment.mjs';

const f=await createStudioWorkerEnvironment(),checks=[];
const date='2026-10-15',historicalDate='2026-10-16';
const record={date,items:[{label:'公开笔记',text:'Synthetic SSR reading <script>unsafe()</script> & 中文',private_note:'PRIVATE_NESTED_SENTINEL'}],practice:'Synthetic public practice',revision:1,updatedAt:'2026-10-15T08:00:00Z',private_note:'PRIVATE_ROW_SENTINEL'};
async function html(url){
  const response=await f.runtime.dispatchFetch('http://synthetic.invalid'+url);
  assert.equal(response.status,200,url);
  const text=await response.text();
  assert.ok(!text.includes('PRIVATE_'),url+' public projection');
  checks.push(url);return text;
}
const body=text=>text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
try{
  await f.db.prepare('INSERT INTO records(date,items,practice,revision,updated_at) VALUES(?,?,?,?,?)').bind(date,JSON.stringify(record.items),record.practice,1,record.updatedAt).run();
  await f.db.prepare('INSERT INTO records(date,items,practice,revision,updated_at) VALUES(?,?,?,?,?)').bind('2026-10-14',JSON.stringify([{label:'Earlier',text:'Synthetic older reading'}]),'',1,record.updatedAt).run();
  await f.db.prepare('INSERT INTO snapshots(date,data,updated_at) VALUES(?,?,?)').bind(historicalDate,JSON.stringify([{...record,practice:'Synthetic historical practice'}]),record.updatedAt).run();
  const initial=await html('/learning');
  assert.match(body(initial),/class="notes"[^]*Synthetic SSR reading/,'text is rendered HTML, not just an RSC payload');
  assert.ok(!body(initial).includes('class="loading-bars"'));
  assert.match(initial,/<link[^>]*rel="canonical"[^>]*href="https:\/\/wayneo.dev\/learning"/);
  const shared=await html('/learning?date='+date+'&month=2026-09&q=missing');
  assert.match(shared,/<title>2026-10-15 学习手记 · Wayne<\/title>/);
  assert.match(shared,/<meta[^>]*property="og:title"[^>]*content="2026-10-15 学习手记 · Wayne"/);
  assert.match(shared,/<meta[^>]*property="og:description"[^>]*Synthetic SSR reading/);
  assert.match(body(shared),/Synthetic SSR reading &lt;script&gt;unsafe\(\)&lt;\/script&gt;/);
  assert.ok(!body(shared).includes('Synthetic older reading'),'the server applies the shared date before hydration');
  assert.match(body(shared),/href="\/learning\?date=2026-10-15"/);
  const filtered=await html('/learning?q=Earlier');
  assert.ok(body(filtered).includes('Synthetic older reading'));
  assert.ok(!body(filtered).includes('Synthetic SSR reading'));
  const snapshot=await html('/learning?date='+date+'&snapshot='+historicalDate);
  assert.ok(body(snapshot).includes('Synthetic historical practice'));
  assert.ok(!body(snapshot).includes('Synthetic public practice'));
  assert.match(snapshot,/<title>2026-10-15 学习手记（快照 2026-10-16） · Wayne<\/title>/);
  assert.match(body(snapshot),/href="\/learning\?date=2026-10-15&amp;snapshot=2026-10-16"/);
  const api=await f.runtime.dispatchFetch('http://synthetic.invalid/api/snapshots?date='+historicalDate);
  assert.equal(api.status,200);assert.ok(!JSON.stringify(await api.json()).includes('PRIVATE_'));
  const unknown=await html('/learning?date=2026-10-13');
  assert.ok(body(unknown).includes('这一天还没有公开手记'));
  assert.match(unknown,/<meta[^>]*name="robots"[^>]*content="noindex, follow"/);
  const missing=await html('/learning?date='+date+'&snapshot=2026-10-17');
  assert.ok(body(missing).includes('暂时无法读取这份快照'));
  assert.ok(!body(missing).includes('Synthetic SSR reading'));
  // A later request must read current state, never reuse a module-level public cache.
  await f.db.prepare('UPDATE records SET practice=? WHERE date=?').bind('Synthetic updated practice',date).run();
  const updated=await html('/learning?date='+date);
  assert.ok(body(updated).includes('Synthetic updated practice'));
  await f.db.prepare('ALTER TABLE records RENAME TO synthetic_unavailable_records').run();
  const failed=await html('/learning?date='+date);
  assert.ok(body(failed).includes('暂时无法读取记录，请重试。'));
  assert.ok(body(failed).includes('重新读取'));
  assert.ok(!body(failed).includes('这一天还没有公开手记'));
  const retainedHistory=await html('/learning?date='+date+'&snapshot='+historicalDate);
  assert.ok(body(retainedHistory).includes('Synthetic historical practice'));
  await f.db.prepare('ALTER TABLE synthetic_unavailable_records RENAME TO records').run();
  const summary={passed:true,checks,scope:'generated Worker, SSR body and metadata, public projection, memory D1 only'};
  fs.writeFileSync(path.join(f.work,'journal-reading-summary.json'),JSON.stringify(summary,null,2));
  console.log(JSON.stringify(summary));
}finally{await f.runtime.dispose();}
