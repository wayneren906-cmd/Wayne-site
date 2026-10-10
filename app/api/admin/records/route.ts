import { env } from "cloudflare:workers";
import { verifyOwner, sameOrigin } from "@/lib/access";
import { json, readRecords, snapshot } from "@/lib/database";
import { recordSchema } from "@/lib/records";
export const dynamic = "force-dynamic";
async function allowed(request: Request) {
  try {await verifyOwner(request.headers.get("cf-access-jwt-assertion"),env); return true;} catch {return false;}
}
export async function GET(request:Request) {
  if (!await allowed(request)) return json({error:"请使用管理员账户登录"},403);
  const last = await env.DB.prepare("SELECT updated_at FROM snapshots ORDER BY updated_at DESC LIMIT 1").first();
  return json({records:await readRecords(env.DB),lastSync:last?.updated_at ?? null,canEdit:true,signedIn:true});
}
export async function POST(request:Request) {
  if (!await allowed(request)) return json({error:"请使用管理员账户登录"},403);
  if (!sameOrigin(request)) return json({error:"请求来源无效"},403);
  let body;try {body=recordSchema.parse(await request.json());}catch{return json({error:"请检查日期和学习内容"},400);}
  const now=new Date().toISOString();
  const result=body.expectedRevision === 0
    ? await env.DB.prepare("INSERT INTO records(date,items,practice,revision,updated_at) VALUES(?,?,?,1,?) ON CONFLICT(date) DO NOTHING").bind(body.date,JSON.stringify(body.items),body.practice,now).run()
    : await env.DB.prepare("UPDATE records SET items=?,practice=?,revision=revision+1,updated_at=? WHERE date=? AND revision=?").bind(JSON.stringify(body.items),body.practice,now,body.date,body.expectedRevision).run();
  if(!result.meta.changes)return json({error:"这一天的记录已更新，请重新打开编辑"},409);
  return json({records:await readRecords(env.DB)});
}
export async function PUT(request:Request) {
  if (!await allowed(request)) return json({error:"请使用管理员账户登录"},403);
  if (!sameOrigin(request)) return json({error:"请求来源无效"},403);
  return json(await snapshot(env.DB));
}
