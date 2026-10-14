import {env} from 'cloudflare:workers';
import {headers} from 'next/headers';
import {verifyStudioSession} from '@/lib/learning/auth';
import {getStudioPlanDrafts} from '@/lib/studio-plans';
import type {StudioPlanDraftDTO} from '@/lib/learning/contracts';
import StudioShell from '../../studio-shell';
import PlanEditor from './plan-editor';
import StudioLoginLink from '../../studio-login-link';
import '../projects/project-editor.css';
import '../../studio-goals.css';
export const dynamic='force-dynamic';
export const metadata={title:'目标与计划管理 · Studio',robots:{index:false,follow:false}};
export default async function PlanManagementPage(){
  let allowed=false,plans:StudioPlanDraftDTO[]|null=null,error:string|null=null;
  try{const identity=await verifyStudioSession(await headers(),env.DB);allowed=true;plans=await getStudioPlanDrafts(env.DB,identity);}
  catch{if(allowed)error='目标数据暂时无法读取，请重新读取。';}
  return <StudioShell active="plans" privateSection="plans" title="目标与下一步" description="手动维护目标、状态与行动，再决定哪些安排公开。这些目标不会自动生成学习计划。">
    <a href="/studio#goals">查看公开目标 ↗</a>
    {allowed?<PlanEditor initialPlans={plans} initialError={error}/>:<p className="workbench-empty" role="alert">请登录管理员账号。当前无法验证管理权限。<StudioLoginLink returnTo="/studio/private/plans"/></p>}
  </StudioShell>;
}
