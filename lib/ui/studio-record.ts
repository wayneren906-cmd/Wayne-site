import type {LearningEventDTO,LearningCorrectionInput} from '../learning/contracts.ts';
export function recordCorrection(event:LearningEventDTO,summary:string,reason:string,key:string):LearningCorrectionInput{
  if(!summary.trim()||summary.trim().length>2000||!reason.trim()||reason.trim().length>1000||event.kind==='user_correction')throw Error('请填写有效正文和修订原因。');
  return {schema_version:1,idempotency_key:key,expected_revision:event.revision,reason:reason.trim(),event:{source:{...event.source},kind:event.kind,occurred_at:event.occurred_at,time_precision:event.time_precision,
    study_day_override:event.study_day_override_reason&&event.study_day?{study_day:event.study_day,reason:event.study_day_override_reason}:null,
    content:{summary:summary.trim()},evidence_status:event.evidence_status,assistance:event.assistance,execution_mode:event.execution_mode,knowledge_ids:[...event.knowledge_ids],plan_id:event.plan_id}};
}
