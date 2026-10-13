import test from 'node:test';
import assert from 'node:assert/strict';
import {saveLearningEvent} from '../lib/learning/events.ts';
import * as reads from '../lib/learning/reads.ts';
import {verifyLearningGrant} from '../lib/learning/auth.ts';
import {fixture, now, input, token} from './helpers/learning-fixture.mjs';

test('C2-B current event read returns only the private DTO, not revision transport or actor fields', async t => {
  const {db, identity} = await fixture(t);
  const receipt = await saveLearningEvent(db, identity, input(), {now});
  const event = await reads.getLearningEvent(db, identity, receipt.event_id, {now});
  assert.deepEqual(event, {event_id: receipt.event_id, revision: 1, source: {type: 'studio', record_id: null}, kind: 'learning_activity', occurred_at: null, time_precision: 'unknown', received_at: now.toISOString(), study_day: null, study_day_override_reason: null, content: {summary: 'synthetic private fact'}, evidence_status: 'unknown', assistance: 'unknown', execution_mode: 'unknown', knowledge_ids: [], plan_id: null, visibility: 'private'});
});

test('C2-B missing and foreign-owner event reads have the same result; serialized identities fail', async t => {
  const {db, sqlite, identity} = await fixture(t);
  const receipt = await saveLearningEvent(db, identity, input(), {now});
  sqlite.prepare('UPDATE integration_grants SET owner_id=?').run('synthetic-other');
  const other = await verifyLearningGrant(token, db, now.getTime()/1000);
  assert.equal(await reads.getLearningEvent(db, other, receipt.event_id, {now}), null);
  assert.equal(await reads.getLearningEvent(db, other, 'missing', {now}), null);
  await assert.rejects(reads.getLearningEvent(db, JSON.parse(JSON.stringify(identity)), receipt.event_id, {now}), {code: 'PRIVATE_ACCESS_DENIED'});
});

test('C2-B context scope does not grant individual event access and write scope does not grant context', async t => {
  const {db, identity} = await fixture(t, ['context:read']);
  assert.equal((await reads.getLearningContext(db, identity, 'teaching', {now})).events.length, 0);
  await assert.rejects(reads.getLearningEvent(db, identity, 'missing', {now}), {code: 'PRIVATE_ACCESS_DENIED'});
  const second = await fixture(t, ['events:write']);
  await assert.rejects(reads.getLearningContext(second.db, second.identity, 'teaching', {now}), {code: 'PRIVATE_ACCESS_DENIED'});
});

test('C2-B reads recheck revoked, expired, disabled and corrupted grants inside the content snapshot', async t => {
  const {db, sqlite, identity} = await fixture(t);
  const receipt = await saveLearningEvent(db, identity, input(), {now});
  for (const change of ["UPDATE users SET status='disabled'", "UPDATE integration_grants SET revoked_at='2026-10-13T12:00:00Z'", `UPDATE integration_grants SET expires_at=${now.getTime()/1000}`, `UPDATE integration_grants SET scopes='["events:read"]'`, `UPDATE integration_grants SET scopes='["context:read","events:read","publish:*"]'`, `UPDATE integration_grants SET scopes='["context:read","events:read",42]'`, `UPDATE integration_grants SET scopes='["context:read","events:read","events:read"]'`]) {
    const racing = {...db, async batch(statements) {sqlite.exec(change); return db.batch(statements);}};
    await assert.rejects(reads.getLearningContext(racing, identity, 'teaching', {now}), {code: 'PRIVATE_ACCESS_DENIED'});
    if (!change.includes(`scopes='["events:read"]'`)) await assert.rejects(reads.getLearningEvent(db, identity, receipt.event_id, {now}), {code: 'PRIVATE_ACCESS_DENIED'});
    sqlite.exec("UPDATE users SET status='active'");
    sqlite.prepare('UPDATE integration_grants SET revoked_at=NULL,expires_at=?,scopes=?').run(now.getTime()/1000 + 3600, '["events:read","context:read","events:write"]');
  }
});

test('C2-B empty context reports unknown coverage and absent processing, not a new learning date or plan', async t => {
  const {db, identity} = await fixture(t);
  const context = await reads.getLearningContext(db, identity, 'teaching', {now});
  assert.equal(context.data_version, 0); assert.equal(context.latest_observed_event_at, null);
  assert.equal(context.generated_at, now.toISOString()); assert.equal(context.assessment_processed_version, 0);
  assert.equal(context.outline_version, null); assert.equal(context.policy_version, null);
  assert.deepEqual(context.covered_sources, []); assert.deepEqual(context.events, []); assert.deepEqual(context.evidence_refs, []);
  assert.ok(context.unknown_ranges.includes('chat_history_not_connected'));
  assert.ok(context.unknown_ranges.includes('assessment_not_implemented'));
});

test('C2-B bounded context keeps current version, deterministic recent events and explicit omitted/unknown ranges', async t => {
  const {db, identity} = await fixture(t);
  const ids = [];
  for (let n = 0; n < 25; n++) ids.push((await saveLearningEvent(db, identity, {...input('synthetic-' + n), content: {summary: 'synthetic ' + n}, occurred_at: n === 0 ? '2026-10-10T00:00:00Z' : null, time_precision: n === 0 ? 'exact' : 'unknown'}, {now: new Date(now.getTime() + n * 1000)})).event_id);
  const context = await reads.getLearningContext(db, identity, 'teaching', {now});
  assert.equal(context.data_version, 25); assert.equal(context.events.length, 20);
  assert.deepEqual(context.events.map(e => e.event_id), ids.slice(5).reverse());
  assert.equal(context.latest_observed_event_at, '2026-10-10T00:00:00.000Z');
  assert.deepEqual(context.covered_sources, ['studio']);
  assert.deepEqual(context.evidence_refs, context.events.map(e => ({event_id: e.event_id, revision: 1})));
  assert.ok(context.unknown_ranges.includes('older_events_omitted')); assert.ok(context.unknown_ranges.includes('event_time_unknown'));
  assert.ok(Buffer.byteLength(JSON.stringify(context)) <= 64 * 1024);
  const review = await reads.getLearningContext(db, identity, 'review', {now});
  assert.equal(review.events.length, 25);
});

test('C2-B context byte cap trims complete events and evidence refs together', async t => {
  const {db, identity} = await fixture(t);
  for (let n = 0; n < 25; n++) await saveLearningEvent(db, identity, {...input('large-' + n), content: {summary: '测'.repeat(2000)}}, {now});
  const result = await reads.getLearningContext(db, identity, 'review', {now});
  assert.ok(result.events.length > 0 && result.events.length < 25);
  assert.ok(Buffer.byteLength(JSON.stringify(result)) <= 64 * 1024);
  assert.ok(result.unknown_ranges.includes('response_size_limited'));
  assert.deepEqual(result.evidence_refs, result.events.map(e => ({event_id: e.event_id, revision: e.revision})));
});

test('C2-B reads current revision rather than receipt revision, and broken payloads/outages fail sanitized', async t => {
  const {db, sqlite, identity} = await fixture(t);
  const receipt = await saveLearningEvent(db, identity, input(), {now});
  sqlite.prepare('INSERT INTO event_revisions VALUES(?,?,?,?,?,?,?,?)').run(receipt.event_id, 'synthetic-owner', 2, 1, JSON.stringify({...input(), content: {summary: 'synthetic correction'}}), 'synthetic-owner', 'synthetic test revision', now.toISOString());
  sqlite.prepare('UPDATE learning_events SET current_revision=2 WHERE event_id=?').run(receipt.event_id);
  assert.equal((await reads.getLearningEvent(db, identity, receipt.event_id, {now})).content.summary, 'synthetic correction');
  assert.equal((await reads.getLearningEvent(db, identity, receipt.event_id, {now})).revision, 2);
  sqlite.prepare('UPDATE event_revisions SET payload_json=? WHERE revision=2').run('{}');
  await assert.rejects(reads.getLearningEvent(db, identity, receipt.event_id, {now}), {code: 'SERVICE_UNAVAILABLE'});
  const offline = {prepare() {throw Error('synthetic private SQL diagnostic');}};
  await assert.rejects(reads.getLearningContext(offline, identity, 'teaching', {now}), e => e.code === 'SERVICE_UNAVAILABLE' && !e.message.includes('SQL diagnostic'));
  await assert.rejects(reads.getLearningContext(db, identity, 'arbitrary', {now}), {code: 'INVALID_INPUT'});
});

test('C2-B context authorization, version and event selection use the same database snapshot', async t => {
  const {db, sqlite, identity} = await fixture(t);
  let batches = 0;
  const racing = {...db, async batch(statements) {
    batches++;
    await saveLearningEvent(db, identity, input('synthetic-before-snapshot'), {now});
    const results = await db.batch(statements);
    await saveLearningEvent(db, identity, input('synthetic-after-snapshot'), {now});
    return results;
  }};
  const context = await reads.getLearningContext(racing, identity, 'teaching', {now});
  assert.equal(batches, 1);
  assert.equal(context.data_version, 1); assert.equal(context.events.length, 1);
  assert.equal(context.evidence_refs.length, 1);
  assert.equal(sqlite.prepare('SELECT data_version FROM learning_state').get().data_version, 2);
});

test('C2-B missing current revision fails closed rather than returning an empty or original event', async t => {
  const {db, sqlite, identity} = await fixture(t);
  const receipt = await saveLearningEvent(db, identity, input(), {now});
  sqlite.prepare('UPDATE learning_events SET current_revision=99 WHERE event_id=?').run(receipt.event_id);
  await assert.rejects(reads.getLearningEvent(db, identity, receipt.event_id, {now}), {code: 'SERVICE_UNAVAILABLE'});
  await assert.rejects(reads.getLearningContext(db, identity, 'teaching', {now}), {code: 'SERVICE_UNAVAILABLE'});
});
