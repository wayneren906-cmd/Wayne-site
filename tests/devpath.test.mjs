import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveDevPathRecords,devPathIdFromHash,devPathDetailHref} from '../lib/devpath.ts';
import {devPathTopics,devPathArticles,devPathDirections,devPathMilestones,devPathRecords,devPathIds} from '../content/devpath.ts';

test('daily evidence uses the canonical public Journal identity and current text',()=>{
  const records=[{date:'2026-10-26',items:[{label:'验证边界',text:'只确认三项按键测试；TIM 为理论学习。'}],practice:'补充内容',revision:2,updatedAt:'2026-10-28T00:00:00Z',privateNote:'not public'}];
  const resolved=resolveDevPathRecords(devPathRecords,records);
  const exti=resolved.find(page=>page.id==='exti');
  assert.equal(exti.blocks[1].text,records[0].items[0].text);
  assert.equal(exti.aside[0].link,'/learning?date=2026-10-26');
  assert.equal(exti.blocks.at(-1).text,'补充内容');
  assert.ok(!JSON.stringify(resolved).includes('not public'));
  assert.ok(!('body' in devPathRecords[0]));
  assert.ok(resolved.find(page=>page.id==='first-board').blocks[0].text.includes('暂未收录'));
  assert.ok(resolveDevPathRecords(devPathRecords,[],true)[0].blocks[0].text.includes('暂时无法读取'));
});

test('all topic, evidence and related links resolve without a prototype-only page',()=>{
  const pages=[...devPathArticles,...devPathRecords];
  const ids=pages.map(page=>page.id);
  assert.equal(new Set(ids).size,ids.length);
  assert.equal(devPathTopics.length,5);
  assert.ok(!ids.includes('prototype'));
  for(const page of pages){
    for(const id of page.related)assert.ok(ids.includes(id),`${page.id} -> ${id}`);
    for(const block of page.blocks??[])if(block.type==='records')for(const id of block.ids)assert.ok(devPathRecords.some(ref=>ref.id===id));
  }
  assert.equal(devPathDirections.length,5);
  for(const direction of devPathDirections)for(const link of direction.links)assert.ok(ids.includes(link.id));
  for(const milestone of devPathMilestones)assert.ok(ids.includes(milestone.pageId));
  assert.deepEqual(ids,devPathIds);
  for(const id of ['hardware','wayneo','product','career','ai','about','chapter','first-board','exti']){
    assert.ok(ids.includes(id),'legacy id '+id);
    assert.equal(devPathDetailHref(id),`/studio/devpath/${id}`);
  }
});

test('detail fragments cannot interpret other site anchors or arbitrary IDs',()=>{
  const ids=['hardware','exti'];
  assert.equal(devPathIdFromHash('#view/exti',ids),'exti');
  for(const hash of ['#collection','#journal','#view/unknown','#view/../studio','#view/%65xti'])assert.equal(devPathIdFromHash(hash,ids),null);
});
