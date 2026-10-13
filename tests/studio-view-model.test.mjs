import test from 'node:test';
import assert from 'node:assert/strict';
import { StudioHttpClient, StudioClientError } from '../lib/ui/studio-client.ts';
import { StudioViewModel } from '../lib/ui/studio-view-model.ts';

// All data and receipts in this test file are synthetic.

const syntheticEventDTO = {
  event_id: 'evt-synthetic-vm-01',
  revision: 1,
  schema_version: 1,
  idempotency_key: 'key-vm-01',
  source: { type: 'studio', record_id: null },
  kind: 'learning_activity',
  occurred_at: '2026-10-13T09:00:00+08:00',
  time_precision: 'exact',
  study_day: '2026-10-13',
  study_day_override: null,
  study_day_override_reason: null,
  content: { summary: '合成模型测试内容' },
  evidence_status: 'self_reported',
  assistance: 'none',
  execution_mode: 'local_run',
  knowledge_ids: ['c_arrays'],
  plan_id: null,
  visibility: 'private',
  received_at: '2026-10-13T09:00:01Z',
};

const syntheticContext = {
  purpose: 'teaching',
  generated_at: '2026-10-13T09:00:05Z',
  latest_observed_event_at: '2026-10-13T09:00:00+08:00',
  data_version: 5,
  assessment_processed_version: 5,
  outline_version: 1,
  policy_version: 1,
  covered_sources: ['studio'],
  unknown_ranges: [],
  evidence_refs: [{ event_id: 'evt-synthetic-vm-01', revision: 1 }],
  events: [syntheticEventDTO],
};

test('loadContext populates events and update meta on success', async () => {
  const mockFetch = async () =>
    new Response(JSON.stringify(syntheticContext), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  const client = new StudioHttpClient({ fetchFn: mockFetch });
  const vm = new StudioViewModel(client);

  await vm.loadContext();
  const state = vm.getState();

  assert.equal(state.loadingEvents, false);
  assert.equal(state.eventsError, null);
  assert.equal(state.events.length, 1);
  assert.equal(state.events[0].event_id, 'evt-synthetic-vm-01');
  assert.equal(state.overview.connectionState, 'available');
  assert.equal(state.overview.lastContentUpdatedAt, '2026-10-13T09:00:00+08:00');
});

test('loadContext on 401/403 sets clear permission alert and does not fake empty profile', async () => {
  const mockFetch = async () =>
    new Response(
      JSON.stringify({ error: { code: 'PRIVATE_ACCESS_DENIED', message: 'Unauthorized' } }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );

  const client = new StudioHttpClient({ fetchFn: mockFetch });
  const vm = new StudioViewModel(client);

  await vm.loadContext();
  const state = vm.getState();

  assert.equal(state.loadingEvents, false);
  assert.notEqual(state.eventsError, null);
  assert.equal(state.overview.notice?.kind, 'action_required');
  assert(state.overview.notice?.text.includes('私人学习空间需所有者授权'));
});

test('idempotency key remains identical on retry when payload text is unmodified', async () => {
  const capturedKeys = [];
  let shouldFail = true;

  const mockFetch = async (url, init) => {
    const urlStr = String(url);
    if (urlStr.includes('/api/studio/events') && init.method === 'POST') {
      const payload = JSON.parse(init.body);
      capturedKeys.push(payload.idempotency_key);

      if (shouldFail) {
        shouldFail = false;
        return new Response(
          JSON.stringify({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Temporary failure' } }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          receipt_id: 'rcpt-retry-01',
          event_id: 'evt-retry-01',
          revision: 1,
          received_at: '2026-10-13T10:00:00Z',
          study_day: '2026-10-13',
          data_version: 6,
          saved: true,
          processing_status: 'pending',
          replayed: false,
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify(syntheticContext), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const client = new StudioHttpClient({ fetchFn: mockFetch });
  const vm = new StudioViewModel(client);

  vm.updateSupplementDraft('指针练习');

  // 第一次提交（模拟失败）
  const resultFail = await vm.submitSupplement();
  assert.equal(resultFail, null);
  assert.equal(vm.getState().supplementState, 'error');
  assert.equal(vm.getState().supplementDraft, '指针练习'); // 失败保留草稿
  assert.equal(capturedKeys.length, 1);

  // 用户未修改草稿，直接重试提交
  const resultSuccess = await vm.submitSupplement();
  assert.notEqual(resultSuccess, null);
  assert.equal(vm.getState().supplementState, 'saved');
  assert.equal(vm.getState().supplementDraft, ''); // 成功清空草稿
  assert.equal(capturedKeys.length, 2);

  // 核心断言：未修改载荷时重试必须沿用相同的幂等键
  assert.equal(capturedKeys[0], capturedKeys[1]);
});

test('idempotency key changes when draft text is edited after failure', async () => {
  const capturedKeys = [];

  const mockFetch = async (url, init) => {
    const urlStr = String(url);
    if (urlStr.includes('/api/studio/events') && init.method === 'POST') {
      const payload = JSON.parse(init.body);
      capturedKeys.push(payload.idempotency_key);

      return new Response(
        JSON.stringify({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Temporary failure' } }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response(JSON.stringify(syntheticContext), { status: 200 });
  };

  const client = new StudioHttpClient({ fetchFn: mockFetch });
  const vm = new StudioViewModel(client);

  vm.updateSupplementDraft('初始草稿文本');
  await vm.submitSupplement();
  assert.equal(capturedKeys.length, 1);

  // 用户修改了草稿文本（修改了载荷）
  vm.updateSupplementDraft('修改后的草稿文本');
  await vm.submitSupplement();
  assert.equal(capturedKeys.length, 2);

  // 核心断言：修改载荷后必须生成新的幂等键，绝不能沿用旧键
  assert.notEqual(capturedKeys[0], capturedKeys[1]);
});

test('selectEvent updates selectedEventId and subscribe notifies listeners', () => {
  const client = new StudioHttpClient();
  const vm = new StudioViewModel(client);

  let notifiedCount = 0;
  const unsubscribe = vm.subscribe(() => {
    notifiedCount++;
  });

  vm.selectEvent('evt-123');
  assert.equal(vm.getState().selectedEventId, 'evt-123');
  assert.equal(notifiedCount, 1);

  vm.selectEvent(null);
  assert.equal(vm.getState().selectedEventId, null);
  assert.equal(notifiedCount, 2);

  unsubscribe();
  vm.selectEvent('evt-456');
  assert.equal(notifiedCount, 2); // 取消订阅后不再通知
});
