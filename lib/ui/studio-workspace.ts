import type {LearningEventInput,LearningContextDTO,SaveReceiptDTO,Assistance,ExecutionMode} from '../learning/contracts.ts';
import {knowledgeTopics,practiceExercises,studioProjects} from '../studio-catalog.ts';
import {receiptSchema,contextSchema} from './studio-protocol.ts';

export type WorkspaceTarget={kind:'practice';id:string}|{kind:'project';id:string;milestone:string};
export type WorkspaceDraft={summary:string;date:string;assistance:Assistance;execution:ExecutionMode};
export function workspaceTarget(target:WorkspaceTarget){
  if(target.kind==='practice'){
    const exercise=practiceExercises.find(e=>e.id===target.id);if(!exercise)throw Error('请选择有效练习。');
    return {title:exercise.title,knowledgeIds:[...exercise.knowledgeIds],prefix:`workspace.practice.${exercise.id}`};
  }
  const project=studioProjects.find(p=>p.id===target.id),milestone=project?.milestones.find(m=>m.id===target.milestone);
  if(!project||!milestone)throw Error('请选择有效的项目里程碑。');
  return {title:project.title+' · '+milestone.title,knowledgeIds:[...milestone.knowledgeIds],prefix:`workspace.project.${project.id}.${milestone.id}`};
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function buildWorkspaceInput(target:WorkspaceTarget,draft:WorkspaceDraft,keys:{key:string;instance:string}):LearningEventInput{
  const resolved=workspaceTarget(target),summary=draft.summary.trim(),date=draft.date;
  if(!summary||summary.length>2000||!uuid.test(keys.instance)||!keys.key||keys.key.length>255)throw Error('请填写最多2000字的实际过程或结果。');
  if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date))throw Error('学习日期无效。');
  if(!['unknown','none','concept_hint','code_outline','full_solution'].includes(draft.assistance)||!['unknown','reading','simulated_analysis','local_run','hardware_run'].includes(draft.execution))throw Error('请选择有效的协助程度和运行方式。');
  return {schema_version:1,idempotency_key:keys.key,source:{type:'studio',record_id:`${resolved.prefix}.${keys.instance}`},kind:'learning_activity',occurred_at:null,
    time_precision:date?'date':'unknown',study_day_override:date?{study_day:date,reason:'用户在工作台选择的学习日期'}:null,
    content:{summary},evidence_status:'self_reported',assistance:draft.assistance,execution_mode:draft.execution,knowledge_ids:resolved.knowledgeIds,plan_id:null};
}
export function projectWorkspace(context:LearningContextDTO){
  const parsed=contextSchema.safeParse(context);if(!parsed.success)throw Error('私人上下文无效。');context=parsed.data;
  const referenced=context.events.filter(e=>context.evidence_refs.some(r=>r.event_id===e.event_id&&r.revision===e.revision));
  const linked=(prefix:string)=>referenced.filter(e=>e.kind==='learning_activity'&&e.source.type==='studio'&&e.source.record_id?.startsWith(prefix+'.')&&uuid.test(e.source.record_id.slice(prefix.length+1)));
  return {dataVersion:context.data_version,partial:context.unknown_ranges.some(r=>['older_events_omitted','response_size_limited'].includes(r)),
    topics:knowledgeTopics.map(t=>({id:t.id,title:t.title,events:referenced.filter(e=>e.knowledge_ids.includes(t.id)),mastery:'unconfirmed' as const})),
    practices:practiceExercises.map(e=>({id:e.id,title:e.title,events:linked(`workspace.practice.${e.id}`).filter(event=>e.knowledgeIds.every(id=>event.knowledge_ids.includes(id)))})),
    projects:studioProjects.map(p=>({id:p.id,title:p.title,milestones:p.milestones.map(m=>({id:m.id,title:m.title,events:linked(`workspace.project.${p.id}.${m.id}`).filter(e=>m.knowledgeIds.every(id=>e.knowledge_ids.includes(id)))}))}))};
}
// Retains the exact transport key and source instance after any unverified response.
export class WorkspaceRecorder{
  private pending:{signature:string;input:LearningEventInput}|null=null;
  private busy=false;
  private save:(input:LearningEventInput)=>Promise<SaveReceiptDTO>;
  private keys:()=>{key:string;instance:string};
  constructor(save:(input:LearningEventInput)=>Promise<SaveReceiptDTO>,keys=()=>({key:'workspace-'+crypto.randomUUID(),instance:crypto.randomUUID()})){this.save=save;this.keys=keys;}
  async submit(target:WorkspaceTarget,draft:WorkspaceDraft):Promise<SaveReceiptDTO|null>{
    if(this.busy)return null;
    const signature=JSON.stringify({target,draft:{...draft,summary:draft.summary.trim()}});
    if(this.pending?.signature!==signature)this.pending={signature,input:buildWorkspaceInput(target,draft,this.keys())};
    this.busy=true;
    try{const receipt=await this.save(this.pending.input);if(!receiptSchema.safeParse(receipt).success)throw Error('保存回执不完整，请保留原稿重试。');this.pending=null;return receipt;}
    finally{this.busy=false;}
  }
}
