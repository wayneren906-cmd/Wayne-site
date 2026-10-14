'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {StudioHttpClient} from '@/lib/ui/studio-client';
import {projectWorkspace} from '@/lib/ui/studio-workspace';
import {studioProjects} from '@/lib/studio-catalog';
import type {LearningContextDTO} from '@/lib/learning/contracts';

export default function ProjectEvidence({projectId}:{projectId:string}){
  const client=useMemo(()=>new StudioHttpClient(),[]);
  const [context,setContext]=useState<LearningContextDTO|null>(null),[error,setError]=useState<string|null>(null),[loading,setLoading]=useState(true);
  const generation=useRef(0);
  const refresh=useCallback(async(signal?:AbortSignal)=>{
    const version=++generation.current;setLoading(true);setContext(null);setError(null);
    try{const next=await client.getContext('review',{signal});if(version===generation.current)setContext(next);}
    catch(cause){if(version===generation.current&&!signal?.aborted)setError(cause instanceof Error?cause.message:'过程记录暂时无法读取。');}
    finally{if(version===generation.current)setLoading(false);}
  },[client]);
  useEffect(()=>{const controller=new AbortController();void refresh(controller.signal);return()=>{controller.abort();generation.current++;};},[refresh]);
  const catalog=studioProjects.find(project=>project.id===projectId);
  const view=context?projectWorkspace(context):null;
  const project=view?.projects.find(item=>item.id===projectId);
  if(!catalog)return null;
  return <section className="studio-project-evidence" aria-labelledby="project-evidence-title" aria-busy={loading}>
    <div className="studio-evidence-heading"><h2 id="project-evidence-title">里程碑过程记录</h2><button className="workbench-action" type="button" disabled={loading} onClick={()=>void refresh()}>刷新过程记录</button></div>
    <p className="workbench-note">当前快照中的关联记录，不是完整项目档案。记录数量不会自动改变里程碑状态。</p>
    {loading&&<p role="status">正在读取过程记录…</p>}{error&&<p className="workbench-feedback" role="alert">{error}</p>}
    {view?.partial&&<p className="workbench-note">较早记录或部分长记录未包含在本次快照中。</p>}
    <div className="workbench-milestones">{catalog.milestones.map(milestone=>{const events=project?.milestones.find(item=>item.id===milestone.id)?.events;return <article className="workbench-panel" key={milestone.id}><h3>{milestone.title}</h3><p>验收条件 · {milestone.acceptance}</p><a className="workbench-action" href={'/studio/private/workspace?project='+catalog.id+'&milestone='+milestone.id}>添加此里程碑的过程记录 →</a>{context&&<><p>本次读取 {events?.length??0} 条关联记录</p>{events?.length?<ul className="workbench-evidence">{events.map(event=><li key={event.event_id}><p>{event.study_day??'学习日期未知'}</p><p>{event.content.summary}</p><a href={'/studio/private/record/'+encodeURIComponent(event.event_id)}>查看与修订 →</a></li>)}</ul>:<p>当前快照中暂无关联记录。</p>}</>}</article>;})}</div>
  </section>;
}
