import {z} from 'zod';
import {dateSchema, learningDate} from '../records.ts';
import type {LearningEventInput, LearningAPIErrorCode} from './contracts.ts';

export class LearningWriteError extends Error {
  readonly code: LearningAPIErrorCode;
  constructor(code: LearningAPIErrorCode) {
    super({INVALID_INPUT: '学习事件内容无效', PAYLOAD_TOO_LARGE: '学习事件超过大小限制', IDEMPOTENCY_CONFLICT: '相同幂等键对应不同内容', REVISION_CONFLICT: '来源或版本冲突，请重新读取', SERVICE_UNAVAILABLE: '保存暂时不可用，请用原幂等键重试', PRIVATE_ACCESS_DENIED: '私人学习访问未获授权', RATE_LIMITED: '请求过于频繁', EVENT_DELETED: '学习事件已删除，不能重放旧提交', EVENT_NOT_FOUND: '学习事件不存在或不可访问'}[code]);
    this.name = 'LearningWriteError'; this.code = code;
  }
}

const id = z.string().trim().min(1).max(255);
const schema = z.object({
  schema_version: z.literal(1),
  idempotency_key: id,
  source: z.object({type: z.enum(['studio', 'studio_supplement']), record_id: id.nullable()}).strict(),
  kind: z.enum(['learning_activity', 'historical_summary']),
  occurred_at: z.string().datetime({offset: true}).refine(value => dateSchema.safeParse(value.slice(0, 10)).success && Number.isFinite(Date.parse(value))).nullable(),
  time_precision: z.enum(['exact', 'date', 'unknown']),
  study_day_override: z.object({study_day: dateSchema, reason: z.string().trim().min(1).max(1000)}).strict().nullable(),
  content: z.object({summary: z.string().trim().min(1).max(2000)}).strict(),
  evidence_status: z.enum(['unknown', 'self_reported']).default('unknown'),
  assistance: z.enum(['unknown', 'none', 'concept_hint', 'code_outline', 'full_solution']),
  execution_mode: z.enum(['unknown', 'reading', 'simulated_analysis', 'local_run', 'hardware_run']),
  knowledge_ids: z.array(z.string().trim().min(1).max(80)).max(32).refine(values => new Set(values).size === values.length),
  plan_id: id.nullable(),
  test_run_id: id.optional(),
}).strict().superRefine((event, ctx) => {
  const exact = event.time_precision === 'exact';
  if (exact !== (event.occurred_at !== null) || (event.time_precision === 'date' && !event.study_day_override)) ctx.addIssue({code: 'custom', message: '时间精度与发生时间不一致'});
  if (event.kind === 'historical_summary' && (event.evidence_status !== 'unknown' || event.assistance !== 'unknown' || event.execution_mode !== 'unknown')) ctx.addIssue({code: 'custom', message: '历史摘要不能补造成原始实践证据'});
});

export function normalizeLearningEvent(raw: unknown): {input: LearningEventInput; studyDay: string | null; canonicalPayload: string} {
  let serialized: string | undefined;
  try { serialized = JSON.stringify(raw); } catch { throw new LearningWriteError('INVALID_INPUT'); }
  if (serialized === undefined) throw new LearningWriteError('INVALID_INPUT');
  if (new TextEncoder().encode(serialized).byteLength > 64 * 1024) throw new LearningWriteError('PAYLOAD_TOO_LARGE');
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new LearningWriteError('INVALID_INPUT');
  const input: LearningEventInput = parsed.data;
  input.knowledge_ids = [...input.knowledge_ids].sort();
  if (input.occurred_at !== null) input.occurred_at = new Date(input.occurred_at).toISOString();
  const studyDay = input.study_day_override?.study_day ?? (input.occurred_at ? learningDate(new Date(input.occurred_at)) : null);
  // Identity, server IDs/timestamps and the transport key are excluded from the payload hash.
  const {idempotency_key: _key, ...payload} = input;
  return {input, studyDay, canonicalPayload: JSON.stringify(payload)};
}
