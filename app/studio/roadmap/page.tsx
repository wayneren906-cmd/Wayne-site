import {env} from 'cloudflare:workers';
import {readRecords} from '@/lib/database';
import {learningStages,knowledgeTopics,publicTopicReferences} from '@/lib/studio-catalog';
import StudioShell from '../studio-shell';
export const dynamic='force-dynamic';
export const metadata={title:'学习与知识 · Studio'};
export default async function RoadmapPage(){
  let records:Awaited<ReturnType<typeof readRecords>>|null=null;try{records=await readRecords(env.DB);}catch{}
  return <StudioShell active="roadmap" title="学习与知识" description="沿着概念与前置关系找到练习方向。目录是建议路线，个人掌握程度需要另外确认。">
    {learningStages.map((stage,n)=><section className="workbench-stage" id={stage.id} key={stage.id}><header><p className="workbench-kicker">STAGE {String(n+1).padStart(2,'0')}</p><h2>{stage.title}</h2><p>{stage.description}</p></header><div className="workbench-cards">{knowledgeTopics.filter(t=>t.stage===stage.id).map(topic=>{const refs=records?publicTopicReferences(records,topic.id):null;return <article className="workbench-card" id={topic.id} key={topic.id}><p className="workbench-label">能力状态 · 未确认</p><h3>{topic.title}</h3><p>{topic.goal}</p><div className="workbench-tags">{topic.prerequisites.map(id=><a key={id} href={`#${id}`}>前置：{knowledgeTopics.find(t=>t.id===id)?.title}</a>)}</div><p>{refs?`${refs.length} 篇公开手记提及相关内容`:'公开引用暂时不可用'}</p><details><summary>查看关联说明</summary><p>按公开手记中的关键词查找，仅作为阅读线索，不代表完成、掌握或验证。</p>{refs?.length?<a href="/learning">阅读公开手记（最近 {refs[0]}） ↗</a>:<p>暂无公开引用。</p>}</details><a href={`/studio/practice?topic=${topic.id}`}>选择相关练习 →</a></article>;})}</div></section>)}
    <p className="workbench-footnote">你自己的证据与记录关联可在 <a href="/studio/private/workspace">私人工作区</a> 查看。目录不会自动修改学习安排。</p>
  </StudioShell>;
}
