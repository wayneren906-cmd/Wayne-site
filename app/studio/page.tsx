import {env} from 'cloudflare:workers';
import {readRecords} from '@/lib/database';
import {summarizePublicLearning} from '@/lib/studio-public';
import {learningStages,practiceExercises,studioProjects} from '@/lib/studio-catalog';
import StudioShell from './studio-shell';
export const dynamic='force-dynamic';
export const metadata={title:'Studio · 学习工作台'};
export default async function StudioPage(){
  let summary:ReturnType<typeof summarizePublicLearning>|null=null;
  try{summary=summarizePublicLearning(await readRecords(env.DB));}catch{}
  const recent=summary?.recent[0];
  return <StudioShell active="overview" title="学习工作台" description="找到当前线索，选择下一次练习，把过程和结果留成证据。">
    <div className="workbench-grid">
      <section className="workbench-panel" aria-labelledby="current-title"><p className="workbench-kicker">01 / 当前线索</p><h2 id="current-title">从最近的记录继续</h2>{recent?<><p>最近公开手记 · {recent.date}</p><ul className="workbench-list">{recent.items.slice(0,3).map((i,n)=><li key={n}><h3>{i.label}</h3><p>{i.text}</p></li>)}</ul></>:<p>{summary?'尚无公开手记，可先浏览学习路线和练习目录。':'公开手记暂时无法读取，其他栏目仍可使用。'}</p>}<a className="workbench-action" href="/studio/roadmap">查看学习路线 →</a><div className="workbench-metrics"><span>{summary?.recordedDays??'—'} 个公开记录日</span><span>{summary?.entryCount??'—'} 项公开内容</span><span>能力状态待证据确认</span></div></section>
      <section className="workbench-panel" aria-labelledby="next-title"><p className="workbench-kicker">02 / 下一步行动</p><h2 id="next-title">选择一次具体练习</h2><p>先看目标与验收条件，再记录实际过程。不自动替你安排任务，也不把已有记录当作完成证明。</p><ul className="workbench-list">{practiceExercises.slice(0,3).map(e=><li key={e.id}><a href={`/studio/practice#${e.id}`}><span>{e.title}</span><span aria-hidden="true">↗</span></a></li>)}</ul><a className="workbench-action primary" href="/studio/practice">进入任务与练习 →</a></section>
    </div>
    <section className="workbench-stage" style={{marginTop:28}} aria-labelledby="works"><header><p className="workbench-kicker">03 / WORKS</p><h2 id="works">项目实践</h2><p>将练习带入项目。现有方向仍是蓝图，里程碑需要实际记录支持。</p></header><div className="workbench-cards">{studioProjects.map(p=><article className="workbench-card" key={p.id}><p className="workbench-label">{p.num}</p><h3>{p.title}</h3><p>{p.desc}</p><a href={`/studio/projects#${p.id}`}>查看里程碑与验收条件 ↗</a></article>)}</div></section>
    <section className="workbench-panel" aria-labelledby="route-title"><p className="workbench-kicker">04 / 路线目录</p><h2 id="route-title">让每一步有上下文</h2><ul className="workbench-list">{learningStages.map((s,n)=><li key={s.id}><a href={`/studio/roadmap#${s.id}`}><span>{String(n+1).padStart(2,'0')} · {s.title}</span><span aria-hidden="true">→</span></a><p>{s.description}</p></li>)}</ul></section>
    <p className="workbench-footnote">公开内容只使用已发布手记。个人任务、练习过程和项目证据保存在私人工作区；尚未接入自动能力评估或学习规划。</p>
  </StudioShell>;
}
