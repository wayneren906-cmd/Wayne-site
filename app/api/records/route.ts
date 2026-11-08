import { env } from "cloudflare:workers";
import { json } from "@/lib/database";
import { readPublicJournalRecords } from "@/lib/public-content";
import { latestRecordUpdate } from "@/lib/records";
export const dynamic = "force-dynamic";
export async function GET() {
  const records = await readPublicJournalRecords(env.DB);
  return json({records,lastSync:latestRecordUpdate(records),canEdit:false,signedIn:false});
}
