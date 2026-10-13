import {env} from 'cloudflare:workers';
import {handleStudioEvents} from '@/lib/learning/http';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return handleStudioEvents(request, env);
}
