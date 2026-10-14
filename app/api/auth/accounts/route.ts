import {env} from 'cloudflare:workers';
import {handleAdminAuth} from '@/lib/admin-auth';
export const dynamic='force-dynamic';
export async function GET(request:Request){return handleAdminAuth(request,env.DB,'accounts');}
export async function POST(request:Request){return handleAdminAuth(request,env.DB,'accounts');}
