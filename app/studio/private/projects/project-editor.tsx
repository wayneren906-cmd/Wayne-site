"use client";
import {useEffect,useRef,useState} from 'react';
import {studioProjects} from '@/lib/studio-catalog';
import {emptyProjectContent,projectContentSchema,projectListSchema,projectMutationSchema,projectReceiptSchema,projectStatusLabels,milestoneStatusLabels} from '@/lib/ui/project-protocol';
import type {StudioProjectContent,StudioProjectDraftDTO,StudioProjectMutation} from '@/lib/learning/contracts';
import {useUnsavedChanges} from '@/lib/ui/use-unsaved-changes';
import {studioPublicationState} from '@/lib/ui/studio-publication-state';
import {projectPublicationChanges} from '@/lib/ui/studio-publication-changes';
import StudioPublicationChanges from '../../studio-publication-changes';
import ProjectEvidence from './project-evidence';

type Editable=StudioProjectContent&{private_note:string};
const draftOf=(row?:StudioProjectDraftDTO):Editable=>({...row?.draft??emptyProjectContent(),private_note:row?.private_note??''});
const formatTime=(value:string)=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',dateStyle:'medium',timeStyle:'short',hour12:false}).format(new Date(value));

export default function ProjectEditor({initialProjects,initialError=null,initialProjectId}:{initialProjects:StudioProjectDraftDTO[]|null;initialError?:string|null;initialProjectId?:string}){
  const [projects,setProjects]=useState(initialProjects),[error,setError]=useState(initialError),[notice,setNotice]=useState<string|null>(null);
  const [selected,setSelected]=useState(studioProjects.find(project=>project.id===initialProjectId)?.id??studioProjects[0].id),[edits,setEdits]=useState<Record<string,Editable>>({});
  const [busy,setBusy]=useState(false),[preview,setPreview]=useState(false),[confirmed,setConfirmed]=useState(false),[withdraw,setWithdraw]=useState(false);
  const [ready,setReady]=useState(false);
  const locked=useRef(false),retry=useRef<{signature:string;payload:StudioProjectMutation}|null>(null),abort=useRef<AbortController|null>(null),alive=useRef(true);
  useEffect(()=>{alive.current=true;setReady(true);return()=>{alive.current=false;abort.current?.abort();};},[]);
  const catalog=studioProjects.find(project=>project.id===selected)!;
  const row=projects?.find(project=>project.project_id===selected),form=edits[selected]??draftOf(row);
  const dirty=JSON.stringify(form)!==JSON.stringify(draftOf(row));
  const canPublish=!!row&&!dirty&&!!row.draft.summary&&JSON.stringify(row.draft)!==JSON.stringify(row.publication?.content);
  const hasUnsavedEdits=Object.entries(edits).some(([id,value])=>JSON.stringify(value)!==JSON.stringify(draftOf(projects?.find(project=>project.project_id===id))));
  useUnsavedChanges(hasUnsavedEdits);
  const publicationState=studioPublicationState({dirty,hasDraft:!!row,hasPublication:!!row?.publication,matchesPublication:!!row?.publication&&JSON.stringify(row.draft)===JSON.stringify(row.publication.content),hasContent:!!row?.draft.summary});

  async function request(method:string,payload?:StudioProjectMutation){
    const current=new AbortController();abort.current=current;const timer=setTimeout(()=>current.abort(),20000);
    try{
      const response=await fetch('/api/studio/projects',{method,credentials:'same-origin',cache:'no-store',redirect:'error',signal:current.signal,...(payload?{headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}:{})});
      if(!response.ok)throw Error(response.status===401||response.status===403?'管理权限无法验证，请重新登录。':response.status===409?'远程版本已变化或操作键冲突。你的输入已保留，请重新读取并对比服务器草稿。':response.status===400?'内容或发布条件不符合要求，请检查项目状态与里程碑。':'项目服务暂时不可用，请用原操作重试。');
      return await response.json();
    }catch(cause){if(cause instanceof Error&&cause.name==='AbortError')throw Error('请求超时，请用原操作重试。');throw cause;}
    finally{clearTimeout(timer);}
  }
  async function load(resetId?:string,validate?:(rows:StudioProjectDraftDTO[])=>void){
    const result=projectListSchema.safeParse(await request('GET'));if(!result.success)throw Error('项目数据不完整，请重试。');
    validate?.(result.data.projects);
    if(!alive.current)return result.data.projects;
    setProjects(result.data.projects);
    if(resetId)setEdits(previous=>{const next={...previous};delete next[resetId];return next;});
    return result.data.projects;
  }
  async function reload(){
    if(locked.current)return;locked.current=true;setBusy(true);setError(null);setPreview(false);setConfirmed(false);setWithdraw(false);
    try{await load();if(alive.current)setNotice('已读取最新版本。未保存的输入仍保留，可与服务器草稿对比。');}
    catch(cause){if(alive.current)setError(cause instanceof Error?cause.message:'读取失败，请重试。');}
    finally{locked.current=false;if(alive.current)setBusy(false);}
  }
  function edit(patch:Partial<Editable>){setEdits(previous=>({...previous,[selected]:{...form,...patch}}));setPreview(false);setConfirmed(false);setNotice(null);}
  async function mutate(action:StudioProjectMutation['action']){
    if(locked.current||projects===null)return;
    if(action==='publish'&&(!canPublish||!confirmed))return;
    const intended={action,project_id:selected,expected_revision:row?.revision??0,...(action==='save_draft'?{content:form}:action==='publish'?{confirm_public:true}:{})};
    const parsed=projectMutationSchema.safeParse({...intended,idempotency_key:'pending'});
    if(!parsed.success){setError(parsed.error.issues[0]?.message??'项目内容无效');return;}
    const signature=JSON.stringify(parsed.data);
    const payload=retry.current?.signature===signature?retry.current.payload:{...parsed.data,idempotency_key:crypto.randomUUID()};
    retry.current={signature,payload};locked.current=true;setBusy(true);setError(null);setNotice(null);
    let acknowledged=false;
    try{
      const receipt=projectReceiptSchema.safeParse(await request('POST',payload));
      if(!receipt.success||receipt.data.project_id!==payload.project_id||receipt.data.action!==action||receipt.data.revision!==payload.expected_revision+1)throw Error('保存回执不完整，请用原操作重试。');
      acknowledged=true;let newer=false;
      await load(action==='unpublish'&&dirty?undefined:selected,rows=>{
        const current=rows.find(project=>project.project_id===selected);
        if(!current||current.revision<receipt.data.revision)throw Error('项目回读版本无效');
        if(current.revision>receipt.data.revision){newer=true;return;}
        if(action==='save_draft'){
          const {private_note,...content}=(payload as Extract<StudioProjectMutation,{action:'save_draft'}>).content;
          if(JSON.stringify(current.draft)!==JSON.stringify(projectContentSchema.parse(content))||current.private_note!==private_note)throw Error('草稿回读不一致');
        }else if(action==='publish'){
          if(current.publication?.revision!==receipt.data.revision||JSON.stringify(current.publication.content)!==JSON.stringify(row!.draft))throw Error('公开快照回读不一致');
        }else if(current.publication!==null)throw Error('撤下回读不一致');
      });
      if(!alive.current)return;
      retry.current=null;setPreview(false);setConfirmed(false);setWithdraw(false);
      setNotice(newer?'操作已保存；服务器已有更新版本，请核对当前草稿与公开状态。':action==='save_draft'?'私人草稿已保存并回读确认。':action==='publish'?'项目状态已公开发布并回读确认。':'公开状态已撤下，私人草稿与未保存的输入保留。');
    }catch(cause){if(alive.current)setError(acknowledged?'已收到保存回执，但未完成回读，请刷新核对。':cause instanceof Error?cause.message:'操作失败，请用原操作重试。');}
    finally{locked.current=false;if(alive.current)setBusy(false);}
  }
  return <div className="project-editor" aria-busy={busy||!ready} data-ready={ready}>
    {projects!==null&&<dl className="studio-save-state" aria-label="项目保存与公开状态"><div><dt>私人草稿</dt><dd>{publicationState.draftLabel}</dd></div><div><dt>公开版本</dt><dd>{publicationState.publicationLabel}</dd></div></dl>}
    {hasUnsavedEdits&&<p className="workbench-note">本页有未保存的项目修改。离开或刷新前请先保存；切换项目可保留本页输入。</p>}
    <div className="project-editor-toolbar"><label>选择项目<select value={selected} disabled={busy||!ready} onChange={event=>{setSelected(event.target.value);setPreview(false);setConfirmed(false);setWithdraw(false);setError(null);setNotice(null);}}>{studioProjects.map(project=><option key={project.id} value={project.id}>{project.title}</option>)}</select></label><button type="button" className="workbench-action" disabled={busy||!ready} onClick={reload}>{busy?'处理中…':'重新读取版本'}</button></div>
    {error&&<p className="workbench-feedback" role="alert">{error}</p>}{notice&&<p className="workbench-feedback" role="status">{notice}</p>}
    {projects!==null&&<div className="workbench-grid">
      <section className="workbench-panel"><p className="workbench-kicker">PRIVATE DRAFT / {row?`r${row.revision}`:'尚未保存'}</p><h2>{catalog.title}</h2><p>保存仅更新私人草稿。切换项目会保留本次页面内未保存的输入。</p><form className="workbench-form" onSubmit={event=>{event.preventDefault();void mutate('save_draft');}}><fieldset disabled={busy||!ready}>
        <label>项目状态<select value={form.status} onChange={event=>edit({status:event.target.value as StudioProjectContent['status']})}>{Object.entries(projectStatusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label>进展说明<textarea value={form.summary} maxLength={1200} onChange={event=>edit({summary:event.target.value})}/></label>
        <label>下一步<input value={form.next_step} maxLength={240} onChange={event=>edit({next_step:event.target.value})}/></label>
        <div className="project-editor-milestones">{catalog.milestones.map(milestone=><label key={milestone.id} id={`milestone-${milestone.id}`}>{milestone.title}<select value={form.milestones[milestone.id as keyof typeof form.milestones]} onChange={event=>edit({milestones:{...form.milestones,[milestone.id]:event.target.value}})}>{Object.entries(milestoneStatusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>)}</div>
        <label>私人备注（不会发布）<textarea value={form.private_note} maxLength={2000} onChange={event=>edit({private_note:event.target.value})}/></label>
        <button type="submit" className="workbench-action primary" disabled={busy||!!row&&!dirty}>保存私人草稿</button>
      </fieldset></form>
      {row&&<details className="project-editor-server"><summary>查看服务器草稿 r{row.revision}</summary><p>{projectStatusLabels[row.draft.status]} · {row.draft.summary||'暂无进展说明'}</p><p>{row.draft.next_step&&`下一步：${row.draft.next_step}`}</p><p>更新时间 · {formatTime(row.updated_at)}</p></details>}
      </section>
      <section className="workbench-panel"><p className="workbench-kicker">PUBLIC SNAPSHOT</p><h2>访客现在看到的内容</h2>{row?.publication?<><p>{projectStatusLabels[row.publication.content.status]} · 已发布 r{row.publication.revision}</p><p className="project-editor-copy">{row.publication.content.summary}</p><p>下一步 · {row.publication.content.next_step||'暂无公开安排'}</p><p>发布时间 · {formatTime(row.publication.published_at)}</p><a href={`/studio/projects#${selected}`}>查看公开项目 ↗</a></>:<p>尚未发布实际状态。访客看到的仍是原有方向蓝图。</p>}
        <div className="project-editor-publish-actions"><button type="button" className="workbench-action" disabled={busy||!ready||!canPublish} onClick={()=>{setPreview(true);setConfirmed(false);setWithdraw(false);}}>预览并发布</button>{row?.publication&&<button type="button" className="workbench-action" disabled={busy||!ready} onClick={()=>{setWithdraw(true);setPreview(false);}}>撤下公开状态</button>}</div>
        <p className="workbench-note">{publicationState.publishHint}</p>
        {preview&&row&&<section className="project-editor-preview" aria-label="发布预览"><StudioPublicationChanges changes={projectPublicationChanges(selected,row.draft,row.publication?.content??null)}/><h3>{catalog.title}</h3><p>{projectStatusLabels[row.draft.status]}</p><p className="project-editor-copy">{row.draft.summary}</p><p>下一步 · {row.draft.next_step||'暂无公开安排'}</p><ul>{catalog.milestones.map(milestone=><li key={milestone.id}>{milestone.title} · {milestoneStatusLabels[row.draft.milestones[milestone.id as keyof typeof row.draft.milestones]]}</li>)}</ul><label className="project-editor-confirm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event=>setConfirmed(event.target.checked)}/><span>确认公开以上状态、说明与里程碑。私人备注不会发布。</span></label><button type="button" className="workbench-action primary" disabled={busy||!confirmed} onClick={()=>void mutate('publish')}>确认发布</button><button type="button" className="workbench-action" disabled={busy} onClick={()=>setPreview(false)}>取消</button></section>}
        {withdraw&&<div className="project-editor-preview"><p>撤下后，公开页面恢复为方向蓝图，私人草稿仍保留。</p><button type="button" className="workbench-action" disabled={busy} onClick={()=>void mutate('unpublish')}>确认撤下</button><button type="button" className="workbench-action" disabled={busy} onClick={()=>setWithdraw(false)}>取消</button></div>}
      </section>
    </div>}
    <ProjectEvidence projectId={selected}/>
  </div>;
}
