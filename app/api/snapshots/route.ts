import { env } from "cloudflare:workers";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  if(!env.DB) throw new Error("Missing DB");
  const date = new URL(req.url).searchParams.get("date");
  if(date) {
    const row = await env.DB.prepare("SELECT * FROM snapshots WHERE date=?").bind(date).first();
    return Response.json(row ? {date:row.date, records:JSON.parse(row.data as string), updatedAt:row.updated_at} : {error:"快照不存在"}, {status:row?200:404,headers:{"Cache-Control":"no-store"}});
  }
  const rows = await env.DB.prepare("SELECT date,updated_at FROM snapshots ORDER BY date DESC").all();
  return Response.json({snapshots:rows.results}, {headers:{"Cache-Control":"no-store"}});
}
