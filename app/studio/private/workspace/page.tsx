import {env} from 'cloudflare:workers';
import {headers} from 'next/headers';
import {verifyStudioSession} from '@/lib/learning/auth';
import StudioShell from '../../studio-shell';
import WorkspaceClient from './workspace-client';
import StudioLoginLink from '../../studio-login-link';
export const dynamic='force-dynamic';
export const metadata={title:'新增私人记录 · Studio',robots:{index:false,follow:false}};
export default async function WorkspacePage(){
  let allowed=false;try{await verifyStudioSession(await headers(),env.DB);allowed=true;}catch{}
  return <StudioShell active="records" privateSection="records" title="新增私人记录" description="保存日常学习、练习或项目过程。关联对象可选，记录不会自动公开或改变项目状态。"><a href="/studio/private">← 返回近期记录</a>{allowed?<WorkspaceClient/>:<div className="workbench-empty" role="alert">请登录管理员账号。当前无法验证访问权限。<StudioLoginLink returnTo="/studio/private/workspace"/></div>}</StudioShell>;
}
