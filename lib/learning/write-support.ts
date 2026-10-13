import {LearningAccessError, learningScopes, type LearningPrincipal, type LearningScope} from './auth.ts';
import {LearningWriteError} from './event-validation.ts';
import type {SaveReceiptDTO} from './contracts.ts';

export type ReceiptRow = {
  receipt_id: string; event_id: string; revision: number; received_at: string;
  study_day: string | null; data_version: number; processing_status: 'pending'; payload_sha256: string;
};

export async function activeWriter(db: D1Database, identity: LearningPrincipal, scope: LearningScope, now: Date) {
  const user = await db.prepare(`SELECT u.user_id FROM users u
    WHERE u.user_id=? AND u.role='owner' AND u.status='active'
    AND (? IS NULL OR EXISTS (
      SELECT 1 FROM integration_grants g WHERE g.grant_id=? AND g.owner_id=u.user_id
      AND g.revoked_at IS NULL AND g.expires_at>?
      AND json_array_length(g.scopes) BETWEEN 1 AND ?
      AND NOT EXISTS (SELECT 1 FROM json_each(g.scopes) WHERE type<>'text' OR value NOT IN (SELECT value FROM json_each(?)))
      AND (SELECT COUNT(DISTINCT value) FROM json_each(g.scopes))=json_array_length(g.scopes)
      AND EXISTS (SELECT 1 FROM json_each(g.scopes) WHERE value=?)
    ))`).bind(identity.userId, identity.grantId, identity.grantId, now.getTime()/1000, learningScopes.length, JSON.stringify(learningScopes), scope).first();
  if (!user) throw new LearningAccessError();
}

export function receiptQuery(db: D1Database, identity: LearningPrincipal, credential: string, operation: string, key: string) {
  return db.prepare('SELECT receipt_id,event_id,revision,received_at,study_day,data_version,processing_status,payload_sha256 FROM ingest_receipts WHERE owner_id=? AND credential_key=? AND operation=? AND idempotency_key=?')
    .bind(identity.userId, credential, operation, key);
}

export function savedReceipt(row: ReceiptRow, hash: string, replayed: boolean): SaveReceiptDTO {
  if (row.payload_sha256 !== hash) throw new LearningWriteError('IDEMPOTENCY_CONFLICT');
  const {payload_sha256: _hash, ...fields} = row;
  return {...fields, saved: true, replayed};
}

export async function payloadHash(payload: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function requiredWrite(db: D1Database, statements: D1PreparedStatement[], sql: string, values: (string | number | null)[]) {
  statements.push(db.prepare(sql).bind(...values));
  // Check while rollback is still possible: D1 does not treat zero affected rows as failure.
  statements.push(db.prepare("SELECT CASE WHEN changes() = 1 THEN 1 ELSE json('required write failed') END AS write_guard"));
}
