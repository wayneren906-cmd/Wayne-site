import {env} from 'cloudflare:workers';
import {headers} from 'next/headers';
import LogoutButton from '../../../login/logout-button';
import {verifyStudioSession} from '@/lib/learning/auth';
import {getLearningContext,getStudioManagement} from '@/lib/learning/reads';
import {getStudioProjectDrafts} from '@/lib/studio-projects';
import {getStudioPlanDrafts} from '@/lib/studio-plans';
import StudioShell from '../../studio-shell';
import StudioWorkbench from '../../studio-workbench';
import StudioCover from '../../studio-cover';
import StudioLoginLink from '../../studio-login-link';

export const dynamic='force-dynamic';
export const metadata={title:'私人工作台 · Studio',robots:{index:false,follow:false}};
export default async function ManagementPage(){
  let identity;
  try{identity=await verifyStudioSession(await headers(),env.DB);}catch{}
  const results=identity?await Promise.allSettled([
    getStudioPlanDrafts(env.DB,identity),getStudioProjectDrafts(env.DB,identity),getLearningContext(env.DB,identity,'review'),getStudioManagement(env.DB,identity),
  ]):null;
  return <StudioShell active="management" privateSection="management" title="私人工作台" description="查看当前目标与项目，记录实际过程，再决定哪些变化公开。" cover={<StudioCover privateView/>} sessionControl={results?<LogoutButton/>:undefined}>
    {results?<StudioWorkbench
      plans={results[0].status==='fulfilled'?results[0].value:null}
      projects={results[1].status==='fulfilled'?results[1].value:null}
      context={results[2].status==='fulfilled'?results[2].value:null}
      systemNeedsAttention={results[3].status==='fulfilled'?results[3].value.jobs.counts.failed+results[3].value.jobs.counts.needs_attention:null}
    />:<p className="workbench-empty" role="alert">请登录管理员账号。当前无法验证管理权限。<StudioLoginLink returnTo="/studio/private/management"/></p>}
  </StudioShell>;
}
