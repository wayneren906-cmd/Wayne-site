import {studioProjects,knowledgeTopics} from '@/lib/studio-catalog';
import {env} from 'cloudflare:workers';
import {readPublicStudioProjects} from '@/lib/studio-projects';
import {projectStatusLabels,milestoneStatusLabels} from '@/lib/ui/project-protocol';
import StudioShell from '../studio-shell';
export const dynamic='force-dynamic';
export const metadata={title:'项目与创作 · Studio'};
export default async function StudioProjectsPage(){
  let published:Awaited<ReturnType<typeof readPublicStudioProjects>>|null=null;
  try{published=await readPublicStudioProjects(env.DB);}catch{}
  return <StudioShell active="projects" title="项目与创作" description="把知识变成可以验证的实现。已发布的进展与方向蓝图在这里汇合。">
    {published===null&&<p className="workbench-feedback" role="status">动态项目状态暂时无法读取，方向蓝图仍可浏览。</p>}
    {studioProjects.map(project=>{const live=published?.find(item=>item.project_id===project.id);return <section id={project.id} className="workbench-project" key={project.id}><p className="workbench-kicker">{project.num} · {live?projectStatusLabels[live.content.status]:'项目蓝图'}</p><h2>{project.title}</h2><p>{project.desc}</p>{live&&<div className="workbench-panel" style={{marginTop:20}}><p className="workbench-kicker">PUBLISHED PROGRESS / <time dateTime={live.published_at}>{new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(live.published_at))}</time></p><p style={{whiteSpace:'pre-wrap',marginTop:12}}>{live.content.summary}</p><p className="workbench-note">下一步 · {live.content.next_step||'暂无公开安排'}</p></div>}<div className="workbench-tags">{project.tags.map(tag=><span key={tag}>{tag}</span>)}</div><ol className="workbench-milestones">{project.milestones.map((milestone,index)=><li key={milestone.id}><p className="workbench-label">MILESTONE {index+1}{live?` · ${milestoneStatusLabels[live.content.milestones[milestone.id as keyof typeof live.content.milestones]]}`:''}</p><h3>{milestone.title}</h3><p>{milestone.acceptance}</p><details><summary>关联知识</summary>{milestone.knowledgeIds.map(id=><a key={id} href={`/studio/roadmap#${id}`}>{knowledgeTopics.find(topic=>topic.id===id)?.title}</a>)}</details><a href={`/studio/private/workspace?project=${project.id}&milestone=${milestone.id}`}>记录此里程碑的过程 ↗</a></li>)}</ol></section>;})}
    <p className="workbench-footnote">项目与里程碑状态由管理员确认后公开发布，独立于私人练习证据。未发布的方向展示蓝图，不自动推断完成或掌握程度。</p>
  </StudioShell>;
}
