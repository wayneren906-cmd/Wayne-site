import {env} from 'cloudflare:workers';
import {headers} from 'next/headers';
import {verifyStudioSession} from '@/lib/learning/auth';
import Journal from '../journal';
import SiteHeader from '../site-header';
import LogoutButton from '../login/logout-button';
export const dynamic='force-dynamic';
export const metadata={title:'管理学习记录',robots:{index:false,follow:false}};
export default async function AdminPage(){
  try{await verifyStudioSession(await headers(),env.DB);}catch{return <div className="shell"><SiteHeader active="learning"/><main className="intro"><div><h1>管理员登录</h1><p className="subtitle">登录后可以管理学习记录。</p><a className="secondary" href="/login">邮箱登录 →</a></div></main></div>;}
  return <><div className="shell" style={{paddingTop:16}}><LogoutButton/></div><Journal signInPath="/login" apiPath="/api/admin/records"/></>;
}
