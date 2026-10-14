import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { compileAllStudioComponents } from './helpers/compile-studio.mjs';
compileAllStudioComponents();

const { default: StudioOverview } = await import('./.generated/studio-overview.mjs');
const { default: StudioEventList } = await import('./.generated/studio-event-list.mjs');
const { default: StudioEventDetail } = await import('./.generated/studio-event-detail.mjs');
const { default: StudioSupplementForm } = await import('./.generated/studio-supplement-form.mjs');
const { default: StudioClient } = await import('./.generated/studio-client.mjs');
const { default: StudioPrivateNavigation } = await import('./.generated/studio-private-navigation.mjs');
import { StudioHttpClient, createStudioHttpClientAdapter } from '../lib/ui/studio-client.ts';

// All fixtures, events, and mock data in this test file are strictly synthetic.

test('every private section offers the same navigation with exactly one current destination', () => {
  for (const active of ['management', 'records', 'projects', 'plans', 'system']) {
    const html = renderToStaticMarkup(React.createElement(StudioPrivateNavigation, {active}));
    assert.equal((html.match(/aria-current="page"/g) || []).length, 1);
    for (const href of ['/studio/private/management', '/studio/private', '/studio/private/projects', '/studio/private/plans', '/studio/private/system']) assert.ok(html.includes(`href="${href}"`));
    assert.ok(html.includes('私人管理栏目'));
  }
});

test('private record list uses the unified composer instead of a second inline form',()=>{
  const html=renderToStaticMarkup(React.createElement(StudioClient,{showSupplement:false,initialEvents:[],readOnly:true}));
  assert.ok(html.includes('href="/studio/private/workspace"'));
  assert.ok(!html.includes('<textarea'));
  assert.ok(!html.includes('href="#supplement"'));
});

const syntheticEvent1 = {
  event_id: 'evt-comp-01',
  revision: 1,
  schema_version: 1,
  idempotency_key: 'key-comp-01',
  source: { type: 'studio', record_id: 'src-01' },
  kind: 'learning_activity',
  occurred_at: '2026-10-13T08:30:00+08:00',
  time_precision: 'exact',
  study_day: '2026-10-13',
  study_day_override: null,
  study_day_override_reason: null,
  content: { summary: 'C语言指针解引用与内存模型' },
  evidence_status: 'artifact_checked',
  assistance: 'none',
  execution_mode: 'local_run',
  knowledge_ids: ['c_pointers', 'memory_layout'],
  plan_id: null,
  visibility: 'private',
  received_at: '2026-10-13T08:30:01Z',
};

// 同一天的第二个独立事件，验证不合并
const syntheticEvent2 = {
  event_id: 'evt-comp-02',
  revision: 1,
  schema_version: 1,
  idempotency_key: 'key-comp-02',
  source: { type: 'studio', record_id: 'src-02' },
  kind: 'learning_activity',
  occurred_at: null, // 发生时间未知
  time_precision: 'unknown',
  study_day: '2026-10-13',
  study_day_override: null,
  study_day_override_reason: null,
  content: { summary: '指针算术与数组下标越界调试 <script>alert(1)</script>' }, // 包含需转义的内容
  evidence_status: 'self_reported',
  assistance: 'concept_hint',
  execution_mode: 'simulated_analysis',
  knowledge_ids: ['c_pointers'],
  plan_id: 'plan-c-basics',
  visibility: 'private',
  received_at: '2026-10-13T14:00:00Z',
};

test('StudioOverview renders empty focus truthfully and distinguishes connection states', () => {
  // 1. 空安排
  const htmlEmpty = renderToStaticMarkup(
    React.createElement(StudioOverview, {
      currentFocus: null,
      notice: null,
      connectionState: 'not_connected',
      lastContentUpdatedAt: null,
      supplementHref: null,
      loading: false,
    })
  );
  assert(htmlEmpty.includes('记录实际学习与实践'), '记录概况不冒充未接入的学习安排');
  assert(htmlEmpty.includes('/studio/private/plans'), '提供已实现的手动目标管理入口');
  assert(htmlEmpty.includes('未接入'), 'not_connected 映射为 未接入');
  assert(htmlEmpty.includes('学习时间未知或暂无记录'), 'lastContentUpdatedAt 为空时提示尚未同步');
  assert(!htmlEmpty.includes('studio-overview__supplement-button'), '无 supplementHref 时不渲染补充按钮');

  // 2. 有安排与可用状态
  const htmlFocus = renderToStaticMarkup(
    React.createElement(StudioOverview, {
      currentFocus: { title: '指针与数组', detail: '掌握指针算术与下标转换关系。' },
      notice: { kind: 'action_required', text: '需要确认新生成的安排' },
      connectionState: 'available',
      lastContentUpdatedAt: '2026-10-13T12:00:00+08:00',
      supplementHref: '#supplement',
      loading: false,
    })
  );
  assert(htmlFocus.includes('指针与数组'));
  assert(htmlFocus.includes('通道可用'));
  assert(htmlFocus.includes('需要确认'));
  assert(htmlFocus.includes('role="alert"'), 'action_required 对应 alert 语义');
  assert(htmlFocus.includes('href="#supplement"'));

  // 3. 读取加载态
  const htmlLoading = renderToStaticMarkup(
    React.createElement(StudioOverview, {
      currentFocus: null,
      notice: null,
      connectionState: 'temporarily_unavailable',
      lastContentUpdatedAt: null,
      supplementHref: '#supplement',
      loading: true,
    })
  );
  assert(htmlLoading.includes('aria-label="正在读取记录概况…"'));
  assert(htmlLoading.includes('暂时不可用'));
});

test('StudioEventList renders two same-day events separately and formats unknown times honestly', () => {
  const html = renderToStaticMarkup(
    React.createElement(StudioEventList, {
      events: [syntheticEvent1, syntheticEvent2],
      selectedEventId: 'evt-comp-01',
      loading: false,
      errorMessage: null,
      onSelect: () => {},
      onRetry: () => {},
    })
  );

  // 同一天两次事件分别保留，各有一个 option 项
  assert(html.includes('data-event-id="evt-comp-01"'));
  assert(html.includes('data-event-id="evt-comp-02"'));
  assert(html.includes('C语言指针解引用与内存模型'));
  assert(html.includes('指针算术与数组下标越界调试'));
  assert.equal((html.match(/role="option"/g) || []).length, 2, '同日两个事件作为独立项展示');

  // 第一个事件为选中态
  assert(html.includes('aria-selected="true"'));
  assert(html.includes('aria-selected="false"'));

  // 第二个事件发生时间未知，诚实展示
  assert(html.includes('时间未知'));
  assert(html.includes('本次读取 2 条'));
  assert(html.includes('不是完整档案'));

  // 特殊字符转义安全验证：不应包含未经转义的原始 <script> 标签
  assert(!html.includes('<script>alert(1)</script>'));
  assert(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
});

test('StudioEventList renders empty state and error state with retry button', () => {
  const htmlEmpty = renderToStaticMarkup(
    React.createElement(StudioEventList, {
      events: [],
      selectedEventId: null,
      loading: false,
      errorMessage: null,
      onSelect: () => {},
      onRetry: () => {},
    })
  );
  assert(htmlEmpty.includes('暂无学习事件'));

  const htmlError = renderToStaticMarkup(
    React.createElement(StudioEventList, {
      events: [],
      selectedEventId: null,
      loading: false,
      errorMessage: '网络连接超时',
      onSelect: () => {},
      onRetry: () => {},
    })
  );
  assert(htmlError.includes('role="alert"'));
  assert(htmlError.includes('网络连接超时'));
  assert(htmlError.includes('重试读取'));
});

test('StudioEventDetail renders all fact fields and close button, returning null when event is null', () => {
  const htmlNull = renderToStaticMarkup(
    React.createElement(StudioEventDetail, {
      event: null,
      onClose: () => {},
    })
  );
  assert.equal(htmlNull, '');

  const htmlDetail = renderToStaticMarkup(
    React.createElement(StudioEventDetail, {
      event: syntheticEvent1,
      onClose: () => {},
    })
  );
  assert(htmlDetail.includes('evt-comp-01'));
  assert(htmlDetail.includes('物证已核实'));
  assert(htmlDetail.includes('独立完成（无提示）'));
  assert(htmlDetail.includes('本机编译与运行'));
  assert(htmlDetail.includes('私有（private）'));
  assert(htmlDetail.includes('memory_layout'));
  assert(htmlDetail.includes('aria-label="关闭事件详情"'));
});

test('StudioSupplementForm handles disabled state during saving and preserves draft on error', () => {
  // 1. 保存中：按钮 disabled，显示“正在保存…”
  const htmlSaving = renderToStaticMarkup(
    React.createElement(StudioSupplementForm, {
      text: '正在输入的草稿',
      state: 'saving',
      errorMessage: null,
      onChange: () => {},
      onSubmit: () => {},
    })
  );
  assert(htmlSaving.includes('disabled=""'));
  assert(htmlSaving.includes('正在保存…'));
  assert(htmlSaving.includes('7 字'));

  // 2. 保存错误：显示错误提示，textarea 仍保留用户输入的文本
  const htmlError = renderToStaticMarkup(
    React.createElement(StudioSupplementForm, {
      text: '重要的用户草稿',
      state: 'error',
      errorMessage: '服务器暂时不可用',
      onChange: () => {},
      onSubmit: () => {},
    })
  );
  assert(htmlError.includes('重要的用户草稿'));
  assert(htmlError.includes('服务器暂时不可用'));
  assert(htmlError.includes('role="alert"'));

  // 3. 已保存反馈
  const htmlSaved = renderToStaticMarkup(
    React.createElement(StudioSupplementForm, {
      text: '',
      state: 'saved',
      errorMessage: null,
      onChange: () => {},
      onSubmit: () => {},
    })
  );
  assert(htmlSaved.includes('记录已保存，尚未进行能力评估'));
  assert(htmlSaved.includes('role="status"'));
});

test('StudioClient composite renders full layout and integrates adapter with idempotency lock', async () => {
  // 验证静态服务端渲染完整性
  const htmlStatic = renderToStaticMarkup(
    React.createElement(StudioClient, {
      initialEvents: [syntheticEvent1, syntheticEvent2],
      initialOverview: {
        currentFocus: null,
        notice: null,
        connectionState: 'available',
        lastContentUpdatedAt: null,
        supplementHref: '#supplement',
        loading: false,
      },
    })
  );
  assert(htmlStatic.includes('STUDIO / 学习操作台'));
  assert(htmlStatic.includes('补充学习记录'));
  assert(htmlStatic.includes('data-event-id="evt-comp-01"'));
  assert(htmlStatic.includes('data-event-id="evt-comp-02"'));
  assert(htmlStatic.includes('C语言指针解引用与内存模型'));

  // 验证 createStudioHttpClientAdapter 与 StudioHttpClient 的连接契约
  let httpPostKey = null;
  const mockFetch = async (_url, init) => {
    if (init.method === 'POST') {
      const body = JSON.parse(init.body);
      httpPostKey = body.idempotency_key;
      return new Response(
        JSON.stringify({
          receipt_id: 'rcpt-http-01',
          event_id: 'evt-http-01',
          revision: 1,
          received_at: '2026-10-13T10:00:00Z',
          study_day: '2026-10-13',
          data_version: 2,
          saved: true,
          processing_status: 'pending',
          replayed: false,
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response(
      JSON.stringify({
        purpose: 'teaching',
        generated_at: '2026-10-13T10:00:00Z',
        latest_observed_event_at: '2026-10-13T10:00:00Z',
        data_version: 2,
        assessment_processed_version: 2,
        outline_version: 1,
        policy_version: 1,
        covered_sources: ['studio'],
        unknown_ranges: [],
        evidence_refs: [{event_id:syntheticEvent1.event_id,revision:syntheticEvent1.revision}],
        events: [syntheticEvent1],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const client = new StudioHttpClient({ fetchFn: mockFetch });
  const httpAdapter = createStudioHttpClientAdapter(client);

  // 1. 验证 loadOverview 契约
  const overviewResult = await httpAdapter.loadOverview();
  assert.equal(overviewResult.connectionState, 'available');
  assert.equal(overviewResult.lastContentUpdatedAt, '2026-10-13T10:00:00Z');

  // 2. 验证 loadEvents 契约
  const eventsResult = await httpAdapter.loadEvents();
  assert.equal(eventsResult.length, 1);
  assert.equal(eventsResult[0].event_id, 'evt-comp-01');

  // 3. 验证 submitSupplement 带有幂等键的调用契约
  const receipt = await httpAdapter.submitSupplement('合成草稿', {
    idempotencyKey: 'custom-idempotency-key-01',
  });
  assert.equal(httpPostKey, 'custom-idempotency-key-01', '适配器向 HTTP POST 准确传递了幂等键');
  assert.equal(receipt.receipt_id, 'rcpt-http-01');
  assert.equal(receipt.saved, true);
});
