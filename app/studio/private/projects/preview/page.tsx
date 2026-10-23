import {env} from 'cloudflare:workers';
import {headers} from 'next/headers';
import {verifyStudioSession} from '@/lib/learning/auth';
import {getStudioProjectDrafts} from '@/lib/studio-projects';
import {studioProjects} from '@/lib/studio-catalog';
import type {StudioProjectDraftDTO} from '@/lib/learning/contracts';
import StudioShell from '../../../studio-shell';
import StudioProjectSpread from '../../../studio-project-spread';
import StudioLoginLink from '../../../studio-login-link';

export const dynamic='force-dynamic';
export const metadata={title:'草稿排版预览 · Studio',robots:{index:false,follow:false}};
const formatTime=(value:string)=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',dateStyle:'medium',timeStyle:'short',hour12:false}).format(new Date(value));

// 私人草稿排版预览：先验证管理员会话，再读取服务器草稿，只渲染 query 指定项目的已保存内容。
// 不使用任何前端未保存输入，不写入、不发布，也不显示私人备注与发布日期。
export default async function ProjectDraftPreviewPage({searchParams}:{searchParams:Promise<{project?:string|string[]}>}){
  const query=await searchParams;
  const requested=typeof query.project==='string'?query.project:'';
  const catalogProject=studioProjects.find(project=>project.id===requested)??null;
  let allowed=false,drafts:StudioProjectDraftDTO[]|null=null,readError=false;
  try{
    const identity=await verifyStudioSession(await headers(),env.DB);
    allowed=true;
    drafts=await getStudioProjectDrafts(env.DB,identity);
  }catch{
    if(allowed)readError=true;
  }
  const row=(catalogProject&&drafts)?(drafts.find(draft=>draft.project_id===catalogProject.id)??null):null;
  return <StudioShell active="projects" title="项目详情" description="正在做的项目，以及已经留下的成果。">
    {!allowed?(
      <p className="workbench-empty" role="alert">请登录管理员账号。当前无法验证管理权限。<StudioLoginLink returnTo="/studio/private/projects"/></p>
    ):!catalogProject?(
      <p className="workbench-feedback" role="alert">预览链接无效：需要一个已存在的项目 ID。请回到项目管理页选择项目后再预览。</p>
    ):readError?(
      <p className="workbench-feedback" role="alert">项目草稿暂时无法读取，请刷新重试。</p>
    ):!row?(
      <p className="workbench-feedback" role="status">该项目还没有已保存的服务器草稿，暂无可预览的排版。</p>
    ):(
      <>
        <aside className="workbench-panel" aria-label="私人草稿预览说明">
          <p className="workbench-kicker">PRIVATE DRAFT PREVIEW</p>
          <h2>私人草稿预览 · 仅管理员可见</h2>
          <p>草稿版本 r{row.revision} · 更新时间 <time dateTime={row.updated_at}>{formatTime(row.updated_at)}</time></p>
          <p className="workbench-note">这里只渲染已经保存到服务器的草稿，未保存的修改不会出现在预览中；预览不会发布或写入，也不显示私人备注。</p>
          <p><a href={`/studio/private/projects?project=${row.project_id}`}>返回该项目编辑页 ↗</a></p>
        </aside>
        <StudioProjectSpread projectId={row.project_id} content={row.draft}/>
      </>
    )}
  </StudioShell>;
}
