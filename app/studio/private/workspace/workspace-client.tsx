'use client';
import {useMemo,useEffect,useState,useRef,useCallback} from 'react';
import {knowledgeTopics,practiceExercises,studioProjects} from '@/lib/studio-catalog';
import {StudioHttpClient} from '@/lib/ui/studio-client';
import {WorkspaceRecorder,workspaceTarget,projectWorkspace} from '@/lib/ui/studio-workspace';
import type {WorkspaceTarget,WorkspaceDraft} from '@/lib/ui/studio-workspace';
import type {LearningContextDTO} from '@/lib/learning/contracts';
import {useUnsavedChanges} from '@/lib/ui/use-unsaved-changes';

const options=[{value:'note',label:'日常学习记录 · 无关联对象',target:{kind:'note' as const}},...practiceExercises.map(e=>({value:'practice:'+e.id,label:'练习 · '+e.title,target:{kind:'practice' as const,id:e.id}})),...studioProjects.flatMap(p=>p.milestones.map(m=>({value:'project:'+p.id+':'+m.id,label:p.title+' · '+m.title,target:{kind:'project' as const,id:p.id,milestone:m.id}})))];
const empty:WorkspaceDraft={summary:'',date:'',assistance:'unknown',execution:'unknown'};

export default function WorkspaceClient({readOnly=false}:{readOnly?:boolean}){
  const client=useMemo(()=>new StudioHttpClient(),[]);
  const recorder=useMemo(()=>new WorkspaceRecorder(input=>client.saveEvent(input)),[client]);
  const [selection,setSelection]=useState('note'),[draft,setDraft]=useState<WorkspaceDraft>(empty);
  const [context,setContext]=useState<LearningContextDTO|null>(null),[error,setError]=useState<string|null>(null);
  const [receipt,setReceipt]=useState<{eventId:string;target:WorkspaceTarget}|null>(null);
  const [saving,setSaving]=useState(false),[loading,setLoading]=useState(!readOnly),[ready,setReady]=useState(false);
  const [savedDate,setSavedDate]=useState('');
  const generation=useRef(0),busy=useRef(false);
  const dirty=!!draft.summary.trim()||draft.date!==savedDate||draft.assistance!=='unknown'||draft.execution!=='unknown';
  useUnsavedChanges(dirty);
  const target:WorkspaceTarget=(options.find(option=>option.value===selection)??options[0]).target;
  const resolved=workspaceTarget(target),view=context?projectWorkspace(context):null;
  const targetEvents=target.kind==='note'?context?.events:target.kind==='practice'?view?.practices.find(item=>item.id===target.id)?.events:view?.projects.find(item=>item.id===target.id)?.milestones.find(item=>item.id===target.milestone)?.events;
  const exercise=target.kind==='practice'?practiceExercises.find(item=>item.id===target.id):null;
  const milestone=target.kind==='project'?studioProjects.find(item=>item.id===target.id)?.milestones.find(item=>item.id===target.milestone):null;

  useEffect(()=>{
    const query=new URLSearchParams(location.search);
    const value=query.has('practice')?'practice:'+query.get('practice'):'project:'+query.get('project')+':'+query.get('milestone');
    if(options.some(option=>option.value===value))setSelection(value);
    setReady(true);
  },[]);
  const refresh=useCallback(async(signal?:AbortSignal)=>{
    if(readOnly)return;
    const version=++generation.current;setLoading(true);setError(null);setContext(null);
    try{const next=await client.getContext('review',{signal});if(version===generation.current)setContext(next);}
    catch(cause){if(version===generation.current&&!signal?.aborted)setError(cause instanceof Error?cause.message:'读取失败，请重试。');}
    finally{if(version===generation.current)setLoading(false);}
  },[client,readOnly]);
  useEffect(()=>{const controller=new AbortController();void refresh(controller.signal);return()=>{controller.abort();generation.current++;};},[refresh]);
  async function submit(event:React.FormEvent){
    event.preventDefault();if(readOnly||!ready||busy.current)return;
    busy.current=true;setSaving(true);setError(null);setReceipt(null);
    try{
      const saved=await recorder.submit(target,draft);
      if(saved){setReceipt({eventId:saved.event_id,target});setDraft({...empty,date:draft.date});setSavedDate(draft.date);await refresh();}
    }catch(cause){setError(cause instanceof Error?cause.message:'保存失败，请保留原稿重试。');}
    finally{busy.current=false;setSaving(false);}
  }
  const projectHref=receipt?.target.kind==='project'?'/studio/private/projects?project='+receipt.target.id+'&milestone='+receipt.target.milestone+'#milestone-'+receipt.target.milestone:null;
  return <div className="studio-record-composer" data-ready={ready}>
    {readOnly&&<p className="workbench-feedback">当前为只读预览，不读取或保存私人记录。</p>}
    {receipt&&<section className="workbench-feedback" role="status"><p>记录已保存到私人空间{receipt.target.kind==='note'?'':'，关联到「'+workspaceTarget(receipt.target).title+'」'}。尚未进行能力或里程碑验收。</p><div className="studio-inline-actions"><a href={'/studio/private/record/'+encodeURIComponent(receipt.eventId)}>查看记录与修订 →</a>{projectHref&&<a href={projectHref}>继续更新此项目的里程碑状态 →</a>}</div></section>}
    {error&&<p className="workbench-feedback" role="alert">{error}{receipt&&' 记录已保存，但近期列表未完成刷新。'} {!saving&&<button type="button" onClick={()=>void refresh()}>重新读取</button>}</p>}
    <div className="workbench-grid">
      <section className="workbench-panel"><p className="workbench-kicker">PRIVATE / NEW RECORD</p><h2>记录一次实际过程</h2>
        {dirty&&<p className="workbench-note">输入尚未保存。离开或刷新前请先保存记录。</p>}
        <form className="workbench-form" onSubmit={submit}>
          <label>实际过程与结果<textarea aria-label="实际过程与结果" value={draft.summary} disabled={readOnly||saving||!ready} required maxLength={2000} placeholder="写下实际做了什么、结果是什么、遇到什么问题。" onChange={event=>setDraft(previous=>({...previous,summary:event.target.value}))}/></label>
          <label>关联对象（选填）<select aria-label="练习或项目里程碑" value={selection} disabled={saving||!ready||readOnly} onChange={event=>{setSelection(event.target.value);setReceipt(null);}}>{options.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          {(exercise||milestone)&&<div className="studio-record-guidance"><h3>{resolved.title}</h3>{exercise?<><p>{exercise.goal}</p><details><summary>查看练习步骤与验收条件</summary><ol>{exercise.steps.map(step=><li key={step}>{step}</li>)}</ol><ul>{exercise.acceptance.map(item=><li key={item}>{item}</li>)}</ul></details></>:<p>验收条件 · {milestone?.acceptance}</p>}<p>关联知识 · {resolved.knowledgeIds.map(id=>knowledgeTopics.find(item=>item.id===id)?.title).join('、')}</p></div>}
          <label>学习日期（选填）<input type="date" value={draft.date} disabled={readOnly||saving||!ready} onChange={event=>setDraft(previous=>({...previous,date:event.target.value}))}/></label>
          <p>未填写日期时，学习时间保持未知；保存时间不作为学习时间。</p>
          <details className="studio-record-extra"><summary>补充过程信息（选填）</summary><div className="workbench-form">
            <label>协助程度<select aria-label="协助程度" value={draft.assistance} disabled={readOnly||saving||!ready} onChange={event=>setDraft(previous=>({...previous,assistance:event.target.value as WorkspaceDraft['assistance']}))}><option value="unknown">尚未说明</option><option value="none">无提示</option><option value="concept_hint">概念提示</option><option value="code_outline">代码大纲</option><option value="full_solution">完整解答</option></select></label>
            <label>执行方式<select aria-label="执行方式" value={draft.execution} disabled={readOnly||saving||!ready} onChange={event=>setDraft(previous=>({...previous,execution:event.target.value as WorkspaceDraft['execution']}))}><option value="unknown">尚未说明</option><option value="reading">阅读理解</option><option value="simulated_analysis">模拟与分析</option><option value="local_run">本机编译运行</option><option value="hardware_run">硬件运行</option></select></label>
          </div></details>
          <div className="studio-record-submit"><p>仅保存到私人空间</p><button className="workbench-action primary" type="submit" disabled={readOnly||saving||!ready||!draft.summary.trim()}>{saving?'正在保存…':'保存私人记录'}</button></div>
        </form>
      </section>
      <section className="workbench-panel"><p className="workbench-kicker">RECENT / PRIVATE NOTES</p><h2>{target.kind==='note'?'近期私人记录':'关联过程记录'}</h2>{target.kind!=='note'&&<p className="studio-record-context">{resolved.title}</p>}
        <p>{loading?'正在读取…':readOnly?'只读预览不读取私人记录。':context?'本次读取 '+(targetEvents?.length??0)+' 条'+(target.kind==='note'?'近期记录':'关联记录'):'私人记录暂时无法读取。'}</p>
        <p className="workbench-note">这里只展示当前快照，未显示不代表没有记录。记录数量不代表完成或通过验收。</p>
        {view?.partial&&<p className="workbench-note">较早记录或部分长记录未包含在本次快照中。</p>}
        {targetEvents?.length?<ul className="workbench-evidence">{targetEvents.map(event=><li key={event.event_id}><h3>{event.study_day??'学习日期未知'}</h3><p>{event.content.summary}</p><a href={'/studio/private/record/'+encodeURIComponent(event.event_id)}>查看、修订与历史 →</a></li>)}</ul>:context&&<p className="workbench-note">当前读取范围内暂无记录。</p>}
        <a href="/studio/private">查看近期记录列表 →</a>
      </section>
    </div>
  </div>;
}
