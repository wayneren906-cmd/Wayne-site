import {env} from 'cloudflare:workers';
import {handleStudioProjects} from '@/lib/learning/http';
export const dynamic='force-dynamic';
export async function GET(request:Request){return handleStudioProjects(request,env);}
export async function POST(request:Request){return handleStudioProjects(request,env);}
