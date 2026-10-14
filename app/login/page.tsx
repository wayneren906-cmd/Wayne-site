import {env} from 'cloudflare:workers';
import {headers} from 'next/headers';
import {redirect} from 'next/navigation';
import {readAdminSession} from '@/lib/admin-auth';
import StudioShell from '../studio/studio-shell';
import LoginForm from './login-form';
import {studioReturnTo} from '@/lib/ui/studio-navigation';
import './login.css';
export const dynamic='force-dynamic';
export const metadata={title:'管理员邮箱登录 · Wayneo',robots:{index:false,follow:false}};
export default async function LoginPage({searchParams}:{searchParams:Promise<{returnTo?:string|string[]}>}){
  const returnTo=studioReturnTo((await searchParams).returnTo);
  let signedIn=false;try{signedIn=!!await readAdminSession(await headers(),env.DB);}catch{}
  if(signedIn)redirect(returnTo);
  return <StudioShell active="login" title="回到你的数字空间" description="公开内容自由浏览。管理员登录后，可以管理记录、项目和目标。"><LoginForm returnTo={returnTo}/><p className="workbench-note">目前仅接受已有管理员账号。登录后继续原来的操作。<a href="/studio">继续以游客浏览 →</a></p></StudioShell>;
}
