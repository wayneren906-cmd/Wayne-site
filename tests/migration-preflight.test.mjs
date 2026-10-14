import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {planLearningMigrations} from '../scripts/migration-preflight.mjs';

const files=['0001_initial.sql','0002_learning_events.sql','0003_ingest_outbox.sql','0004_correction_authority.sql','0005_private_deletion.sql','0006_studio_projects.sql'];
const sql=name=>fs.readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8');
const schema=db=>db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all();
function baseline(t,count=1){const db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec('PRAGMA foreign_keys=ON');
  db.exec('CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT UNIQUE,applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)');
  for(const name of files.slice(0,count)){db.exec(sql(name));db.prepare('INSERT INTO d1_migrations(name) VALUES(?)').run(name);}return db;}
const snapshot=db=>({schema:schema(db),records:db.prepare('SELECT * FROM records ORDER BY date').all(),snapshots:db.prepare('SELECT * FROM snapshots ORDER BY date').all()});

test('live-compatible baseline plans additive hashed migrations and eleven private tables without mutating input',t=>{
  const db=baseline(t);const before=snapshot(db),applied=db.prepare('SELECT name FROM d1_migrations ORDER BY id').all();
  const plan=planLearningMigrations(before.schema,applied);
  assert.deepEqual(plan.pending.map(row=>row.name),files.slice(1));assert.equal(plan.private_tables.length,11);
  assert.ok(plan.pending.every(row=>/^[a-f0-9]{64}$/.test(row.sha256)&&row.bytes>0));
  assert.deepEqual(snapshot(db),before);
});
test('drifted/missing/extra schema, unknown ledger, duplicate or out-of-order migration entries fail closed',t=>{
  const db=baseline(t),rows=schema(db),ledger=[{name:files[0]}];
  for(const changed of [rows.filter(row=>row.name!=='records'),rows.map(row=>row.name==='records'?{...row,sql:row.sql.replace('revision INTEGER','revision TEXT')}:row),
    [...rows,{type:'table',name:'unexpected_private',tbl_name:'unexpected_private',sql:'CREATE TABLE unexpected_private(x TEXT)'}]])assert.throws(()=>planLearningMigrations(changed,ledger),/schema differs/);
  for(const changed of [[{name:'unknown.sql'}],[{name:files[0]},{name:files[0]}],[{name:files[1]},{name:files[0]}]])assert.throws(()=>planLearningMigrations(rows,changed),/ordered prefix/);
});
test('all migrations preserve synthetic legacy body/revisions/snapshots and create no user or private content',t=>{
  const db=baseline(t);
  for(let day=10;day<14;day++)db.prepare('INSERT INTO records VALUES(?,?,?,?,?)').run(`2026-10-${day}`,JSON.stringify([{label:'合成旧记录',text:"quote ' \n long synthetic content"}]),'synthetic supplement',day,'2026-10-14T00:00:00Z');
  for(let day=9;day<14;day++)db.prepare('INSERT INTO snapshots VALUES(?,?,?)').run(`2026-10-${day}`,'[{"synthetic":"snapshot"}]','2026-10-14T00:00:00Z');
  const before=snapshot(db),plan=planLearningMigrations(before.schema,[{name:files[0]}]);
  for(const migration of plan.pending){db.exec('BEGIN IMMEDIATE');try{db.exec(sql(migration.name));db.prepare('INSERT INTO d1_migrations(name) VALUES(?)').run(migration.name);db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}}
  const after=snapshot(db);assert.deepEqual(after.records,before.records);assert.deepEqual(after.snapshots,before.snapshots);
  for(const table of plan.private_tables)assert.equal(db.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n,0);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  assert.equal(planLearningMigrations(schema(db),db.prepare('SELECT name FROM d1_migrations ORDER BY id').all()).pending.length,0);
});
test('a failed migration rolls back its DDL and ledger; previously completed files remain resumable',t=>{
  const db=baseline(t);
  db.exec(sql(files[1]));db.prepare('INSERT INTO d1_migrations(name) VALUES(?)').run(files[1]);const before=schema(db);
  db.exec('BEGIN IMMEDIATE');assert.throws(()=>db.exec(sql(files[2])+"\n SELECT json('synthetic migration failure');"));db.exec('ROLLBACK');
  assert.deepEqual(schema(db),before);const plan=planLearningMigrations(schema(db),db.prepare('SELECT name FROM d1_migrations ORDER BY id').all());
  assert.deepEqual(plan.pending.map(row=>row.name),files.slice(2));
});
