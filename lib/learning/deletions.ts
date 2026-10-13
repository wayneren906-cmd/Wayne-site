import {z} from 'zod';
import {LearningAccessError, requireLearningPermission, type LearningPrincipal} from './auth.ts';
import {LearningWriteError} from './event-validation.ts';
import {activeWriter, requiredWrite} from './write-support.ts';
import {purgeDeletedBodies} from './deletion-support.ts';
import type {DeleteReceiptDTO} from './contracts.ts';

const id = z.string().min(1).max(255).refine(value => value.trim() === value && !/[\u0000-\u001f\u007f]/.test(value));
const schema = z.object({schema_version: z.literal(1), idempotency_key: id,
  expected_revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER - 1)}).strict();
type Marker = {event_id: string; deleted_revision: number; data_version: number; deleted_at: string};

export async function deleteLearningEvent(db: D1Database, identity: LearningPrincipal | null, eventId: string,
  raw: unknown, options: {now?: Date} = {}): Promise<DeleteReceiptDTO> {
  requireLearningPermission(identity, identity?.userId ?? '', 'events:correct');
  if (identity!.kind !== 'owner' || identity!.grantId !== null) throw new LearningAccessError();
  const owner = identity!, parsed = schema.safeParse(raw), now = options.now ?? new Date();
  if (!parsed.success || !id.safeParse(eventId).success || !Number.isFinite(now.getTime())) throw new LearningWriteError('INVALID_INPUT');
  const value = parsed.data, at = now.toISOString();
  const marker = () => db.prepare(`SELECT event_id,deleted_revision,data_version,deleted_at FROM deleted_learning_events
    WHERE owner_id=? AND idempotency_key=?`).bind(owner.userId, value.idempotency_key).first<Marker>();
  const current = () => db.prepare('SELECT current_revision FROM learning_events WHERE owner_id=? AND event_id=?')
    .bind(owner.userId, eventId).first<{current_revision: number}>();
  const receipt = (row: Marker, replayed: boolean): DeleteReceiptDTO => {
    if (row.event_id !== eventId || row.deleted_revision !== value.expected_revision) throw new LearningWriteError('IDEMPOTENCY_CONFLICT');
    return {...row, deleted: true, replayed};
  };
  try {
    await activeWriter(db, owner, 'events:correct', now);
    const prior = await marker(); if (prior) return receipt(prior, true);
    const row = await current();
    if (!row) throw new LearningWriteError('EVENT_NOT_FOUND');
    if (row.current_revision !== value.expected_revision) throw new LearningWriteError('REVISION_CONFLICT');
    const statements: D1PreparedStatement[] = [];
    requiredWrite(db, statements, 'UPDATE learning_state SET data_version=data_version+1,updated_at=? WHERE owner_id=? AND data_version<9007199254740991', [at, owner.userId]);
    requiredWrite(db, statements, `INSERT INTO deleted_learning_events
      SELECT e.owner_id,e.event_id,e.source_type,e.source_record_id,e.current_revision,s.data_version,?,?
      FROM learning_events e JOIN learning_state s ON s.owner_id=e.owner_id JOIN users u ON u.user_id=e.owner_id
      WHERE e.owner_id=? AND e.event_id=? AND e.current_revision=? AND u.role='owner' AND u.status='active'`,
      [at, value.idempotency_key, owner.userId, eventId, value.expected_revision]);
    statements.push(db.prepare(`INSERT INTO deleted_learning_keys SELECT owner_id,credential_key,operation,idempotency_key,event_id
      FROM ingest_receipts WHERE owner_id=? AND event_id=?`).bind(owner.userId, eventId));
    statements.push(db.prepare(`SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM ingest_receipts r WHERE r.owner_id=? AND r.event_id=?
      AND NOT EXISTS (SELECT 1 FROM deleted_learning_keys k WHERE k.owner_id=r.owner_id AND k.event_id=r.event_id
        AND k.credential_key=r.credential_key AND k.operation=r.operation AND k.idempotency_key=r.idempotency_key))
      THEN 1 ELSE json('required replay blockers failed') END AS blocker_guard`).bind(owner.userId, eventId));
    purgeDeletedBodies(db, statements, owner.userId);
    statements.push(db.prepare(`SELECT event_id,deleted_revision,data_version,deleted_at FROM deleted_learning_events WHERE owner_id=? AND idempotency_key=?`)
      .bind(owner.userId, value.idempotency_key));
    try {
      const results = await db.batch<Marker>(statements);
      const saved = results.at(-1)?.results?.[0];
      if (!saved) throw new LearningWriteError('SERVICE_UNAVAILABLE');
      return receipt(saved, false);
    } catch {
      await activeWriter(db, owner, 'events:correct', now);
      const saved = await marker(); if (saved) return receipt(saved, true);
      const latest = await current();
      if (!latest) throw new LearningWriteError('EVENT_NOT_FOUND');
      if (latest.current_revision !== value.expected_revision) throw new LearningWriteError('REVISION_CONFLICT');
      throw new LearningWriteError('SERVICE_UNAVAILABLE');
    }
  } catch (error) {
    if (error instanceof LearningAccessError || error instanceof LearningWriteError) throw error;
    throw new LearningWriteError('SERVICE_UNAVAILABLE');
  }
}
