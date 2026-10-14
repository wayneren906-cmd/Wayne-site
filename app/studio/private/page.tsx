import {env} from 'cloudflare:workers';
import {headers} from 'next/headers';
import {verifyStudioSession} from '@/lib/learning/auth';
import StudioShell from '../studio-shell';
import StudioLoginLink from '../studio-login-link';
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
  return <StudioShell active="records" privateSection="records" title="私人学习记录" description="查看近期记录与修订历史。新增日常、练习和项目记录使用同一入口，记录默认私人。" sessionControl={allowed?<LogoutButton/>:undefined}>{allowed?<StudioEntry showSupplement={false}/>:<p className="workbench-empty" role="alert">请登录管理员账号。当前无法验证访问权限。<StudioLoginLink returnTo="/studio/private"/></p>}</StudioShell>;
}
