import {env} from 'cloudflare:workers';
import {headers} from 'next/headers';
import {verifyStudioSession} from '@/lib/learning/auth';
import SiteHeader from '../../site-header';
import SiteFooter from '../../site-footer';
import StudioEntry from '../studio-entry';
import LogoutButton from '../../login/logout-button';
import '../studio-overview.css';
import '../studio-events.css';
import '../studio-supplement-form.css';
import '../studio-client.css';
export const dynamic='force-dynamic';
export const metadata={title:'私人学习空间',robots:{index:false,follow:false}};
export default async function PrivateStudioPage(){
  let allowed=false;try{await verifyStudioSession(await headers(),env.DB);allowed=true;}catch{}
  return <div className="editorial-shell studio-private-shell"><SiteHeader active="studio"/><main className="studio-page"><a className="studio-back-link" href="/studio">← 返回 Studio</a><div className="studio-page__header"><div><p className="studio-private-kicker">PRIVATE NOTEBOOK / 私人手记</p><h1>私人学习空间</h1></div>{allowed&&<LogoutButton/>}</div><a className="studio-back-link" href="/studio/private/management">管理总览 →</a><a className="studio-back-link" href="/studio/private/workspace">练习与项目关联工作区 →</a>{allowed?<StudioEntry/>:<p role="alert">请登录管理员账号。当前无法验证访问权限。<a href="/login">邮箱登录 →</a></p>}</main><SiteFooter/></div>;
}
