import {env} from 'cloudflare:workers';
import {handleStudioManagement} from '@/lib/learning/http';

export const dynamic='force-dynamic';
export async function GET(request:Request){return handleStudioManagement(request,env);}
