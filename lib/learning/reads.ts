import {z} from 'zod';
import {LearningAccessError, learningScopes, requireLearningPermission, type LearningPrincipal, type LearningScope} from './auth.ts';
import type {ContextPurpose, LearningAPIErrorCode, LearningContextDTO, LearningEventDTO, LearningEventHistoryDTO} from './contracts.ts';
import {dateSchema, learningDate} from '../records.ts';

export class LearningReadError extends Error {
  readonly code: Extract<LearningAPIErrorCode, 'INVALID_INPUT' | 'SERVICE_UNAVAILABLE'>;
  constructor(code: Extract<LearningAPIErrorCode, 'INVALID_INPUT' | 'SERVICE_UNAVAILABLE'>) {
    super(code === 'INVALID_INPUT' ? '读取参数无效' : '私人学习读取暂时不可用，请稍后重试');
    this.name = 'LearningReadError'; this.code = code;
  }
}

const limits: Record<ContextPurpose, number> = {teaching: 20, planning: 10, review: 40, portfolio: 10};
const id = z.string().min(1).max(255);
const timestamp = z.string().datetime({offset: true});
const dtoSchema = z.object({
  event_id: id, revision: z.number().int().positive(), source: z.object({type: z.string().min(1).max(80), record_id: id.nullable()}),
  kind: z.enum(['learning_activity', 'historical_summary', 'user_correction']), occurred_at: timestamp.nullable(),
  time_precision: z.enum(['exact', 'date', 'unknown']), received_at: timestamp, study_day: dateSchema.nullable(),
  study_day_override_reason: z.string().min(1).max(1000).nullable(), content: z.object({summary: z.string().min(1).max(2000)}),
  evidence_status: z.enum(['unknown', 'self_reported', 'artifact_checked']), assistance: z.enum(['unknown', 'none', 'concept_hint', 'code_outline', 'full_solution']),
  execution_mode: z.enum(['unknown', 'reading', 'simulated_analysis', 'local_run', 'hardware_run']),
  knowledge_ids: z.array(z.string().min(1).max(80)).max(32), plan_id: id.nullable(), visibility: z.literal('private'),
});
type EventRow = {
  event_id: string; revision: number; source_type: string; source_record_id: string | null;
  kind: string; occurred_at: string | null; time_precision: string; received_at: string;
  study_day: string | null; study_day_override_reason: string | null; summary: string;
  evidence_status: string; assistance: string; execution_mode: string; knowledge_ids_json: string; plan_id: string | null; visibility: string;
};

// Project only approved fields from the current revision. Never return payload_json,
// which also stores idempotency/test transport fields and future internal metadata.
const visibleEvent = `NOT EXISTS (SELECT 1 FROM deleted_learning_events d WHERE d.owner_id=e.owner_id
  AND (d.event_id=e.event_id OR (d.source_type=e.source_type AND d.source_record_id=e.source_record_id)))`;
const currentEvents = `SELECT e.event_id,e.current_revision AS revision,e.source_type,e.source_record_id,
  e.kind,e.occurred_at,e.time_precision,e.received_at,e.study_day,e.study_day_override_reason,
  e.evidence_status,e.assistance,e.execution_mode,e.visibility,
  json_extract(r.payload_json,'$.content.summary') AS summary,
  json_extract(r.payload_json,'$.knowledge_ids') AS knowledge_ids_json,
  json_extract(r.payload_json,'$.plan_id') AS plan_id
  FROM learning_events e LEFT JOIN event_revisions r
  ON r.event_id=e.event_id AND r.owner_id=e.owner_id AND r.revision=e.current_revision
  WHERE e.owner_id=? AND ${visibleEvent}`;

function authority(db: D1Database, identity: LearningPrincipal, scope: LearningScope, now: Date) {
  return db.prepare(`SELECT u.user_id FROM users u WHERE u.user_id=? AND u.role='owner' AND u.status='active'
    AND (? IS NULL OR EXISTS (
      SELECT 1 FROM integration_grants g WHERE g.grant_id=? AND g.owner_id=u.user_id
      AND g.revoked_at IS NULL AND g.expires_at>?
      AND json_array_length(g.scopes) BETWEEN 1 AND ?
      AND NOT EXISTS (SELECT 1 FROM json_each(g.scopes) WHERE type<>'text' OR value NOT IN (SELECT value FROM json_each(?)))
      AND (SELECT COUNT(DISTINCT value) FROM json_each(g.scopes))=json_array_length(g.scopes)
      AND EXISTS (SELECT 1 FROM json_each(g.scopes) WHERE value=?)
    ))`).bind(identity.userId, identity.grantId, identity.grantId, now.getTime()/1000, learningScopes.length, JSON.stringify(learningScopes), scope);
}

async function snapshot(db: D1Database, identity: LearningPrincipal, scope: LearningScope, now: Date, queries: D1PreparedStatement[]) {
  // A single primary-database batch snapshots live authorization, state and content.
  // Do not use a separate authorization read followed by an unversioned content read.
  const results = await db.batch([authority(db, identity, scope, now), ...queries]);
  if (!results[0]?.results?.length) throw new LearningAccessError();
  if (results.length !== queries.length + 1 || results.some(r => !r.success || !Array.isArray(r.results))) throw new LearningReadError('SERVICE_UNAVAILABLE');
  return results.slice(1);
}

function eventDTO(row: EventRow): LearningEventDTO {
  return dtoSchema.parse({
    event_id: row.event_id, revision: row.revision, source: {type: row.source_type, record_id: row.source_record_id},
    kind: row.kind, occurred_at: row.occurred_at, time_precision: row.time_precision, received_at: row.received_at,
    study_day: row.study_day, study_day_override_reason: row.study_day_override_reason, content: {summary: row.summary},
    evidence_status: row.evidence_status, assistance: row.assistance, execution_mode: row.execution_mode,
    knowledge_ids: JSON.parse(row.knowledge_ids_json), plan_id: row.plan_id, visibility: row.visibility,
  });
}

function failure(error: unknown): never {
  if (error instanceof LearningAccessError || error instanceof LearningReadError) throw error;
  throw new LearningReadError('SERVICE_UNAVAILABLE');
}

export async function getLearningEvent(db: D1Database, identity: LearningPrincipal | null, eventId: string, options: {now?: Date} = {}): Promise<LearningEventDTO | null> {
  requireLearningPermission(identity, identity?.userId ?? '', 'events:read');
  const now = options.now ?? new Date();
  if (!id.safeParse(eventId).success || !Number.isFinite(now.getTime())) throw new LearningReadError('INVALID_INPUT');
  try {
    const [events] = await snapshot(db, identity!, 'events:read', now, [db.prepare(currentEvents + ' AND e.event_id=? LIMIT 1').bind(identity!.userId, eventId)]);
    return events.results.length ? eventDTO(events.results[0] as EventRow) : null;
  } catch (error) {return failure(error);}
}

export async function getLearningEventHistory(db: D1Database, identity: LearningPrincipal | null, eventId: string, query: {before_revision?: number} = {}, options: {now?: Date} = {}): Promise<LearningEventHistoryDTO | null> {
  requireLearningPermission(identity, identity?.userId ?? '', 'events:read');
  const now = options.now ?? new Date();
  const parsed = z.object({before_revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional()}).strict().safeParse(query);
  if (!parsed.success || !id.safeParse(eventId).success || !Number.isFinite(now.getTime())) throw new LearningReadError('INVALID_INPUT');
  try {
    const owner = identity!.userId;
    const [state, current, currentPayload, revisions] = await snapshot(db, identity!, 'events:read', now, [
      db.prepare('SELECT data_version FROM learning_state WHERE owner_id=?').bind(owner),
      db.prepare(`SELECT e.current_revision,EXISTS(SELECT 1 FROM event_revisions r WHERE r.owner_id=e.owner_id AND r.event_id=e.event_id AND r.revision=e.current_revision) AS has_revision FROM learning_events e WHERE e.owner_id=? AND e.event_id=? AND ${visibleEvent}`).bind(owner, eventId),
      db.prepare(currentEvents + ' AND e.event_id=? LIMIT 1').bind(owner, eventId),
      db.prepare(`SELECT e.event_id,r.revision,e.source_type,e.source_record_id,e.kind,e.received_at,e.visibility,
        json_extract(r.payload_json,'$.occurred_at') AS occurred_at,json_extract(r.payload_json,'$.time_precision') AS time_precision,
        json_extract(r.payload_json,'$.study_day_override.study_day') AS study_day,
        json_extract(r.payload_json,'$.study_day_override.reason') AS study_day_override_reason,
        json_extract(r.payload_json,'$.content.summary') AS summary,json_extract(r.payload_json,'$.evidence_status') AS evidence_status,
        json_extract(r.payload_json,'$.assistance') AS assistance,json_extract(r.payload_json,'$.execution_mode') AS execution_mode,
        json_extract(r.payload_json,'$.knowledge_ids') AS knowledge_ids_json,json_extract(r.payload_json,'$.plan_id') AS plan_id,
        r.supersedes_revision,r.reason,r.created_at
        FROM learning_events e JOIN event_revisions r ON r.event_id=e.event_id AND r.owner_id=e.owner_id
        WHERE e.owner_id=? AND e.event_id=? AND ${visibleEvent} AND r.revision<=e.current_revision AND (? IS NULL OR r.revision<?)
        ORDER BY r.revision DESC LIMIT 11`).bind(owner, eventId, parsed.data.before_revision ?? null, parsed.data.before_revision ?? null),
    ]);
    if (!current.results.length) return null;
    const head = current.results[0] as {current_revision: number; has_revision: number};
    const version = (state.results[0] as {data_version: number} | undefined)?.data_version;
    if (!head.has_revision || !Number.isSafeInteger(head.current_revision) || !Number.isSafeInteger(version) || version! < 1) throw new LearningReadError('SERVICE_UNAVAILABLE');
    // A pagination cursor cannot bypass validation of the authoritative head.
    if (currentPayload.results.length !== 1) throw new LearningReadError('SERVICE_UNAVAILABLE');
    eventDTO(currentPayload.results[0] as EventRow);
    const history: LearningEventHistoryDTO = {event_id: eventId, current_revision: head.current_revision, data_version: version!, next_before_revision: null, revisions: []};
    for (const raw of revisions.results.slice(0, 10)) {
      const row = raw as EventRow & {supersedes_revision: number | null; reason: string; created_at: string};
      timestamp.nullable().parse(row.occurred_at);
      const event = eventDTO({...row, study_day: row.study_day ?? (row.occurred_at ? learningDate(new Date(row.occurred_at)) : null)});
      const metadata = z.object({supersedes_revision: z.number().int().positive().nullable(), reason: z.string().min(1).max(1000), created_at: timestamp}).parse(row);
      if (metadata.supersedes_revision !== (event.revision === 1 ? null : event.revision - 1)) throw new LearningReadError('SERVICE_UNAVAILABLE');
      history.revisions.push({event, ...metadata});
    }
    const more = revisions.results.length > history.revisions.length;
    if (more) history.next_before_revision = history.revisions.at(-1)!.event.revision;
    while (new TextEncoder().encode(JSON.stringify(history)).byteLength > 64 * 1024 && history.revisions.length) {
      history.revisions.pop();
      history.next_before_revision = history.revisions.at(-1)?.event.revision ?? null;
    }
    if (revisions.results.length && !history.revisions.length) throw new LearningReadError('SERVICE_UNAVAILABLE');
    return history;
  } catch (error) {return failure(error);}
}

export async function getLearningContext(db: D1Database, identity: LearningPrincipal | null, purpose: ContextPurpose, options: {now?: Date} = {}): Promise<LearningContextDTO> {
  requireLearningPermission(identity, identity?.userId ?? '', 'context:read');
  const now = options.now ?? new Date();
  if (!Object.hasOwn(limits, purpose) || !Number.isFinite(now.getTime())) throw new LearningReadError('INVALID_INPUT');
  try {
    const owner = identity!.userId;
    const [state, metadata, events] = await snapshot(db, identity!, 'context:read', now, [
      db.prepare('SELECT data_version FROM learning_state WHERE owner_id=?').bind(owner),
      db.prepare(`SELECT COUNT(*) AS total,MAX(e.occurred_at) AS latest,SUM(CASE WHEN e.time_precision='unknown' THEN 1 ELSE 0 END) AS unknown_time FROM learning_events e WHERE e.owner_id=? AND ${visibleEvent}`).bind(owner),
      db.prepare(currentEvents + ' ORDER BY e.received_at DESC,e.event_id DESC LIMIT ?').bind(owner, limits[purpose]),
    ]);
    const meta = metadata.results[0] as {total: number; latest: string | null; unknown_time: number | null};
    const dataVersion = (state.results[0] as {data_version: number} | undefined)?.data_version ?? 0;
    if (!Number.isSafeInteger(dataVersion) || dataVersion < 0 || (meta.total > 0 && dataVersion === 0)) throw new LearningReadError('SERVICE_UNAVAILABLE');
    const context: LearningContextDTO = {
      purpose, generated_at: now.toISOString(), latest_observed_event_at: meta.latest,
      data_version: dataVersion, assessment_processed_version: 0, outline_version: null, policy_version: null,
      covered_sources: [], unknown_ranges: ['chat_history_not_connected', 'assessment_not_implemented', 'outline_not_configured', 'plan_not_configured'],
      evidence_refs: [], events: events.results.map(row => eventDTO(row as EventRow)),
    };
    if (meta.total > context.events.length) context.unknown_ranges.push('older_events_omitted');
    if (meta.unknown_time) context.unknown_ranges.push('event_time_unknown');
    const synchronizeRefs = () => {
      context.covered_sources = [...new Set(context.events.map(e => e.source.type))].sort();
      context.evidence_refs = context.events.map(e => ({event_id: e.event_id, revision: e.revision}));
    };
    synchronizeRefs();
    while (new TextEncoder().encode(JSON.stringify(context)).byteLength > 64 * 1024 && context.events.length) {
      context.events.pop();
      if (!context.unknown_ranges.includes('response_size_limited')) context.unknown_ranges.push('response_size_limited');
      synchronizeRefs();
    }
    return context;
  } catch (error) {return failure(error);}
}
