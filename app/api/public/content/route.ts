import { env } from "cloudflare:workers";
import { json } from "@/lib/database";
import { readPublicContent } from "@/lib/public-content";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return json({items: await readPublicContent(env.DB)});
  } catch {
    // 通用错误，不泄露私人内容或数据库细节。
    return json({error:"公开内容暂时不可用",message:"请稍后重试。"},503);
  }
}
