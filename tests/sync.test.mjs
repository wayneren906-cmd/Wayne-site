import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { handleSync } from '../lib/sync.ts';

const token = 'a'.repeat(64);
const digest = createHash('sha256').update(token).digest('hex');
const draft = {date:'2026-10-10',items:[{label:'学习',text:'阅读状态机'}],practice:'尚未独立运行',expectedRevision:0};
function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('CREATE TABLE records(date TEXT PRIMARY KEY,items TEXT NOT NULL,practice TEXT NOT NULL,revision INTEGER NOT NULL,updated_at TEXT NOT NULL)');
  const DB = {prepare(sql){let args=[]; const statement=sqlite.prepare(sql); return {
    bind(...values){args=values;return this;},
    async first(){return statement.get(...args)??null;},
    async all(){return {results:statement.all(...args)};},
    async run(){return {meta:{changes:Number(statement.run(...args).changes)}};}
  };}};
  return {DB,SYNC_TOKEN_SHA256:digest};
}
function request(body=draft, credential=token) {
  return new Request('https://wayneo.dev/api/sync/records',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${credential}`},body:JSON.stringify(body)});
}
test('sync rejects missing or wrong credentials and fails closed without config',async()=>{
  const env=fixture();
  for(const credential of ['', 'wrong',digest]) assert.equal((await handleSync(request(draft,credential),env)).status,401);
  assert.equal((await handleSync(request(),{DB:env.DB})).status,503);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS count FROM records').first()).count,0);
  assert.equal((await handleSync(new Request('https://wayneo.dev/api/sync/records'),env)).status,401);
});
test('sync creates, reads and updates using actual SQLite revision guards',async()=>{
  const env=fixture();
  assert.equal((await handleSync(request(),env)).status,200);
  const read=await handleSync(new Request('https://wayneo.dev/api/sync/records',{headers:{Authorization:`Bearer ${token}`}}),env);
  assert.equal((await read.json()).records[0].revision,1);
  const result=await handleSync(request({...draft,practice:'已完成真实练习',expectedRevision:1}),env);
  assert.equal(result.status,200);
  assert.equal((await result.json()).record.revision,2);
});
test('sync identical retries do not change revision or timestamp',async()=>{
  const env=fixture();
  const first=await (await handleSync(request(),env)).json();
  const retry=await (await handleSync(request(),env)).json();
  assert.equal(retry.unchanged,true);
  assert.deepEqual(retry.record,first.record);
});
test('sync stale revisions never replace manual content',async()=>{
  const env=fixture();
  await handleSync(request(),env);
  await env.DB.prepare('UPDATE records SET practice=?,revision=revision+1 WHERE date=?').bind('人工修改',draft.date).run();
  assert.equal((await handleSync(request({...draft,practice:'旧自动摘要',expectedRevision:1}),env)).status,409);
  assert.equal((await env.DB.prepare('SELECT practice FROM records').first()).practice,'人工修改');
});
test('sync validates input and caps streamed request size before mutating',async()=>{
  const env=fixture();
  assert.equal((await handleSync(request({...draft,date:'2026-02-30'}),env)).status,400);
  assert.equal((await handleSync(request({...draft,practice:'x'.repeat(70000)}),env)).status,413);
  const bad=new Request('https://wayneo.dev/api/sync/records',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:'{'});
  assert.equal((await handleSync(bad,env)).status,400);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS count FROM records').first()).count,0);
});
