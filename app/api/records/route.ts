import { env } from "cloudflare:workers";
import { json } from "@/lib/database";
import { readPublicJournalRecords } from "@/lib/public-content";
export const dynamic = "force-dynamic";
export async function GET() {
  const last = await env.DB.prepare("SELECT updated_at FROM snapshots ORDER BY updated_at DESC LIMIT 1").first();
  return json({records:await readPublicJournalRecords(env.DB),lastSync:last?.updated_at ?? null,canEdit:false,signedIn:false});
}
