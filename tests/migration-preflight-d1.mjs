// Migrations on synthetic populated legacy schema only; no remote database access.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {planLearningMigrations} from '../scripts/migration-preflight.mjs';
import {sqlStatements} from './helpers/studio-worker-environment.mjs';
const root=path.resolve(import.meta.dirname,'..'),require=createRequire(fs.realpathSync(path.join(root,'node_modules/wrangler/package.json')));
const {Miniflare}=await import(pathToFileURL(require.resolve('miniflare')).href);
const runtime=new Miniflare({modules:true,script:"export default {fetch(){return new Response('synthetic migration rehearsal')}}",compatibilityDate:'2026-05-15',
  host:'127.0.0.1',port:0,d1Databases:{DB:'synthetic-migration-rehearsal'},d1Persist:false,cachePersist:false,kvPersist:false,r2Persist:false,durableObjectsPersist:false});
const sql=name=>fs.readFileSync(path.join(root,'migrations',name),'utf8');
try{
  const db=await runtime.getD1Database('DB');
  for(const statement of sqlStatements(sql('0001_initial.sql')))await db.prepare(statement).run();
  await db.prepare('CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT UNIQUE,applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)').run();
  await db.prepare('INSERT INTO d1_migrations(name) VALUES(?)').bind('0001_initial.sql').run();
  for(let n=10;n<14;n++)await db.prepare('INSERT INTO records VALUES(?,?,?,?,?)').bind(`2026-10-${n}`,'[{"label":"synthetic","text":"not production content"}]','synthetic legacy supplement',2,'2026-10-14T00:00:00Z').run();
  for(let n=9;n<14;n++)await db.prepare('INSERT INTO snapshots VALUES(?,?,?)').bind(`2026-10-${n}`,'[{"synthetic":"snapshot"}]','2026-10-14T00:00:00Z').run();
  const schema=async()=>(await db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all()).results;
  const ledger=async()=>(await db.prepare('SELECT name FROM d1_migrations ORDER BY id').all()).results;
  const legacy=async()=>({records:(await db.prepare('SELECT * FROM records ORDER BY date').all()).results,snapshots:(await db.prepare('SELECT * FROM snapshots ORDER BY date').all()).results});
  console.log('Synthetic D1 baseline objects: '+JSON.stringify((await schema()).map(row=>({name:row.name,type:row.type}))));
  const before=await legacy(),plan=planLearningMigrations(await schema(),await ledger());
  const apply=async name=>db.batch([...sqlStatements(sql(name)).map(statement=>db.prepare(statement)),db.prepare('INSERT INTO d1_migrations(name) VALUES(?)').bind(name)]);
  await apply(plan.pending[0].name);
  const checkpoint={schema:await schema(),ledger:await ledger()};
  await assert.rejects(db.batch([...sqlStatements(sql(plan.pending[1].name)).map(statement=>db.prepare(statement)),db.prepare("SELECT json('synthetic migration failure')"),db.prepare('INSERT INTO d1_migrations(name) VALUES(?)').bind(plan.pending[1].name)]));
  assert.deepEqual(await schema(),checkpoint.schema);assert.deepEqual(await ledger(),checkpoint.ledger);
  const resumed=planLearningMigrations(await schema(),await ledger());assert.equal(resumed.pending.length,3);
  for(const migration of resumed.pending)await apply(migration.name);
  assert.deepEqual(await legacy(),before);
  const final=planLearningMigrations(await schema(),await ledger());assert.equal(final.pending.length,0);
  for(const table of final.private_tables)assert.equal((await db.prepare(`SELECT COUNT(*) n FROM ${table}`).first()).n,0);
  assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results,[]);
  console.log(JSON.stringify({passed:true,legacy_records:4,legacy_snapshots:5,new_private_tables:9,remaining_migrations:0,failed_migration_rolled_back:true,schema_sha256:final.schema_sha256}));
}finally{await runtime.dispose();}
