import {LearningWriteError} from './event-validation.ts';

export async function rejectDeletedWrite(db: D1Database, ownerId: string, credential: string, operation: string, key: string,
  eventId: string | null = null, sourceType: string | null = null, sourceId: string | null = null) {
  const blocked = await db.prepare(`SELECT 1 FROM deleted_learning_keys
    WHERE owner_id=? AND credential_key=? AND operation=? AND idempotency_key=?
    UNION ALL SELECT 1 FROM deleted_learning_events WHERE owner_id=?
    AND (event_id=? OR (source_type=? AND source_record_id=?)) LIMIT 1`)
    .bind(ownerId, credential, operation, key, ownerId, eventId, sourceType, sourceId).first();
  if (blocked) throw new LearningWriteError('EVENT_DELETED');
}

/** Verify the entire set, including individual rows skipped by IGNORE triggers. */
export function purgeDeletedBodies(db: D1Database, statements: D1PreparedStatement[], ownerId?: string) {
  for (const table of ['processing_jobs', 'ingest_receipts', 'event_revisions', 'learning_events']) {
    const predicate = `${ownerId === undefined ? '' : `${table}.owner_id=? AND `}EXISTS (SELECT 1 FROM deleted_learning_events d WHERE d.owner_id=${table}.owner_id
      AND (d.event_id=${table}.event_id OR EXISTS (SELECT 1 FROM learning_events e
        WHERE e.owner_id=${table}.owner_id AND e.event_id=${table}.event_id
        AND e.source_type=d.source_type AND e.source_record_id=d.source_record_id)))`;
    const args = ownerId === undefined ? [] : [ownerId];
    statements.push(db.prepare(`DELETE FROM ${table} WHERE ${predicate}`).bind(...args));
    statements.push(db.prepare(`SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM ${table} WHERE ${predicate})
      THEN 1 ELSE json('required deletion failed') END AS deletion_guard`).bind(...args));
  }
}
