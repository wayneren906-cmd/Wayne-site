import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {verifyLearningGrant, verifyLearningOwner} from '../lib/learning/auth.ts';
import {saveLearningEvent} from '../lib/learning/events.ts';

const now = new Date('2026-10-13T12:00:00Z');
const token = 'c'.repeat(64); // Synthetic credential, never used against a real endpoint.
const input = (key = 'synthetic-key', source = null) => ({schema_version: 1, idempotency_key: key, source: {type: 'studio', record_id: source}, kind: 'learning_activity', occurred_at: null, time_precision: 'unknown', study_day_override: null, content: {summary: '合成练习，仅用于测试'}, evidence_status: 'self_reported', assistance: 'unknown', execution_mode: 'unknown', knowledge_ids: [], plan_id: null, test_run_id: 'synthetic-c2a'});

async function fixture(t) {
  const sqlite = new DatabaseSync(':memory:'); t.after(() => sqlite.close());
  sqlite.exec('PRAGMA foreign_keys=ON');
  for (const file of ['0001_initial.sql', '0002_learning_events.sql', '0003_ingest_outbox.sql', '0004_correction_authority.sql', '0005_private_deletion.sql']) sqlite.exec(readFileSync(new URL('../migrations/' + file, import.meta.url), 'utf8'));
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name IN ('ingest_receipts','processing_jobs')").get().n, 2, 'receipt/outbox migration must exist');
  sqlite.prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').run('synthetic-owner', 'https://synthetic.cloudflareaccess.com', 'synthetic-sub', 'owner', 'active', now.toISOString());
  sqlite.prepare('INSERT INTO integration_grants(grant_id,owner_id,token_sha256,scopes,expires_at,created_at) VALUES(?,?,?,?,?,?)').run('synthetic-grant', 'synthetic-owner', createHash('sha256').update(token).digest('hex'), '["events:write"]', now.getTime()/1000 + 3600, now.toISOString());
  const db = {prepare(sql) {
    let args = []; const statement = sqlite.prepare(sql);
    const execute = () => statement.columns().length ? {results: statement.all(...args), meta: {changes: 0}} : {results: [], meta: {changes: Number(statement.run(...args).changes)}};
    return {bind(...values) {args = values; return this;}, async first() {return statement.get(...args) ?? null;}, execute};
  }, async batch(statements) {
    sqlite.exec('BEGIN IMMEDIATE');
    try {const results = statements.map(statement => statement.execute()); sqlite.exec('COMMIT'); return results;} catch (error) {sqlite.exec('ROLLBACK'); throw error;}
  }};
  const identity = await verifyLearningGrant(token, db, now.getTime()/1000);
  const snapshot = () => Object.fromEntries(['learning_state','learning_events','event_revisions','ingest_receipts','processing_jobs','records','snapshots'].map(table => [table, sqlite.prepare(`SELECT * FROM ${table}`).all()]));
  return {sqlite, db, identity, snapshot};
}

test('C2-A persists event, revision, receipt, version and outbox together with private unknown defaults', async t => {
  const {sqlite, db, identity, snapshot} = await fixture(t);
  const receipt = await saveLearningEvent(db, identity, input(), {now});
  assert.equal(receipt.saved, true); assert.equal(receipt.replayed, false); assert.equal(receipt.data_version, 1); assert.equal(receipt.study_day, null); assert.equal(receipt.processing_status, 'pending');
  const rows = snapshot();
  for (const table of ['learning_state','learning_events','event_revisions','ingest_receipts','processing_jobs']) assert.equal(rows[table].length, 1);
  assert.equal(rows.learning_events[0].visibility, 'private'); assert.equal(rows.learning_events[0].occurred_at, null);
  assert.equal(rows.learning_events[0].current_revision, rows.event_revisions[0].revision);
  assert.equal(rows.processing_jobs[0].data_version, receipt.data_version);
  assert.equal(rows.records.length, 0); assert.equal(rows.snapshots.length, 0);
  assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), []);
});

test('C2-A retries return the original receipt without mutations; changed payload conflicts', async t => {
  const {db, identity, snapshot} = await fixture(t);
  const first = await saveLearningEvent(db, identity, input(), {now}); const before = snapshot();
  const again = await saveLearningEvent(db, identity, {...input(), content: {summary: ' 合成练习，仅用于测试 '}}, {now: new Date(now.getTime() + 1000)});
  assert.deepEqual(again, {...first, replayed: true}); assert.deepEqual(snapshot(), before);
  await assert.rejects(saveLearningEvent(db, identity, {...input(), content: {summary: 'different synthetic content'}}, {now}), {code: 'IDEMPOTENCY_CONFLICT'});
  assert.deepEqual(snapshot(), before);
});

test('C2-A concurrent same-key delivery saves once; separate real events on the same day remain distinct', async t => {
  const {db, identity, snapshot} = await fixture(t);
  const first = {...input(), occurred_at: '2026-10-13T10:00:00+08:00', time_precision: 'exact'};
  const receipts = await Promise.all([saveLearningEvent(db, identity, first, {now}), saveLearningEvent(db, identity, first, {now})]);
  assert.equal(receipts[0].event_id, receipts[1].event_id); assert.equal(snapshot().learning_events.length, 1);
  await saveLearningEvent(db, identity, {...first, idempotency_key: 'synthetic-second', occurred_at: '2026-10-13T11:00:00+08:00'}, {now});
  assert.equal(snapshot().learning_events.length, 2); assert.equal(snapshot().learning_state[0].data_version, 2);
  assert.ok(snapshot().learning_events.every(event => event.study_day === '2026-10-13'));
});

test('C2-A a failed required insert rolls back all new rows and restores an existing version', async t => {
  const {sqlite, db, identity, snapshot} = await fixture(t);
  await saveLearningEvent(db, identity, input(), {now}); const before = snapshot();
  for (const target of ['learning_state', 'learning_events', 'event_revisions', 'ingest_receipts', 'processing_jobs']) {
    sqlite.exec(`CREATE TRIGGER synthetic_fail BEFORE INSERT ON ${target} BEGIN SELECT RAISE(ABORT,'synthetic failure'); END`);
    await assert.rejects(saveLearningEvent(db, identity, input('synthetic-failed'), {now}), {code: 'SERVICE_UNAVAILABLE'});
    assert.deepEqual(snapshot(), before); sqlite.exec('DROP TRIGGER synthetic_fail');
  }
  const recovered = await saveLearningEvent(db, identity, input('synthetic-failed'), {now}); assert.equal(recovered.data_version, 2);
});

test('C2-A a required write affecting zero rows also aborts the entire batch', async t => {
  const {sqlite, db, identity, snapshot} = await fixture(t);
  await saveLearningEvent(db, identity, input(), {now}); const before = snapshot();
  for (const target of ['learning_state', 'learning_events', 'event_revisions', 'ingest_receipts', 'processing_jobs']) {
    sqlite.exec(`CREATE TRIGGER synthetic_skip BEFORE INSERT ON ${target} BEGIN SELECT RAISE(IGNORE); END`);
    await assert.rejects(saveLearningEvent(db, identity, input('synthetic-skipped'), {now}), {code: 'SERVICE_UNAVAILABLE'});
    assert.deepEqual(snapshot(), before); sqlite.exec('DROP TRIGGER synthetic_skip');
  }
});

test('C2-A failed and ignored existing state updates cannot commit an event or advance the version', async t => {
  const {sqlite, db, identity, snapshot} = await fixture(t);
  await saveLearningEvent(db, identity, input(), {now}); const before = snapshot();
  for (const failure of ["ABORT,'synthetic update failure'", 'IGNORE']) {
    sqlite.exec(`CREATE TRIGGER synthetic_update BEFORE UPDATE ON learning_state BEGIN SELECT RAISE(${failure}); END`);
    await assert.rejects(saveLearningEvent(db, identity, input('synthetic-update'), {now}), {code: 'SERVICE_UNAVAILABLE'});
    assert.deepEqual(snapshot(), before); sqlite.exec('DROP TRIGGER synthetic_update');
  }
});

test('C2-A concurrent changed payloads yield one receipt and one conflict without extra rows', async t => {
  const {db, identity, snapshot} = await fixture(t);
  const outcomes = await Promise.allSettled([
    saveLearningEvent(db, identity, input(), {now}),
    saveLearningEvent(db, identity, {...input(), content: {summary: 'different synthetic concurrent payload'}}, {now}),
  ]);
  assert.equal(outcomes.filter(value => value.status === 'fulfilled').length, 1);
  assert.equal(outcomes.find(value => value.status === 'rejected').reason.code, 'IDEMPOTENCY_CONFLICT');
  for (const table of ['learning_state', 'learning_events', 'event_revisions', 'ingest_receipts', 'processing_jobs']) assert.equal(snapshot()[table].length, 1);
  assert.equal(snapshot().learning_state[0].data_version, 1);
});

test('C2-A identical keys remain isolated between owners, owner sessions and separate grants', async t => {
  const {sqlite, db, identity, snapshot} = await fixture(t);
  const config = {CF_ACCESS_TEAM_DOMAIN: 'https://synthetic.cloudflareaccess.com', CF_ACCESS_AUD: 'synthetic-c2a', JOURNAL_OWNER_EMAIL: 'owner@example.com'};
  const pair = await crypto.subtle.generateKey({name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256'}, true, ['sign', 'verify']);
  const key = {...await crypto.subtle.exportKey('jwk', pair.publicKey), kid: 'synthetic-c2a-key'};
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const text = encode({alg: 'RS256', kid: key.kid}) + '.' + encode({iss: config.CF_ACCESS_TEAM_DOMAIN, aud: config.CF_ACCESS_AUD, exp: now.getTime()/1000 + 3600, email: config.JOURNAL_OWNER_EMAIL, sub: 'synthetic-sub'});
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(text));
  const owner = await verifyLearningOwner(text + '.' + Buffer.from(signature).toString('base64url'), config, db, {keys: [key], now: now.getTime()/1000});
  sqlite.prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').run('synthetic-other-owner', config.CF_ACCESS_TEAM_DOMAIN, 'synthetic-other-sub', 'owner', 'active', now.toISOString());
  const identities = [identity, owner];
  for (const [grantId, ownerId, credential] of [['synthetic-second-grant', 'synthetic-owner', 'e'.repeat(64)], ['synthetic-other-grant', 'synthetic-other-owner', 'f'.repeat(64)]]) {
    sqlite.prepare('INSERT INTO integration_grants(grant_id,owner_id,token_sha256,scopes,expires_at,created_at) VALUES(?,?,?,?,?,?)').run(grantId, ownerId, createHash('sha256').update(credential).digest('hex'), '["events:write"]', now.getTime()/1000 + 3600, now.toISOString());
    identities.push(await verifyLearningGrant(credential, db, now.getTime()/1000));
  }
  const receipts = [];
  for (const principal of identities) receipts.push(await saveLearningEvent(db, principal, input(), {now}));
  assert.equal(new Set(receipts.map(value => value.event_id)).size, 4);
  assert.equal(snapshot().processing_jobs.length, 4);
  assert.deepEqual(snapshot().learning_state.map(row => [row.owner_id, row.data_version]), [['synthetic-owner', 3], ['synthetic-other-owner', 1]]);
  const before = snapshot();
  for (const [index, principal] of identities.entries()) assert.deepEqual(await saveLearningEvent(db, principal, input(), {now}), {...receipts[index], replayed: true});
  assert.deepEqual(snapshot(), before);
});

test('C2-A removed permission, expired or revoked grants reject replay and transaction-time writes', async t => {
  const {sqlite, db, identity, snapshot} = await fixture(t);
  await saveLearningEvent(db, identity, input(), {now}); const before = snapshot();
  for (const change of ["scopes='[\"events:read\"]'", `expires_at=${now.getTime()/1000}`, `revoked_at='${now.toISOString()}'`]) {
    sqlite.prepare('UPDATE integration_grants SET scopes=?,expires_at=?,revoked_at=NULL').run('["events:write"]', now.getTime()/1000 + 3600);
    const racingDB = {...db, async batch(statements) {sqlite.exec(`UPDATE integration_grants SET ${change}`); return db.batch(statements);}};
    await assert.rejects(saveLearningEvent(racingDB, identity, input('synthetic-authority-race'), {now}), {code: 'PRIVATE_ACCESS_DENIED'});
    await assert.rejects(saveLearningEvent(db, identity, input(), {now}), {code: 'PRIVATE_ACCESS_DENIED'});
    assert.deepEqual(snapshot(), before);
  }
});

test('C2-A duplicate source identity never overwrites a real event', async t => {
  const {db, identity, snapshot} = await fixture(t);
  await saveLearningEvent(db, identity, input('key-1', 'synthetic-source'), {now}); const before = snapshot();
  await assert.rejects(saveLearningEvent(db, identity, input('key-2', 'synthetic-source'), {now}), {code: 'REVISION_CONFLICT'});
  assert.deepEqual(snapshot(), before);
});

test('C2-A revoked grants, forged principals and unvalidated input cannot write or replay', async t => {
  const {sqlite, db, identity, snapshot} = await fixture(t);
  await assert.rejects(saveLearningEvent(db, JSON.parse(JSON.stringify(identity)), input(), {now}), {code: 'PRIVATE_ACCESS_DENIED'});
  await assert.rejects(saveLearningEvent(db, identity, {...input(), visibility: 'public'}, {now}), {code: 'INVALID_INPUT'});
  await saveLearningEvent(db, identity, input(), {now}); const before = snapshot();
  sqlite.prepare('UPDATE integration_grants SET revoked_at=?').run(now.toISOString());
  await assert.rejects(saveLearningEvent(db, identity, input(), {now}), {code: 'PRIVATE_ACCESS_DENIED'});
  assert.deepEqual(snapshot(), before);
});

test('C2-A an authorization change immediately before the batch is rejected and rolled back', async t => {
  const {sqlite, db, identity, snapshot} = await fixture(t); const before = snapshot();
  const racingDB = {...db, async batch(statements) {sqlite.exec("UPDATE users SET status='disabled'"); return db.batch(statements);}};
  await assert.rejects(saveLearningEvent(racingDB, identity, input(), {now}), {code: 'PRIVATE_ACCESS_DENIED'});
  assert.deepEqual(snapshot(), before);
});

test('C2-A newly corrupted grant scopes cannot write or replay using a previously verified principal', async t => {
  const {sqlite, db, identity, snapshot} = await fixture(t);
  await saveLearningEvent(db, identity, input(), {now}); const before = snapshot();
  for (const scopes of [['events:write', 'publish:*'], ['events:write', 'events:write'], ['events:write', 42]]) {
    sqlite.prepare('UPDATE integration_grants SET scopes=?').run(JSON.stringify(scopes));
    for (const key of ['synthetic-key', 'synthetic-new']) {
      await assert.rejects(saveLearningEvent(db, identity, input(key), {now}), {code: 'PRIVATE_ACCESS_DENIED'});
      assert.deepEqual(snapshot(), before);
    }
  }
});

test('C2-A grant scope corruption immediately before the batch rolls back every row', async t => {
  const {sqlite, db, identity, snapshot} = await fixture(t); const before = snapshot();
  const racingDB = {...db, async batch(statements) {
    sqlite.exec(`UPDATE integration_grants SET scopes='["events:write","publish:*"]'`);
    return db.batch(statements);
  }};
  await assert.rejects(saveLearningEvent(racingDB, identity, input(), {now}), {code: 'PRIVATE_ACCESS_DENIED'});
  assert.deepEqual(snapshot(), before);
});

test('C2-A database outages return a sanitized retryable error before writing and during recovery', async t => {
  const {db, identity, snapshot} = await fixture(t); const before = snapshot();
  const unavailable = () => {throw Error('synthetic private database diagnostic');};
  const cases = [
    {prepare: unavailable},
    {...db, prepare(sql) {
      if (sql.startsWith('SELECT receipt_id')) return {bind() {return this;}, first: unavailable};
      return db.prepare(sql);
    }},
    {...db, async batch() {this.prepare = unavailable; throw Error('synthetic connection failure');}},
  ];
  for (const offline of cases) {
    await assert.rejects(saveLearningEvent(offline, identity, input(), {now}), {code: 'SERVICE_UNAVAILABLE', message: '保存暂时不可用，请用原幂等键重试'});
    assert.deepEqual(snapshot(), before);
  }
});

test('C2-A a lost response after commit is safely recovered by the same idempotency key', async t => {
  const {db, identity, snapshot} = await fixture(t);
  const lostResponseDB = {...db, async batch(statements) {await db.batch(statements); throw Error('synthetic lost response');}};
  const receipt = await saveLearningEvent(lostResponseDB, identity, input(), {now});
  assert.equal(receipt.saved, true); assert.equal(receipt.replayed, true); assert.equal(snapshot().processing_jobs.length, 1);
});

test('C2-A delayed receipt preserves the actual study day and job versions cannot diverge from receipts', async t => {
  const {sqlite, db, identity} = await fixture(t);
  const saved = await saveLearningEvent(db, identity, {...input(), occurred_at: '2026-10-13T05:59:59+08:00', time_precision: 'exact'}, {now});
  assert.equal(saved.study_day, '2026-10-12'); assert.equal(saved.received_at, now.toISOString());
  assert.throws(() => sqlite.exec('UPDATE processing_jobs SET data_version=data_version+1'), /FOREIGN KEY/);
});
