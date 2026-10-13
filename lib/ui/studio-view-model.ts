import { useEffect, useState, useMemo } from "react";
import type {
  LearningEventInput,
  LearningEventDTO,
  SaveReceiptDTO,
  LearningContextDTO,
  ContextPurpose,
} from "@/lib/learning/contracts";
import type { StudioOverviewProps } from "@/app/studio/studio-overview";
import { StudioHttpClient, StudioClientError } from "./studio-client.ts";
import {contextNotice} from './studio-protocol.ts';

export type StudioViewState = {
  overview: StudioOverviewProps;
  events: readonly LearningEventDTO[];
  selectedEventId: string | null;
  loadingEvents: boolean;
  eventsError: string | null;
  supplementDraft: string;
  supplementState: "idle" | "saving" | "saved" | "error";
  supplementError: string | null;
};

export class StudioViewModel {
  private state: StudioViewState;
  private readonly client: StudioHttpClient;
  private readonly listeners = new Set<() => void>();
  private activeIdempotencyKey: string | null = null;
  private lockedPayloadText: string | null = null;
  private contextGeneration=0;

  constructor(client: StudioHttpClient, initialState?: Partial<StudioViewState>) {
    this.client = client;
    this.state = {
      overview: {
        currentFocus: null,
        notice: null,
        connectionState: "not_connected",
        lastContentUpdatedAt: null,
        supplementHref: "#supplement",
        loading: false,
        ...initialState?.overview,
      },
      events: initialState?.events ?? [],
      selectedEventId: initialState?.selectedEventId ?? null,
      loadingEvents: initialState?.loadingEvents ?? false,
      eventsError: initialState?.eventsError ?? null,
      supplementDraft: initialState?.supplementDraft ?? "",
      supplementState: initialState?.supplementState ?? "idle",
      supplementError: initialState?.supplementError ?? null,
    };
  }

  getState(): StudioViewState {
    return this.state;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setState(updater: (prev: StudioViewState) => StudioViewState): void {
    this.state = updater(this.state);
    for (const listener of this.listeners) {
      listener();
    }
  }

  selectEvent(eventId: string | null): void {
    this.setState((prev) => ({
      ...prev,
      selectedEventId: eventId,
    }));
  }

  updateSupplementDraft(text: string): void {
    if(this.state.supplementState==='saving')return;
    // 若文本被修改，废弃之前绑定的重试幂等键，确保不会在修改载荷后沿用旧键
    if (this.lockedPayloadText !== null && text !== this.lockedPayloadText) {
      this.activeIdempotencyKey = null;
      this.lockedPayloadText = null;
    }

    this.setState((prev) => ({
      ...prev,
      supplementDraft: text,
      supplementState: prev.supplementState === "saved" || prev.supplementState === "error" ? "idle" : prev.supplementState,
      supplementError: null,
    }));
  }

  async loadContext(purpose: ContextPurpose = "teaching"): Promise<LearningContextDTO | null> {
    const generation=++this.contextGeneration;
    this.setState((prev) => ({
      ...prev,
      loadingEvents: true,
      eventsError: null,
      overview: { ...prev.overview, loading: true },
    }));

    try {
      const context = await this.client.getContext(purpose);
      if(generation!==this.contextGeneration)return null;

      this.setState((prev) => ({
        ...prev,
        loadingEvents: false,
        events: context.events ?? [],
        overview: {
          ...prev.overview,
          loading: false,
          connectionState: "available",
          lastContentUpdatedAt: context.latest_observed_event_at,
          notice:
            context.unknown_ranges && context.unknown_ranges.length > 0
              ? {
                  kind: "info",
                  text: contextNotice(context)!,
                }
              : null,
        },
      }));

      return context;
    } catch (err) {
      if(generation!==this.contextGeneration)return null;
      const errorMessage =
        err instanceof StudioClientError
          ? err.message
          : err instanceof Error
          ? err.message
          : "读取学习上下文失败。";

      const isDenied = err instanceof StudioClientError && err.code === "PRIVATE_ACCESS_DENIED";

      this.setState((prev) => ({
        ...prev,
        loadingEvents: false,
        events: [],
        selectedEventId: null,
        eventsError: errorMessage,
        overview: {
          ...prev.overview,
          loading: false,
          connectionState: "temporarily_unavailable",
          lastContentUpdatedAt: null,
          notice: isDenied
            ? {
                kind: "action_required",
                text: "私人学习空间需所有者授权，请登录或确认访问凭证。",
              }
            : null,
        },
      }));

      return null;
    }
  }

  async submitSupplement(): Promise<SaveReceiptDTO | null> {
    const text = this.state.supplementDraft.trim();
    if (!text || this.state.supplementState === "saving") return null;

    // 幂等键防改载荷规则：
    // 若这是失败后的重试且文本内容未改动，继续沿用上一次生成的 activeIdempotencyKey；
    // 否则生成全新的幂等键，并锁定载荷内容。
    if (!this.activeIdempotencyKey || this.lockedPayloadText !== text) {
      this.activeIdempotencyKey = `suppl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      this.lockedPayloadText = text;
    }

    const input: LearningEventInput = {
      schema_version: 1,
      idempotency_key: this.activeIdempotencyKey,
      source: { type: "studio_supplement", record_id: null },
      kind: "learning_activity",
      occurred_at: null, // 自然语言补充默认由系统分析解析，发生时间未知则不编造，保留 null
      time_precision: "unknown",
      study_day_override: null,
      content: { summary: text },
      evidence_status: "self_reported",
      assistance: "unknown",
      execution_mode: "unknown",
      knowledge_ids: [],
      plan_id: null,
    };

    this.setState((prev) => ({
      ...prev,
      supplementState: "saving",
      supplementError: null,
    }));

    try {
      const receipt = await this.client.saveEvent(input);

      // 保存成功后：重置键和载荷锁，清空输入
      this.activeIdempotencyKey = null;
      this.lockedPayloadText = null;

      this.setState((prev) => ({
        ...prev,
        supplementDraft: "",
        supplementState: "saved",
        supplementError: null,
      }));

      // 异步刷新上下文与事件列表
      await this.loadContext();

      return receipt;
    } catch (err) {
      const message =
        err instanceof StudioClientError
          ? err.message
          : err instanceof Error
          ? err.message
          : "补充记录保存失败。";

      // 失败时保留草稿文本 (supplementDraft 保持原样)
      this.setState((prev) => ({
        ...prev,
        supplementState: "error",
        supplementError: message,
      }));

      return null;
    }
  }
}

export function useStudioViewModel(client: StudioHttpClient): {
  state: StudioViewState;
  selectEvent: (eventId: string | null) => void;
  updateSupplementDraft: (text: string) => void;
  loadContext: (purpose?: ContextPurpose) => Promise<LearningContextDTO | null>;
  submitSupplement: () => Promise<SaveReceiptDTO | null>;
} {
  const viewModel = useMemo(() => new StudioViewModel(client), [client]);
  const [state, setState] = useState<StudioViewState>(() => viewModel.getState());

  useEffect(() => {
    return viewModel.subscribe(() => {
      setState(viewModel.getState());
    });
  }, [viewModel]);

  return {
    state,
    selectEvent: (id) => viewModel.selectEvent(id),
    updateSupplementDraft: (txt) => viewModel.updateSupplementDraft(txt),
    loadContext: (p) => viewModel.loadContext(p),
    submitSupplement: () => viewModel.submitSupplement(),
  };
}
