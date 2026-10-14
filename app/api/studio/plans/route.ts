import {env} from 'cloudflare:workers';
import {handleStudioPlans} from '@/lib/learning/http';
export const dynamic='force-dynamic';
export async function GET(request:Request){return handleStudioPlans(request,env);}
export async function POST(request:Request){return handleStudioPlans(request,env);}
