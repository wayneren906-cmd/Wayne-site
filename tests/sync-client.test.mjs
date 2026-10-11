import test from 'node:test';
import assert from 'node:assert/strict';
import { checkRevision, verifyRecord } from '../scripts/sync-client.mjs';
const draft={date:'2026-10-10',items:[{label:'学习',text:'真实摘要'}],practice:'未运行',expectedRevision:2};
test('uploader refuses untracked existing dates and manual edits',()=>{
  assert.throws(()=>checkRevision(draft,{revision:2},{}),/人工/);
  assert.throws(()=>checkRevision(draft,{revision:2},{'2026-10-10':{revision:1}}),/人工/);
  assert.doesNotThrow(()=>checkRevision(draft,{revision:2},{'2026-10-10':{revision:2}}));
  assert.doesNotThrow(()=>checkRevision(draft,{revision:2},{},true));
});
test('uploader allows only exact-content replay after a lost response',()=>{
  const current={...draft,revision:3};
  assert.doesNotThrow(()=>checkRevision(draft,current,{'2026-10-10':{revision:2}}));
  assert.throws(()=>checkRevision({...draft,practice:'different'},current,{'2026-10-10':{revision:2}}),/版本/);
});
test('uploader does not record success without exact read-back verification',()=>{
  const saved={...draft,revision:3};
  assert.doesNotThrow(()=>verifyRecord(draft,saved,saved));
  assert.throws(()=>verifyRecord(draft,saved,{...saved,practice:'人工修改'}),/核对/);
  assert.throws(()=>verifyRecord(draft,saved,{...saved,revision:4}),/核对/);
});
test('uploader recovers initial creation and adoption only with an exact pending draft',()=>{
  const created={...draft,expectedRevision:0};
  assert.doesNotThrow(()=>checkRevision(created,{...created,revision:1},{},false,{[draft.date]:created}));
  assert.doesNotThrow(()=>checkRevision(draft,{...draft,revision:3},{},false,{[draft.date]:draft}));
  assert.throws(()=>checkRevision(draft,{...draft,revision:3},{},false,{[draft.date]:{...draft,practice:'different'}}),/版本/);
});
