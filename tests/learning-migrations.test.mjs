import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const oldSQL = readFileSync(new URL('../migrations/0001_initial.sql', import.meta.url), 'utf8');
const newSQL = readFileSync(new URL('../migrations/0002_learning_events.sql', import.meta.url), 'utf8');
const privateTables = ['event_revisions', 'integration_grants', 'learning_events', 'learning_state', 'users'];
const now = '2026-10-13T00:00:00Z';

function fixture(t) {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(oldSQL);
  db.exec(newSQL);
  assert.deepEqual(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT IN ('records','snapshots') ORDER BY name").all().map(r => r.name), privateTables);
  return db;
}
function addUser(db, id = 'synthetic-owner') {
  db.prepare('INSERT INTO users(user_id,identity_issuer,identity_subject,role,status,created_at) VALUES(?,?,?,?,?,?)').run(id, 'https://synthetic.cloudflareaccess.com', id + '-sub', 'owner', 'active', now);
}
function addEvent(db, id, {owner = 'synthetic-owner', sourceId = id, day = '2026-10-12', occurredAt = null, precision = 'date', override = null} = {}) {
  db.prepare('INSERT INTO learning_events(event_id,owner_id,source_type,source_record_id,kind,occurred_at,time_precision,received_at,study_day,study_day_override_reason) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .run(id, owner, 'studio', sourceId, 'learning_activity', occurredAt, precision, now, day, override);
}
function addRevision(db, id, revision = 1, owner = 'synthetic-owner', previous = null) {
  db.prepare('INSERT INTO event_revisions(event_id,owner_id,revision,supersedes_revision,payload_json,actor_user_id,reason,created_at) VALUES(?,?,?,?,?,?,?,?)')
    .run(id, owner, revision, previous, JSON.stringify({summary: '明确标记的合成测试内容'}), owner, 'synthetic test', now);
}

test('C1 additive migration is repeatable, preserves legacy content and seeds no private users', t => {
  const db = fixture(t);
  db.prepare('INSERT INTO records VALUES(?,?,?,?,?)').run('2026-10-12', '[{"label":"synthetic","text":"test only"}]', 'synthetic supplement', 2, now);
  db.prepare('INSERT INTO snapshots VALUES(?,?,?)').run('2026-10-12', '[]', now);
  const before = {records: db.prepare('SELECT * FROM records').all(), snapshots: db.prepare('SELECT * FROM snapshots').all(), schema: db.prepare('SELECT name,sql FROM sqlite_master ORDER BY name').all()};
  db.exec(newSQL);
  assert.deepEqual({records: db.prepare('SELECT * FROM records').all(), snapshots: db.prepare('SELECT * FROM snapshots').all(), schema: db.prepare('SELECT name,sql FROM sqlite_master ORDER BY name').all()}, before);
  for (const table of privateTables) assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n, 0);
});

test('C1 two same-day events survive with private and unknown-evidence defaults', t => {
  const db = fixture(t); addUser(db);
  addEvent(db, 'synthetic-event-1'); addEvent(db, 'synthetic-event-2');
  const rows = db.prepare('SELECT visibility,evidence_status,assistance,execution_mode FROM learning_events').all();
  assert.equal(rows.length, 2);
  for (const row of rows) assert.deepEqual({...row}, {visibility: 'private', evidence_status: 'unknown', assistance: 'unknown', execution_mode: 'unknown'});
  addEvent(db, 'synthetic-time-unknown', {day: null, precision: 'unknown'});
  assert.equal(db.prepare("SELECT study_day FROM learning_events WHERE event_id='synthetic-time-unknown'").get().study_day, null);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM records').get().n, 0);
});

test('C1 stable identity and source constraints reject duplicates but allow separate owners', t => {
  const db = fixture(t); addUser(db); addUser(db, 'synthetic-other');
  assert.throws(() => db.prepare('INSERT INTO users(user_id,identity_issuer,identity_subject,created_at) VALUES(?,?,?,?)').run('duplicate', 'https://synthetic.cloudflareaccess.com', 'synthetic-owner-sub', now), /UNIQUE/);
  addEvent(db, 'synthetic-event-1', {sourceId: 'synthetic-source-1'});
  assert.throws(() => addEvent(db, 'synthetic-duplicate', {sourceId: 'synthetic-source-1'}), /UNIQUE/);
  addEvent(db, 'synthetic-other-event', {owner: 'synthetic-other', sourceId: 'synthetic-source-1'});
  addEvent(db, 'synthetic-without-source-1', {sourceId: null}); addEvent(db, 'synthetic-without-source-2', {sourceId: null});
});

test('C1 revisions and state cannot refer to another owner or a nonexistent predecessor', t => {
  const db = fixture(t); addUser(db); addUser(db, 'synthetic-other'); addEvent(db, 'synthetic-event-1'); addRevision(db, 'synthetic-event-1');
  assert.throws(() => addRevision(db, 'synthetic-event-1', 2, 'synthetic-other', 1), /FOREIGN KEY/);
  assert.throws(() => addRevision(db, 'synthetic-event-1', 3, 'synthetic-owner', 2), /FOREIGN KEY/);
  assert.throws(() => addRevision(db, 'synthetic-event-1', 2, 'synthetic-owner', null), /CHECK/);
  addRevision(db, 'synthetic-event-1', 2, 'synthetic-owner', 1);
  assert.throws(() => addRevision(db, 'synthetic-event-1', 2, 'synthetic-owner', 1), /UNIQUE/);
  assert.throws(() => db.prepare('INSERT INTO learning_state(owner_id,updated_at) VALUES(?,?)').run('missing-owner', now), /FOREIGN KEY/);
  db.prepare('INSERT INTO learning_state(owner_id,updated_at) VALUES(?,?)').run('synthetic-owner', now);
  assert.equal(db.prepare('SELECT data_version FROM learning_state').get().data_version, 0);
  assert.throws(() => db.exec('UPDATE learning_state SET data_version=-1'), /CHECK/);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
});

test('C1 invalid privacy, evidence, JSON, timestamps and date overrides cannot enter the schema', t => {
  const db = fixture(t); addUser(db); addEvent(db, 'synthetic-event-1'); addRevision(db, 'synthetic-event-1');
  for (const sql of ["UPDATE learning_events SET visibility='public'", "UPDATE learning_events SET evidence_status='mastered'", "UPDATE learning_events SET current_revision=0", "UPDATE learning_events SET time_precision='exact',occurred_at=NULL", "UPDATE learning_events SET study_day='2026-02-30'", "UPDATE event_revisions SET payload_json='not-json'", "UPDATE event_revisions SET payload_json='[]'"]) assert.throws(() => db.exec(sql));
  assert.throws(() => addEvent(db, 'synthetic-empty-override', {override: ''}), /CHECK/);
  assert.throws(() => addEvent(db, 'synthetic-override-without-date', {day: null, precision: 'unknown', override: 'synthetic explicit override'}), /CHECK/);
  assert.throws(() => addEvent(db, 'synthetic-unknown-pretends-date', {day: '2026-10-12', precision: 'unknown'}), /CHECK/);
  assert.throws(() => db.prepare('INSERT INTO integration_grants(grant_id,owner_id,token_sha256,scopes,expires_at,created_at) VALUES(?,?,?,?,?,?)').run('bad-token', 'synthetic-owner', 'plaintext-token', '[]', 2000, now), /CHECK/);
});

test('C1 a synthetic database can be exported and restored with all relations and values intact', t => {
  const db = fixture(t); addUser(db); addEvent(db, 'synthetic-event-1'); addRevision(db, 'synthetic-event-1');
  db.prepare('INSERT INTO learning_state(owner_id,data_version,updated_at) VALUES(?,?,?)').run('synthetic-owner', 1, now);
  const restored = fixture(t);
  const literal = value => value === null ? 'NULL' : typeof value === 'number' ? String(value) : "'" + value.replaceAll("'", "''") + "'";
  for (const table of ['users', 'integration_grants', 'learning_events', 'event_revisions', 'learning_state']) {
    const rows = db.prepare(`SELECT * FROM ${table}`).all();
    for (const row of rows) restored.exec(`INSERT INTO ${table}(${Object.keys(row).join(',')}) VALUES(${Object.values(row).map(literal).join(',')})`);
    assert.deepEqual(restored.prepare(`SELECT * FROM ${table}`).all(), rows);
  }
  assert.deepEqual(restored.prepare('PRAGMA foreign_key_check').all(), []);
  assert.equal(restored.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
});
