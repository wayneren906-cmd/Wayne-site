import {env} from 'cloudflare:workers';
import {handleStudioEventHistory} from '@/lib/learning/http';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: {params: Promise<{event_id: string}>}) {
  const {event_id} = await context.params;
  return handleStudioEventHistory(request, env, event_id);
}
