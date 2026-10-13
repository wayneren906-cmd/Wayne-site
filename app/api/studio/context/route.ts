import {env} from 'cloudflare:workers';
import {handleStudioContext} from '@/lib/learning/http';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleStudioContext(request, env);
}
