import {z} from 'zod';
import {purgeDeletedBodies} from './deletion-support.ts';
import {LearningWriteError} from './event-validation.ts';

const id = z.string().min(1).max(255);
const version = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER - 1);
const markerSchema = z.object({owner_id: id, event_id: id, source_type: z.string().min(1).max(80), source_record_id: id.nullable(),
  deleted_revision: version.refine(n => n > 0), data_version: version.refine(n => n > 0),
  deleted_at: z.string().datetime({offset: true}), idempotency_key: id}).strict();
const keySchema = z.object({owner_id: id, credential_key: z.string().min(1).max(261), operation: z.enum(['events:create', 'events:correct']),
  idempotency_key: id, event_id: id}).strict();
export const checkpointSchema = z.object({schema_version: z.literal(1),
  owners: z.array(z.object({owner_id: id, data_version: version}).strict()).min(1).max(100),
  markers: z.array(markerSchema).max(1000), keys: z.array(keySchema).max(10000)}).strict();
export type DeletionCheckpoint = z.infer<typeof checkpointSchema>;

/** Trusted offline operation ONLY: destination must be isolated with reads/jobs disabled.
 * The checkpoint must survive outside the older backup. No HTTP route or provider is configured.
 */
export function deletionRestoreStatements(db: D1Database, raw: unknown, options: {isolated: true; now?: Date}) {
  const parsed = checkpointSchema.safeParse(raw), now = options.now ?? new Date();
  if (options.isolated !== true || !parsed.success || !Number.isFinite(now.getTime())) throw new LearningWriteError('INVALID_INPUT');
  const checkpoint = parsed.data;
  const owners = new Map(checkpoint.owners.map(o => [o.owner_id, o.data_version]));
  const markers = new Map(checkpoint.markers.map(m => [JSON.stringify([m.owner_id, m.event_id]), m]));
  if (owners.size !== checkpoint.owners.length || markers.size !== checkpoint.markers.length
    || checkpoint.markers.some(m => !owners.has(m.owner_id) || owners.get(m.owner_id)! < m.data_version)
    || checkpoint.keys.some(k => !markers.has(JSON.stringify([k.owner_id, k.event_id])))) throw new LearningWriteError('INVALID_INPUT');
  const statements: D1PreparedStatement[] = [];
  for (const m of checkpoint.markers) {
    statements.push(db.prepare(`INSERT INTO deleted_learning_events VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(owner_id,event_id) DO NOTHING`)
      .bind(m.owner_id, m.event_id, m.source_type, m.source_record_id, m.deleted_revision, m.data_version, m.deleted_at, m.idempotency_key));
    statements.push(db.prepare(`SELECT CASE WHEN EXISTS (SELECT 1 FROM deleted_learning_events WHERE owner_id=? AND event_id=?
      AND source_type=? AND source_record_id IS ? AND deleted_revision=? AND data_version=? AND deleted_at=? AND idempotency_key=?)
      THEN 1 ELSE json('conflicting deletion checkpoint') END AS marker_guard`)
      .bind(m.owner_id, m.event_id, m.source_type, m.source_record_id, m.deleted_revision, m.data_version, m.deleted_at, m.idempotency_key));
  }
  for (const k of checkpoint.keys) {
    statements.push(db.prepare(`INSERT INTO deleted_learning_keys VALUES(?,?,?,?,?)
      ON CONFLICT(owner_id,credential_key,operation,idempotency_key) DO NOTHING`)
      .bind(k.owner_id, k.credential_key, k.operation, k.idempotency_key, k.event_id));
    statements.push(db.prepare(`SELECT CASE WHEN EXISTS (SELECT 1 FROM deleted_learning_keys WHERE owner_id=? AND credential_key=?
      AND operation=? AND idempotency_key=? AND event_id=?) THEN 1 ELSE json('conflicting replay checkpoint') END AS key_guard`)
      .bind(k.owner_id, k.credential_key, k.operation, k.idempotency_key, k.event_id));
  }
  // Capture any old-backup retry keys, including a different event ID for the same source.
  statements.push(db.prepare(`INSERT INTO deleted_learning_keys
    SELECT r.owner_id,r.credential_key,r.operation,r.idempotency_key,d.event_id FROM ingest_receipts r
    JOIN learning_events e ON e.owner_id=r.owner_id AND e.event_id=r.event_id
    JOIN deleted_learning_events d ON d.owner_id=e.owner_id
      AND (d.event_id=e.event_id OR (d.source_type=e.source_type AND d.source_record_id=e.source_record_id))
    WHERE NOT EXISTS (SELECT 1 FROM deleted_learning_keys k WHERE k.owner_id=r.owner_id AND k.credential_key=r.credential_key
      AND k.operation=r.operation AND k.idempotency_key=r.idempotency_key)`));
  statements.push(db.prepare(`SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM ingest_receipts r JOIN learning_events e
    ON e.owner_id=r.owner_id AND e.event_id=r.event_id JOIN deleted_learning_events d ON d.owner_id=e.owner_id
    AND (d.event_id=e.event_id OR (d.source_type=e.source_type AND d.source_record_id=e.source_record_id))
    WHERE NOT EXISTS (SELECT 1 FROM deleted_learning_keys k WHERE k.owner_id=r.owner_id AND k.credential_key=r.credential_key
      AND k.operation=r.operation AND k.idempotency_key=r.idempotency_key AND k.event_id=d.event_id))
    THEN 1 ELSE json('missing restored replay blockers') END AS restored_key_guard`));
  purgeDeletedBodies(db, statements);
  // Each restored owner must have an external high-water mark, including owners without deletions.
  statements.push(db.prepare(`SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM
    (SELECT owner_id FROM learning_state UNION SELECT owner_id FROM learning_events UNION SELECT owner_id FROM deleted_learning_events) WHERE owner_id NOT IN
    (SELECT json_extract(value,'$.owner_id') FROM json_each(?))) THEN 1 ELSE json('missing owner high water') END AS owner_guard`)
    .bind(JSON.stringify(checkpoint.owners)));
  for (const o of checkpoint.owners) {
    statements.push(db.prepare(`INSERT INTO learning_state(owner_id,data_version,updated_at)
      VALUES(?,max(?,coalesce((SELECT max(data_version) FROM deleted_learning_events WHERE owner_id=?),0))+1,?)
      ON CONFLICT(owner_id) DO UPDATE SET data_version=max(learning_state.data_version,excluded.data_version-1)+1,updated_at=excluded.updated_at`)
      .bind(o.owner_id, o.data_version, o.owner_id, now.toISOString()));
    statements.push(db.prepare(`SELECT CASE WHEN changes()=1 AND (SELECT data_version FROM learning_state WHERE owner_id=?)>?
      AND (SELECT data_version FROM learning_state WHERE owner_id=?)<=9007199254740991
      THEN 1 ELSE json('invalid restored version') END AS version_guard`).bind(o.owner_id, o.data_version, o.owner_id));
  }
  // Old leases and completed derivations cannot be accepted after a restore epoch change.
  statements.push(db.prepare('DELETE FROM processing_jobs'));
  statements.push(db.prepare(`SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM processing_jobs) THEN 1 ELSE json('old jobs retained') END AS jobs_guard`));
  return statements;
}

export async function filterRestoredLearningData(db: D1Database, raw: unknown, options: {isolated: true; now?: Date}) {
  const statements=deletionRestoreStatements(db,raw,options);
  try {await db.batch(statements);} catch {throw new LearningWriteError('SERVICE_UNAVAILABLE');}
}
