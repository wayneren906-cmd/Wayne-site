-- Content-free ledger; no seed data or production application.
CREATE TABLE IF NOT EXISTS deleted_learning_events (
 owner_id TEXT NOT NULL REFERENCES users(user_id), event_id TEXT NOT NULL,
 source_type TEXT NOT NULL, source_record_id TEXT,
 deleted_revision INTEGER NOT NULL CHECK (typeof(deleted_revision)='integer' AND deleted_revision>=1),
 data_version INTEGER NOT NULL CHECK (typeof(data_version)='integer' AND data_version>=1),
 deleted_at TEXT NOT NULL CHECK (julianday(deleted_at) IS NOT NULL),
 idempotency_key TEXT NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 255),
 PRIMARY KEY(owner_id,event_id), UNIQUE(owner_id,idempotency_key), UNIQUE(owner_id,source_type,source_record_id)
);
CREATE TABLE IF NOT EXISTS deleted_learning_keys (
 owner_id TEXT NOT NULL, credential_key TEXT NOT NULL,
 operation TEXT NOT NULL CHECK (operation IN ('events:create','events:correct')),
 idempotency_key TEXT NOT NULL, event_id TEXT NOT NULL,
 PRIMARY KEY(owner_id,credential_key,operation,idempotency_key),
 FOREIGN KEY(owner_id,event_id) REFERENCES deleted_learning_events(owner_id,event_id)
);
CREATE TRIGGER IF NOT EXISTS learning_events_no_resurrection BEFORE INSERT ON learning_events
WHEN EXISTS (SELECT 1 FROM deleted_learning_events d WHERE d.owner_id=NEW.owner_id
 AND (d.event_id=NEW.event_id OR (d.source_type=NEW.source_type AND d.source_record_id=NEW.source_record_id)))
BEGIN SELECT RAISE(ABORT,'EVENT_DELETED'); END;
CREATE TRIGGER IF NOT EXISTS learning_events_no_deleted_update BEFORE UPDATE ON learning_events
WHEN EXISTS (SELECT 1 FROM deleted_learning_events WHERE owner_id=NEW.owner_id AND event_id=NEW.event_id)
BEGIN SELECT RAISE(ABORT,'EVENT_DELETED'); END;
CREATE TRIGGER IF NOT EXISTS event_revisions_no_resurrection BEFORE INSERT ON event_revisions
WHEN EXISTS (SELECT 1 FROM deleted_learning_events WHERE owner_id=NEW.owner_id AND event_id=NEW.event_id)
BEGIN SELECT RAISE(ABORT,'EVENT_DELETED'); END;
CREATE TRIGGER IF NOT EXISTS ingest_receipts_no_resurrection BEFORE INSERT ON ingest_receipts
WHEN EXISTS (SELECT 1 FROM deleted_learning_events WHERE owner_id=NEW.owner_id AND event_id=NEW.event_id)
 OR EXISTS (SELECT 1 FROM deleted_learning_keys WHERE owner_id=NEW.owner_id AND credential_key=NEW.credential_key
 AND operation=NEW.operation AND idempotency_key=NEW.idempotency_key)
BEGIN SELECT RAISE(ABORT,'EVENT_DELETED'); END;
CREATE TRIGGER IF NOT EXISTS processing_jobs_no_resurrection BEFORE INSERT ON processing_jobs
WHEN EXISTS (SELECT 1 FROM deleted_learning_events WHERE owner_id=NEW.owner_id AND event_id=NEW.event_id)
BEGIN SELECT RAISE(ABORT,'EVENT_DELETED'); END;
CREATE TRIGGER IF NOT EXISTS processing_jobs_no_deleted_completion BEFORE UPDATE ON processing_jobs
WHEN EXISTS (SELECT 1 FROM deleted_learning_events WHERE owner_id=NEW.owner_id AND event_id=NEW.event_id)
BEGIN SELECT RAISE(ABORT,'EVENT_DELETED'); END;
