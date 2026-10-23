import {studioProjects,knowledgeTopics} from '@/lib/studio-catalog';
import {projectStatusLabels,milestoneStatusLabels} from '@/lib/ui/project-protocol';
import type {StudioProjectContent} from '@/lib/learning/contracts';
import StudioProjectDescription from './studio-project-description';

// 公开项目详情与私人草稿预览共用的服务器排版组件。
// content 决定文案与里程碑状态；publishedAt 只在真实公开快照时传入，缺省表示不展示发布日期。
// 只接收单一项目内容，不接收整行 DTO，私人备注永远不会进入这里。
export default function StudioProjectSpread({projectId,content,publishedAt}:{projectId:string;content:StudioProjectContent;publishedAt?:string}){
  const project=studioProjects.find(item=>item.id===projectId);
  if(!project)return null;
  return <section id={projectId} className="workbench-project studio-project-spread">
    <header className="studio-project-heading">
      <p className="workbench-kicker">
        {project.num} · {projectStatusLabels[content.status]}
      </p>
      <h2>{project.title}</h2>
      {publishedAt&&<p className="workbench-source">
        发布日期：
        <time dateTime={publishedAt}>
          {new Intl.DateTimeFormat('zh-CN',{
            timeZone:'Asia/Shanghai',
            year:'numeric',
            month:'2-digit',
            day:'2-digit'
          }).format(new Date(publishedAt))}
        </time>
      </p>}
      <div className="workbench-tags">
        {project.tags.map(tag=><span key={tag}>{tag}</span>)}
      </div>
    </header>
    <div className="studio-project-body">
      <StudioProjectDescription
        description={content.description??project.desc}
        summary={content.summary}
        nextStep={content.next_step}
      />
      <details className="workbench-details" style={{marginTop:16}}>
        <summary>阶段进展与参考标准</summary>
        <p className="workbench-note">阶段状态由本人确认，参考标准不代表已经完成的成果。</p>
        <ol className="workbench-milestones" style={{marginTop:12}}>
          {project.milestones.map((milestone,index)=>{
            const topics=milestone.knowledgeIds.flatMap(id=>knowledgeTopics.filter(topic=>topic.id===id));
            return (
              <li key={milestone.id}>
                <p className="workbench-label">
                  MILESTONE {index+1} · {milestoneStatusLabels[content.milestones[milestone.id as keyof typeof content.milestones]]}
                </p>
                <h3>{milestone.title}</h3>
                <p>{milestone.acceptance}</p>
                {topics.length>0&&<details>
                  <summary>关联知识</summary>
                  {topics.map(topic=>(
                    <a key={topic.id} href={`/studio/roadmap#${topic.id}`}>
                      {topic.title}
                    </a>
                  ))}
                </details>}
              </li>
            );
          })}
        </ol>
      </details>
    </div>
  </section>;
}
