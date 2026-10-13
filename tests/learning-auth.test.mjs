import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { verifyLearningOwner, verifyLearningGrant, requireLearningPermission } from '../lib/learning/auth.ts';

// All identities, tokens and database rows in this file are synthetic.
const config = { CF_ACCESS_TEAM_DOMAIN: 'https://c1-synthetic.cloudflareaccess.com', CF_ACCESS_AUD: 'synthetic-c1', JOURNAL_OWNER_EMAIL: 'owner@example.com' };
const pair = await crypto.subtle.generateKey({name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256'}, true, ['sign', 'verify']);
const key = {...await crypto.subtle.exportKey('jwk', pair.publicKey), kid: 'synthetic-c1-key'};
const verification = {keys: [key], now: 1000};
const machineToken = 'a'.repeat(64);
const digest = createHash('sha256').update(machineToken).digest('hex');

async function token(changes = {}, headerChanges = {}) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const text = encode({alg: 'RS256', kid: key.kid, ...headerChanges}) + '.' + encode({iss: config.CF_ACCESS_TEAM_DOMAIN, aud: [config.CF_ACCESS_AUD], exp: 2000, iat: 900, email: config.JOURNAL_OWNER_EMAIL, sub: 'synthetic-owner-subject', ...changes});
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(text));
  return text + '.' + Buffer.from(signature).toString('base64url');
}

function fixture(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  sqlite.exec('PRAGMA foreign_keys = ON');
  sqlite.exec(readFileSync(new URL('../migrations/0002_learning_events.sql', import.meta.url), 'utf8'));
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='users'").get().n, 1, 'C1 users migration must exist');
  sqlite.prepare('INSERT INTO users(user_id,identity_issuer,identity_subject,role,status,created_at) VALUES(?,?,?,?,?,?)')
    .run('synthetic-owner', config.CF_ACCESS_TEAM_DOMAIN, 'synthetic-owner-subject', 'owner', 'active', '2026-10-13T00:00:00Z');
  sqlite.prepare('INSERT INTO integration_grants(grant_id,owner_id,token_sha256,scopes,expires_at,created_at) VALUES(?,?,?,?,?,?)')
    .run('synthetic-grant', 'synthetic-owner', digest, JSON.stringify(['context:read', 'events:write']), 2000, '2026-10-13T00:00:00Z');
  const db = {prepare(sql) { const statement = sqlite.prepare(sql); let args = []; return {bind(...values) { args = values; return this; }, async first() { return statement.get(...args) ?? null; }}; }};
  return {sqlite, db};
}

test('C1 signed and pre-registered owner resolves to internal ID without auto-registration', async t => {
  const {sqlite, db} = fixture(t);
  const principal = await verifyLearningOwner(await token(), config, db, verification);
  assert.deepEqual(principal, {userId: 'synthetic-owner', kind: 'owner', grantId: null, scopes: ['context:read', 'events:read', 'events:write', 'events:correct']});
  requireLearningPermission(principal, 'synthetic-owner', 'events:correct');
  sqlite.exec('DELETE FROM integration_grants; DELETE FROM users');
  await assert.rejects(verifyLearningOwner(await token(), config, db, verification), {code: 'PRIVATE_ACCESS_DENIED'});
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM users').get().n, 0);
});

test('C1 missing, invalid and tampered signed identities are denied before a database lookup', async () => {
  let lookups = 0;
  const db = {prepare() { lookups++; throw Error('Unexpected lookup'); }};
  const signed = await token();
  const parts = signed.split('.');
  const tampered = parts[0] + '.' + Buffer.from(JSON.stringify({sub: 'other', email: config.JOURNAL_OWNER_EMAIL})).toString('base64url') + '.' + parts[2];
  for (const candidate of [null, 'invalid', tampered, await token({aud: ['other']}), await token({iss: 'https://other.cloudflareaccess.com'}), await token({exp: 1000}), await token({email: 'visitor@example.com'}), await token({}, {alg: 'none'})]) {
    await assert.rejects(verifyLearningOwner(candidate, config, db, verification), {code: 'PRIVATE_ACCESS_DENIED'});
  }
  assert.equal(lookups, 0);
});

test('C1 owner subject is required and ordinary, disabled or differently mapped users have no access', async t => {
  const {sqlite, db} = fixture(t);
  for (const sub of [undefined, '', ' ', 42, 'synthetic-owner-subject ', 'other-subject', "subject' OR 1=1 --"]) {
    await assert.rejects(verifyLearningOwner(await token({sub}), config, db, verification), {code: 'PRIVATE_ACCESS_DENIED'});
  }
  for (const sql of ["UPDATE users SET role='member'", "UPDATE users SET role='owner',status='disabled'", "UPDATE users SET status='active',identity_issuer='https://other.cloudflareaccess.com'"]) {
    sqlite.exec(sql);
    await assert.rejects(verifyLearningOwner(await token(), config, db, verification), {code: 'PRIVATE_ACCESS_DENIED'});
  }
});

test('C1 integration grants are owner-bound and expose only explicitly allowed scopes', async t => {
  const {db} = fixture(t);
  const principal = await verifyLearningGrant(machineToken, db, 1000);
  assert.deepEqual(principal, {userId: 'synthetic-owner', kind: 'integration', grantId: 'synthetic-grant', scopes: ['context:read', 'events:write']});
  requireLearningPermission(principal, 'synthetic-owner', 'events:write');
  assert.throws(() => requireLearningPermission(principal, 'synthetic-owner', 'events:correct'), {code: 'PRIVATE_ACCESS_DENIED'});
  assert.throws(() => requireLearningPermission(principal, 'another-owner', 'events:write'), {code: 'PRIVATE_ACCESS_DENIED'});
  assert.throws(() => requireLearningPermission(principal, 'synthetic-owner', 'admin:*'), {code: 'PRIVATE_ACCESS_DENIED'});
  assert.throws(() => requireLearningPermission(null, 'synthetic-owner', 'context:read'), {code: 'PRIVATE_ACCESS_DENIED'});
  assert.throws(() => requireLearningPermission(JSON.parse(JSON.stringify(principal)), 'synthetic-owner', 'events:write'), {code: 'PRIVATE_ACCESS_DENIED'});
  assert.ok(Object.isFrozen(principal) && Object.isFrozen(principal.scopes));
});

test('C1 wrong, expired, revoked and disabled-owner grants are denied with no token disclosure', async t => {
  const {sqlite, db} = fixture(t);
  for (const candidate of [null, '', 'short', 'A'.repeat(64), 'b'.repeat(64), digest]) {
    await assert.rejects(verifyLearningGrant(candidate, db, 1000), {code: 'PRIVATE_ACCESS_DENIED', message: '私人学习访问未获授权'});
  }
  await assert.rejects(verifyLearningGrant(machineToken, db, 2000), {code: 'PRIVATE_ACCESS_DENIED'});
  await assert.rejects(verifyLearningGrant(machineToken, db, NaN), {code: 'PRIVATE_ACCESS_DENIED'});
  sqlite.exec("UPDATE integration_grants SET revoked_at='2026-10-13T01:00:00Z'");
  await assert.rejects(verifyLearningGrant(machineToken, db, 1000), {code: 'PRIVATE_ACCESS_DENIED'});
  sqlite.exec("UPDATE integration_grants SET revoked_at=NULL; UPDATE users SET status='disabled'");
  await assert.rejects(verifyLearningGrant(machineToken, db, 1000), {code: 'PRIVATE_ACCESS_DENIED'});
  sqlite.exec("UPDATE users SET status='active',role='member'");
  await assert.rejects(verifyLearningGrant(machineToken, db, 1000), {code: 'PRIVATE_ACCESS_DENIED'});
});

test('C1 corrupted or unknown stored scopes fail closed and do not grant wildcards', async t => {
  const {sqlite, db} = fixture(t);
  for (const scopes of [['admin:*'], ['events:write', 'publish:*'], [], ['events:write', 'events:write'], [42]]) {
    sqlite.prepare('UPDATE integration_grants SET scopes=?').run(JSON.stringify(scopes));
    await assert.rejects(verifyLearningGrant(machineToken, db, 1000), {code: 'PRIVATE_ACCESS_DENIED'});
  }
});
