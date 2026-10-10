import { readFile,writeFile,mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { recordSchema, dateSchema } from "../lib/records.ts";
export function importSQL(document){
 if(document.formatVersion!==1||!Array.isArray(document.records)||!Array.isArray(document.snapshots)) throw Error("Invalid export format");
 const literal=value=>"'"+String(value).replaceAll("'","''")+"'";
 const entry=value=>{
  recordSchema.parse({...value,expectedRevision:value.revision});
  if(!Number.isInteger(value.revision)||value.revision<1||typeof value.updatedAt!=="string"||Number.isNaN(Date.parse(value.updatedAt)))throw Error("Invalid record");
  return value;
 };
 const lines=["-- Import skips existing dates; it never overwrites records."];
 for(const value of document.records){
  const r=entry(value);
  lines.push("INSERT INTO records(date,items,practice,revision,updated_at) VALUES("+[r.date,JSON.stringify(r.items),r.practice,r.revision,r.updatedAt].map(literal).join(",")+") ON CONFLICT(date) DO NOTHING;");
 }
 for(const s of document.snapshots){
  dateSchema.parse(s.date);if(!Array.isArray(s.records)||typeof s.updatedAt!=="string"||Number.isNaN(Date.parse(s.updatedAt)))throw Error("Invalid snapshot");s.records.forEach(entry);
  lines.push("INSERT INTO snapshots(date,data,updated_at) VALUES("+[s.date,JSON.stringify(s.records),s.updatedAt].map(literal).join(",")+") ON CONFLICT(date) DO NOTHING;");
 }
 return lines.join("\n")+"\n";
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename)){
 const input=process.argv[2] || "data/learning-export.json", output=resolve(process.argv[3] || "data/import.sql");
 const sql=importSQL(JSON.parse(await readFile(input,"utf8")));
 await mkdir(resolve(output,".."),{recursive:true});await writeFile(output,sql);console.log("SQL saved to "+output);
}
