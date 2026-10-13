import {env} from 'cloudflare:workers';
import {handleStudioEvent} from '@/lib/learning/http';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: {params: Promise<{event_id: string}>}) {
  const {event_id} = await context.params;
  return handleStudioEvent(request, env, event_id);
}

export async function PATCH(request: Request, context: {params: Promise<{event_id: string}>}) {
  const {event_id} = await context.params;
  return handleStudioEvent(request, env, event_id);
}

export async function DELETE(request: Request, context: {params: Promise<{event_id: string}>}) {
  const {event_id} = await context.params;
  return handleStudioEvent(request, env, event_id);
}
