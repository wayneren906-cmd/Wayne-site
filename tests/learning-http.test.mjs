import test from 'node:test';
import assert from 'node:assert/strict';
import * as http from '../lib/learning/http.ts';
import {fixture, signedOwner, now, input, token} from './helpers/learning-fixture.mjs';

const origin = 'https://synthetic.invalid';
const request = (path, jwt, options = {}) => new Request(origin + path, {...options, headers: {...(jwt ? {'cf-access-jwt-assertion': jwt} : {}), ...options.headers}});
async function environment(t) {
  const {db, sqlite} = await fixture(t);
  const {config, jwt, verification} = await signedOwner();
  return {db, sqlite, jwt, env: {DB: db, ...config}, options: {now, verification}};
}
const post = (jwt, body = input(), headers = {}) => request('/api/studio/events', jwt, {method: 'POST', body: JSON.stringify(body), headers: {origin, 'content-type': 'application/json', ...headers}});

test('C2-B HTTP save, original receipt replay, event read and context share one real database loop', async t => {
  const {env, jwt, options, sqlite} = await environment(t);
  const saved = await http.handleStudioEvents(post(jwt), env, options);
  assert.equal(saved.status, 201); const receipt = await saved.json();
  assert.equal(receipt.saved, true); assert.equal(receipt.data_version, 1);
  const retry = await http.handleStudioEvents(post(jwt), env, options);
  assert.equal(retry.status, 200); assert.deepEqual(await retry.json(), {...receipt, replayed: true});
  const event = await http.handleStudioEvent(request('/api/studio/events/' + receipt.event_id, jwt), env, receipt.event_id, options);
  assert.equal(event.status, 200); assert.equal((await event.json()).content.summary, 'synthetic private fact');
  const context = await http.handleStudioContext(request('/api/studio/context?purpose=teaching', jwt), env, options);
  assert.equal(context.status, 200); assert.equal((await context.json()).events[0].event_id, receipt.event_id);
  for (const r of [saved, retry, event, context]) {assert.match(r.headers.get('cache-control'), /no-store/); assert.equal(r.headers.get('access-control-allow-origin'), null);}
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM records').get().n, 0);
});

test('C2-B HTTP anonymous, forged, expired, wrong-audience and unregistered owner tokens cannot read/write', async t => {
  const {env, jwt, options} = await environment(t);
  for (const candidate of [null, 'forged', jwt.slice(0, -10) + '0123456789']) {
    const response = await http.handleStudioContext(request('/api/studio/context', candidate), env, options);
    assert.equal(response.status, candidate === null ? 401 : 403); assert.equal((await response.json()).error.code, 'PRIVATE_ACCESS_DENIED');
    assert.equal((await http.handleStudioEvents(post(candidate), env, options)).status, candidate === null ? 401 : 403);
  }
  for (const claims of [{exp: now.getTime()/1000}, {aud: 'foreign'}, {email: 'member@example.com'}, {sub: 'unregistered'}]) {
    const auth = await signedOwner('synthetic-sub', claims);
    const result = await http.handleStudioContext(request('/api/studio/context', auth.jwt), env, {now, verification: auth.verification});
    assert.equal(result.status, 403);
  }
  const grantRequest = request('/api/studio/context', null, {headers: {authorization: 'Bearer ' + token}});
  assert.equal((await http.handleStudioContext(grantRequest, env, options)).status, 401, 'Studio is owner-session only; grant HTTP exposure is deferred');
});

test('C2-B HTTP rejects cross-origin/missing-origin writes, injected owner and malformed or oversized JSON', async t => {
  const {env, jwt, options, sqlite} = await environment(t);
  for (const value of ['https://foreign.invalid', 'null']) assert.equal((await http.handleStudioEvents(post(jwt, input(), {origin: value}), env, options)).status, 403);
  const missing = request('/api/studio/events', jwt, {method: 'POST', body: JSON.stringify(input()), headers: {'content-type': 'application/json'}});
  assert.equal((await http.handleStudioEvents(missing, env, options)).status, 403);
  assert.equal((await http.handleStudioEvents(post(jwt, {...input(), owner_id: 'synthetic-other'}), env, options)).status, 400);
  assert.equal((await http.handleStudioEvents(post(jwt, input(), {'content-type': 'text/plain'}), env, options)).status, 415);
  const malformed = request('/api/studio/events', jwt, {method: 'POST', body: '{', headers: {origin, 'content-type': 'application/json'}});
  assert.equal((await http.handleStudioEvents(malformed, env, options)).status, 400);
  let cancelled = false;
  const body = new ReadableStream({start(c) {c.enqueue(new Uint8Array(65537));}, cancel() {cancelled = true;}});
  const large = request('/api/studio/events', jwt, {method: 'POST', body, duplex: 'half', headers: {origin, 'content-type': 'application/json', 'content-length': '1'}});
  assert.equal((await http.handleStudioEvents(large, env, options)).status, 413); assert.equal(cancelled, true);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM learning_events').get().n, 0);
});

test('C2-B HTTP maps conflicts and missing/foreign event reads without leaking identities or private diagnostics', async t => {
  const {env, jwt, options, sqlite} = await environment(t);
  const saved = await (await http.handleStudioEvents(post(jwt), env, options)).json();
  const conflict = await http.handleStudioEvents(post(jwt, {...input(), content: {summary: 'changed'}}), env, options);
  assert.equal(conflict.status, 409); assert.equal((await conflict.json()).error.code, 'IDEMPOTENCY_CONFLICT');
  const foreign = await signedOwner('synthetic-other-sub');
  const otherOptions = {now, verification: foreign.verification};
  const hidden = await http.handleStudioEvent(request('/api/studio/events/' + saved.event_id, foreign.jwt), env, saved.event_id, otherOptions);
  const missing = await http.handleStudioEvent(request('/api/studio/events/missing', foreign.jwt), env, 'missing', otherOptions);
  assert.equal(hidden.status, 404); assert.equal(missing.status, 404); assert.deepEqual(await hidden.json(), await missing.json());
  sqlite.exec("UPDATE users SET status='disabled' WHERE user_id='synthetic-owner'");
  assert.equal((await http.handleStudioEvents(post(jwt), env, options)).status, 403);
  const outage = {DB: {prepare() {throw Error('synthetic private SQL diagnostic');}}, ...env}; outage.DB = {prepare() {throw Error('synthetic private SQL diagnostic');}};
  const failed = await http.handleStudioContext(request('/api/studio/context', jwt), outage, options);
  assert.equal(failed.status, 503); assert.ok(!(await failed.text()).includes('SQL diagnostic'));
});

test('C2-B HTTP context validates purpose and unexpected query parameters; wrong methods are not accepted', async t => {
  const {env, jwt, options} = await environment(t);
  for (const query of ['purpose=invalid', 'purpose=teaching&purpose=review', 'owner_id=synthetic-other', 'purpose=__proto__']) {
    assert.equal((await http.handleStudioContext(request('/api/studio/context?' + query, jwt), env, options)).status, 400);
  }
  assert.equal((await http.handleStudioEvents(request('/api/studio/events', jwt), env, options)).status, 405);
  assert.equal((await http.handleStudioContext(request('/api/studio/context', jwt, {method: 'POST'}), env, options)).status, 405);
});

test('C2-B HTTP invalid UTF8 is rejected and oversized bodies remain 413 when stream cancellation fails', async t => {
  const {env, jwt, options, sqlite} = await environment(t);
  const headers = {origin, 'content-type': 'application/json'};
  const invalid = request('/api/studio/events', jwt, {method: 'POST', body: new Uint8Array([123, 34, 255, 34, 58, 49, 125]), headers});
  assert.equal((await http.handleStudioEvents(invalid, env, options)).status, 400);
  const body = new ReadableStream({start(c) {c.enqueue(new Uint8Array(65537));}, cancel() {throw Error('synthetic cancellation failure');}});
  const large = request('/api/studio/events', jwt, {method: 'POST', body, duplex: 'half', headers});
  assert.equal((await http.handleStudioEvents(large, env, options)).status, 413);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM learning_events').get().n, 0);
});

const correction = () => {
  const {schema_version, idempotency_key: _key, ...event} = input();
  return {schema_version, idempotency_key: 'synthetic-http-correction', expected_revision: 1,
    reason: 'synthetic correction', event: {...event, content: {summary: 'synthetic corrected HTTP fact'}}};
};
const patch = (id, jwt, body = correction(), headers = {}) => request('/api/studio/events/' + id, jwt, {method: 'PATCH', body: JSON.stringify(body), headers: {origin, 'content-type': 'application/json', ...headers}});
const revisions = async (...args) => {
  assert.equal(typeof http.handleStudioEventHistory, 'function', 'protected history handler must exist');
  return http.handleStudioEventHistory(...args);
};

test('C2-C HTTP PATCH creates a revision, replays its receipt and exposes protected bounded history', async t => {
  const {env, jwt, options} = await environment(t);
  const saved = await (await http.handleStudioEvents(post(jwt), env, options)).json();
  const changed = await http.handleStudioEvent(patch(saved.event_id, jwt), env, saved.event_id, options);
  assert.equal(changed.status, 201); const receipt = await changed.json();
  assert.equal(receipt.revision, 2); assert.equal(receipt.data_version, 2);
  const replay = await http.handleStudioEvent(patch(saved.event_id, jwt), env, saved.event_id, options);
  assert.equal(replay.status, 200); assert.deepEqual(await replay.json(), {...receipt, replayed: true});
  const stale = await http.handleStudioEvent(patch(saved.event_id, jwt, {...correction(), idempotency_key: 'stale-http'}), env, saved.event_id, options);
  assert.equal(stale.status, 409); assert.equal((await stale.json()).error.code, 'REVISION_CONFLICT');
  const read = await http.handleStudioEvent(request('/api/studio/events/' + saved.event_id, jwt), env, saved.event_id, options);
  assert.equal((await read.json()).content.summary, 'synthetic corrected HTTP fact');
  const h = await revisions(request('/api/studio/events/' + saved.event_id + '/revisions', jwt), env, saved.event_id, options);
  assert.equal(h.status, 200); const payload = await h.json();
  assert.deepEqual(payload.revisions.map(r => r.event.revision), [2,1]); assert.equal(payload.data_version, 2);
  const page = await revisions(request('/api/studio/events/' + saved.event_id + '/revisions?before_revision=2', jwt), env, saved.event_id, options);
  assert.deepEqual((await page.json()).revisions.map(r => r.event.revision), [1]);
  for (const response of [changed, replay, stale, read, h, page]) assert.match(response.headers.get('cache-control'), /no-store/);
});

test('C2-C HTTP correction/history reject anonymous, forged, cross-origin, injected and unbounded requests', async t => {
  const {env, jwt, options, sqlite} = await environment(t);
  const saved = await (await http.handleStudioEvents(post(jwt), env, options)).json();
  for (const candidate of [null, 'forged']) {
    assert.equal((await http.handleStudioEvent(patch(saved.event_id, candidate), env, saved.event_id, options)).status, candidate ? 403 : 401);
    assert.equal((await revisions(request('/revisions', candidate), env, saved.event_id, options)).status, candidate ? 403 : 401);
  }
  assert.equal((await http.handleStudioEvent(patch(saved.event_id, jwt, correction(), {origin: 'https://foreign.invalid'}), env, saved.event_id, options)).status, 403);
  assert.equal((await http.handleStudioEvent(patch(saved.event_id, jwt, correction(), {'content-type': 'text/plain'}), env, saved.event_id, options)).status, 415);
  assert.equal((await http.handleStudioEvent(patch(saved.event_id, jwt, {...correction(), owner_id: 'synthetic-other'}), env, saved.event_id, options)).status, 400);
  assert.equal((await http.handleStudioEvent(patch(saved.event_id, jwt, {...correction(), reason: 'x'.repeat(65537)}), env, saved.event_id, options)).status, 413);
  for (const query of ['before_revision=0', 'before_revision=1.2', 'before_revision=2&before_revision=3', 'owner_id=synthetic-other', 'before_revision=1e2', 'before_revision=9007199254740992']) {
    assert.equal((await revisions(request('/revisions?' + query, jwt), env, saved.event_id, options)).status, 400);
  }
  assert.equal((await revisions(request('/revisions', jwt, {method: 'POST'}), env, saved.event_id, options)).status, 405);
  assert.equal(sqlite.prepare('SELECT current_revision FROM learning_events').get().current_revision, 1);
});

test('C2-C HTTP foreign and missing history are indistinguishable; foreign correction cannot modify or reveal content', async t => {
  const {env, jwt, options, sqlite} = await environment(t);
  const saved = await (await http.handleStudioEvents(post(jwt), env, options)).json();
  const other = await signedOwner('synthetic-other-sub'); const opt = {now, verification: other.verification};
  const hidden = await revisions(request('/revisions', other.jwt), env, saved.event_id, opt);
  const missing = await revisions(request('/revisions', other.jwt), env, 'missing', opt);
  assert.equal(hidden.status, 404); assert.equal(missing.status, 404); assert.deepEqual(await hidden.json(), await missing.json());
  const foreign = await http.handleStudioEvent(patch(saved.event_id, other.jwt), env, saved.event_id, opt);
  const absent = await http.handleStudioEvent(patch('missing', other.jwt), env, 'missing', opt);
  assert.equal(foreign.status, 409); assert.deepEqual(await foreign.json(), await absent.json());
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM event_revisions').get().n, 1);
});
