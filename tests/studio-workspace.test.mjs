import test from 'node:test';
import assert from 'node:assert/strict';
import {knowledgeTopics,practiceExercises,studioProjects,publicTopicReferences} from '../lib/studio-catalog.ts';
import {buildWorkspaceInput,projectWorkspace,WorkspaceRecorder} from '../lib/ui/studio-workspace.ts';
import {recordCorrection} from '../lib/ui/studio-record.ts';
import {normalizeLearningEvent} from '../lib/learning/event-validation.ts';
import {StudioHttpClient} from '../lib/ui/studio-client.ts';
import {fixture,now,signedOwner} from './helpers/learning-fixture.mjs';
import {handleStudioEvents,handleStudioEvent,handleStudioContext,handleStudioEventHistory} from '../lib/learning/http.ts';
const keys={key:'synthetic-workspace-key',instance:'11111111-1111-4111-8111-111111111111'},target={kind:'practice',id:'string-reverse'},draft={summary:'synthetic private practice',date:'',assistance:'none',execution:'local_run'};
const receipt={receipt_id:'synthetic-receipt',event_id:'synthetic-event',revision:1,received_at:now.toISOString(),study_day:null,data_version:1,saved:true,processing_status:'pending',replayed:false};
const context=events=>({purpose:'review',generated_at:now.toISOString(),latest_observed_event_at:null,data_version:events.length?1:0,assessment_processed_version:0,outline_version:null,policy_version:null,covered_sources:[...new Set(events.map(e=>e.source.type))],unknown_ranges:[],evidence_refs:events.map(e=>({event_id:e.event_id,revision:e.revision})),events});
const event=(input,id='synthetic-event')=>{const {idempotency_key,schema_version,study_day_override,...fields}=input;return {...fields,event_id:id,revision:1,received_at:now.toISOString(),study_day:study_day_override?.study_day??null,study_day_override_reason:study_day_override?.reason??null,visibility:'private'};};
test('catalog links have stable unique identifiers, valid prerequisites and no prerequisite cycles',()=>{
  assert.equal(new Set(knowledgeTopics.map(t=>t.id)).size,knowledgeTopics.length);
  const walk=(id,path=[])=>{assert.ok(!path.includes(id));const topic=knowledgeTopics.find(t=>t.id===id);assert.ok(topic);for(const next of topic.prerequisites)walk(next,[...path,id]);};
  for(const topic of knowledgeTopics)walk(topic.id);
  for(const ids of [...practiceExercises.map(e=>e.knowledgeIds),...studioProjects.flatMap(p=>p.milestones.map(m=>m.knowledgeIds))])assert.ok(ids.every(id=>knowledgeTopics.some(t=>t.id===id)));
});
test('workspace submissions link existing event fields without creating a plan or inventing learning time',()=>{
  const input=buildWorkspaceInput(target,draft,keys);assert.equal(input.occurred_at,null);assert.equal(input.time_precision,'unknown');assert.equal(input.plan_id,null);assert.equal(input.evidence_status,'self_reported');
  assert.deepEqual(input.knowledge_ids,['c-arrays','c-pointers']);assert.match(input.source.record_id,/workspace.practice.string-reverse/);assert.equal(normalizeLearningEvent(input).studyDay,null);
  const dated=buildWorkspaceInput(target,{...draft,date:'2026-10-13'},keys);assert.equal(normalizeLearningEvent(dated).studyDay,'2026-10-13');
  const milestone=buildWorkspaceInput({kind:'project',id:'c-engine',milestone:'verification'},draft,keys);assert.match(milestone.source.record_id,/workspace.project.c-engine.verification/);assert.deepEqual(milestone.knowledge_ids,['c-testing']);
});

test('unified everyday records preserve supplement source semantics without inventing an association',()=>{
  const input=buildWorkspaceInput({kind:'note'},{...draft,date:'2026-10-14'},keys);
  assert.deepEqual(input.source,{type:'studio_supplement',record_id:null});
  assert.deepEqual(input.knowledge_ids,[]);
  assert.equal(input.plan_id,null);
  assert.equal(input.evidence_status,'self_reported');
  assert.equal(normalizeLearningEvent(input).studyDay,'2026-10-14');
  const undated=buildWorkspaceInput({kind:'note'},draft,keys);
  assert.equal(normalizeLearningEvent(undated).studyDay,null);
  assert.equal(undated.occurred_at,null);
});
test('invalid catalog targets, impossible dates or unsupported execution metadata reject before transport',()=>{
  for(const value of [{target:{kind:'practice',id:'missing'},draft},{target,draft:{...draft,date:'2026-02-30'}},{target,draft:{...draft,assistance:'verified'}},{target,draft:{...draft,summary:' '}},{target:{kind:'project',id:'c-engine',milestone:'missing'},draft}])assert.throws(()=>buildWorkspaceInput(value.target,value.draft,keys));
});
test('public keyword references are reading links, independent of personal mastery',()=>{
  const result=publicTopicReferences([{date:'2000-01-01',items:[{label:'合成公开记录',text:'指针'}]}],'c-pointers');assert.deepEqual(result,['2000-01-01']);assert.deepEqual(publicTopicReferences([],'missing'),[]);
});
test('private associations require exact known source instances and matching knowledge, never imply mastery',()=>{
  const current=event(buildWorkspaceInput(target,draft,keys));const historical={...current,event_id:'historical',kind:'historical_summary'};
  const malformed={...current,event_id:'malformed',source:{type:'studio',record_id:current.source.record_id+'.extra'}};
  const mismatch={...current,event_id:'mismatch',knowledge_ids:[]};
  const view=projectWorkspace(context([current,historical,malformed,mismatch]));assert.equal(view.practices.find(e=>e.id===target.id).events.length,1);assert.ok(view.topics.every(t=>t.mastery==='unconfirmed'));
  assert.throws(()=>projectWorkspace({...context([current]),evidence_refs:[]}));
});
test('partial private snapshots keep coverage limits explicit and revisions replace old evidence',()=>{
  const current={...event(buildWorkspaceInput(target,draft,keys)),revision:2};const c=context([current]);c.unknown_ranges=['older_events_omitted'];
  const view=projectWorkspace(c);assert.equal(view.partial,true);assert.equal(view.practices.find(e=>e.id===target.id).events[0].revision,2);
  assert.equal(projectWorkspace(context([])).topics[0].mastery,'unconfirmed');
});
test('project milestone projection isolates projects and does not promote submitted evidence to completion',()=>{
  const input=buildWorkspaceInput({kind:'project',id:'c-engine',milestone:'verification'},draft,keys),current=event(input);
  const view=projectWorkspace(context([current]));assert.equal(view.projects[0].milestones.find(m=>m.id==='verification').events.length,1);assert.equal(view.projects[1].milestones.flatMap(m=>m.events).length,0);assert.ok(!('completed' in view.projects[0]));
});
test('workspace recorder blocks concurrent submissions and retries the exact key/source after response loss',async()=>{
  let release;const inputs=[];let first=true;const recorder=new WorkspaceRecorder(async input=>{inputs.push(input);if(first){first=false;await new Promise(r=>release=r);throw Error('response lost');}return receipt;},()=>keys);
  const pending=recorder.submit(target,draft);assert.equal(await recorder.submit(target,draft),null);release();await assert.rejects(pending);assert.deepEqual(await recorder.submit(target,draft),receipt);assert.equal(inputs.length,2);assert.deepEqual(inputs[0],inputs[1]);
});
test('malformed receipt retains original intent; edited intent gets a new source and transport key',async()=>{
  const inputs=[];let n=0;const recorder=new WorkspaceRecorder(async input=>{inputs.push(input);return inputs.length===1?{saved:true}:receipt;},()=>({key:'synthetic-'+(++n),instance:`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`}));
  await assert.rejects(recorder.submit(target,draft));await recorder.submit(target,draft);assert.equal(inputs[0].idempotency_key,inputs[1].idempotency_key);
  await recorder.submit(target,{...draft,summary:'synthetic changed'});assert.notEqual(inputs[2].idempotency_key,inputs[1].idempotency_key);
});
test('record correction preserves source, association, uncertainty and expected revision',()=>{
  const current=event(buildWorkspaceInput(target,{...draft,date:'2026-10-13'},keys));const input=recordCorrection(current,'synthetic corrected','synthetic reason','correction-key');
  assert.equal(input.expected_revision,1);assert.deepEqual(input.event.source,current.source);assert.deepEqual(input.event.knowledge_ids,current.knowledge_ids);assert.equal(input.event.occurred_at,null);assert.equal(input.event.study_day_override.study_day,'2026-10-13');assert.equal(normalizeLearningEvent({...input.event,schema_version:1,idempotency_key:'synthetic'}).studyDay,'2026-10-13');
});
test('signed owner workspace saves, reads association, corrects, reads history and deletes via real handlers',async t=>{
  const f=await fixture(t),auth=await signedOwner(),base='https://synthetic.invalid';
  const client=new StudioHttpClient({fetchFn:async(url,init)=>{const headers=new Headers(init.headers);headers.set('cookie',auth.cookie);if(init.method!=='GET')headers.set('origin',base);const request=new Request(base+url,{...init,headers}),env={DB:f.db,...auth.config},options={now,verification:auth.verification};
    if(url.includes('/context'))return handleStudioContext(request,env,options);if(url==='/api/studio/events')return handleStudioEvents(request,env,options);
    const parts=url.split('/');if(url.includes('/revisions'))return handleStudioEventHistory(request,env,parts[4],options);return handleStudioEvent(request,env,parts[4],options);}});
  const saved=await client.saveEvent(buildWorkspaceInput(target,draft,keys));let view=projectWorkspace(await client.getContext('review'));assert.equal(view.practices.find(e=>e.id===target.id).events.length,1);
  const current=await client.getEvent(saved.event_id);await client.correctEvent(saved.event_id,recordCorrection(current,'synthetic corrected','synthetic reason','workspace-correction'));
  assert.equal((await client.getHistory(saved.event_id)).revisions.length,2);assert.equal((await client.getEvent(saved.event_id)).revision,2);
  await client.deleteEvent(saved.event_id,{schema_version:1,idempotency_key:'workspace-delete',expected_revision:2});view=projectWorkspace(await client.getContext('review'));assert.equal(view.practices.find(e=>e.id===target.id).events.length,0);assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM records').get().n,0);
});
test('history/correction/deletion clients reject incomplete or mismatched response bodies',async()=>{
  const client=new StudioHttpClient({fetchFn:async()=>Response.json({saved:true,deleted:true,event_id:'wrong'})});
  await assert.rejects(client.getHistory('expected'));await assert.rejects(client.correctEvent('expected',{expected_revision:1}));await assert.rejects(client.deleteEvent('expected',{expected_revision:1}));
});
