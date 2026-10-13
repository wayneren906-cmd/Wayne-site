import {env} from 'cloudflare:workers';
import {headers} from 'next/headers';
import {verifyLearningOwner} from '@/lib/learning/auth';
import {prepareOwnerRegistration} from '@/lib/learning/registration';
import StudioShell from '../../studio-shell';
import WorkspaceClient from './workspace-client';
export const dynamic='force-dynamic';
export const metadata={title:'私人工作区 · Studio',robots:{index:false,follow:false}};
export default async function WorkspacePage(){
  const token=(await headers()).get('cf-access-jwt-assertion');let allowed=false,preview=false;
  try{await verifyLearningOwner(token,env,env.DB);allowed=true;}catch{try{preview=(await prepareOwnerRegistration(token,env,env.DB)).registration_required;}catch{}}
  return <StudioShell active="practice" title="私人工作区" description="关联知识、练习与项目里程碑，保留真实过程和保存回执。"><a href="/studio/practice">← 返回练习目录</a>{allowed||preview?<WorkspaceClient readOnly={preview}/>:<div className="workbench-empty">请使用已获授权的所有者账户登录。当前无法验证访问权限。</div>}</StudioShell>;
}
