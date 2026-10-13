import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as events from '../lib/learning/events.ts';
import * as reads from '../lib/learning/reads.ts';
import {verifyLearningGrant, verifyLearningOwner} from '../lib/learning/auth.ts';
import {fixture, input, now, token, signedOwner} from './helpers/learning-fixture.mjs';

// Namespace lookup makes the initial RED assertion about absent behavior explicit.
const correct = async (...args) => {
  assert.equal(typeof events.correctLearningEvent, 'function', 'correction service must exist');
  return events.correctLearningEvent(...args);
};
const history = async (...args) => {
  assert.equal(typeof reads.getLearningEventHistory, 'function', 'history service must exist');
  return reads.getLearningEventHistory(...args);
};
const replacement = (key = 'synthetic-correction', expected = 1) => {
  const {schema_version, idempotency_key, ...event} = input();
  return {schema_version, idempotency_key: key, expected_revision: expected, reason: 'synthetic factual correction',
    event: {...event, content: {summary: 'synthetic corrected fact'}, occurred_at: '2026-10-13T05:59:59+08:00', time_precision: 'exact'}};
};
const snapshot = sqlite => Object.fromEntries(['learning_state', 'learning_events', 'event_revisions', 'ingest_receipts', 'processing_jobs'].map(table => [table, sqlite.prepare(`SELECT * FROM ${table}`).all()]));
async function setup(t) {
  const f = await fixture(t, ['events:write', 'events:correct', 'events:read', 'context:read']);
  return {...f, saved: await events.saveLearningEvent(f.db, f.identity, input(), {now})};
}

test('C2-C correction atomically advances revision, receipt, version and job; history preserves original facts', async t => {
  const {db, sqlite, identity, saved} = await setup(t);
  const changed = await correct(db, identity, saved.event_id, replacement(), {now: new Date(now.getTime() + 1000)});
  assert.equal(changed.revision, 2); assert.equal(changed.data_version, 2); assert.equal(changed.study_day, '2026-10-12');
  assert.equal(changed.replayed, false); assert.equal(changed.processing_status, 'pending');
  const current = await reads.getLearningEvent(db, identity, saved.event_id, {now});
  assert.equal(current.content.summary, 'synthetic corrected fact'); assert.equal(current.received_at, saved.received_at);
  const h = await history(db, identity, saved.event_id, {}, {now});
  assert.equal(h.current_revision, 2); assert.equal(h.data_version, 2); assert.equal(h.next_before_revision, null);
  assert.deepEqual(h.revisions.map(r => [r.event.revision, r.event.content.summary, r.event.study_day, r.supersedes_revision]),
    [[2, 'synthetic corrected fact', '2026-10-12', 1], [1, 'synthetic private fact', null, null]]);
  assert.equal(h.revisions[0].reason, 'synthetic factual correction');
  assert.equal(h.revisions[0].created_at, '2026-10-13T12:00:01.000Z');
  const text = JSON.stringify(h);
  for (const key of ['owner_id', 'actor_user_id', 'payload_json', 'idempotency_key', 'test_run_id']) assert.ok(!text.includes(key));
  const rows = snapshot(sqlite);
  assert.equal(rows.learning_events.length, 1);
  for (const table of ['event_revisions', 'ingest_receipts', 'processing_jobs']) assert.equal(rows[table].length, 2);
  assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), []);
});

test('C2-C original receipts replay after later revisions; changed CAS/reason/event conflict under the same key', async t => {
  const {db, sqlite, identity, saved} = await setup(t);
  const first = await correct(db, identity, saved.event_id, replacement(), {now});
  await correct(db, identity, saved.event_id, replacement('synthetic-next', 2), {now});
  const before = snapshot(sqlite);
  assert.deepEqual(await correct(db, identity, saved.event_id, replacement(), {now}), {...first, replayed: true});
  assert.deepEqual(await events.saveLearningEvent(db, identity, input(), {now}), {...saved, replayed: true});
  for (const [id, value] of [[saved.event_id, {...replacement(), reason: 'changed reason'}], [saved.event_id, replacement('synthetic-correction', 2)], ['missing', replacement()], [saved.event_id, {...replacement(), event: {...replacement().event, content: {summary: 'different'}}}]]) {
    await assert.rejects(correct(db, identity, id, value, {now}), {code: 'IDEMPOTENCY_CONFLICT'});
  }
  await assert.rejects(correct(db, identity, saved.event_id, replacement('stale', 1), {now}), {code: 'REVISION_CONFLICT'});
  assert.deepEqual(snapshot(sqlite), before);
});

test('C2-C source/kind, actor/visibility injection, empty reason and invalid CAS cannot mutate', async t => {
  const {db, sqlite, identity, saved} = await setup(t); const before = snapshot(sqlite);
  for (const value of [
    {...replacement(), reason: ' '}, {...replacement(), expected_revision: 0}, {...replacement(), expected_revision: 1.2},
    {...replacement(), expected_revision: Number.MAX_SAFE_INTEGER + 1}, {...replacement(), actor_user_id: 'synthetic-other'},
    {...replacement(), event: {...replacement().event, visibility: 'public'}},
    {...replacement(), event: {...replacement().event, evidence_status: 'artifact_checked'}},
  ]) await assert.rejects(correct(db, identity, saved.event_id, value, {now}), {code: 'INVALID_INPUT'});
  for (const event of [{...replacement().event, source: {type: 'studio_supplement', record_id: null}}, {...replacement().event, source: {type: 'studio', record_id: 'changed'}}, {...replacement().event, kind: 'historical_summary'}]) {
    await assert.rejects(correct(db, identity, saved.event_id, {...replacement(), event}, {now}), {code: 'REVISION_CONFLICT'});
  }
  await assert.rejects(correct(db, identity, saved.event_id, {...replacement(), reason: 'x'.repeat(65537)}, {now}), {code: 'PAYLOAD_TOO_LARGE'});
  assert.deepEqual(snapshot(sqlite), before);
});

test('C2-C correction-only grants work; write-only, forged and foreign identities cannot correct/read history', async t => {
  const {db, sqlite, identity, saved} = await setup(t);
  sqlite.prepare('UPDATE integration_grants SET scopes=?').run('["events:correct"]');
  const correctionOnly = await verifyLearningGrant(token, db, now.getTime()/1000);
  assert.equal((await correct(db, correctionOnly, saved.event_id, replacement(), {now})).revision, 2);
  await assert.rejects(events.saveLearningEvent(db, correctionOnly, input('no-write'), {now}), {code: 'PRIVATE_ACCESS_DENIED'});
  await assert.rejects(history(db, correctionOnly, saved.event_id, {}, {now}), {code: 'PRIVATE_ACCESS_DENIED'});
  const before = snapshot(sqlite);
  await assert.rejects(correct(db, JSON.parse(JSON.stringify(identity)), saved.event_id, replacement(), {now}), {code: 'PRIVATE_ACCESS_DENIED'});
  sqlite.prepare('UPDATE integration_grants SET scopes=?').run('["events:write"]');
  const writeOnly = await verifyLearningGrant(token, db, now.getTime()/1000);
  await assert.rejects(correct(db, writeOnly, saved.event_id, replacement(), {now}), {code: 'PRIVATE_ACCESS_DENIED'});
  const auth = await signedOwner('synthetic-other-sub');
  const other = await verifyLearningOwner(auth.jwt, auth.config, db, auth.verification);
  await assert.rejects(correct(db, other, saved.event_id, replacement(), {now}), {code: 'REVISION_CONFLICT'});
  await assert.rejects(correct(db, other, 'missing', replacement(), {now}), {code: 'REVISION_CONFLICT'});
  assert.equal(await history(db, other, saved.event_id, {}, {now}), null);
  assert.equal(await history(db, other, 'missing', {}, {now}), null);
  assert.deepEqual(snapshot(sqlite), before);
});

test('C2-C every required correction write ABORT/IGNORE restores the entire prior state', async t => {
  const {db, sqlite, identity, saved} = await setup(t); const before = snapshot(sqlite);
  for (const [action, table] of [['UPDATE', 'learning_events'], ['UPDATE', 'learning_state'], ['INSERT', 'event_revisions'], ['INSERT', 'ingest_receipts'], ['INSERT', 'processing_jobs']]) {
    for (const failure of ["ABORT,'synthetic private diagnostic'", 'IGNORE']) {
      sqlite.exec(`CREATE TRIGGER synthetic_fail BEFORE ${action} ON ${table} BEGIN SELECT RAISE(${failure}); END`);
      await assert.rejects(correct(db, identity, saved.event_id, replacement(), {now}), {code: 'SERVICE_UNAVAILABLE'});
      assert.deepEqual(snapshot(sqlite), before); sqlite.exec('DROP TRIGGER synthetic_fail');
    }
  }
});

test('C2-C concurrent same/different correction keys cannot duplicate revisions; lost response replays safely', async t => {
  const {db, sqlite, identity, saved} = await setup(t);
  const same = await Promise.all([correct(db, identity, saved.event_id, replacement(), {now}), correct(db, identity, saved.event_id, replacement(), {now})]);
  assert.equal(same[0].receipt_id, same[1].receipt_id);
  const different = await Promise.allSettled([correct(db, identity, saved.event_id, replacement('race-a', 2), {now}), correct(db, identity, saved.event_id, replacement('race-b', 2), {now})]);
  assert.equal(different.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(different.find(r => r.status === 'rejected').reason.code, 'REVISION_CONFLICT');
  const lost = {...db, async batch(s) {await db.batch(s); throw Error('synthetic lost response');}};
  assert.equal((await correct(lost, identity, saved.event_id, replacement('lost', 3), {now})).replayed, true);
  assert.equal(snapshot(sqlite).event_revisions.length, 4); assert.equal(snapshot(sqlite).processing_jobs.length, 4);
});

test('C2-C revoked/corrupted/expired grants and disabled owners reject in-batch writes and original receipt replay', async t => {
  const {db, sqlite, identity, saved} = await setup(t);
  await correct(db, identity, saved.event_id, replacement(), {now}); const before = snapshot(sqlite);
  for (const change of ["scopes='[\"events:write\"]'", "scopes='[\"events:correct\",42]'", "scopes='[\"events:correct\",\"events:correct\"]'", "scopes='[\"events:correct\",\"publish:*\"]'", `expires_at=${now.getTime()/1000}`, `revoked_at='${now.toISOString()}'`, "owner_id='synthetic-other'"]) {
    const racing = {...db, async batch(s) {sqlite.exec('UPDATE integration_grants SET ' + change); return db.batch(s);}};
    await assert.rejects(correct(racing, identity, saved.event_id, replacement('race', 2), {now}), {code: 'PRIVATE_ACCESS_DENIED'});
    await assert.rejects(correct(db, identity, saved.event_id, replacement(), {now}), {code: 'PRIVATE_ACCESS_DENIED'});
    assert.deepEqual(snapshot(sqlite), before);
    sqlite.prepare('UPDATE integration_grants SET scopes=?,expires_at=?,revoked_at=NULL,owner_id=?').run('["events:write","events:correct","events:read","context:read"]', now.getTime()/1000+3600, 'synthetic-owner');
  }
  const disabled = {...db, async batch(s) {sqlite.exec("UPDATE users SET status='disabled' WHERE user_id='synthetic-owner'"); return db.batch(s);}};
  await assert.rejects(correct(disabled, identity, saved.event_id, replacement('disabled', 2), {now}), {code: 'PRIVATE_ACCESS_DENIED'});
  assert.deepEqual(snapshot(sqlite), before);
});

test('C2-C history pagination stays bounded and deterministic; invalid cursor and missing current payload fail closed', async t => {
  const {db, sqlite, identity, saved} = await setup(t);
  for (let n = 1; n <= 12; n++) await correct(db, identity, saved.event_id, replacement('page-' + n, n), {now});
  const first = await history(db, identity, saved.event_id, {}, {now});
  assert.deepEqual(first.revisions.map(r => r.event.revision), [13,12,11,10,9,8,7,6,5,4]);
  assert.equal(first.next_before_revision, 4);
  const second = await history(db, identity, saved.event_id, {before_revision: 4}, {now});
  assert.deepEqual(second.revisions.map(r => r.event.revision), [3,2,1]); assert.equal(second.next_before_revision, null);
  assert.ok(Buffer.byteLength(JSON.stringify(first)) <= 65536);
  for (const query of [{before_revision: 0}, {before_revision: 1.2}, {owner_id: 'synthetic-other'}]) await assert.rejects(history(db, identity, saved.event_id, query, {now}), {code: 'INVALID_INPUT'});
  sqlite.exec('UPDATE learning_events SET current_revision=999');
  await assert.rejects(history(db, identity, saved.event_id, {}, {now}), {code: 'SERVICE_UNAVAILABLE'});
});

test('C2-C new authority migration is replayable and rejects unsupported receipt operations', async t => {
  const {sqlite} = await setup(t);
  const sql = readFileSync(new URL('../migrations/0004_correction_authority.sql', import.meta.url), 'utf8');
  sqlite.exec(sql); sqlite.exec(sql);
  assert.throws(() => sqlite.exec("INSERT INTO ingest_receipts SELECT 'unsupported',owner_id,grant_id,credential_key,'publish:any','unsupported',payload_sha256,event_id,revision,study_day,data_version,received_at,processing_status FROM ingest_receipts LIMIT 1"), /PRIVATE_ACCESS_DENIED/);
});

test('C2-C history rejects a corrupt current payload even when the cursor excludes that revision', async t => {
  const {db, sqlite, identity, saved} = await setup(t);
  await correct(db, identity, saved.event_id, replacement(), {now});
  sqlite.prepare('UPDATE event_revisions SET payload_json=? WHERE revision=2').run('{}');
  await assert.rejects(history(db, identity, saved.event_id, {before_revision: 2}, {now}), {code: 'SERVICE_UNAVAILABLE'});
  await assert.rejects(history(db, identity, saved.event_id, {before_revision: 1}, {now}), {code: 'SERVICE_UNAVAILABLE'});
});

test('C2-C history state and payloads share one snapshot across concurrent corrections', async t => {
  const {db, sqlite, identity, saved} = await setup(t);
  let batches = 0;
  const racing = {...db, async batch(statements) {
    batches++;
    await correct(db, identity, saved.event_id, replacement('before-history', 1), {now});
    const result = await db.batch(statements);
    await correct(db, identity, saved.event_id, replacement('after-history', 2), {now});
    return result;
  }};
  const result = await history(racing, identity, saved.event_id, {}, {now});
  assert.equal(batches, 1); assert.equal(result.data_version, 2); assert.equal(result.current_revision, 2);
  assert.deepEqual(result.revisions.map(r => r.event.revision), [2, 1]);
  assert.equal(sqlite.prepare('SELECT current_revision FROM learning_events').get().current_revision, 3);
});

test('C2-C history byte trimming keeps whole revisions and a usable next cursor', async t => {
  const {db, identity, saved} = await setup(t);
  for (let n = 1; n <= 10; n++) {
    const value = replacement('large-history-' + n, n);
    await correct(db, identity, saved.event_id, {...value, reason: '\u6d4b'.repeat(1000), event: {...value.event, content: {summary: '\u6d4b'.repeat(2000)}}}, {now});
  }
  const result = await history(db, identity, saved.event_id, {}, {now});
  assert.ok(result.revisions.length > 0 && result.revisions.length < 10);
  assert.ok(Buffer.byteLength(JSON.stringify(result)) <= 65536);
  assert.equal(result.next_before_revision, result.revisions.at(-1).event.revision);
  const next = await history(db, identity, saved.event_id, {before_revision: result.next_before_revision}, {now});
  assert.equal(next.revisions[0].event.revision, result.next_before_revision - 1);
});

test('C2-C normalized correction retries replay and database failures stay sanitized', async t => {
  const {db, sqlite, identity, saved} = await setup(t);
  const value = replacement(); value.event.knowledge_ids = ['z', 'a'];
  const receipt = await correct(db, identity, saved.event_id, value, {now});
  const normalized = {...value, reason: ' ' + value.reason + ' ', event: {...value.event, occurred_at: '2026-10-12T21:59:59Z', knowledge_ids: ['a', 'z']}};
  assert.deepEqual(await correct(db, identity, saved.event_id, normalized, {now}), {...receipt, replayed: true});
  const before = snapshot(sqlite);
  for (const faulty of [
    {prepare() {throw Error('synthetic private SQL diagnostic');}},
    {...db, async batch() {throw Error('synthetic private SQL diagnostic');}},
    {...db, async batch() {db.prepare = () => {throw Error('synthetic private SQL diagnostic');}; throw Error('synthetic response loss');}},
  ]) {
    const prepare = db.prepare;
    try {await assert.rejects(correct(faulty, identity, saved.event_id, replacement('outage', 2), {now}), e => e.code === 'SERVICE_UNAVAILABLE' && !e.message.includes('SQL diagnostic'));}
    finally {db.prepare = prepare;}
  }
  assert.deepEqual(snapshot(sqlite), before);
});
