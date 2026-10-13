import {requireLearningPermission, LearningAccessError, type LearningPrincipal} from './auth.ts';
import {normalizeLearningEvent, LearningWriteError} from './event-validation.ts';
import type {SaveReceiptDTO} from './contracts.ts';
import {activeWriter, receiptQuery as queryReceipt, savedReceipt as receipt, payloadHash, requiredWrite, type ReceiptRow} from './write-support.ts';
export {correctLearningEvent} from './corrections.ts';
import {rejectDeletedWrite} from './deletion-support.ts';

const operation = 'events:create';
function receiptQuery(db: D1Database, identity: LearningPrincipal, credential: string, key: string) {
  return queryReceipt(db, identity, credential, operation, key);
}

/** Creates one new private event. No HTTP route, evaluation or publishing side effects. */
export async function saveLearningEvent(db: D1Database, identity: LearningPrincipal | null, raw: unknown, options: {now?: Date} = {}): Promise<SaveReceiptDTO> {
  requireLearningPermission(identity, identity?.userId ?? '', 'events:write');
  const owner = identity!;
  const now = options.now ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new LearningWriteError('INVALID_INPUT');
  const normalized = normalizeLearningEvent(raw), event = normalized.input;
  const hash = await payloadHash(normalized.canonicalPayload);
  const credential = owner.grantId === null ? 'owner' : 'grant:' + owner.grantId;
  try {
    await activeWriter(db, owner, 'events:write', now);
    await rejectDeletedWrite(db, owner.userId, credential, operation, event.idempotency_key, null, event.source.type, event.source.record_id);
    const existing = await receiptQuery(db, owner, credential, event.idempotency_key).first<ReceiptRow>();
    if (existing) return receipt(existing, hash, true);

    const eventId = crypto.randomUUID(), receiptId = crypto.randomUUID(), receivedAt = now.toISOString();
    const statements: D1PreparedStatement[] = [];
    const write = (sql: string, values: (string | number | null)[]) => requiredWrite(db, statements, sql, values);
    write('INSERT INTO learning_state(owner_id,data_version,updated_at) VALUES(?,1,?) ON CONFLICT(owner_id) DO UPDATE SET data_version=learning_state.data_version+1,updated_at=excluded.updated_at', [owner.userId, receivedAt]);
    write('INSERT INTO learning_events(event_id,owner_id,source_type,source_record_id,kind,occurred_at,time_precision,received_at,study_day,study_day_override_reason,evidence_status,assistance,execution_mode) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)', [eventId, owner.userId, event.source.type, event.source.record_id, event.kind, event.occurred_at, event.time_precision, receivedAt, normalized.studyDay, event.study_day_override?.reason ?? null, event.evidence_status, event.assistance, event.execution_mode]);
    write('INSERT INTO event_revisions(event_id,owner_id,revision,payload_json,actor_user_id,reason,created_at) VALUES(?,?,1,?,?,?,?)', [eventId, owner.userId, JSON.stringify(event), owner.userId, 'initial event', receivedAt]);
    write('INSERT INTO ingest_receipts(receipt_id,owner_id,grant_id,credential_key,operation,idempotency_key,payload_sha256,event_id,revision,study_day,data_version,received_at) VALUES(?,?,?,?,?,?,?,?,1,?,(SELECT data_version FROM learning_state WHERE owner_id=?),?)', [receiptId, owner.userId, owner.grantId, credential, operation, event.idempotency_key, hash, eventId, normalized.studyDay, owner.userId, receivedAt]);
    write('INSERT INTO processing_jobs(job_id,receipt_id,owner_id,event_id,revision,data_version,next_attempt_at,created_at) VALUES(?,?,?,?,1,(SELECT data_version FROM learning_state WHERE owner_id=?),?,?)', [crypto.randomUUID(), receiptId, owner.userId, eventId, owner.userId, receivedAt, receivedAt]);
    statements.push(receiptQuery(db, owner, credential, event.idempotency_key));
    try {
      const results = await db.batch<ReceiptRow>(statements);
      const row = results.at(-1)?.results?.[0];
      if (!row) throw new LearningWriteError('SERVICE_UNAVAILABLE');
      return receipt(row, hash, false);
    } catch {
      // Another request may have committed this key, or our commit response was lost.
      // Never turn an arbitrary SQL/network failure into a successful receipt.
      await activeWriter(db, owner, 'events:write', now);
      await rejectDeletedWrite(db, owner.userId, credential, operation, event.idempotency_key, null, event.source.type, event.source.record_id);
      const saved = await receiptQuery(db, owner, credential, event.idempotency_key).first<ReceiptRow>();
      if (saved) return receipt(saved, hash, true);
      if (event.source.record_id !== null) {
        const source = await db.prepare('SELECT event_id FROM learning_events WHERE owner_id=? AND source_type=? AND source_record_id=?')
          .bind(owner.userId, event.source.type, event.source.record_id).first();
        if (source) throw new LearningWriteError('REVISION_CONFLICT');
      }
      throw new LearningWriteError('SERVICE_UNAVAILABLE');
    }
  } catch (error) {
    if (error instanceof LearningAccessError || error instanceof LearningWriteError) throw error;
    throw new LearningWriteError('SERVICE_UNAVAILABLE');
  }
}
