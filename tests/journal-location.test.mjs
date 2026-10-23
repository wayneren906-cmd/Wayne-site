import test from 'node:test';
import assert from 'node:assert/strict';
import {readJournalLocation,journalLocationURL,emptyJournalLocation} from '../lib/ui/journal-location.ts';

test('shared dates take precedence over stale month and text filters',()=>{
  assert.deepEqual(readJournalLocation('?date=2026-10-22&month=2026-09&q=missing'),{...emptyJournalLocation,date:'2026-10-22'});
  assert.deepEqual(readJournalLocation('?date=2026-02-30&month=2026-13&snapshot=bad'),emptyJournalLocation);
});
test('month, unicode query and snapshot round trip without losing unrelated URL state',()=>{
  const filters={date:'',month:'2026-09',query:'GPIO & 输入 + 输出',snapshot:'2026-10-21'};
  const url=journalLocationURL('https://example.test/learning?date=2026-10-22&from=index#journal-records',filters);
  const parsed=new URL(url,'https://example.test');
  assert.deepEqual(readJournalLocation(parsed.search),filters);
  assert.equal(parsed.searchParams.get('from'),'index');
  assert.equal(parsed.hash,'#journal-records');
  assert.equal(parsed.searchParams.has('date'),false);
});
test('clearing filters removes old values so reload restores the unfiltered journal',()=>{
  const url=journalLocationURL('https://example.test/learning?date=2026-10-22&month=2026-09&q=GPIO&snapshot=2026-10-21',emptyJournalLocation);
  assert.equal(url,'/learning');
  assert.deepEqual(readJournalLocation(new URL(url,'https://example.test').search),emptyJournalLocation);
});
