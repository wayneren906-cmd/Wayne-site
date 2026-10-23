import {studioProjects} from '@/lib/studio-catalog';
import {env} from 'cloudflare:workers';
import {readPublicStudioProjects} from '@/lib/studio-projects';
import StudioShell from '../studio-shell';
import StudioProjectSpread from '../studio-project-spread';

export const dynamic='force-dynamic';
export const metadata={
  title:'项目详情 · Studio',
  description:'Wayneo Studio — 已发布项目的介绍与公开进展。'
};

export default async function StudioProjectsPage(){
  let published:Awaited<ReturnType<typeof readPublicStudioProjects>>|null=null;
  try{
    published=await readPublicStudioProjects(env.DB);
  }catch{
    published=null;
  }

  const isFailure=published===null;
  const publishedList=published??[];
  const publishedMap=new Map(publishedList.map(item=>[item.project_id,item]));
  const activeProjects=studioProjects
    .map(project=>{
      const live=publishedMap.get(project.id);
      if(!live)return null;
      return {project,live};
    })
    .filter((item):item is {project:(typeof studioProjects)[number];live:(typeof publishedList)[number]}=>item!==null);

  return (
    <StudioShell
      active="projects"
      title="项目详情"
      description="正在做的项目，以及已经留下的成果。"
    >
      {isFailure?(
        <p className="workbench-feedback" role="status">
          项目进展暂时无法读取，请稍后重试。
        </p>
      ):activeProjects.length===0?(
        <p className="workbench-feedback" role="status">
          项目内容仍在整理。确认发布后，进展会出现在这里。
        </p>
      ):(
        activeProjects.map(({project,live})=>(
          <StudioProjectSpread key={project.id} projectId={project.id} content={live.content} publishedAt={live.published_at}/>
        ))
      )}
      <p className="workbench-footnote">
        <a href="/learning">阅读 Journal ↗</a>
      </p>
    </StudioShell>
  );
}
