import {z} from 'zod';
import type {LearningContextDTO} from '../learning/contracts.ts';

const id=z.string().min(1).max(255), count=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const revision=count.refine(n=>n>0), timestamp=z.string().datetime({offset:true});
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>Number.isFinite(Date.parse(s+'T00:00:00Z')) && new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s);
export const receiptSchema=z.object({receipt_id:id,event_id:id,revision,received_at:timestamp,study_day:day.nullable(),
  data_version:revision,saved:z.literal(true),processing_status:z.literal('pending'),replayed:z.boolean()});
export const eventSchema=z.object({event_id:id,revision,source:z.object({type:z.string().min(1).max(80),record_id:id.nullable()}),
  kind:z.enum(['learning_activity','historical_summary','user_correction']),occurred_at:timestamp.nullable(),
  time_precision:z.enum(['exact','date','unknown']),received_at:timestamp,study_day:day.nullable(),study_day_override_reason:z.string().max(1000).nullable(),
  visibility:z.literal('private'),content:z.object({summary:z.string().min(1).max(2000)}),evidence_status:z.enum(['unknown','self_reported','artifact_checked']),
  assistance:z.enum(['unknown','none','concept_hint','code_outline','full_solution']),execution_mode:z.enum(['unknown','reading','simulated_analysis','local_run','hardware_run']),
  knowledge_ids:z.array(z.string().min(1).max(80)).max(32),plan_id:id.nullable()});
export const contextSchema=z.object({purpose:z.enum(['teaching','planning','review','portfolio']),generated_at:timestamp,
  latest_observed_event_at:timestamp.nullable(),data_version:count,assessment_processed_version:count,outline_version:revision.nullable(),policy_version:revision.nullable(),
  covered_sources:z.array(z.string().min(1).max(80)).max(40),unknown_ranges:z.array(z.string().min(1).max(100)).max(40),
  evidence_refs:z.array(z.object({event_id:id,revision})).max(40),events:z.array(eventSchema).max(40)
}).refine(c=>c.assessment_processed_version<=c.data_version && (c.events.length===0 || c.data_version>0)
  && new Set(c.events.map(e=>e.event_id)).size===c.events.length && c.evidence_refs.length===c.events.length
  && c.events.every(e=>c.evidence_refs.some(r=>r.event_id===e.event_id&&r.revision===e.revision))
  && c.events.every(e=>c.covered_sources.includes(e.source.type)));

export function contextNotice(context:LearningContextDTO): string | null {
  const labels:Record<string,string>={chat_history_not_connected:'尚未接入聊天记录',assessment_not_implemented:'能力尚未评估',
    outline_not_configured:'知识大纲尚未配置',plan_not_configured:'当前计划尚未配置',older_events_omitted:'仅展示最近部分记录',
    event_time_unknown:'部分记录的学习时间未知',response_size_limited:'长记录已按响应大小限制裁剪'};
  const messages=[...new Set(context.unknown_ranges.map(code=>labels[code]??'另有未确认的覆盖范围'))];
  return messages.length?messages.join('；')+'。':null;
}
