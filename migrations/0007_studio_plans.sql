-- Plan drafts are private. A separate, explicitly published snapshot is the only public planion.
CREATE TABLE IF NOT EXISTS studio_plan_records (
 owner_id TEXT NOT NULL REFERENCES users(user_id),
 plan_id TEXT NOT NULL CHECK (plan_id IN ('personal-goals')),
 revision INTEGER NOT NULL CHECK (typeof(revision)='integer' AND revision BETWEEN 1 AND 9007199254740990),
 draft_json TEXT NOT NULL CHECK (json_valid(draft_json) AND json_type(draft_json)='object'),
 private_note TEXT NOT NULL DEFAULT '' CHECK (length(private_note)<=2000),
 updated_at TEXT NOT NULL CHECK (julianday(updated_at) IS NOT NULL),
 published_revision INTEGER,
 published_json TEXT CHECK (published_json IS NULL OR (json_valid(published_json) AND json_type(published_json)='object')),
 published_at TEXT,
 PRIMARY KEY (owner_id,plan_id),
 CHECK ((published_revision IS NULL AND published_json IS NULL AND published_at IS NULL)
   OR (published_revision IS NOT NULL AND typeof(published_revision)='integer' AND published_revision BETWEEN 1 AND revision AND published_json IS NOT NULL AND published_at IS NOT NULL AND julianday(published_at) IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS studio_plan_receipts (
 owner_id TEXT NOT NULL REFERENCES users(user_id),
 idempotency_key TEXT NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 255),
 plan_id TEXT NOT NULL,
 payload_sha256 TEXT NOT NULL CHECK (length(payload_sha256)=64 AND payload_sha256 NOT GLOB '*[^0-9a-f]*'),
 action TEXT NOT NULL CHECK (action IN ('save_draft','publish','unpublish')),
 revision INTEGER NOT NULL CHECK (typeof(revision)='integer' AND revision BETWEEN 1 AND 9007199254740990),
 PRIMARY KEY (owner_id,idempotency_key),
 FOREIGN KEY (owner_id,plan_id) REFERENCES studio_plan_records(owner_id,plan_id)
);
CREATE TRIGGER IF NOT EXISTS studio_plan_insert_authority BEFORE INSERT ON studio_plan_records
WHEN NOT EXISTS (SELECT 1 FROM users WHERE user_id=NEW.owner_id AND role='owner' AND status='active')
BEGIN
 SELECT RAISE(ABORT,'PRIVATE_ACCESS_DENIED');
END;
CREATE TRIGGER IF NOT EXISTS studio_plan_update_authority BEFORE UPDATE ON studio_plan_records
WHEN NEW.owner_id IS NOT OLD.owner_id OR NEW.plan_id IS NOT OLD.plan_id
 OR NOT EXISTS (SELECT 1 FROM users WHERE user_id=NEW.owner_id AND role='owner' AND status='active')
BEGIN
 SELECT RAISE(ABORT,'PRIVATE_ACCESS_DENIED');
END;
CREATE TRIGGER IF NOT EXISTS studio_plan_receipt_authority BEFORE INSERT ON studio_plan_receipts
WHEN NOT EXISTS (SELECT 1 FROM users WHERE user_id=NEW.owner_id AND role='owner' AND status='active')
BEGIN
 SELECT RAISE(ABORT,'PRIVATE_ACCESS_DENIED');
END;
CREATE TRIGGER IF NOT EXISTS studio_plan_receipt_version BEFORE INSERT ON studio_plan_receipts
WHEN NEW.revision IS NOT (SELECT revision FROM studio_plan_records WHERE owner_id=NEW.owner_id AND plan_id=NEW.plan_id)
BEGIN
 SELECT RAISE(ABORT,'INVALID_PLAN_RECEIPT_VERSION');
END;
