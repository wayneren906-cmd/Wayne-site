// Local, read-only planner. No Cloudflare credentials, remote calls or migration application.
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
const internal=new Set(['_cf_KV','_cf_METADATA','d1_migrations']);
const canonical=sql=>sql.trim().replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|\s+/g,part=>/^['"]/.test(part)?part:' ').replace(/;$/,'');
const objects=db=>db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND sql IS NOT NULL ORDER BY type,name").all();
const hash=text=>createHash('sha256').update(text).digest('hex');

export function planLearningMigrations(schema,applied,options={}){
  const directory=options.migrationsDirectory??path.join(root,'migrations');
  const files=fs.readdirSync(directory).filter(name=>/^\d{4}_[\w-]+\.sql$/.test(name)).sort();
  if(!Array.isArray(schema)||!Array.isArray(applied)||!files.length)throw Error('Invalid migration baseline');
  const names=applied.map(row=>row?.name);
  if(names.some((name,i)=>name!==files[i])||new Set(names).size!==names.length)throw Error('Migration ledger is not a supported ordered prefix');
  const expected=new DatabaseSync(':memory:');
  try{
    expected.exec('PRAGMA foreign_keys=ON');
    for(const name of names)expected.exec(fs.readFileSync(path.join(directory,name),'utf8'));
    const expectedObjects=objects(expected);
    const actual=schema.filter(row=>!internal.has(row?.name)&&!row?.name?.startsWith('sqlite_'));
    if(new Set(actual.map(row=>row.name)).size!==actual.length||actual.length!==expectedObjects.length)throw Error('Database schema differs from its migration ledger');
    for(const row of expectedObjects){
      const existing=actual.find(candidate=>candidate.name===row.name);
      if(!existing||existing.type!==row.type||existing.tbl_name!==row.tbl_name||typeof existing.sql!=='string'||canonical(existing.sql)!==canonical(row.sql))throw Error('Database schema differs from its migration ledger');
    }
    const protectedObjects=expectedObjects.filter(row=>['records','snapshots'].includes(row.tbl_name));
    const pending=files.slice(names.length).map(name=>{
      const sql=fs.readFileSync(path.join(directory,name),'utf8');
      expected.exec(sql);
      return {name,sha256:hash(sql),bytes:Buffer.byteLength(sql)};
    });
    const finalObjects=objects(expected);
    for(const protectedObject of protectedObjects){
      const final=finalObjects.find(row=>row.name===protectedObject.name);
      if(!final||canonical(final.sql)!==canonical(protectedObject.sql))throw Error('Migration changes protected legacy schema');
    }
    return {format_version:1,baseline_migrations:names,pending,protected_tables:['records','snapshots'],
      private_tables:finalObjects.filter(row=>row.type==='table'&&!['records','snapshots'].includes(row.name)).map(row=>row.name).sort(),
      schema_sha256:hash(JSON.stringify(finalObjects.map(row=>({...row,sql:canonical(row.sql)}))))};
  }finally{expected.close();}
}

if(process.argv[1]===import.meta.filename){
  const file=process.argv[2];
  if(!file)throw Error('Provide a local metadata-only baseline JSON: {schema,applied}. This command never reads a database.');
  const baseline=JSON.parse(fs.readFileSync(path.resolve(file),'utf8'));
  console.log(JSON.stringify(planLearningMigrations(baseline.schema,baseline.applied),null,2));
}
