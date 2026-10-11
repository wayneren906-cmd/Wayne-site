import { env } from 'cloudflare:workers';
import { handleSync } from '@/lib/sync';
export const dynamic = 'force-dynamic';
export function GET(request: Request) { return handleSync(request, env); }
export function POST(request: Request) { return handleSync(request, env); }
