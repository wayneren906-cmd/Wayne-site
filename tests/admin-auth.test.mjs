import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,now,signedOwner,input} from './helpers/learning-fixture.mjs';
import {hashAdminPassword,handleAdminAuth,readAdminSession,authDigest} from '../lib/admin-auth.ts';
import {verifyStudioSession} from '../lib/learning/auth.ts';
import {handleStudioEvents} from '../lib/learning/http.ts';
import {adminBootstrapStatements} from '../lib/admin-bootstrap.ts';
const password='Synthetic-test-password-42',at=now.getTime()/1000;
const request=(action,body,options={})=>new Request('https://synthetic.invalid/api/auth/'+action,{method:body?'POST':'GET',headers:{...(body?{origin:'https://synthetic.invalid','content-type':'application/json'}:{}),...options.headers},...(body?{body:JSON.stringify(body)}:{}),...options});
async function setup(t){const f=await fixture(t);f.sqlite.prepare('UPDATE admin_accounts SET email=?,password_hash=? WHERE account_id=?').run('owner@example.com',hashAdminPassword(password),'synthetic-owner-account');return f;}
const login=(f,body={email:'OWNER@EXAMPLE.COM',password},options={})=>handleAdminAuth(request('login',body,options),f.db,'login',{now:at});
const cookie=response=>response.headers.get('set-cookie').split(';')[0];
test('salted password hashes differ; email login sets an opaque secure session stored only as a digest',async t=>{
  const f=await setup(t);assert.notEqual(hashAdminPassword(password),hashAdminPassword(password));
  const response=await login(f);assert.equal(response.status,200);assert.deepEqual(await response.json(),{signed_in:true});assert.match(response.headers.get('cache-control'),/no-store/);
  const set=response.headers.get('set-cookie');for(const attr of ['__Host-wayneo_session=','HttpOnly','Secure','SameSite=Strict','Path=/'])assert.ok(set.includes(attr));
  const token=cookie(response).split('=')[1];assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM admin_sessions WHERE token_sha256=?').get(token).n,0);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM admin_sessions WHERE token_sha256=?').get(await authDigest(token)).n,1);
  const headers=new Headers({cookie:cookie(response)}),account=await readAdminSession(headers,f.db,at);assert.equal(account.email,'owner@example.com');assert.equal((await verifyStudioSession(headers,f.db,at)).userId,'synthetic-owner');
});
test('wrong password and unknown email receive indistinguishable failures without leaking hashes or account state',async t=>{
  const f=await setup(t),a=await login(f,{email:'owner@example.com',password:'wrong-password'}),b=await login(f,{email:'missing@example.com',password});
  assert.equal(a.status,401);assert.equal(b.status,401);assert.deepEqual(await a.json(),await b.json());assert.equal(a.headers.get('set-cookie'),null);
  f.sqlite.exec("UPDATE admin_accounts SET status='disabled' WHERE account_id='synthetic-owner-account'");assert.equal((await login(f)).status,401);
});
test('login rejects cross-origin, missing origin, wrong content types and oversized payloads before creating sessions',async t=>{
  const f=await setup(t),before=f.sqlite.prepare('SELECT COUNT(*) n FROM admin_sessions').get().n;
  for(const origin of ['https://foreign.invalid','null'])assert.equal((await login(f,undefined,{headers:{origin,'content-type':'application/json'}})).status,403);
  assert.equal((await login(f,undefined,{headers:{origin:'https://synthetic.invalid','content-type':'text/plain'}})).status,415);
  assert.equal((await login(f,{email:'owner@example.com',password:'x'.repeat(9000)})).status,413);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM admin_sessions').get().n,before);
});
test('fixed-window email and IP rate limits hold under repeated unknown-account logins',async t=>{
  const f=await setup(t);
  for(let n=0;n<6;n++)assert.equal((await login(f,{email:'missing@example.com',password})).status,401);
  const limited=await login(f,{email:'missing@example.com',password});assert.equal(limited.status,429);assert.ok(Number(limited.headers.get('retry-after'))>0);
  const response=await handleAdminAuth(request('login',{email:'missing@example.com',password}),f.db,'login',{now:at+601});assert.equal(response.status,401);
});
test('expired, duplicated, revoked-version and disabled sessions cannot grant administrator permissions',async t=>{
  const f=await setup(t),response=await login(f),value=cookie(response),headers=new Headers({cookie:value});
  assert.equal(await readAdminSession(new Headers({cookie:value+'; '+value}),f.db,at),null);
  assert.equal(await readAdminSession(headers,f.db,at+28800),null);
  f.sqlite.exec("UPDATE admin_accounts SET auth_version=auth_version+1 WHERE email='owner@example.com'");assert.equal(await readAdminSession(headers,f.db,at),null);
  assert.equal(await readAdminSession(new Headers({'cf-access-jwt-assertion':(await signedOwner()).jwt}),f.db,at),null,'old Access JWT grants no native session');
});
test('logout invalidates server session and clears cookie; foreign logout cannot log a user out',async t=>{
  const f=await setup(t),response=await login(f),value=cookie(response);
  const foreign=await handleAdminAuth(request('logout',{}, {headers:{origin:'https://foreign.invalid',cookie:value}}),f.db,'logout',{now:at});assert.equal(foreign.status,403);assert.ok(await readAdminSession(new Headers({cookie:value}),f.db,at));
  const result=await handleAdminAuth(request('logout',{}, {headers:{origin:'https://synthetic.invalid',cookie:value}}),f.db,'logout',{now:at});assert.equal(result.status,200);assert.ok(result.headers.get('set-cookie').includes('Max-Age=0'));assert.equal(await readAdminSession(new Headers({cookie:value}),f.db,at),null);
});
test('only a signed-in primary owner adds admin accounts, duplicates do not overwrite credentials, and admins share the owner space',async t=>{
  const f=await setup(t),response=await login(f),value=cookie(response);
  const body={email:'admin@example.com',password:'Synthetic-secondary-password'};
  assert.equal((await handleAdminAuth(request('accounts',body),f.db,'accounts',{now:at})).status,403);
  const req=()=>request('accounts',body,{headers:{cookie:value,origin:'https://synthetic.invalid','content-type':'application/json'}});
  assert.equal((await handleAdminAuth(req(),f.db,'accounts',{now:at})).status,201);
  const stored=f.sqlite.prepare("SELECT owner_id,password_hash,role FROM admin_accounts WHERE email='admin@example.com'").get();assert.equal(stored.owner_id,'synthetic-owner');assert.equal(stored.role,'admin');assert.ok(!stored.password_hash.includes(body.password));
  assert.equal((await handleAdminAuth(req(),f.db,'accounts',{now:at})).status,409);assert.equal(f.sqlite.prepare("SELECT password_hash FROM admin_accounts WHERE email='admin@example.com'").get().password_hash,stored.password_hash);
  const adminLogin=await login(f,body),adminCookie=cookie(adminLogin);assert.equal((await verifyStudioSession(new Headers({cookie:adminCookie}),f.db,at)).userId,'synthetic-owner');
  assert.equal((await handleAdminAuth(request('accounts',{email:'third@example.com',password},{headers:{cookie:adminCookie,origin:'https://synthetic.invalid','content-type':'application/json'}}),f.db,'accounts',{now:at})).status,403);
  const list=await handleAdminAuth(request('accounts',undefined,{headers:{cookie:value}}),f.db,'accounts',{now:at});assert.ok(!JSON.stringify(await list.json()).includes('password_hash'));
});
test('native session revocation just before a private write transaction rolls back all learning changes',async t=>{
  const f=await setup(t),response=await login(f),value=cookie(response);let batches=0;
  const racing={...f.db,async batch(statements){if(++batches===2)f.sqlite.exec("UPDATE admin_accounts SET status='disabled' WHERE account_id='synthetic-owner-account'");return f.db.batch(statements);}};
  const result=await handleStudioEvents(new Request('https://synthetic.invalid/api/studio/events',{method:'POST',headers:{cookie:value,origin:'https://synthetic.invalid','content-type':'application/json'},body:JSON.stringify(input())}),{DB:racing},{now});
  assert.equal(result.status,403);assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM learning_events').get().n,0);
});

test('offline primary-account initializer is atomic, refuses existing accounts and cannot overwrite them',async t=>{
  const f=await fixture(t);f.sqlite.exec('DELETE FROM integration_grants; DELETE FROM users;');
  const ownerId=crypto.randomUUID(),accountId=crypto.randomUUID(),created_at=now.toISOString();
  const proposal={schema_version:1,owner:{user_id:ownerId,identity_issuer:'https://wayneo.dev/email',identity_subject:accountId,role:'owner',status:'active',created_at},account:{account_id:accountId,owner_id:ownerId,email:'synthetic-initial@example.com',password_hash:hashAdminPassword(password),role:'owner',status:'active',auth_version:1,created_at}};
  for(const mode of ['ABORT','IGNORE']){
    f.sqlite.exec(`CREATE TRIGGER synthetic_bootstrap_failure BEFORE INSERT ON admin_accounts BEGIN SELECT RAISE(${mode}${mode==='ABORT'?',\'synthetic failure\'':''}); END;`);
    await assert.rejects(f.db.batch(adminBootstrapStatements(f.db,proposal)));assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM users').get().n,0);assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM admin_accounts').get().n,0);
    f.sqlite.exec('DROP TRIGGER synthetic_bootstrap_failure');
  }
  await f.db.batch(adminBootstrapStatements(f.db,proposal));assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM admin_accounts').get().n,1);
  await assert.rejects(f.db.batch(adminBootstrapStatements(f.db,proposal)));assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM admin_accounts').get().n,1);
  assert.equal((await login(f,{email:'synthetic-initial@example.com',password})).status,200);
});
