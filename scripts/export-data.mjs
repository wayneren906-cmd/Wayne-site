import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const url=new URL(process.argv[2] || "https://wayneo.dev");
if (!["http:","https:"].includes(url.protocol)) throw Error("Invalid site URL");
const destination=resolve(process.argv[3] || "data/learning-export.json");
const get=async path=>{
 const response=await fetch(new URL(path,url),{redirect:"error"});
 if(!response.ok)throw Error("Export failed: "+path+" HTTP "+response.status);
 return response.json();
};
let output;
for(let attempt=0;attempt<3;attempt++){
 const first=await get("/api/records"),list=await get("/api/snapshots"),snapshots=[];
 for(const {date} of list.snapshots) snapshots.push(await get("/api/snapshots?date="+encodeURIComponent(date)));
 const last=await get("/api/records"),lastList=await get("/api/snapshots");
 if(JSON.stringify(first.records)===JSON.stringify(last.records)&&JSON.stringify(list)===JSON.stringify(lastList)){
  output={formatVersion:1,exportedAt:new Date().toISOString(),source:url.origin,records:last.records,snapshots};break;
 }
}
if(!output)throw Error("Records changed while exporting. Please retry when editing is complete.");
await mkdir(resolve(destination,".."),{recursive:true});
await writeFile(destination,JSON.stringify(output,null,2)+"\n");
console.log("Exported "+output.records.length+" records and "+output.snapshots.length+" snapshots to "+destination);
