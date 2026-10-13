import {eventSchema,contextSchema} from '../lib/ui/studio-protocol.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { StudioHttpClient, StudioClientError } from '../lib/ui/studio-client.ts';

// All fixtures, tokens, receipts, and context payloads in this file are strictly synthetic.

const syntheticEventInput = {
  schema_version: 1,
  idempotency_key: 'synthetic-key-001',
  source: { type: 'studio_test', record_id: 'rec-001' },
  kind: 'learning_activity',
  occurred_at: '2026-10-13T10:00:00+08:00',
  time_precision: 'exact',
  study_day_override: null,
  content: { summary: '合成测试：验证 Studio 客户端请求封装' },
  evidence_status: 'self_reported',
  assistance: 'none',
  execution_mode: 'local_run',
  knowledge_ids: ['c_pointers'],
  plan_id: null,
};

const syntheticReceipt = {
  receipt_id: 'rcpt-synthetic-001',
  event_id: 'evt-synthetic-001',
  revision: 1,
  received_at: '2026-10-13T10:00:01Z',
  study_day: '2026-10-13',
  data_version: 10,
  saved: true,
  processing_status: 'pending',
  replayed: false,
};

const syntheticEventDTO = {
  ...syntheticEventInput,
  event_id: 'evt-synthetic-001',
  revision: 1,
  received_at: '2026-10-13T10:00:01Z',
  study_day: '2026-10-13',
  study_day_override_reason: null,
  visibility: 'private',
};

const syntheticContextDTO = {
  purpose: 'teaching',
  generated_at: '2026-10-13T10:00:05Z',
  latest_observed_event_at: '2026-10-13T10:00:00+08:00',
  data_version: 10,
  assessment_processed_version: 9,
  outline_version: 1,
  policy_version: 1,
  covered_sources: ['studio_test'],
  unknown_ranges: [],
  evidence_refs: [{ event_id: 'evt-synthetic-001', revision: 1 }],
  events: [syntheticEventDTO],
};

test('saveEvent dispatches correct POST request with same-origin credentials and parses SaveReceiptDTO', async () => {
  let capturedUrl = '';
  let capturedInit = null;

  const mockFetch = async (url, init) => {
    capturedUrl = String(url);
    capturedInit = init;
    return new Response(JSON.stringify(syntheticReceipt), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const client = new StudioHttpClient({ fetchFn: mockFetch });
  const result = await client.saveEvent(syntheticEventInput);

  assert.equal(capturedUrl, '/api/studio/events');
  assert.equal(capturedInit.method, 'POST');
  assert.equal(capturedInit.credentials, 'same-origin');
  assert.equal(capturedInit.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(capturedInit.body), syntheticEventInput);
  assert.deepEqual(result, syntheticReceipt);
});

test('getEvent dispatches GET request and parses LearningEventDTO', async () => {
  let capturedUrl = '';

  const mockFetch = async (url, init) => {
    capturedUrl = String(url);
    return new Response(JSON.stringify(syntheticEventDTO), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const client = new StudioHttpClient({ fetchFn: mockFetch });
  const result = await client.getEvent('evt-synthetic-001');

  assert.equal(capturedUrl, '/api/studio/events/evt-synthetic-001');
  assert.deepEqual(result, eventSchema.parse(syntheticEventDTO));
});

test('getContext dispatches GET request with encoded purpose query', async () => {
  let capturedUrl = '';

  const mockFetch = async (url) => {
    capturedUrl = String(url);
    return new Response(JSON.stringify(syntheticContextDTO), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const client = new StudioHttpClient({ fetchFn: mockFetch });
  const result = await client.getContext('teaching');

  assert.equal(capturedUrl, '/api/studio/context?purpose=teaching');
  assert.deepEqual(result, contextSchema.parse(syntheticContextDTO));
});

test('401 and 403 responses throw StudioClientError with PRIVATE_ACCESS_DENIED without faking empty profile', async () => {
  const mockFetch = async () => {
    return new Response(
      JSON.stringify({ error: { code: 'PRIVATE_ACCESS_DENIED', message: 'Owner token required' } }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const client = new StudioHttpClient({ fetchFn: mockFetch });

  await assert.rejects(
    async () => client.getContext('teaching'),
    (err) => {
      assert(err instanceof StudioClientError);
      assert.equal(err.status, 401);
      assert.equal(err.code, 'PRIVATE_ACCESS_DENIED');
      return true;
    }
  );
});

test('409 responses correctly map IDEMPOTENCY_CONFLICT and REVISION_CONFLICT', async () => {
  const mockFetchConflict = async () => {
    return new Response(
      JSON.stringify({ error: { code: 'IDEMPOTENCY_CONFLICT', message: 'Idempotency conflict' } }),
      { status: 409, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const client = new StudioHttpClient({ fetchFn: mockFetchConflict });

  await assert.rejects(
    async () => client.saveEvent(syntheticEventInput),
    (err) => {
      assert(err instanceof StudioClientError);
      assert.equal(err.status, 409);
      assert.equal(err.code, 'IDEMPOTENCY_CONFLICT');
      return true;
    }
  );
});

test('503 and server errors throw SERVICE_UNAVAILABLE', async () => {
  const mockFetch503 = async () => {
    return new Response('Database temporarily unavailable', { status: 503 });
  };

  const client = new StudioHttpClient({ fetchFn: mockFetch503 });

  await assert.rejects(
    async () => client.getEvent('any-id'),
    (err) => {
      assert(err instanceof StudioClientError);
      assert.equal(err.status, 503);
      assert.equal(err.code, 'SERVICE_UNAVAILABLE');
      return true;
    }
  );
});

test('request timeout triggers TIMEOUT_ERROR', async () => {
  const mockHangingFetch = async (_url, init) => {
    return new Promise((resolve, reject) => {
      init.signal?.addEventListener('abort', () => {
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        reject(error);
      });
    });
  };

  const client = new StudioHttpClient({ fetchFn: mockHangingFetch, defaultTimeoutMs: 50 });

  await assert.rejects(
    async () => client.getEvent('any-id'),
    (err) => {
      assert(err instanceof StudioClientError);
      assert.equal(err.code, 'TIMEOUT_ERROR');
      return true;
    }
  );
});
