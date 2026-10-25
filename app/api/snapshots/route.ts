import { env } from "cloudflare:workers";
import {readPublicJournalSnapshot} from '@/lib/public-content';
import {dateSchema} from '@/lib/records';
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  if(!env.DB) throw new Error("Missing DB");
  const date = new URL(req.url).searchParams.get("date");
  if(date) {
    if(!dateSchema.safeParse(date).success)return Response.json({error:'日期无效'},{status:400,headers:{'Cache-Control':'no-store'}});
    const snapshot = await readPublicJournalSnapshot(env.DB,date);
    return Response.json(snapshot ?? {error:"快照不存在"}, {status:snapshot?200:404,headers:{"Cache-Control":"no-store"}});
  }
  const rows = await env.DB.prepare("SELECT date,updated_at FROM snapshots ORDER BY date DESC").all();
  return Response.json({snapshots:rows.results}, {headers:{"Cache-Control":"no-store"}});
}
