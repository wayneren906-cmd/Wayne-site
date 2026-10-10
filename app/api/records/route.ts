import { env } from "cloudflare:workers";
import { json, readRecords } from "@/lib/database";
export const dynamic = "force-dynamic";
export async function GET() {
  const last = await env.DB.prepare("SELECT updated_at FROM snapshots ORDER BY updated_at DESC LIMIT 1").first();
  return json({records:await readRecords(env.DB),lastSync:last?.updated_at ?? null,canEdit:false,signedIn:false});
}
