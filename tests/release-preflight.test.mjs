import test from 'node:test';
import assert from 'node:assert/strict';
import {planStudioAccessExtension} from '../scripts/release-preflight.mjs';
const app={type:'self_hosted',id:'synthetic-app',aud:'synthetic-aud',destinations:[{type:'public',uri:'synthetic.example/admin'},{type:'public',uri:'synthetic.example/api/admin/*'}],
  policies:[{id:'synthetic-owner-policy',decision:'allow',include:[{email:{email:'owner@example.com'}}],exclude:[],require:[]}],allowed_idps:['synthetic-idp']};
test('Studio Access plan adds only page/API paths and preserves original app audience and owner policy',()=>{
  const before=JSON.stringify(app);const plan=planStudioAccessExtension(app,'owner@example.com','synthetic-aud',['synthetic.example']);
  assert.deepEqual(plan.add_public_paths,['synthetic.example/studio/private','synthetic.example/api/studio']);
  assert.deepEqual(plan.preserve_policy_ids,['synthetic-owner-policy']);assert.equal(JSON.stringify(app),before);
  const already={...app,destinations:[...app.destinations,...plan.add_public_paths.map(uri=>({type:'public',uri}))]};
  assert.deepEqual(planStudioAccessExtension(already,'owner@example.com','synthetic-aud',['synthetic.example']).add_public_paths,[]);
  const broad={...already,destinations:[...already.destinations,{type:'public',uri:'synthetic.example/studio'}]};
  const narrowed=planStudioAccessExtension(broad,'owner@example.com','synthetic-aud',['synthetic.example']);
  assert.deepEqual(narrowed.remove_public_paths,['synthetic.example/studio']);assert.ok(!narrowed.after_destinations.includes('synthetic.example/studio'));assert.ok(narrowed.after_destinations.includes('synthetic.example/studio/private'));
});
test('wrong audience, broadened policy, unrelated destination or public bypass abort release planning',()=>{
  for(const value of [{...app,aud:'wrong'},{...app,policies:[{...app.policies[0],include:[{everyone:{}}]}]},
    {...app,policies:[...app.policies,{decision:'bypass'}]},{...app,destinations:[{type:'public',uri:'unrelated.example/admin'}]},
    {...app,destinations:[{type:'public',uri:'synthetic.example/admin',overrides:[{behavior:'public',path_pattern:'/*'}]}]}]){
    assert.throws(()=>planStudioAccessExtension(value,'owner@example.com','synthetic-aud',['synthetic.example']));
  }
});
