-- Migration 0009: allow the fixed Wayneo project id in studio_project_records.
--
-- Why the tables are rebuilt: the project_id CHECK written in 0006 only accepts the three
-- original ids, and SQLite cannot change a CHECK constraint in place. 0006 is already applied
-- in shared environments and must not be edited. No seed row is written here: no draft, no
-- published snapshot and no receipt is inserted, so the public projection stays empty until
-- the owner saves and confirms a publication.
--
-- Transaction requirements (verified against the Cloudflare D1 SQL/foreign-keys docs):
--  * D1 applies a migration file inside an implicit transaction. Do not add BEGIN/COMMIT in a
--    D1 migration.
--  * D1 does not allow disabling foreign key enforcement (PRAGMA foreign_keys=OFF is not
--    available). PRAGMA defer_foreign_keys=on is the supported switch: it postpones constraint
--    checks to the end of the enclosing transaction and resets automatically on COMMIT.
--  * To validate this file with a plain sqlite3 build, wrap the whole file in a transaction so
--    the PRAGMA runs inside it:  BEGIN; <this file> COMMIT;
--  * Step order matters: the old child table is dropped before the old parent table, the rebuilt
--    parent is renamed before the rebuilt child, and the temp child references the temp parent so
--    that SQLite rewrites the reference to the final name on RENAME (SQLite >= 3.25). The guard in
--    step 5 aborts the migration if that reference was not rewritten.
--
-- Scope: only studio_project_records and studio_project_receipts are touched. The FK target users,
-- every other table and every other migration are left untouched.
PRAGMA defer_foreign_keys=on;

-- 1) Rebuilt parent: identical columns, checks and defaults to 0006, with 'wayneo' added to the
--    project_id CHECK. Any other project id is still rejected by the constraint.
CREATE TABLE studio_project_records_new (
 owner_id TEXT NOT NULL REFERENCES users(user_id),
 project_id TEXT NOT NULL CHECK (project_id IN ('c-engine','embedded-controller','automotive-bus','wayneo')),
 revision INTEGER NOT NULL CHECK (typeof(revision)='integer' AND revision BETWEEN 1 AND 9007199254740990),
 draft_json TEXT NOT NULL CHECK (json_valid(draft_json) AND json_type(draft_json)='object'),
 private_note TEXT NOT NULL DEFAULT '' CHECK (length(private_note)<=2000),
 updated_at TEXT NOT NULL CHECK (julianday(updated_at) IS NOT NULL),
 published_revision INTEGER,
 published_json TEXT CHECK (published_json IS NULL OR (json_valid(published_json) AND json_type(published_json)='object')),
 published_at TEXT,
 PRIMARY KEY (owner_id,project_id),
 CHECK ((published_revision IS NULL AND published_json IS NULL AND published_at IS NULL)
   OR (published_revision IS NOT NULL AND typeof(published_revision)='integer' AND published_revision BETWEEN 1 AND revision AND published_json IS NOT NULL AND published_at IS NOT NULL AND julianday(published_at) IS NOT NULL))
);

-- 2) Rebuilt child: same columns, checks and composite FK shape as 0006, pointing at the rebuilt
--    parent while the rebuild is in progress.
CREATE TABLE studio_project_receipts_new (
 owner_id TEXT NOT NULL REFERENCES users(user_id),
 idempotency_key TEXT NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 255),
 project_id TEXT NOT NULL,
 payload_sha256 TEXT NOT NULL CHECK (length(payload_sha256)=64 AND payload_sha256 NOT GLOB '*[^0-9a-f]*'),
 action TEXT NOT NULL CHECK (action IN ('save_draft','publish','unpublish')),
 revision INTEGER NOT NULL CHECK (typeof(revision)='integer' AND revision BETWEEN 1 AND 9007199254740990),
 PRIMARY KEY (owner_id,idempotency_key),
 FOREIGN KEY (owner_id,project_id) REFERENCES studio_project_records_new(owner_id,project_id)
);

-- 3) Copy every private draft, publication pointer, private note and receipt, including the stored
--    payload_sha256 values so existing idempotency hashes keep matching. Nothing is rewritten.
INSERT INTO studio_project_records_new(owner_id,project_id,revision,draft_json,private_note,updated_at,published_revision,published_json,published_at)
 SELECT owner_id,project_id,revision,draft_json,private_note,updated_at,published_revision,published_json,published_at FROM studio_project_records;
INSERT INTO studio_project_receipts_new(owner_id,idempotency_key,project_id,payload_sha256,action,revision)
 SELECT owner_id,idempotency_key,project_id,payload_sha256,action,revision FROM studio_project_receipts;

-- 4) Drop the old child first, then the old parent, then move the rebuilt pair into the original
--    names. Dropping a table also drops the 0006 triggers attached to it.
DROP TABLE studio_project_receipts;
DROP TABLE studio_project_records;
ALTER TABLE studio_project_records_new RENAME TO studio_project_records;
ALTER TABLE studio_project_receipts_new RENAME TO studio_project_receipts;

-- 5) Fail loudly if the rebuilt receipts table still references the temporary parent name.
--    json() on a non-JSON literal raises an error and aborts the migration.
SELECT CASE WHEN (SELECT sql FROM sqlite_master WHERE type='table' AND name='studio_project_receipts') LIKE '%studio_project_records_new%'
 THEN json('studio_project_receipts still references the temporary table') ELSE 1 END AS project_receipts_fk_guard;

-- 6) Recreate the four authority/version triggers unchanged from 0006.
CREATE TRIGGER IF NOT EXISTS studio_project_insert_authority BEFORE INSERT ON studio_project_records
WHEN NOT EXISTS (SELECT 1 FROM users WHERE user_id=NEW.owner_id AND role='owner' AND status='active')
BEGIN
 SELECT RAISE(ABORT,'PRIVATE_ACCESS_DENIED');
END;
CREATE TRIGGER IF NOT EXISTS studio_project_update_authority BEFORE UPDATE ON studio_project_records
WHEN NEW.owner_id IS NOT OLD.owner_id OR NEW.project_id IS NOT OLD.project_id
 OR NOT EXISTS (SELECT 1 FROM users WHERE user_id=NEW.owner_id AND role='owner' AND status='active')
BEGIN
 SELECT RAISE(ABORT,'PRIVATE_ACCESS_DENIED');
END;
CREATE TRIGGER IF NOT EXISTS studio_project_receipt_authority BEFORE INSERT ON studio_project_receipts
WHEN NOT EXISTS (SELECT 1 FROM users WHERE user_id=NEW.owner_id AND role='owner' AND status='active')
BEGIN
 SELECT RAISE(ABORT,'PRIVATE_ACCESS_DENIED');
END;
CREATE TRIGGER IF NOT EXISTS studio_project_receipt_version BEFORE INSERT ON studio_project_receipts
WHEN NEW.revision IS NOT (SELECT revision FROM studio_project_records WHERE owner_id=NEW.owner_id AND project_id=NEW.project_id)
BEGIN
 SELECT RAISE(ABORT,'INVALID_PROJECT_RECEIPT_VERSION');
END;
