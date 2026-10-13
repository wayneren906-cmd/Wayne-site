-- Additive receipt/outbox storage. No seed data, old-table changes or automatic execution.
CREATE TABLE IF NOT EXISTS ingest_receipts (
  receipt_id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users(user_id),
  grant_id TEXT REFERENCES integration_grants(grant_id),
  credential_key TEXT NOT NULL,
  operation TEXT NOT NULL,
  idempotency_key TEXT NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 255),
  payload_sha256 TEXT NOT NULL CHECK (length(payload_sha256) = 64 AND payload_sha256 NOT GLOB '*[^0-9a-f]*'),
  event_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (typeof(revision) = 'integer' AND revision >= 1),
  study_day TEXT,
  data_version INTEGER NOT NULL CHECK (typeof(data_version) = 'integer' AND data_version >= 1),
  received_at TEXT NOT NULL CHECK (julianday(received_at) IS NOT NULL),
  processing_status TEXT NOT NULL DEFAULT 'pending' CHECK (processing_status = 'pending'),
  FOREIGN KEY (event_id, owner_id) REFERENCES learning_events(event_id, owner_id),
  FOREIGN KEY (event_id, revision) REFERENCES event_revisions(event_id, revision),
  UNIQUE (owner_id, credential_key, operation, idempotency_key),
  UNIQUE (receipt_id, owner_id, event_id, revision, data_version),
  CHECK ((grant_id IS NULL AND credential_key = 'owner') OR (grant_id IS NOT NULL AND credential_key = 'grant:' || grant_id))
);

-- Recheck current authority inside the write transaction, not only before it.
CREATE TRIGGER IF NOT EXISTS ingest_receipts_authority BEFORE INSERT ON ingest_receipts
WHEN NOT EXISTS (SELECT 1 FROM users WHERE user_id = NEW.owner_id AND role = 'owner' AND status = 'active')
  OR (NEW.grant_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM integration_grants g WHERE g.grant_id = NEW.grant_id AND g.owner_id = NEW.owner_id
    AND g.revoked_at IS NULL AND g.expires_at > unixepoch(NEW.received_at)
    AND json_array_length(g.scopes) BETWEEN 1 AND 4
    AND NOT EXISTS (SELECT 1 FROM json_each(g.scopes) WHERE type <> 'text' OR value NOT IN ('context:read', 'events:read', 'events:write', 'events:correct'))
    AND (SELECT COUNT(DISTINCT value) FROM json_each(g.scopes)) = json_array_length(g.scopes)
    AND EXISTS (SELECT 1 FROM json_each(g.scopes) WHERE value = 'events:write')
  ))
BEGIN
  SELECT RAISE(ABORT, 'PRIVATE_ACCESS_DENIED');
END;

CREATE TRIGGER IF NOT EXISTS ingest_receipts_version BEFORE INSERT ON ingest_receipts
WHEN NEW.data_version IS NOT (SELECT data_version FROM learning_state WHERE owner_id = NEW.owner_id)
BEGIN
  SELECT RAISE(ABORT, 'INVALID_RECEIPT_VERSION');
END;

CREATE TABLE IF NOT EXISTS processing_jobs (
  job_id TEXT PRIMARY KEY NOT NULL,
  receipt_id TEXT NOT NULL REFERENCES ingest_receipts(receipt_id),
  owner_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  data_version INTEGER NOT NULL CHECK (typeof(data_version) = 'integer' AND data_version >= 1),
  job_type TEXT NOT NULL DEFAULT 'process_event' CHECK (job_type = 'process_event'),
  rule_version TEXT NOT NULL DEFAULT 'v1',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'needs_attention')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (typeof(attempts) = 'integer' AND attempts >= 0),
  next_attempt_at TEXT NOT NULL CHECK (julianday(next_attempt_at) IS NOT NULL),
  lease_until TEXT,
  last_error_code TEXT,
  created_at TEXT NOT NULL CHECK (julianday(created_at) IS NOT NULL),
  FOREIGN KEY (event_id, owner_id) REFERENCES learning_events(event_id, owner_id),
  FOREIGN KEY (event_id, revision) REFERENCES event_revisions(event_id, revision),
  FOREIGN KEY (receipt_id, owner_id, event_id, revision, data_version) REFERENCES ingest_receipts(receipt_id, owner_id, event_id, revision, data_version),
  UNIQUE (event_id, revision, job_type, rule_version)
);

CREATE INDEX IF NOT EXISTS processing_jobs_pending ON processing_jobs(status, next_attempt_at);
