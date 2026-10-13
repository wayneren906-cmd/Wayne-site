import test from 'node:test';
import assert from 'node:assert/strict';
import {StudioHttpClient,createStudioHttpClientAdapter} from '../lib/ui/studio-client.ts';
import {StudioViewModel} from '../lib/ui/studio-view-model.ts';
import {fixture,input,now,signedOwner} from './helpers/learning-fixture.mjs';
import {handleStudioEvents,handleStudioContext,handleStudioEvent} from '../lib/learning/http.ts';

const context={purpose:'teaching',generated_at:now.toISOString(),latest_observed_event_at:null,data_version:0,assessment_processed_version:0,
  outline_version:null,policy_version:null,covered_sources:[],unknown_ranges:['chat_history_not_connected','event_time_unknown'],evidence_refs:[],events:[]};
const response=body=>new Response(JSON.stringify(body),{headers:{'content-type':'application/json'}});
const receipt={receipt_id:'synthetic-receipt',event_id:'synthetic-event',revision:1,received_at:now.toISOString(),study_day:null,data_version:1,saved:true,processing_status:'pending',replayed:false};

test('incomplete/invalid saved receipts preserve the draft and its retry key',async()=>{
  for(const bad of [{saved:true,receipt_id:'partial'},{...receipt,revision:0},{...receipt,replayed:'false'},{...receipt,study_day:'2026-02-30'}]) {
    const keys=[];let first=true;
    const client=new StudioHttpClient({fetchFn:async(_url,init)=>init.method==='POST'?(keys.push(JSON.parse(init.body).idempotency_key),response(first?(first=false,bad):receipt)):response(context)});
    const vm=new StudioViewModel(client);vm.updateSupplementDraft('synthetic draft');
    assert.equal(await vm.submitSupplement(),null);assert.equal(vm.getState().supplementDraft,'synthetic draft');assert.equal(vm.getState().supplementState,'error');
    assert.equal((await vm.submitSupplement()).saved,true);assert.equal(keys[0],keys[1]);
  }
});
test('one adapter snapshot uses one context request and translates coverage without claiming unknown time ranges',async()=>{
  let calls=0;const adapter=createStudioHttpClientAdapter(new StudioHttpClient({fetchFn:async()=>{calls++;return response(context);}}));
  const result=await adapter.loadSnapshot();assert.equal(calls,1);assert.deepEqual(result.events,[]);
  assert.match(result.overview.notice.text,/尚未接入聊天记录/);assert.match(result.overview.notice.text,/学习时间未知/);
  assert.ok(!result.overview.notice.text.includes('chat_history_not_connected'));
});
test('concurrent submit sends one POST; late context cannot overwrite newer context',async()=>{
  let release,calls=0;const client=new StudioHttpClient({fetchFn:async(_url,init)=>{
    if(init.method==='POST'){calls++;await new Promise(resolve=>release=resolve);return response(receipt);}return response(context);
  }});
  const vm=new StudioViewModel(client);vm.updateSupplementDraft('synthetic');const pending=vm.submitSupplement();
  assert.equal(await vm.submitSupplement(),null);assert.equal(calls,1);release();await pending;
  const resolves=[];const reader=new StudioViewModel(new StudioHttpClient({fetchFn:()=>new Promise(resolve=>resolves.push(resolve))}));
  const old=reader.loadContext(),newer=reader.loadContext();resolves[1](response({...context,data_version:3,latest_observed_event_at:'2026-10-14T10:00:00Z'}));await newer;
  resolves[0](response({...context,data_version:1,latest_observed_event_at:'2026-10-13T10:00:00Z'}));await old;assert.equal(reader.getState().overview.connectionState,'available');
  assert.equal(reader.getState().overview.lastContentUpdatedAt,'2026-10-14T10:00:00Z');
  assert.equal(reader.getState().overview.loading,false);
  // Stale rejection also must not turn a completed read into an error.
  assert.equal(reader.getState().eventsError,null);
});
test('signed synthetic owner adapter saves through real HTTP handlers and SQLite then reads matching event',async t=>{
  const {db,sqlite}=await fixture(t);const auth=await signedOwner();const base='https://synthetic.invalid';let contexts=0;
  const client=new StudioHttpClient({fetchFn:async(url,init)=>{
    const headers=new Headers(init.headers);headers.set('cf-access-jwt-assertion',auth.jwt);if(init.method==='POST')headers.set('origin',base);
    const request=new Request(base+url,{...init,headers});const env={DB:db,...auth.config},options={now,verification:auth.verification};
    if(url.includes('/context')){contexts++;return handleStudioContext(request,env,options);}
    if(init.method==='POST')return handleStudioEvents(request,env,options);
    return handleStudioEvent(request,env,decodeURIComponent(url.split('/').at(-1)),options);
  }});
  const adapter=createStudioHttpClientAdapter(client);assert.equal((await adapter.loadSnapshot()).events.length,0);
  const saved=await adapter.submitSupplement('synthetic closed-loop',{idempotencyKey:'synthetic-closed-loop'});
  const replay=await adapter.submitSupplement('synthetic closed-loop',{idempotencyKey:'synthetic-closed-loop'});assert.equal(replay.replayed,true);
  assert.equal((await client.getEvent(saved.event_id)).content.summary,'synthetic closed-loop');
  const snapshot=await adapter.loadSnapshot();assert.equal(snapshot.events[0].event_id,saved.event_id);assert.equal(contexts,2);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM learning_events').get().n,1);
});
test('invalid or wrong-purpose context is rejected instead of faking an empty archive',async()=>{
  for(const body of [{events:[]},{...context,purpose:'review'},{...context,assessment_processed_version:1}]) {
    await assert.rejects(new StudioHttpClient({fetchFn:async()=>response(body)}).getContext(),{code:'INVALID_RESPONSE'});
  }
});
