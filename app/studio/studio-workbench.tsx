import type {LearningContextDTO,StudioPlanDraftDTO,StudioProjectDraftDTO} from '../../lib/learning/contracts.ts';
import {studioProjects} from '../../lib/studio-catalog.ts';
import {goalStatusLabels} from '../../lib/ui/plan-protocol.ts';
import {projectStatusLabels,milestoneStatusLabels} from '../../lib/ui/project-protocol.ts';

type Props={plans:StudioPlanDraftDTO[]|null;projects:StudioProjectDraftDTO[]|null;context:LearningContextDTO|null;systemNeedsAttention?:number|null};
function ReadError({label}:{label:string}){return <p className="workbench-empty" role="alert">{label}暂时无法读取。<a href="/studio/private/management">重新读取工作台 →</a></p>;}

export default function StudioWorkbench({plans,projects,context,systemNeedsAttention}:Props){
  const goals=plans?.[0]?.draft.goals.filter(goal=>goal.status!=='completed')??[];
  const activeProjects=projects?.filter(project=>project.draft.status==='in_progress')??[];
  const projectUpdates=projects?.filter(project=>!!(project.draft.summary||project.publication)&&JSON.stringify(project.draft)!==JSON.stringify(project.publication?.content))??[];
  const plan=plans?.[0];
  const planChanged=!!plan&&(plan.draft.goals.length>0||!!plan.publication)&&JSON.stringify(plan.draft)!==JSON.stringify(plan.publication?.content);
  return <div className="studio-daily-workbench">
    <nav className="studio-quick-actions" aria-label="日常操作"><a className="workbench-action primary" href="/studio/private/workspace">新增记录</a><a className="workbench-action" href="/studio/private/projects">更新项目</a><a className="workbench-action" href="/studio/private/plans">管理目标</a><a className="workbench-action" href="/studio/private/management">刷新工作台</a></nav>
    {systemNeedsAttention===null?<p className="workbench-feedback" role="alert">系统状态暂时无法读取。<a href="/studio/private/system">查看系统状态 →</a></p>:!!systemNeedsAttention&&<p className="workbench-feedback" role="status">有 {systemNeedsAttention} 项后台状态需要查看。<a href="/studio/private/system">查看系统详情 →</a></p>}
    <div className="workbench-grid">
      <section className="workbench-panel" aria-labelledby="daily-goals"><p className="workbench-kicker">01 / GOALS</p><h2 id="daily-goals">当前目标</h2>
        {plans===null?<ReadError label="目标"/>:goals.length?<ul className="workbench-list">{goals.map(goal=><li key={goal.id}><h3>{goal.title}</h3><p>{goalStatusLabels[goal.status]}{goal.target_date&&` · 目标日期 ${goal.target_date}`}</p><p>下一步 · {goal.next_step||'尚未填写'}</p></li>)}</ul>:<p>暂无未完成的目标。<a href="/studio/private/plans">添加或查看目标 →</a></p>}
      </section>
      <section className="workbench-panel" aria-labelledby="daily-projects"><p className="workbench-kicker">02 / PROJECTS</p><h2 id="daily-projects">进行中的项目</h2>
        {projects===null?<ReadError label="项目"/>:activeProjects.length?<ul className="workbench-list">{activeProjects.map(project=>{const catalog=studioProjects.find(item=>item.id===project.project_id);if(!catalog)return null;const milestone=catalog.milestones.find(item=>project.draft.milestones[item.id as keyof typeof project.draft.milestones]==='in_progress')??catalog.milestones.find(item=>project.draft.milestones[item.id as keyof typeof project.draft.milestones]!=='completed');return <li key={project.project_id}><h3>{catalog.title}</h3><p>{projectStatusLabels[project.draft.status]}{milestone&&` · ${milestone.title}（${milestoneStatusLabels[project.draft.milestones[milestone.id as keyof typeof project.draft.milestones]]}）`}</p><p>下一步 · {project.draft.next_step||'尚未填写'}</p><div className="studio-inline-actions">{milestone&&<a href={`/studio/private/workspace?project=${catalog.id}&milestone=${milestone.id}`}>添加过程记录 →</a>}<a href={`/studio/private/projects?project=${catalog.id}`}>更新进展 →</a></div></li>;})}</ul>:<p>暂无状态为进行中的项目。<a href="/studio/private/projects">选择方向并维护状态 →</a></p>}
      </section>
    </div>
    <section className="workbench-panel" aria-labelledby="daily-publishing"><p className="workbench-kicker">03 / PUBLISHING</p><h2 id="daily-publishing">待发布变化</h2>
      {(projects===null||plans===null)&&<p role="alert">部分发布状态暂时无法读取，下面只展示读取成功的内容。<a href="/studio/private/management">重新读取 →</a></p>}
      {projectUpdates.length||planChanged?<ul className="workbench-list">{projectUpdates.map(project=><li key={project.project_id}><h3>{studioProjects.find(item=>item.id===project.project_id)?.title??'项目'}</h3><p>{project.publication?'已保存草稿与公开版本不同':'已保存私人草稿，尚未公开'}</p><a href={`/studio/private/projects?project=${project.project_id}`}>查看变化并预览发布 →</a></li>)}{planChanged&&<li><h3>目标与下一步</h3><p>{plan.draft.goals.length?'整份目标草稿有待发布变化':'草稿已清空，旧公开目标仍保留；请检查是否需要撤下'}</p><a href="/studio/private/plans">查看目标草稿与公开版本 →</a></li>}</ul>:projects!==null&&plans!==null&&<p>目前没有待发布的变化。</p>}
      <p className="workbench-note">这里只比较已保存的公开字段。私人备注不会发布；其他页面内未保存的输入不计入。</p>
    </section>
    <section className="workbench-panel" aria-labelledby="daily-records"><p className="workbench-kicker">04 / RECENT RECORDS</p><h2 id="daily-records">近期记录</h2>
      {context===null?<ReadError label="近期记录"/>:context.events.length?<ul className="workbench-list">{context.events.slice(0,5).map(event=><li key={event.event_id}><h3>{event.content.summary.slice(0,80)}</h3><p>{event.study_day??'学习日期未知'}</p><a href={`/studio/private/record/${encodeURIComponent(event.event_id)}`}>查看记录与修订 →</a></li>)}</ul>:<p>暂无可读取的私人记录。<a href="/studio/private/workspace">记录一次实际过程 →</a></p>}
      <p className="workbench-note">仅展示本次快照中的最近 5 条，不是完整档案。<a href="/studio/private">查看近期记录列表 →</a></p>
    </section>
    <p className="workbench-footnote">目标和项目状态由本人确认。数据来源、后台处理与账号管理见 <a href="/studio/private/system">系统与账号 →</a>。</p>
  </div>;
}
