-- Additive private foundation: no seed data and no changes to records/snapshots.
-- Apply only to an isolated local test database until a production migration is authorized.
CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY NOT NULL CHECK (length(user_id) BETWEEN 1 AND 255),
  identity_issuer TEXT NOT NULL CHECK (length(identity_issuer) > 0),
  identity_subject TEXT NOT NULL CHECK (length(identity_subject) BETWEEN 1 AND 255),
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  status TEXT NOT NULL DEFAULT 'disabled' CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL CHECK (julianday(created_at) IS NOT NULL),
  UNIQUE (identity_issuer, identity_subject)
);

CREATE TABLE IF NOT EXISTS integration_grants (
  grant_id TEXT PRIMARY KEY NOT NULL CHECK (length(grant_id) BETWEEN 1 AND 255),
  owner_id TEXT NOT NULL REFERENCES users(user_id),
  token_sha256 TEXT NOT NULL UNIQUE CHECK (length(token_sha256) = 64 AND token_sha256 NOT GLOB '*[^0-9a-f]*'),
  scopes TEXT NOT NULL CHECK (json_valid(scopes) AND json_type(scopes) = 'array' AND length(scopes) <= 512),
  expires_at INTEGER NOT NULL CHECK (typeof(expires_at) = 'integer' AND expires_at >= 0),
  revoked_at TEXT CHECK (revoked_at IS NULL OR julianday(revoked_at) IS NOT NULL),
  created_at TEXT NOT NULL CHECK (julianday(created_at) IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS learning_events (
  event_id TEXT PRIMARY KEY NOT NULL CHECK (length(event_id) BETWEEN 1 AND 255),
  owner_id TEXT NOT NULL REFERENCES users(user_id),
  source_type TEXT NOT NULL CHECK (length(trim(source_type)) BETWEEN 1 AND 80),
  source_record_id TEXT CHECK (source_record_id IS NULL OR length(trim(source_record_id)) BETWEEN 1 AND 255),
  kind TEXT NOT NULL CHECK (kind IN ('learning_activity', 'historical_summary', 'user_correction')),
  occurred_at TEXT,
  time_precision TEXT NOT NULL DEFAULT 'unknown' CHECK (time_precision IN ('exact', 'date', 'unknown')),
  received_at TEXT NOT NULL CHECK (julianday(received_at) IS NOT NULL),
  study_day TEXT CHECK (
    study_day IS NULL OR (
      study_day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
      AND date(study_day, '+0 days') IS NOT NULL
      AND date(study_day, '+0 days') = study_day
    )
  ),
  study_day_override_reason TEXT CHECK (
    study_day_override_reason IS NULL OR (length(trim(study_day_override_reason)) BETWEEN 1 AND 1000 AND study_day IS NOT NULL)
  ),
  evidence_status TEXT NOT NULL DEFAULT 'unknown' CHECK (evidence_status IN ('unknown', 'self_reported', 'artifact_checked')),
  assistance TEXT NOT NULL DEFAULT 'unknown' CHECK (assistance IN ('unknown', 'none', 'concept_hint', 'code_outline', 'full_solution')),
  execution_mode TEXT NOT NULL DEFAULT 'unknown' CHECK (execution_mode IN ('unknown', 'reading', 'simulated_analysis', 'local_run', 'hardware_run')),
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility = 'private'),
  current_revision INTEGER NOT NULL DEFAULT 1 CHECK (typeof(current_revision) = 'integer' AND current_revision >= 1),
  UNIQUE (event_id, owner_id),
  UNIQUE (owner_id, source_type, source_record_id),
  CHECK (
    (time_precision = 'unknown' AND occurred_at IS NULL AND (study_day IS NULL OR study_day_override_reason IS NOT NULL))
    OR (time_precision = 'date' AND occurred_at IS NULL AND study_day IS NOT NULL)
    OR (time_precision = 'exact' AND occurred_at IS NOT NULL AND julianday(occurred_at) IS NOT NULL AND study_day IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS learning_events_owner_day ON learning_events(owner_id, study_day, event_id);

CREATE TABLE IF NOT EXISTS event_revisions (
  event_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (typeof(revision) = 'integer' AND revision >= 1),
  supersedes_revision INTEGER,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json) AND json_type(payload_json) = 'object'),
  actor_user_id TEXT NOT NULL REFERENCES users(user_id),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 1000),
  created_at TEXT NOT NULL CHECK (julianday(created_at) IS NOT NULL),
  PRIMARY KEY (event_id, revision),
  FOREIGN KEY (event_id, owner_id) REFERENCES learning_events(event_id, owner_id),
  FOREIGN KEY (event_id, supersedes_revision) REFERENCES event_revisions(event_id, revision),
  CHECK (actor_user_id = owner_id),
  CHECK ((revision = 1 AND supersedes_revision IS NULL) OR (revision > 1 AND supersedes_revision IS NOT NULL AND supersedes_revision = revision - 1))
);

CREATE TABLE IF NOT EXISTS learning_state (
  owner_id TEXT PRIMARY KEY NOT NULL REFERENCES users(user_id),
  data_version INTEGER NOT NULL DEFAULT 0 CHECK (typeof(data_version) = 'integer' AND data_version >= 0),
  updated_at TEXT NOT NULL CHECK (julianday(updated_at) IS NOT NULL)
);
