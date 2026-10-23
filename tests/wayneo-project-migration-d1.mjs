// Actual local D1 engine, old populated schema, generated Worker. Synthetic data only.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createStudioWorkerEnvironment,sqlStatements} from './helpers/studio-worker-environment.mjs';
const f=await createStudioWorkerEnvironment({throughMigration:8});
const mutate=async body=>{
  const response=await f.runtime.dispatchFetch('http://synthetic.invalid/api/studio/projects',{method:'POST',headers:{cookie:f.auth.cookie,origin:'http://synthetic.invalid','content-type':'application/json'},body:JSON.stringify(body)});
  assert.equal(response.status,200,await response.clone().text());return response.json();
};
const state=async()=>({
  projects:(await f.db.prepare('SELECT * FROM studio_project_records ORDER BY owner_id,project_id').all()).results,
  receipts:(await f.db.prepare('SELECT * FROM studio_project_receipts ORDER BY owner_id,idempotency_key').all()).results,
  schema:(await f.db.prepare("SELECT name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name").all()).results
});
try{
  const legacy={action:'save_draft',project_id:'c-engine',expected_revision:0,idempotency_key:'synthetic-legacy-save',content:{status:'in_progress',summary:'Synthetic legacy public progress',next_step:'',milestones:{interface:'not_started',implementation:'not_started',verification:'not_started'},private_note:'SYNTHETIC_OLD_NOTE'}};
  await mutate(legacy);
  await mutate({action:'publish',project_id:'c-engine',expected_revision:1,idempotency_key:'synthetic-legacy-publish',confirm_public:true});
  const before=await state();
  const sql=fs.readFileSync(path.resolve('migrations/0009_wayneo_project.sql'),'utf8');
  const statements=()=>sqlStatements(sql).map(statement=>f.db.prepare(statement));
  await assert.rejects(f.db.batch([...statements(),f.db.prepare("SELECT json('synthetic failure')")]));
  assert.deepEqual(await state(),before,'failed migration rolls back schema, snapshots and receipts');
  await f.db.batch(statements());
  const after=await state();
  assert.deepEqual(after.projects,before.projects);assert.deepEqual(after.receipts,before.receipts);
  assert.equal((await mutate(legacy)).replayed,true,'legacy receipt hashes remain reusable');
  const website={...legacy,project_id:'wayneo',idempotency_key:'synthetic-website-save',content:{...legacy.content,description:'Synthetic website introduction',summary:'Synthetic website progress'}};
  await mutate(website);
  const publicBefore=await f.runtime.dispatchFetch('http://synthetic.invalid/studio/projects');
  assert.ok(!(await publicBefore.text()).includes('Synthetic website introduction'));
  await mutate({action:'publish',project_id:'wayneo',expected_revision:1,idempotency_key:'synthetic-website-publish',confirm_public:true});
  const publicAfter=await f.runtime.dispatchFetch('http://synthetic.invalid/studio/projects');
  const html=await publicAfter.text();assert.ok(html.includes('Synthetic website introduction'));assert.ok(!html.includes('SYNTHETIC_OLD_NOTE'));
  assert.deepEqual((await f.db.prepare('PRAGMA foreign_key_check').all()).results,[]);
  console.log(JSON.stringify({passed:true,scope:'generated Worker + local memory D1; populated 0008 to 0009 migration',preservedLegacyRows:true,failedMigrationRolledBack:true,legacyReceiptReplayed:true,wayneoPublishBoundary:true}));
}finally{await f.runtime.dispose();}
