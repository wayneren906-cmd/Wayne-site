import {env} from 'cloudflare:workers';
import {readRecords} from '@/lib/database';
import {summarizePublicActivity,summarizePublicLearning} from '@/lib/studio-public';
import {studioProjects} from '@/lib/studio-catalog';
import {readPublicStudioProjects} from '@/lib/studio-projects';
import {projectStatusLabels} from '@/lib/ui/project-protocol';
import StudioShell from './studio-shell';
import StudioActivityChart from './studio-activity-chart';
import './studio-dashboard.css';

export const dynamic='force-dynamic';
export const metadata={title:'Studio · 个人数字仪表盘',description:'Wayneo Studio — A living dashboard of my growth, work, and exploration. 公开的成长、项目与数字活动，私人的管理空间。'};

export default async function StudioPage(){
  const [recordsResult,projectsResult]=await Promise.allSettled([readRecords(env.DB),readPublicStudioProjects(env.DB)]);
  const summary=recordsResult.status==='fulfilled'?summarizePublicLearning(recordsResult.value):null;
  const activity=recordsResult.status==='fulfilled'?summarizePublicActivity(recordsResult.value):[];
  const publishedProjects=projectsResult.status==='fulfilled'?projectsResult.value:null;
  const recent=summary?.recent[0];
  return <StudioShell active="overview" title="成长、工作与探索。" description="一个持续更新的个人数字仪表盘，让成长可见，让进展可追踪。">
    <div className="dashboard-intro"><p>A living dashboard of my growth, work, and exploration.</p><span className="dashboard-status">公开浏览 · 私人管理</span></div>
    <dl className="dashboard-metrics" aria-label="公开数据概览">
      <div><dt>公开记录日</dt><dd>{summary?.recordedDays??'—'}<small>days</small></dd></div>
      <div><dt>已发布内容</dt><dd>{summary?.entryCount??'—'}<small>entries</small></dd></div>
      <div><dt>项目方向</dt><dd>{studioProjects.length}<small>{publishedProjects===null?'状态暂不可用':`${publishedProjects.length} 项已发布进展`}</small></dd></div>
      <div><dt>最近公开记录</dt><dd className="dashboard-metric-date">{summary?.latestDate??'—'}<small>{summary?'记录日期':'暂时无法读取'}</small></dd></div>
    </dl>
    <div className="dashboard-main-grid">
      <section className="dashboard-section" aria-labelledby="growth-title">
        <header className="dashboard-section-heading"><div><p className="workbench-kicker">01 / GROWTH</p><h2 id="growth-title">让积累有迹可循</h2></div><a href="/learning">阅读 Journal ↗</a></header>
        {summary?<StudioActivityChart months={activity}/>:<p className="dashboard-empty" role="status">公开数据暂时无法读取，请稍后刷新。学习目录和项目方向仍可浏览。</p>}
      </section>
      <section className="dashboard-section dashboard-now" aria-labelledby="now-title">
        <header className="dashboard-section-heading"><div><p className="workbench-kicker">02 / NOW</p><h2 id="now-title">近期探索</h2></div></header>
        <p className="dashboard-source">{recent?`依据 ${recent.date} 的公开手记`:'暂无可读取的近期公开记录'}</p>
        {recent?<ul className="dashboard-focus-list">{recent.items.slice(0,3).map((item,index)=><li key={index}><h3>{item.label}</h3><p>{item.text}</p></li>)}</ul>:<p className="dashboard-empty">学习方向会随公开记录更新，在有依据时呈现。</p>}
        <a className="dashboard-text-link" href="/studio/roadmap">探索学习与知识 →</a>
        <p className="dashboard-source">当前目标尚未公开 · 此处为近期记录摘要</p>
      </section>
    </div>
    <section className="dashboard-section dashboard-projects" aria-labelledby="projects-title">
      <header className="dashboard-section-heading"><div><p className="workbench-kicker">03 / WORK & EXPLORATION</p><h2 id="projects-title">从想法走向作品</h2></div><a href="/studio/projects">全部项目 ↗</a></header>
      <div className="dashboard-project-grid">{studioProjects.map(project=>{const published=publishedProjects?.find(item=>item.project_id===project.id);return <article key={project.id}><div className="dashboard-project-meta"><p className="workbench-kicker">{project.num.split(' / ')[0]}</p><span className="dashboard-status">{published?projectStatusLabels[published.content.status]:'方向蓝图'}</span></div><h3>{project.title}</h3><p>{published?.content.summary??project.desc}</p><div className="dashboard-project-next"><span>{published?'公开下一步':'下一步参考'}</span><p>{published?published.content.next_step||'暂无公开安排':project.milestones[0].title}</p></div><a href={`/studio/projects#${project.id}`}>查看里程碑 →</a></article>;})}</div>
      <p className="dashboard-source">{publishedProjects===null?'动态项目状态暂时无法读取，方向蓝图仍可浏览。':'项目状态由管理员明确发布。未发布的方向保留蓝图，私人草稿与证据不会自动公开。'}</p>
    </section>
    <div className="dashboard-main-grid">
      <section className="dashboard-section" aria-labelledby="activity-title">
        <header className="dashboard-section-heading"><div><p className="workbench-kicker">04 / ACTIVITY</p><h2 id="activity-title">最近留下的足迹</h2></div><a href="/studio/archive">活动档案 ↗</a></header>
        {summary?.recent.length?<ol className="dashboard-timeline">{summary.recent.map(record=><li key={record.date}><time dateTime={record.date}>{record.date}</time><div><h3>{record.items.map(item=>item.label).join(' · ')||'公开手记'}</h3><p>{record.items.length} 项公开内容 · Journal</p></div><a href="/learning" aria-label={`在 Journal 阅读 ${record.date} 的公开记录`}>阅读 ↗</a></li>)}</ol>:<p className="dashboard-empty">{summary?'暂无公开活动。':'活动记录暂时无法读取。'}</p>}
      </section>
      <section className="dashboard-section" id="connections" aria-labelledby="connections-title">
        <header className="dashboard-section-heading"><div><p className="workbench-kicker">05 / CONNECTIONS</p><h2 id="connections-title">数字空间的连接</h2></div></header>
        <p className="dashboard-source">展示已确认的连接范围，私人同步明细仅对管理员开放。</p>
        <dl className="dashboard-connections"><div><dt>公开 Journal 数据</dt><dd>{summary?'本次读取成功':'暂时不可用'}</dd></div><div><dt>私人记录与管理</dt><dd>管理员验证后可用</dd></div><div><dt>ChatGPT 学习系统</dt><dd>尚未接入</dd></div><div><dt>后台任务状态</dt><dd>管理员总览可查看</dd></div></dl>
        <details className="dashboard-management"><summary>管理我的数字空间</summary><p>登录后可以查看私人数据与任务状态，维护项目进展与发布，补充、修订记录。</p><div className="dashboard-management-links"><a href="/studio/private/management">打开管理总览 ↗</a><a href="/studio/private/projects">管理项目状态与发布 ↗</a><a href="/studio/private">管理私人记录 ↗</a><a href="/studio/private/workspace">管理练习与项目证据 ↗</a></div><p>任务执行器、计划编辑与异常处理操作将在接入后开放。</p></details>
      </section>
    </div>
    <p className="workbench-footnote">Index · Journal · Studio 均可公开浏览。此页仅使用已发布的 Journal 和公开项目目录；私人记录与原始证据不会自动公开。管理员权限由服务端验证。</p>
  </StudioShell>;
}
