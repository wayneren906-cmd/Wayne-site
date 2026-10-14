"use client";
import {useEffect,useRef,useState} from 'react';
import type {StudioGoal,StudioPlanContent,StudioPlanDraftDTO,StudioPlanMutation} from '@/lib/learning/contracts';
import {emptyPlanContent,goalStatusLabels,planContentSchema,planListSchema,planMutationSchema,planReceiptSchema} from '@/lib/ui/plan-protocol';
import GoalList from '../../goal-list';
import {useUnsavedChanges} from '@/lib/ui/use-unsaved-changes';
import {studioPublicationState} from '@/lib/ui/studio-publication-state';
import {planPublicationChanges} from '@/lib/ui/studio-publication-changes';
import StudioPublicationChanges from '../../studio-publication-changes';
type Editable=StudioPlanContent&{private_note:string};
const draftOf=(row?:StudioPlanDraftDTO):Editable=>({...row?.draft??emptyPlanContent(),private_note:row?.private_note??''});
export default function PlanEditor({initialPlans,initialError=null}:{initialPlans:StudioPlanDraftDTO[]|null;initialError?:string|null}){
  const [plans,setPlans]=useState(initialPlans),[edit,setEdit]=useState<Editable|null>(null),[error,setError]=useState(initialError),[notice,setNotice]=useState<string|null>(null);
  const [busy,setBusy]=useState(false),[ready,setReady]=useState(false),[preview,setPreview]=useState(false),[confirmed,setConfirmed]=useState(false),[withdraw,setWithdraw]=useState(false),[remove,setRemove]=useState<string|null>(null);
  const locked=useRef(false),alive=useRef(true),abort=useRef<AbortController|null>(null),retry=useRef<{signature:string;payload:StudioPlanMutation}|null>(null);
  const errorRef=useRef<HTMLParagraphElement|null>(null);
  useEffect(()=>{alive.current=true;setReady(true);return()=>{alive.current=false;abort.current?.abort();};},[]);
  useEffect(()=>{if(error)errorRef.current?.focus();},[error]);
  const row=plans?.[0],form=edit??draftOf(row),dirty=JSON.stringify(form)!==JSON.stringify(draftOf(row));
  const canPublish=!!row&&!dirty&&row.draft.goals.length>0&&JSON.stringify(row.draft)!==JSON.stringify(row.publication?.content);
  useUnsavedChanges(dirty);
  const publicationState=studioPublicationState({dirty,hasDraft:!!row,hasPublication:!!row?.publication,matchesPublication:!!row?.publication&&JSON.stringify(row.draft)===JSON.stringify(row.publication.content),hasContent:!!row?.draft.goals.length});
  function update(next:Editable){setEdit(next);setPreview(false);setConfirmed(false);setWithdraw(false);setNotice(null);setError(null);}
  function goal(id:string,patch:Partial<StudioGoal>){update({...form,goals:form.goals.map(item=>item.id===id?{...item,...patch}:item)});}
  async function request(method:string,payload?:StudioPlanMutation){
    const controller=new AbortController();abort.current=controller;const timer=setTimeout(()=>controller.abort(),20000);
    try{
      const response=await fetch('/api/studio/plans',{method,credentials:'same-origin',cache:'no-store',redirect:'error',signal:controller.signal,...(payload?{headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}:{})});
      if(!response.ok)throw Error(response.status===401||response.status===403?'管理权限无法验证，请重新登录。':response.status===409?'远程版本或操作键已变化。你的输入保留，请重新读取并对比服务器草稿。':response.status===400?'内容或发布条件不符合要求，请检查目标名称与日期。':'目标服务暂时不可用，请用原操作重试。');
      return await response.json();
    }catch(cause){if(cause instanceof Error&&cause.name==='AbortError')throw Error('请求超时，请用原操作重试。');throw cause;}
    finally{clearTimeout(timer);}
  }
  async function load(validate?:(rows:StudioPlanDraftDTO[])=>void){
    const parsed=planListSchema.safeParse(await request('GET'));if(!parsed.success)throw Error('目标数据不完整，请重试。');
    validate?.(parsed.data.plans);if(alive.current)setPlans(parsed.data.plans);return parsed.data.plans;
  }
  async function reload(){
    if(locked.current)return;locked.current=true;setBusy(true);setPreview(false);setConfirmed(false);setWithdraw(false);setError(null);
    try{await load();if(alive.current)setNotice('最新版本已读取。未保存的输入仍保留，请对比服务器草稿。');}
    catch(cause){if(alive.current)setError(cause instanceof Error?cause.message:'读取失败');}
    finally{locked.current=false;if(alive.current)setBusy(false);}
  }
  async function mutate(action:StudioPlanMutation['action']){
    if(locked.current||plans===null||!ready||action==='publish'&&(!canPublish||!confirmed))return;
    const parsed=planMutationSchema.safeParse({action,plan_id:'personal-goals',expected_revision:row?.revision??0,idempotency_key:'pending',...(action==='save_draft'?{content:form}:action==='publish'?{confirm_public:true}:{})});
    if(!parsed.success){setError(parsed.error.issues[0]?.message??'目标内容无效');return;}
    const signature=JSON.stringify(parsed.data),payload=retry.current?.signature===signature?retry.current.payload:{...parsed.data,idempotency_key:crypto.randomUUID()};
    retry.current={signature,payload};locked.current=true;setBusy(true);setError(null);setNotice(null);let acknowledged=false;
    try{
      const receipt=planReceiptSchema.safeParse(await request('POST',payload));
      if(!receipt.success||receipt.data.plan_id!==payload.plan_id||receipt.data.action!==action||receipt.data.revision!==payload.expected_revision+1)throw Error('保存回执不完整，请用原操作重试。');
      acknowledged=true;let newer=false;
      await load(rows=>{
        const current=rows[0];if(!current||current.revision<receipt.data.revision)throw Error('目标回读版本无效');
        if(current.revision>receipt.data.revision){newer=true;return;}
        if(action==='save_draft'){
          const saved=(payload as Extract<StudioPlanMutation,{action:'save_draft'}>).content;
          if(JSON.stringify(current.draft)!==JSON.stringify(planContentSchema.parse({goals:saved.goals}))||current.private_note!==saved.private_note)throw Error('草稿回读不一致');
        }else if(action==='publish'){
          if(current.publication?.revision!==receipt.data.revision||JSON.stringify(current.publication.content)!==JSON.stringify(row!.draft))throw Error('公开快照回读不一致');
        }else if(current.publication!==null)throw Error('撤下回读不一致');
      });
      if(!alive.current)return;
      if(!newer&&(action!=='unpublish'||!dirty))setEdit(null);
      retry.current=null;setPreview(false);setConfirmed(false);setWithdraw(false);
      setNotice(newer?'操作已保存；服务器已有更新版本，请核对草稿与公开状态。':action==='save_draft'?'私人目标已保存并回读确认。':action==='publish'?'目标已公开发布并回读确认。':'公开目标已撤下，私人草稿与未保存输入保留。');
    }catch(cause){if(alive.current)setError(acknowledged?'已收到保存回执，但未完成回读，请刷新核对。':cause instanceof Error?cause.message:'操作失败，请重试。');}
    finally{locked.current=false;if(alive.current)setBusy(false);}
  }
  return <div className="plan-editor project-editor" data-ready={ready} aria-busy={busy||!ready}>
    {plans!==null&&<dl className="studio-save-state" aria-label="目标保存与公开状态"><div><dt>私人草稿</dt><dd>{publicationState.draftLabel}</dd></div><div><dt>公开版本</dt><dd>{publicationState.publicationLabel}</dd></div></dl>}
    <div className="plan-actions"><button className="workbench-action" type="button" disabled={busy||!ready} onClick={reload}>{busy?'处理中…':'重新读取版本'}</button></div>
    {error&&<p ref={errorRef} tabIndex={-1} className="workbench-feedback" role="alert">{error}</p>}{notice&&<p className="workbench-feedback" role="status">{notice}</p>}
    {plans!==null&&<div className="workbench-grid"><section className="workbench-panel"><p className="workbench-kicker">PRIVATE PLAN / {row?`r${row.revision}`:'尚未保存'}</p><h2>当前目标</h2><p>最多 8 个目标。保存仅更新私人草稿；期限是目标日期，状态由你确认。</p>
      <form className="workbench-form" onSubmit={event=>{event.preventDefault();void mutate('save_draft');}}><fieldset disabled={busy||!ready}>
        {!form.goals.length&&<p className="workbench-empty">还没有目标。添加一项你希望持续追踪的安排。</p>}
        {form.goals.map((item,index)=><section key={item.id} className="plan-goal-fields" aria-label={`目标 ${index+1}`}>
          <label>目标 {index+1} · 名称<input required value={item.title} maxLength={120} onChange={event=>goal(item.id,{title:event.target.value})}/></label>
          <label>状态<select value={item.status} onChange={event=>goal(item.id,{status:event.target.value as StudioGoal['status']})}>{Object.entries(goalStatusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          <label>目标说明<textarea maxLength={500} value={item.summary} onChange={event=>goal(item.id,{summary:event.target.value})}/></label>
          <label>下一步<input maxLength={240} value={item.next_step} onChange={event=>goal(item.id,{next_step:event.target.value})}/></label>
          <label>目标日期（可选）<input type="date" value={item.target_date??''} onChange={event=>goal(item.id,{target_date:event.target.value||null})}/></label>
          {remove===item.id?<div className="plan-actions"><span>从草稿移除此目标？</span><button className="workbench-action" type="button" onClick={()=>{update({...form,goals:form.goals.filter(goal=>goal.id!==item.id)});setRemove(null);}}>确认移除</button><button className="workbench-action" type="button" onClick={()=>setRemove(null)}>取消移除</button></div>:<button className="workbench-action" type="button" onClick={()=>setRemove(item.id)}>移除此目标</button>}
        </section>)}
        <button className="workbench-action" type="button" disabled={form.goals.length>=8} onClick={()=>update({...form,goals:[...form.goals,{id:crypto.randomUUID(),title:'',status:'planned',summary:'',next_step:'',target_date:null}]})}>添加目标</button>
        <label>私人备注（不会发布）<textarea maxLength={2000} value={form.private_note} onChange={event=>update({...form,private_note:event.target.value})}/></label>
        <button className="workbench-action primary" type="submit" disabled={!!row&&!dirty}>保存私人草稿</button>
      </fieldset></form>
      {row&&<details className="project-editor-server"><summary>查看服务器草稿 r{row.revision}</summary><GoalList content={row.draft}/><p className="plan-note">私人备注 · {row.private_note||'暂无'}</p><p>更新时间 · <time dateTime={row.updated_at}>{new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',dateStyle:'medium',timeStyle:'short'}).format(new Date(row.updated_at))}</time></p></details>}
    </section><section className="workbench-panel"><p className="workbench-kicker">PUBLIC GOALS</p><h2>访客现在看到的目标</h2>{row?.publication?<><GoalList content={row.publication.content}/><p className="workbench-note">已发布 r{row.publication.revision}</p><a href="/studio#goals">查看公开目标 ↗</a></>:<p>暂无公开目标。私人草稿不会出现在仪表盘。</p>}
      <div className="plan-actions"><button className="workbench-action" type="button" disabled={busy||!ready||!canPublish} onClick={()=>{setPreview(true);setConfirmed(false);setWithdraw(false);}}>预览并发布</button>{row?.publication&&<button className="workbench-action" type="button" disabled={busy||!ready} onClick={()=>{setWithdraw(true);setPreview(false);setConfirmed(false);}}>撤下公开目标</button>}</div>
      <p className="workbench-note">{publicationState.publishHint}</p>
      {preview&&row&&<section className="project-editor-preview" aria-label="目标发布预览"><h3>发布预览</h3><StudioPublicationChanges changes={planPublicationChanges(row.draft,row.publication?.content??null)}/><p>此次发布将整体替换公开目标列表，包含以下全部目标；已从草稿移除的目标也会从公开列表移除。</p><GoalList content={row.draft}/><label className="project-editor-confirm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event=>setConfirmed(event.target.checked)}/><span>确认公开以上全部目标、说明、状态、下一步与目标日期。私人备注不会发布。</span></label><div className="plan-actions"><button className="workbench-action primary" type="button" disabled={busy||!confirmed} onClick={()=>void mutate('publish')}>确认发布</button><button className="workbench-action" type="button" disabled={busy} onClick={()=>setPreview(false)}>取消</button></div></section>}
      {withdraw&&<div className="project-editor-preview"><p>撤下后，仪表盘显示暂无公开目标，私人草稿仍保留。</p><div className="plan-actions"><button className="workbench-action" type="button" disabled={busy} onClick={()=>void mutate('unpublish')}>确认撤下</button><button className="workbench-action" type="button" disabled={busy} onClick={()=>setWithdraw(false)}>取消</button></div></div>}
    </section></div>}
  </div>;
}
