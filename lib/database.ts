import { learningDate, type Entry } from "./records.ts";
export async function readRecords(db: D1Database): Promise<Entry[]> {
  const rows = await db.prepare("SELECT * FROM records ORDER BY date DESC").all<{date:string;items:string;practice:string;revision:number;updated_at:string}>();
  return rows.results.map(r => ({date:r.date,items:JSON.parse(r.items),practice:r.practice,revision:r.revision,updatedAt:r.updated_at}));
}
export async function snapshot(db: D1Database, now = new Date()) {
  const date = learningDate(now), data = await readRecords(db), updatedAt = now.toISOString();
  await db.prepare("INSERT INTO snapshots(date,data,updated_at) VALUES(?,?,?) ON CONFLICT(date) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at WHERE excluded.updated_at >= snapshots.updated_at").bind(date,JSON.stringify(data),updatedAt).run();
  return {snapshotDate:date,count:data.length,updatedAt};
}
export function json(data:unknown,status=200) {
  return Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
}
