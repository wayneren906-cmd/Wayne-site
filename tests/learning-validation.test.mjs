import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeLearningEvent} from '../lib/learning/event-validation.ts';

const input = () => ({schema_version: 1, idempotency_key: 'synthetic-key', source: {type: 'studio', record_id: 'synthetic-source'}, kind: 'learning_activity', occurred_at: null, time_precision: 'unknown', study_day_override: null, content: {summary: '合成练习，仅用于测试'}, evidence_status: 'self_reported', assistance: 'unknown', execution_mode: 'unknown', knowledge_ids: [], plan_id: null});

test('C2-A exact time uses the Beijing 06:00 boundary and normalizes offsets', () => {
  const event = {...input(), occurred_at: '2026-10-13T05:59:59+08:00', time_precision: 'exact'};
  assert.equal(normalizeLearningEvent(event).studyDay, '2026-10-12');
  assert.equal(normalizeLearningEvent({...event, occurred_at: '2026-10-12T21:59:59Z'}).input.occurred_at, '2026-10-12T21:59:59.000Z');
  assert.equal(normalizeLearningEvent({...event, occurred_at: '2026-10-13T06:00:00+08:00'}).studyDay, '2026-10-13');
  assert.equal(normalizeLearningEvent({...event, occurred_at: '2027-01-01T05:00:00+08:00'}).studyDay, '2026-12-31');
});

test('C2-A unknown time stays unknown and an explicit date override retains its reason', () => {
  assert.equal(normalizeLearningEvent(input()).studyDay, null);
  const date = normalizeLearningEvent({...input(), time_precision: 'date', study_day_override: {study_day: '2026-10-01', reason: '合成来源仅提供日期'}});
  assert.equal(date.studyDay, '2026-10-01');
  assert.equal(date.input.occurred_at, null);
  assert.equal(date.input.study_day_override.reason, '合成来源仅提供日期');
});

test('C2-A only implemented sources are accepted and omitted evidence remains unknown', () => {
  for (const type of ['studio', 'studio_supplement']) {
    const {evidence_status, ...raw} = input();
    const normalized = normalizeLearningEvent({...raw, source: {type, record_id: null}});
    assert.equal(normalized.input.evidence_status, 'unknown');
    assert.equal(normalized.input.source.type, type);
  }
  assert.throws(() => normalizeLearningEvent({...input(), source: {type: 'invented_verified_source', record_id: null}}), {code: 'INVALID_INPUT'});
});

test('C2-A normalized payload ignores object order but preserves distinct source and content', () => {
  const a = normalizeLearningEvent({...input(), knowledge_ids: ['synthetic-b', 'synthetic-a']});
  const b = normalizeLearningEvent({...Object.fromEntries(Object.entries(input()).reverse()), content: {summary: '  合成练习，仅用于测试  '}, knowledge_ids: ['synthetic-a', 'synthetic-b']});
  assert.equal(a.canonicalPayload, b.canonicalPayload);
  assert.notEqual(a.canonicalPayload, normalizeLearningEvent({...input(), content: {summary: '不同合成练习'}}).canonicalPayload);
});

test('C2-A invalid fields, authority injection, invented verification and unsupported corrections are rejected', () => {
  for (const candidate of [
    {...input(), owner_id: 'another-owner'}, {...input(), visibility: 'public'}, {...input(), role: 'owner'},
    {...input(), evidence_status: 'artifact_checked'}, {...input(), kind: 'user_correction'},
    {...input(), content: {summary: ''}}, {...input(), schema_version: 2},
    {...input(), knowledge_ids: ['duplicate', 'duplicate']}, {...input(), time_precision: 'date'},
    {...input(), occurred_at: '2026-02-30T10:00:00+08:00', time_precision: 'exact'},
    {...input(), occurred_at: '2026-10-13T10:00:00', time_precision: 'exact'},
    {...input(), occurred_at: '2026-10-13T10:00:00Z'},
    {...input(), study_day_override: {study_day: '2026-02-30', reason: 'synthetic'}},
    {...input(), study_day_override: {study_day: '2026-10-13', reason: ' '}},
    {...input(), kind: 'historical_summary', evidence_status: 'self_reported'},
  ]) assert.throws(() => normalizeLearningEvent(candidate), {code: 'INVALID_INPUT'});
  assert.throws(() => normalizeLearningEvent({...input(), content: {summary: 'x'.repeat(70000)}}), {code: 'PAYLOAD_TOO_LARGE'});
});
