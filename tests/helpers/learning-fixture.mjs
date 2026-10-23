import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {verifyLearningGrant} from '../../lib/learning/auth.ts';

export const now = new Date('2026-10-13T12:00:00Z');
export const token = 'a'.repeat(64); // Synthetic: never submitted to a real endpoint.
export const input = (key = 'synthetic-http-1') => ({schema_version: 1, idempotency_key: key, source: {type: 'studio', record_id: null}, kind: 'learning_activity', occurred_at: null, time_precision: 'unknown', study_day_override: null, content: {summary: 'synthetic private fact'}, evidence_status: 'unknown', assistance: 'unknown', execution_mode: 'unknown', knowledge_ids: [], plan_id: null, test_run_id: 'synthetic-c2b'});

export async function fixture(t, scopes = ['events:read', 'context:read', 'events:write'], options = {}) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  sqlite.exec('PRAGMA foreign_keys=ON');
  for (const file of ['0001_initial.sql', '0002_learning_events.sql', '0003_ingest_outbox.sql', '0004_correction_authority.sql', '0005_private_deletion.sql','0006_studio_projects.sql','0007_studio_plans.sql','0008_email_auth.sql','0009_wayneo_project.sql'].filter(name=>Number(name.slice(0,4))<=(options.throughMigration??Infinity))) sqlite.exec(readFileSync(new URL('../../migrations/' + file, import.meta.url), 'utf8'));
  for (const [id, sub] of [['synthetic-owner', 'synthetic-sub'], ['synthetic-other', 'synthetic-other-sub']]) {
    sqlite.prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').run(id, 'https://synthetic.cloudflareaccess.com', sub, 'owner', 'active', now.toISOString());
  }
  for(const [id,sub] of [['synthetic-owner','synthetic-sub'],['synthetic-other','synthetic-other-sub']]){
    const session=createHash('sha256').update(sub).digest('hex');
    sqlite.prepare('INSERT INTO admin_accounts VALUES(?,?,?,?,?,?,?,?)').run(id+'-account',id,id+'@example.com','scrypt-v1$'+'0'.repeat(32)+'$'+'0'.repeat(64),'owner','active',1,now.toISOString());
    sqlite.prepare('INSERT INTO admin_sessions VALUES(?,?,?,?,?)').run(createHash('sha256').update(session).digest('hex'),id+'-account',1,Math.floor(Date.now()/1000)+86400,now.toISOString());
  }
  sqlite.prepare('INSERT INTO integration_grants(grant_id,owner_id,token_sha256,scopes,expires_at,created_at) VALUES(?,?,?,?,?,?)').run('synthetic-grant', 'synthetic-owner', createHash('sha256').update(token).digest('hex'), JSON.stringify(scopes), now.getTime()/1000 + 3600, now.toISOString());
  const db = {prepare(sql) {
    const statement = sqlite.prepare(sql); let args = [];
    const execute = () => statement.columns().length ? {success: true, results: statement.all(...args), meta: {changes: 0}} : {success: true, results: [], meta: {changes: Number(statement.run(...args).changes)}};
    return {bind(...values) {args = values; return this;}, async first() {return statement.get(...args) ?? null;}, async all() {return execute();}, async run() {return execute();}, execute};
  }, async batch(statements) {
    sqlite.exec('BEGIN IMMEDIATE');
    try {const result = statements.map(s => s.execute()); sqlite.exec('COMMIT'); return result;} catch (e) {sqlite.exec('ROLLBACK'); throw e;}
  }};
  return {sqlite, db, identity: await verifyLearningGrant(token, db, now.getTime()/1000)};
}

export async function signedOwner(sub = 'synthetic-sub', overrides = {}, kid = 'synthetic-c2b') {
  const config = {CF_ACCESS_TEAM_DOMAIN: 'https://synthetic.cloudflareaccess.com', CF_ACCESS_AUD: 'synthetic-c2b', JOURNAL_OWNER_EMAIL: 'owner@example.com'};
  const pair = await crypto.subtle.generateKey({name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256'}, true, ['sign', 'verify']);
  const key = {...await crypto.subtle.exportKey('jwk', pair.publicKey), kid};
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const text = encode({alg: 'RS256', kid: key.kid}) + '.' + encode({iss: config.CF_ACCESS_TEAM_DOMAIN, aud: config.CF_ACCESS_AUD, exp: now.getTime()/1000 + 3600, sub, email: config.JOURNAL_OWNER_EMAIL, ...overrides});
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(text));
  const cookie='__Host-wayneo_session='+createHash('sha256').update(sub+(Object.keys(overrides).length?JSON.stringify(overrides):'')).digest('hex');
  return {cookie,config, jwt: text + '.' + Buffer.from(signature).toString('base64url'), verification: {keys: [key], now: now.getTime()/1000}};
}
