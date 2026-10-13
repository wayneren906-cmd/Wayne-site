import type {
  LearningEventInput,
  LearningEventDTO,
  SaveReceiptDTO,
  LearningContextDTO,
  LearningAPIErrorDTO,
  LearningAPIErrorCode,
  ContextPurpose,
} from "@/lib/learning/contracts";
import {receiptSchema,eventSchema,contextSchema,contextNotice} from './studio-protocol.ts';

export type StudioClientErrorType =
  | LearningAPIErrorCode
  | "NETWORK_ERROR"
  | "TIMEOUT_ERROR"
  | "INVALID_RESPONSE"
  | "UNKNOWN_ERROR";

export class StudioClientError extends Error {
  readonly code: StudioClientErrorType;
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, code: StudioClientErrorType, status: number, details?: unknown) {
    super(message);
    this.name = "StudioClientError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export type StudioHttpClientOptions = {
  baseUrl?: string;
  fetchFn?: typeof fetch;
  defaultTimeoutMs?: number;
};

export class StudioHttpClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly defaultTimeoutMs: number;

  constructor(options: StudioHttpClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? "";
    this.fetchFn = options.fetchFn ?? globalThis.fetch.bind(globalThis);
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 10000;
  }

  private async request<T>(
    endpoint: string,
    init: RequestInit,
    timeoutMs?: number
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const timeout = timeoutMs ?? this.defaultTimeoutMs;

    const controller = new AbortController();
    let isTimeout = false;
    const timer = setTimeout(() => {
      isTimeout = true;
      controller.abort();
    }, timeout);

    const externalSignal = init.signal;
    const cancel = () => controller.abort();
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort();
      else externalSignal.addEventListener("abort", cancel, {once:true});
    }

    try {
      const response = await this.fetchFn(url, {
        ...init,
        signal: controller.signal,
        credentials: init.credentials ?? "same-origin",
        redirect: 'error',
        cache: 'no-store',
        headers: {
          Accept: "application/json",
          ...init.headers,
        },
      });

      if (!response.ok) {
        let errorPayload: LearningAPIErrorDTO | null = null;
        try {
          const jsonBody = await response.json();
          if (jsonBody && typeof jsonBody === "object" && "error" in jsonBody) {
            errorPayload = jsonBody as LearningAPIErrorDTO;
          }
        } catch {
          // 非 JSON 格式错误响应
        }

        const status = response.status;
        if (status === 401 || status === 403) {
          throw new StudioClientError(
            errorPayload?.error?.message ?? "私有学习空间访问受限，请确认访问权限。",
            "PRIVATE_ACCESS_DENIED",
            status,
            errorPayload
          );
        }

        if (status === 409) {
          const code = errorPayload?.error?.code;
          const message =
            code === "IDEMPOTENCY_CONFLICT"
              ? "该操作发生幂等冲突：相同请求键已被使用且载荷不一致。"
              : code === "REVISION_CONFLICT"
              ? "该操作发生版本冲突：请求的基准版本已陈旧。"
              : errorPayload?.error?.message ?? "数据版本冲突。";
          throw new StudioClientError(
            message,
            code ?? "IDEMPOTENCY_CONFLICT",
            status,
            errorPayload
          );
        }

        if (status === 413) {
          throw new StudioClientError(
            errorPayload?.error?.message ?? "提交内容体积超出限制。",
            "PAYLOAD_TOO_LARGE",
            status,
            errorPayload
          );
        }

        if (status === 429) {
          throw new StudioClientError(
            errorPayload?.error?.message ?? "请求过于频繁，请稍候再试。",
            "RATE_LIMITED",
            status,
            errorPayload
          );
        }

        if (status >= 500) {
          throw new StudioClientError(
            errorPayload?.error?.message ?? "服务暂时不可用，请稍候重试。",
            "SERVICE_UNAVAILABLE",
            status,
            errorPayload
          );
        }

        throw new StudioClientError(
          errorPayload?.error?.message ?? `请求失败 (${status})`,
          errorPayload?.error?.code ?? "INVALID_INPUT",
          status,
          errorPayload
        );
      }

      try {
        return (await response.json()) as T;
      } catch (err) {
        throw new StudioClientError(
          "服务器返回了无效的响应格式。",
          "INVALID_RESPONSE",
          response.status,
          err
        );
      }
    } catch (err) {
      if (err instanceof StudioClientError) {
        throw err;
      }
      if (isTimeout) {
        throw new StudioClientError(
          `请求超时（超过 ${timeout}ms），请检查网络连接后重试。`,
          "TIMEOUT_ERROR",
          0
        );
      }
      if (err instanceof Error && err.name === "AbortError") {
        throw new StudioClientError("请求已被主动取消。", "NETWORK_ERROR", 0);
      }
      throw new StudioClientError(
        err instanceof Error ? err.message : "网络连接异常，请重试。",
        "NETWORK_ERROR",
        0,
        err
      );
    } finally {
      clearTimeout(timer);
      externalSignal?.removeEventListener('abort',cancel);
    }
  }

  async saveEvent(
    input: LearningEventInput,
    options?: { signal?: AbortSignal; timeoutMs?: number }
  ): Promise<SaveReceiptDTO> {
    const receipt = await this.request<SaveReceiptDTO>(
      "/api/studio/events",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: options?.signal,
      },
      options?.timeoutMs
    );
    const parsed=receiptSchema.safeParse(receipt);
    if(!parsed.success) throw new StudioClientError('服务端保存回执不完整，草稿已保留，请用原请求重试。','INVALID_RESPONSE',200);
    return parsed.data;
  }

  async getEvent(
    eventId: string,
    options?: { signal?: AbortSignal; timeoutMs?: number }
  ): Promise<LearningEventDTO> {
    const event = await this.request<LearningEventDTO>(
      `/api/studio/events/${encodeURIComponent(eventId)}`,
      {
        method: "GET",
        signal: options?.signal,
      },
      options?.timeoutMs
    );
    const parsed=eventSchema.safeParse(event);
    if(!parsed.success || parsed.data.event_id!==eventId) throw new StudioClientError('事件响应无效。','INVALID_RESPONSE',200);
    return parsed.data;
  }

  async getContext(
    purpose: ContextPurpose = "teaching",
    options?: { signal?: AbortSignal; timeoutMs?: number }
  ): Promise<LearningContextDTO> {
    const context = await this.request<LearningContextDTO>(
      `/api/studio/context?purpose=${encodeURIComponent(purpose)}`,
      {
        method: "GET",
        signal: options?.signal,
      },
      options?.timeoutMs
    );
    const parsed=contextSchema.safeParse(context);
    if(!parsed.success || parsed.data.purpose!==purpose) throw new StudioClientError('学习上下文响应无效。','INVALID_RESPONSE',200);
    return parsed.data;
  }
}

export type StudioAdapterOverview = {
  currentFocus: { title: string; detail: string } | null;
  notice: { kind: "info" | "action_required"; text: string } | null;
  connectionState: "not_connected" | "available" | "temporarily_unavailable";
  lastContentUpdatedAt: string | null;
  supplementHref: string | null;
  loading: boolean;
};

export type StudioHttpClientAdapter = {
  loadSnapshot: () => Promise<{overview:StudioAdapterOverview;events:readonly LearningEventDTO[]}>;
  loadOverview: () => Promise<StudioAdapterOverview>;
  loadEvents: () => Promise<readonly LearningEventDTO[]>;
  submitSupplement: (
    text: string,
    options?: { idempotencyKey?: string }
  ) => Promise<SaveReceiptDTO>;
};

export function createStudioHttpClientAdapter(
  client: StudioHttpClient,
  options?: { purpose?: ContextPurpose }
): StudioHttpClientAdapter {
  return {
    async loadSnapshot() {
      const context=await client.getContext(options?.purpose??'teaching');
      const text=contextNotice(context);
      return {events:context.events,overview:{currentFocus:null,notice:text?{kind:'info' as const,text}:null,
        connectionState:'available' as const,lastContentUpdatedAt:context.latest_observed_event_at,supplementHref:'#supplement',loading:false}};
    },
    async loadOverview(): Promise<StudioAdapterOverview> {
      try {
        const context = await client.getContext(options?.purpose ?? "teaching");
        return {
          currentFocus: null,
          notice:
            context.unknown_ranges && context.unknown_ranges.length > 0
              ? {
                  kind: "info",
                  text: contextNotice(context)!,
                }
              : null,
          connectionState: "available",
          lastContentUpdatedAt: context.latest_observed_event_at,
          supplementHref: "#supplement",
          loading: false,
        };
      } catch (err) {
        const isDenied =
          err instanceof StudioClientError &&
          err.code === "PRIVATE_ACCESS_DENIED";
        return {
          currentFocus: null,
          notice: isDenied
            ? {
                kind: "action_required",
                text: "私人学习空间需所有者授权，请确认访问凭证。",
              }
            : null,
          connectionState: "temporarily_unavailable",
          lastContentUpdatedAt: null,
          supplementHref: "#supplement",
          loading: false,
        };
      }
    },

    async loadEvents(): Promise<readonly LearningEventDTO[]> {
      const context = await client.getContext(options?.purpose ?? "teaching");
      return context.events ?? [];
    },

    async submitSupplement(
      text: string,
      subOpts?: { idempotencyKey?: string }
    ): Promise<SaveReceiptDTO> {
      const key =
        subOpts?.idempotencyKey ??
        `suppl-adapter-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      const input: LearningEventInput = {
        schema_version: 1,
        idempotency_key: key,
        source: { type: "studio_supplement", record_id: null },
        kind: "learning_activity",
        occurred_at: null,
        time_precision: "unknown",
        study_day_override: null,
        content: { summary: text },
        evidence_status: "self_reported",
        assistance: "unknown",
        execution_mode: "unknown",
        knowledge_ids: [],
        plan_id: null,
      };

      return client.saveEvent(input);
    },
  };
}
