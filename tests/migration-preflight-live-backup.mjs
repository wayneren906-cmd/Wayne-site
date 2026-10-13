// Only reads an existing ignored public-data export. Restores it into memory, never remotely.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {importSQL} from '../scripts/import-sql.mjs';
const root=path.resolve(import.meta.dirname,'..');
const source=path.resolve(process.argv[2]??path.join(root,'data/pre-migration-2026-10-14/legacy-export.json'));
assert.ok(source.startsWith(path.join(root,'data')+path.sep),'backup must be in ignored data directory');
const text=fs.readFileSync(source,'utf8'),backup=JSON.parse(text),db=new DatabaseSync(':memory:');
try{
  db.exec('PRAGMA foreign_keys=ON');db.exec(fs.readFileSync(path.join(root,'migrations/0001_initial.sql'),'utf8'));
  db.exec(importSQL(backup));
  const restoredRecords=()=>db.prepare('SELECT * FROM records ORDER BY date').all().map(row=>({date:row.date,items:JSON.parse(row.items),practice:row.practice,revision:row.revision,updatedAt:row.updated_at}));
  const expectedRecords=[...backup.records].sort((a,b)=>a.date.localeCompare(b.date));
  assert.deepEqual(restoredRecords(),expectedRecords);
  const restoredSnapshots=()=>db.prepare('SELECT * FROM snapshots ORDER BY date').all().map(row=>({date:row.date,records:JSON.parse(row.data),updatedAt:row.updated_at}));
  assert.deepEqual(restoredSnapshots(),[...backup.snapshots].sort((a,b)=>a.date.localeCompare(b.date)));
  const before={records:restoredRecords(),snapshots:restoredSnapshots()};
  for(const file of fs.readdirSync(path.join(root,'migrations')).filter(name=>name.endsWith('.sql')&&name!=='0001_initial.sql').sort())db.exec(fs.readFileSync(path.join(root,'migrations',file),'utf8'));
  assert.deepEqual({records:restoredRecords(),snapshots:restoredSnapshots()},before);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  const summary={passed:true,records:backup.records.length,snapshots:backup.snapshots.length,exported_at:backup.exportedAt,
    sha256:createHash('sha256').update(text).digest('hex'),scope:'public application data restored in memory, private migrations preserve all restored legacy values'};
  fs.writeFileSync(path.join(path.dirname(source),'restore-summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
}finally{db.close();}
