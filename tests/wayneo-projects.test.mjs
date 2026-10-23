import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture,signedOwner,now} from './helpers/learning-fixture.mjs';
import {verifyLearningOwner} from '../lib/learning/auth.ts';
import {mutateStudioProject,getStudioProjectDrafts,readPublicStudioProjects} from '../lib/studio-projects.ts';
import {emptyProjectContent,projectMutationSchema,projectListSchema} from '../lib/ui/project-protocol.ts';
import {projectPublicationChanges} from '../lib/ui/studio-publication-changes.ts';

async function setup(t,options){
  const f=await fixture(t,undefined,options),auth=await signedOwner();
  return {...f,owner:await verifyLearningOwner(auth.jwt,auth.config,f.db,auth.verification)};
}
const save=(revision=0,key='wayneo-save',patch={})=>({action:'save_draft',project_id:'wayneo',expected_revision:revision,idempotency_key:key,content:{...emptyProjectContent(),status:'in_progress',description:'Synthetic website introduction',summary:'Synthetic website progress',next_step:'',private_note:'SYNTHETIC_WAYNEO_PRIVATE_NOTE',...patch}});
const publish=revision=>({action:'publish',project_id:'wayneo',expected_revision:revision,idempotency_key:'wayneo-publish-'+revision,confirm_public:true});
const rows=db=>({projects:db.prepare('SELECT * FROM studio_project_records ORDER BY owner_id,project_id').all(),receipts:db.prepare('SELECT * FROM studio_project_receipts ORDER BY owner_id,idempotency_key').all()});

test('Wayneo introduction is private until explicit publication; later edits and withdrawal preserve that boundary',async t=>{
  const f=await setup(t);
  await mutateStudioProject(f.db,f.owner,save(),{now});
  assert.deepEqual(await readPublicStudioProjects(f.db),[]);
  await assert.rejects(mutateStudioProject(f.db,f.owner,{...publish(1),confirm_public:false},{now}),{code:'INVALID_INPUT'});
  await mutateStudioProject(f.db,f.owner,publish(1),{now});
  assert.equal((await readPublicStudioProjects(f.db))[0].content.description,'Synthetic website introduction');
  await mutateStudioProject(f.db,f.owner,save(2,'wayneo-new-description',{description:'Synthetic unpublished introduction'}),{now});
  assert.equal((await readPublicStudioProjects(f.db))[0].content.description,'Synthetic website introduction');
  assert.ok(!JSON.stringify(await readPublicStudioProjects(f.db)).includes('SYNTHETIC_WAYNEO_PRIVATE_NOTE'));
  const changes=projectPublicationChanges('wayneo',(await getStudioProjectDrafts(f.db,f.owner))[0].draft,(await readPublicStudioProjects(f.db))[0].content);
  assert.ok(changes.some(change=>change.label==='项目介绍'&&change.before==='Synthetic website introduction'&&change.after==='Synthetic unpublished introduction'));
  const published=publish(3);await mutateStudioProject(f.db,f.owner,published,{now});
  assert.equal((await readPublicStudioProjects(f.db))[0].content.description,'Synthetic unpublished introduction');
  await mutateStudioProject(f.db,f.owner,{action:'unpublish',project_id:'wayneo',expected_revision:4,idempotency_key:'wayneo-withdraw'},{now});
  assert.deepEqual(await readPublicStudioProjects(f.db),[]);
  assert.equal((await getStudioProjectDrafts(f.db,f.owner))[0].draft.description,'Synthetic unpublished introduction');
  assert.equal((await mutateStudioProject(f.db,f.owner,published,{now})).replayed,true);
  assert.deepEqual(await readPublicStudioProjects(f.db),[],'old publication receipts never re-publish a withdrawn project');
});

test('Wayneo rejects incomplete publication and invalid descriptions without granting integration access',async t=>{
  const f=await setup(t);
  await mutateStudioProject(f.db,f.owner,save(0,'wayneo-empty',{description:''}),{now});
  await assert.rejects(mutateStudioProject(f.db,f.owner,publish(1),{now}),{code:'INVALID_INPUT'});
  await assert.rejects(mutateStudioProject(f.db,f.owner,save(1,'wayneo-too-long',{description:'x'.repeat(2001)}),{now}),{code:'INVALID_INPUT'});
  for(const identity of [null,f.identity])await assert.rejects(mutateStudioProject(f.db,identity,save(),{now}),{code:'PRIVATE_ACCESS_DENIED'});
  assert.equal(projectMutationSchema.safeParse({...save(),project_id:'unknown-project'}).success,false);
});

test('0009 preserves legacy drafts, published snapshots and idempotent receipts while restoring SQL guards',async t=>{
  const f=await setup(t,{throughMigration:8});
  const legacy={...save(),project_id:'c-engine',idempotency_key:'legacy-save',content:{...emptyProjectContent(),summary:'Synthetic legacy snapshot',next_step:'',private_note:'Legacy private note'}};
  delete legacy.content.description;
  const legacyPublish={...publish(1),project_id:'c-engine',idempotency_key:'legacy-publish'};
  await mutateStudioProject(f.db,f.owner,legacy,{now});await mutateStudioProject(f.db,f.owner,legacyPublish,{now});
  const before=rows(f.sqlite),sql=readFileSync(new URL('../migrations/0009_wayneo_project.sql',import.meta.url),'utf8');
  f.sqlite.exec('BEGIN IMMEDIATE');try{f.sqlite.exec(sql);f.sqlite.exec('COMMIT');}catch(error){f.sqlite.exec('ROLLBACK');throw error;}
  assert.deepEqual(rows(f.sqlite),before);
  assert.deepEqual(f.sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
  assert.equal((await mutateStudioProject(f.db,f.owner,legacy,{now})).replayed,true);
  assert.equal((await mutateStudioProject(f.db,f.owner,legacyPublish,{now})).replayed,true);
  assert.equal((await readPublicStudioProjects(f.db))[0].content.summary,'Synthetic legacy snapshot');
  assert.equal(Object.hasOwn(projectMutationSchema.parse(legacy).content,'description'),false,'legacy request normalization must not introduce a new field');
  for(const project_id of ['embedded-controller','automotive-bus','wayneo'])await mutateStudioProject(f.db,f.owner,{...save(),project_id,idempotency_key:'save-'+project_id},{now});
  assert.equal(projectListSchema.parse({projects:await getStudioProjectDrafts(f.db,f.owner)}).projects.length,4);
  assert.throws(()=>f.sqlite.prepare('UPDATE studio_project_records SET project_id=? WHERE owner_id=? AND project_id=?').run('unknown-project','synthetic-owner','wayneo'));
  assert.throws(()=>f.sqlite.prepare('INSERT INTO studio_project_receipts VALUES(?,?,?,?,?,?)').run('synthetic-owner','invalid-version','wayneo','a'.repeat(64),'publish',9),/INVALID_PROJECT_RECEIPT_VERSION/);
  f.sqlite.exec("UPDATE users SET status='disabled' WHERE user_id='synthetic-owner'");
  assert.throws(()=>f.sqlite.exec("UPDATE studio_project_records SET private_note='blocked' WHERE project_id='wayneo'"),/PRIVATE_ACCESS_DENIED/);
  assert.deepEqual(await readPublicStudioProjects(f.db),[]);
});

test('a failing 0009 transaction rolls back old data and schema together',async t=>{
  const f=await setup(t,{throughMigration:8});
  await mutateStudioProject(f.db,f.owner,{...save(),project_id:'c-engine'},{now});
  const before=rows(f.sqlite),schema=f.sqlite.prepare("SELECT name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all();
  f.sqlite.exec('BEGIN IMMEDIATE');
  assert.throws(()=>f.sqlite.exec(readFileSync(new URL('../migrations/0009_wayneo_project.sql',import.meta.url),'utf8')+"\n SELECT json('synthetic failure');"));
  f.sqlite.exec('ROLLBACK');
  assert.deepEqual(rows(f.sqlite),before);
  assert.deepEqual(f.sqlite.prepare("SELECT name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all(),schema);
});
