import {env} from 'cloudflare:workers';
import {headers} from 'next/headers';
import {verifyStudioSession} from '@/lib/learning/auth';
import StudioShell from '../../studio-shell';
import WorkspaceClient from './workspace-client';
export const dynamic='force-dynamic';
export const metadata={title:'私人工作区 · Studio',robots:{index:false,follow:false}};
export default async function WorkspacePage(){
  let allowed=false;try{await verifyStudioSession(await headers(),env.DB);allowed=true;}catch{}
  return <StudioShell active="practice" title="私人工作区" description="关联知识、练习与项目里程碑，保留真实过程和保存回执。"><a href="/studio/practice">← 返回练习目录</a>{allowed?<WorkspaceClient/>:<div className="workbench-empty">请登录管理员账号。当前无法验证访问权限。<a href="/login">邮箱登录 →</a></div>}</StudioShell>;
}
