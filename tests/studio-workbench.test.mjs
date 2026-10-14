import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {compileAllStudioComponents} from './helpers/compile-studio.mjs';
import {emptyProjectContent} from '../lib/ui/project-protocol.ts';
import {projectPublicationChanges,planPublicationChanges} from '../lib/ui/studio-publication-changes.ts';
compileAllStudioComponents();
const {default:Workbench}=await import('./.generated/studio-workbench.mjs');
const {default:Changes}=await import('./.generated/studio-publication-changes.mjs');
const goal={id:'synthetic-goal',title:'Synthetic active goal',status:'planned',summary:'Synthetic explanation',next_step:'Synthetic next action',target_date:null};
const content={...emptyProjectContent(),status:'in_progress',summary:'Synthetic current progress',next_step:'Synthetic project action'};
const project={project_id:'c-engine',revision:2,draft:content,private_note:'SYNTHETIC_PRIVATE_NOTE',publication:{revision:1,content:emptyProjectContent(),published_at:'2026-10-14T00:00:00Z'}};
const plan={plan_id:'personal-goals',revision:1,draft:{goals:[goal]},private_note:'SYNTHETIC_PLAN_NOTE',publication:null};
const context={events:[{event_id:'synthetic-record',study_day:null,content:{summary:'Synthetic recent record'}}]};

test('workbench shows actual goals, project next actions and saved publication differences',()=>{
  const html=renderToStaticMarkup(React.createElement(Workbench,{plans:[plan],projects:[project],context}));
  for(const value of [goal.title,goal.next_step,content.next_step,'Synthetic recent record','待发布变化'])assert.ok(html.includes(value));
  assert.ok(html.includes('/studio/private/workspace?project=c-engine&amp;milestone=interface'));
  assert.ok(html.includes('/studio/private/projects?project=c-engine'));
  assert.ok(!html.includes('SYNTHETIC_PRIVATE_NOTE'));
  assert.ok(!html.includes('SYNTHETIC_PLAN_NOTE'));
});

test('failed modules stay distinct from empty modules and do not hide successfully read work',()=>{
  const html=renderToStaticMarkup(React.createElement(Workbench,{plans:null,projects:[project],context:null}));
  assert.ok(html.includes('目标暂时无法读取'));
  assert.ok(html.includes('近期记录暂时无法读取'));
  assert.ok(html.includes(content.next_step));
  assert.ok(!html.includes('目前没有待发布的变化'));
  assert.ok(!html.includes('暂无未完成的目标'));
  const empty=renderToStaticMarkup(React.createElement(Workbench,{plans:[],projects:[],context:{events:[]}}));
  assert.ok(empty.includes('暂无未完成的目标'));
  assert.ok(empty.includes('目前没有待发布的变化'));
});

test('private notes never count as publication changes; cleared drafts keep old public targets visible',()=>{
  const unchanged={...project,publication:{...project.publication,content:{...content}}};
  const html=renderToStaticMarkup(React.createElement(Workbench,{plans:[],projects:[unchanged],context:{events:[]}}));
  assert.ok(html.includes('目前没有待发布的变化'));
  const cleared={...plan,draft:{goals:[]},publication:{content:{goals:[goal]}}};
  const removed=renderToStaticMarkup(React.createElement(Workbench,{plans:[cleared],projects:[],context:{events:[]}}));
  assert.ok(removed.includes('旧公开目标仍保留'));
});

test('workbench retains pending public differences when a draft summary is cleared and reports system uncertainty',()=>{
  const cleared={...project,draft:{...content,summary:''},publication:{...project.publication,content}};
  const html=renderToStaticMarkup(React.createElement(Workbench,{plans:[],projects:[cleared],context:{events:[]},systemNeedsAttention:null}));
  assert.ok(html.includes('系统状态暂时无法读取'));
  assert.ok(!html.includes('目前没有待发布的变化'));
  const warning=renderToStaticMarkup(React.createElement(Workbench,{plans:[],projects:[],context:{events:[]},systemNeedsAttention:2}));
  assert.ok(warning.includes('2'));
  assert.ok(warning.includes('项后台状态需要查看'));
  assert.ok(warning.includes('/studio/private/system'));
});

test('project preview compares only changed public fields, including milestones',()=>{
  const updated={...content,milestones:{...content.milestones,interface:'completed'},private_note:'DO_NOT_PUBLISH'};
  const changes=projectPublicationChanges('c-engine',updated,content);
  assert.equal(changes.length,1);
  assert.equal(changes[0].before,'未开始');
  assert.equal(changes[0].after,'已完成');
  assert.ok(!JSON.stringify(changes).includes('DO_NOT_PUBLISH'));
  const html=renderToStaticMarkup(React.createElement(Changes,{changes:[{label:'Synthetic <script>',before:'<script>alert(1)</script>',after:'Safe'}]}));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('goal preview exposes removal, field edits and ordering rather than silently replacing the list',()=>{
  const second={...goal,id:'synthetic-second',title:'Synthetic second goal'};
  const removed=planPublicationChanges({goals:[{...second,next_step:'Changed next action'}]},{goals:[goal,second]});
  assert.ok(removed.some(change=>change.label.includes('从公开列表移除')&&change.before===goal.title));
  assert.ok(removed.some(change=>change.after==='Changed next action'));
  assert.ok(planPublicationChanges({goals:[second,goal]},{goals:[goal,second]}).some(change=>change.label==='目标顺序'));
  assert.deepEqual(planPublicationChanges({goals:[goal]},{goals:[goal]}),[]);
});
