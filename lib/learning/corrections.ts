import {z} from 'zod';
import {LearningAccessError, requireLearningPermission, type LearningPrincipal} from './auth.ts';
import {LearningWriteError, normalizeLearningEvent} from './event-validation.ts';
import {activeWriter, payloadHash, receiptQuery, requiredWrite, savedReceipt, type ReceiptRow} from './write-support.ts';
import type {SaveReceiptDTO} from './contracts.ts';
import {rejectDeletedWrite} from './deletion-support.ts';

const id = z.string().trim().min(1).max(255);
const envelope = z.object({
  schema_version: z.literal(1), idempotency_key: id,
  expected_revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER - 1),
  reason: z.string().trim().min(1).max(1000), event: z.record(z.string(), z.unknown()),
}).strict();
const operation = 'events:correct';
type Current = {current_revision: number; source_type: string; source_record_id: string | null; kind: string; has_revision: number};

function normalize(raw: unknown, eventId: string) {
  let serialized: string | undefined;
  try {serialized = JSON.stringify(raw);} catch {throw new LearningWriteError('INVALID_INPUT');}
  if (serialized === undefined) throw new LearningWriteError('INVALID_INPUT');
  if (new TextEncoder().encode(serialized).byteLength > 64 * 1024) throw new LearningWriteError('PAYLOAD_TOO_LARGE');
  const result = envelope.safeParse(raw);
  if (!result.success || !id.safeParse(eventId).success || eventId.trim() !== eventId) throw new LearningWriteError('INVALID_INPUT');
  const value = result.data;
  // The nested replacement is not another submission envelope.
  if (Object.hasOwn(value.event, 'schema_version') || Object.hasOwn(value.event, 'idempotency_key')) throw new LearningWriteError('INVALID_INPUT');
  const normalized = normalizeLearningEvent({...value.event, schema_version: 1, idempotency_key: value.idempotency_key});
  return {...normalized, expected: value.expected_revision, reason: value.reason,
    canonicalPayload: JSON.stringify({event_id: eventId, expected_revision: value.expected_revision, reason: value.reason, event: JSON.parse(normalized.canonicalPayload)})};
}

export async function correctLearningEvent(db: D1Database, identity: LearningPrincipal | null, eventId: string, raw: unknown, options: {now?: Date} = {}): Promise<SaveReceiptDTO> {
  requireLearningPermission(identity, identity?.userId ?? '', 'events:correct');
  const owner = identity!, now = options.now ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new LearningWriteError('INVALID_INPUT');
  const normalized = normalize(raw, eventId), event = normalized.input;
  const hash = await payloadHash(normalized.canonicalPayload);
  const credential = owner.grantId === null ? 'owner' : 'grant:' + owner.grantId;
  const queryReceipt = () => receiptQuery(db, owner, credential, operation, event.idempotency_key);
  const current = () => db.prepare(`SELECT e.current_revision,e.source_type,e.source_record_id,e.kind,
    EXISTS(SELECT 1 FROM event_revisions r WHERE r.event_id=e.event_id AND r.owner_id=e.owner_id AND r.revision=e.current_revision) AS has_revision
    FROM learning_events e WHERE e.owner_id=? AND e.event_id=?`).bind(owner.userId, eventId).first<Current>();
  try {
    await activeWriter(db, owner, 'events:correct', now);
    await rejectDeletedWrite(db, owner.userId, credential, operation, event.idempotency_key, eventId);
    const prior = await queryReceipt().first<ReceiptRow>();
    if (prior) return savedReceipt(prior, hash, true);
    const row = await current();
    if (!row || row.current_revision !== normalized.expected || row.source_type !== event.source.type || row.source_record_id !== event.source.record_id || row.kind !== event.kind) throw new LearningWriteError('REVISION_CONFLICT');
    if (!row.has_revision) throw new LearningWriteError('SERVICE_UNAVAILABLE');
    const revision = normalized.expected + 1, at = now.toISOString(), receiptId = crypto.randomUUID();
    const statements: D1PreparedStatement[] = [];
    const write = (sql: string, values: (string | number | null)[]) => requiredWrite(db, statements, sql, values);
    write(`UPDATE learning_events SET current_revision=?,occurred_at=?,time_precision=?,study_day=?,study_day_override_reason=?,evidence_status=?,assistance=?,execution_mode=?
      WHERE owner_id=? AND event_id=? AND current_revision=? AND source_type=? AND source_record_id IS ? AND kind=?`,
      [revision, event.occurred_at, event.time_precision, normalized.studyDay, event.study_day_override?.reason ?? null, event.evidence_status, event.assistance, event.execution_mode, owner.userId, eventId, normalized.expected, event.source.type, event.source.record_id, event.kind]);
    write('UPDATE learning_state SET data_version=data_version+1,updated_at=? WHERE owner_id=?', [at, owner.userId]);
    write('INSERT INTO event_revisions(event_id,owner_id,revision,supersedes_revision,payload_json,actor_user_id,reason,created_at) VALUES(?,?,?,?,?,?,?,?)', [eventId, owner.userId, revision, normalized.expected, JSON.stringify(event), owner.userId, normalized.reason, at]);
    write('INSERT INTO ingest_receipts(receipt_id,owner_id,grant_id,credential_key,operation,idempotency_key,payload_sha256,event_id,revision,study_day,data_version,received_at) VALUES(?,?,?,?,?,?,?,?,?,?,(SELECT data_version FROM learning_state WHERE owner_id=?),?)', [receiptId, owner.userId, owner.grantId, credential, operation, event.idempotency_key, hash, eventId, revision, normalized.studyDay, owner.userId, at]);
    write('INSERT INTO processing_jobs(job_id,receipt_id,owner_id,event_id,revision,data_version,next_attempt_at,created_at) VALUES(?,?,?,?,?,(SELECT data_version FROM learning_state WHERE owner_id=?),?,?)', [crypto.randomUUID(), receiptId, owner.userId, eventId, revision, owner.userId, at, at]);
    statements.push(queryReceipt());
    try {
      const results = await db.batch<ReceiptRow>(statements);
      const saved = results.at(-1)?.results?.[0];
      if (!saved) throw new LearningWriteError('SERVICE_UNAVAILABLE');
      return savedReceipt(saved, hash, false);
    } catch {
      await activeWriter(db, owner, 'events:correct', now);
      await rejectDeletedWrite(db, owner.userId, credential, operation, event.idempotency_key, eventId);
      const saved = await queryReceipt().first<ReceiptRow>();
      if (saved) return savedReceipt(saved, hash, true);
      const latest = await current();
      if (!latest || latest.current_revision !== normalized.expected) throw new LearningWriteError('REVISION_CONFLICT');
      throw new LearningWriteError('SERVICE_UNAVAILABLE');
    }
  } catch (error) {
    if (error instanceof LearningAccessError || error instanceof LearningWriteError) throw error;
    throw new LearningWriteError('SERVICE_UNAVAILABLE');
  }
}
