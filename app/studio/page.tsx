import {env} from 'cloudflare:workers';
import {ArrowUpRight, LockKeyhole} from 'lucide-react';
import {readRecords} from '@/lib/database';
import {summarizePublicLearning} from '@/lib/studio-public';
import SiteHeader from '../site-header';
import SiteFooter from '../site-footer';
import './studio-public.css';

export const dynamic='force-dynamic';
export const metadata={title:'Studio · 学习进度',description:'已公开的学习轨迹、记录与私人学习空间入口。'};
export default async function StudioPage(){
  let summary:ReturnType<typeof summarizePublicLearning>|null=null;
  try{summary=summarizePublicLearning(await readRecords(env.DB));}catch{/* Unavailable is different from no activity. */}
  const largest=summary?.topics[0]?.count??1;
  return <div className="editorial-shell studio-public-shell"><SiteHeader active="studio"/><main>
    <section className="studio-intro" aria-labelledby="studio-title">
      <div className="studio-eyebrow"><span>STUDIO / 学习工作台</span><span>记录 · 回看 · 向前</span></div>
      <div className="studio-intro-grid"><div><h1 id="studio-title">学习，<br/><em>有迹可循。</em></h1><p className="studio-lead">把零散的练习汇成轨迹。回看已经走过的路，<br className="studio-desktop-break"/>也为下一步留一点空间。</p></div>
        <div className="studio-intro-stats"><p className="studio-small-label">THE PUBLIC NOTEBOOK / 公开手记</p><dl><div><dt>有记录的学习日</dt><dd>{summary?.recordedDays??'—'}<span>天</span></dd></div><div><dt>已记录内容</dt><dd>{summary?.entryCount??'—'}<span>项</span></dd></div></dl><p className="studio-stat-note">{summary?'仅统计公开手记，不作为能力评估。':'公开记录暂时无法读取，请稍后刷新。'}</p></div>
      </div>
    </section>
    <nav className="studio-section-nav" aria-label="Studio 栏目"><a href="#progress">01 学习进度</a><a href="#notebook">02 学习记录</a><a href="#plans">03 学习计划</a><a href="#private">04 私人空间 <LockKeyhole size={13} aria-hidden="true"/></a></nav>
    <div className="studio-dashboard-grid">
      <section id="progress" className="studio-progress-panel" aria-labelledby="progress-title"><div className="studio-section-heading"><div><p className="studio-small-label">01 / LEARNING PROGRESS</p><h2 id="progress-title">看见积累的方向</h2></div><span className="studio-section-caption">公开记录分布</span></div>
        <p className="studio-section-description">每一次记下的内容，都是学习的一个落点。这里展示各主题的记录数量，掌握程度仍需通过实际练习确认。</p>
        {summary?.topics.length?<ul className="studio-topic-list">{summary.topics.map(topic=><li key={topic.label}><div className="studio-topic-meta"><span>{topic.label}</span><span>{topic.count} 项记录</span></div><div className="studio-topic-track" aria-hidden="true"><span style={{width:`${topic.count/largest*100}%`}}/></div></li>)}</ul>:<div className="studio-empty-note">{summary?'还没有公开学习记录。第一篇手记会从这里开始。':'记录暂时无法读取，进度统计稍后再来。'}</div>}
        <div className="studio-panel-foot"><span>最近记录日</span><span>{summary?.latestDate??'暂无可用日期'}</span></div>
      </section>
      <aside className="studio-side-stack">
        <section id="plans" className="studio-plan-panel" aria-labelledby="plans-title"><p className="studio-small-label">03 / WHAT COMES NEXT</p><h2 id="plans-title">给下一步留白</h2><p>当前暂无已确认的学习计划。先保留真实记录，再用练习与反馈决定接下来的安排。</p><a className="studio-text-link" href="/projects">看看实践方向 <ArrowUpRight size={16} aria-hidden="true"/></a></section>
        <section id="private" className="studio-private-panel" aria-labelledby="private-title"><div className="studio-private-label"><LockKeyhole size={16} aria-hidden="true"/><span>PRIVATE / 仅自己可见</span></div><h2 id="private-title">私人的学习细节</h2><p>原始记录、修订历史与私人补充集中在这里。登录后核验权限，再查看或修改。</p><a className="studio-private-link" href="/studio/private">进入私人空间 <ArrowUpRight size={18} aria-hidden="true"/></a></section>
      </aside>
    </div>
    <section id="notebook" className="studio-notebook" aria-labelledby="notebook-title"><div className="studio-section-heading"><div><p className="studio-small-label">02 / RECENT NOTES</p><h2 id="notebook-title">最近的学习手记</h2></div><a className="studio-text-link" href="/learning">查看全部 <ArrowUpRight size={16} aria-hidden="true"/></a></div>
      {summary?.recent.length?<ol className="studio-note-list">{summary.recent.map(record=><li key={record.date}><time dateTime={record.date}>{record.date}</time><div><h3>{[...new Set(record.items.map(i=>i.label))].join(' · ')}</h3><p>{record.items.map(i=>i.text).join('；')}</p></div><a href="/learning" aria-label={`阅读 ${record.date} 的公开学习手记`}><ArrowUpRight size={20} aria-hidden="true"/></a></li>)}</ol>:<p className="studio-empty-note">{summary?'尚未发布公开手记。私人内容不会自动出现在这里。':'手记暂时无法读取，可稍后重试。'}</p>}
    </section>
    <p className="studio-public-footnote">公开栏目无需登录。私人数据始终需要身份与权限核验，也不会因进入 Studio 而自动公开。</p>
  </main><SiteFooter/></div>;
}
