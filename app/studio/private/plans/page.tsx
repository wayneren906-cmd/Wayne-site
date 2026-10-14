import {env} from 'cloudflare:workers';
import {headers} from 'next/headers';
import {verifyStudioSession} from '@/lib/learning/auth';
import {getStudioPlanDrafts} from '@/lib/studio-plans';
import type {StudioPlanDraftDTO} from '@/lib/learning/contracts';
import StudioShell from '../../studio-shell';
import PlanEditor from './plan-editor';
import '../projects/project-editor.css';
import '../../studio-goals.css';
export const dynamic='force-dynamic';
export const metadata={title:'目标与计划管理 · Studio',robots:{index:false,follow:false}};
export default async function PlanManagementPage(){
  let allowed=false,plans:StudioPlanDraftDTO[]|null=null,error:string|null=null;
  try{const identity=await verifyStudioSession(await headers(),env.DB);allowed=true;plans=await getStudioPlanDrafts(env.DB,identity);}
  catch{if(allowed)error='目标数据暂时无法读取，请重新读取。';}
  return <StudioShell active="management" title="目标与下一步" description="保留少量清晰的目标，记录状态与行动，再决定哪些安排公开。">
    <nav className="project-editor-navigation" aria-label="目标管理导航"><a href="/studio/private/management">← 管理总览</a><a href="/studio#goals">公开目标 ↗</a></nav>
    {allowed?<PlanEditor initialPlans={plans} initialError={error}/>:<p className="workbench-empty" role="alert">请登录管理员账号。当前无法验证管理权限。</p>}
  </StudioShell>;
}
