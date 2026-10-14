import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,signedOwner,now} from './helpers/learning-fixture.mjs';
import {prepareOwnerRegistration} from '../lib/learning/registration.ts';
import {handleStudioRegistration} from '../lib/learning/http.ts';
import {verifyLearningOwner} from '../lib/learning/auth.ts';

test('signed configured owner gets a disabled proposal without any registration or write',async t=>{
  const {db,sqlite}=await fixture(t),auth=await signedOwner('new-synthetic-sub');
  const before=sqlite.prepare('SELECT * FROM users').all();
  const candidate=await prepareOwnerRegistration(auth.jwt,auth.config,db,{now,verification:auth.verification});
  assert.equal(candidate.registration_required,true);assert.equal(candidate.proposal.status,'disabled');assert.equal(candidate.proposal.identity_subject,'new-synthetic-sub');
  assert.deepEqual(sqlite.prepare('SELECT * FROM users').all(),before);
  assert.ok(!JSON.stringify(candidate).includes(auth.jwt));assert.ok(!JSON.stringify(candidate).includes('email'));
  await assert.rejects(verifyLearningOwner(auth.jwt,auth.config,db,auth.verification),{code:'PRIVATE_ACCESS_DENIED'});
});
test('anonymous/forged/wrong-email/bad-subject cannot obtain a registration proposal',async t=>{
  const {db}=await fixture(t),auth=await signedOwner('new-sub');
  for(const token of [null,'forged'])await assert.rejects(prepareOwnerRegistration(token,auth.config,db,{verification:auth.verification}),{code:'PRIVATE_ACCESS_DENIED'});
  const other=await signedOwner('new-sub',{email:'other@example.com'});
  await assert.rejects(prepareOwnerRegistration(other.jwt,other.config,db,{verification:other.verification}),{code:'PRIVATE_ACCESS_DENIED'});
  const malformed=await signedOwner(' ');await assert.rejects(prepareOwnerRegistration(malformed.jwt,malformed.config,db,{verification:malformed.verification}),{code:'PRIVATE_ACCESS_DENIED'});
});
test('existing disabled/member mapping needs operator review and is never upgraded by GET',async t=>{
  const {db,sqlite}=await fixture(t),auth=await signedOwner();
  sqlite.exec("UPDATE users SET role='member',status='disabled' WHERE user_id='synthetic-owner'");
  const candidate=await prepareOwnerRegistration(auth.jwt,auth.config,db,{verification:auth.verification});
  assert.deepEqual(candidate,{registration_required:false,status:'requires_operator_review'});
  assert.deepEqual(sqlite.prepare("SELECT role,status FROM users WHERE user_id='synthetic-owner'").get(),Object.assign(Object.create(null),{role:'member',status:'disabled'}));
});
test('removed Access registration endpoint returns 410 and no proposal regardless of old credentials',async t=>{
  const {db}=await fixture(t),auth=await signedOwner('new-sub'),env={DB:db,...auth.config};
  for(const headers of [{},{'cf-access-jwt-assertion':auth.jwt},{authorization:'Bearer synthetic'}]){
    const response=await handleStudioRegistration(new Request('https://synthetic.invalid/api/studio/registration',{headers}),env);
    assert.equal(response.status,410);assert.match(response.headers.get('cache-control'),/no-store/);assert.ok(!(await response.text()).includes('proposal'));
  }
});
