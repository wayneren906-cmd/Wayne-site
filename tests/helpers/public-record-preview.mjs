// Explicit, local copies of PUBLIC API records only. Never reads a production database.
import fs from 'node:fs';
import {dateSchema,recordSchema} from '../../lib/records.ts';

export function loadPublicRecords(file){
  const payload=JSON.parse(fs.readFileSync(file,'utf8'));
  if(!Array.isArray(payload.records))throw Error('A public records response is required');
  const dates=new Set();
  return payload.records.map(record=>{
    const checked=recordSchema.parse({date:record.date,items:record.items,practice:record.practice,expectedRevision:record.revision});
    const date=dateSchema.parse(checked.date);
    if(dates.has(date))throw Error('Duplicate public record date');dates.add(date);
    if(typeof record.updatedAt!=='string'||!Number.isFinite(Date.parse(record.updatedAt)))throw Error('Invalid public update timestamp');
    return {date,items:checked.items.map(item=>({label:item.label,text:item.text})),practice:checked.practice,revision:checked.expectedRevision,updatedAt:record.updatedAt};
  });
}

export async function seedPublicRecords(db,records){
  for(const record of records)await db.prepare('INSERT INTO records(date,items,practice,revision,updated_at) VALUES(?,?,?,?,?)').bind(record.date,JSON.stringify(record.items),record.practice,record.revision,record.updatedAt).run();
}
