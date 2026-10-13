import type { ReactElement } from "react";
import type { LearningEventDTO, EventKind, EvidenceStatus, Assistance, ExecutionMode } from "@/lib/learning/contracts";

export type StudioEventDetailProps = {
  event: LearningEventDTO | null;
  onClose: () => void;
};

const kindLabelMap: Record<EventKind, string> = {
  learning_activity: "学习活动",
  historical_summary: "历史摘要",
  user_correction: "用户修正",
};

const evidenceLabelMap: Record<EvidenceStatus, string> = {
  unknown: "未知证据（未核验）",
  self_reported: "自述记录",
  artifact_checked: "物证已核实",
};

const assistanceLabelMap: Record<Assistance, string> = {
  unknown: "未知",
  none: "独立完成（无提示）",
  concept_hint: "概念提示",
  code_outline: "代码大纲",
  full_solution: "完整解答",
};

const executionModeLabelMap: Record<ExecutionMode, string> = {
  unknown: "未知",
  reading: "概念阅读/理解",
  simulated_analysis: "模拟运行/推演",
  local_run: "本机编译与运行",
  hardware_run: "真机/硬件运行",
};

function formatIso(iso: string | null | undefined): string {
  if (!iso) return "未指定";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(d);
  } catch {
    return iso;
  }
}

export default function StudioEventDetail({
  event,
  onClose,
}: StudioEventDetailProps): ReactElement | null {
  if (!event) return null;

  return (
    <aside className="studio-event-detail" aria-label="事件详细信息">
      <div className="studio-event-detail__card">
        <div className="studio-event-detail__header">
          <div className="studio-event-detail__header-text">
            <span className="studio-event-detail__kicker">EVENT DETAIL / 事件详情</span>
            <h3 className="studio-event-detail__id">
              {event.event_id}
              <span className="studio-event-detail__revision">（版本 r{event.revision}）</span>
            </h3>
          </div>
          <button
            type="button"
            className="studio-event-detail__close-button"
            onClick={onClose}
            aria-label="关闭事件详情"
          >
            ✕
          </button>
        </div>

        <div className="studio-event-detail__summary-box">
          <span className="studio-event-detail__label">内容摘要</span>
          <p className="studio-event-detail__summary">{event.content.summary}</p>
        </div>

        <div className="studio-event-detail__grid">
          <div className="studio-event-detail__field">
            <span className="studio-event-detail__label">事件种类</span>
            <span className="studio-event-detail__value">
              {kindLabelMap[event.kind] ?? event.kind}
            </span>
          </div>

          <div className="studio-event-detail__field">
            <span className="studio-event-detail__label">归属学习日</span>
            <span className="studio-event-detail__value">
              {event.study_day ?? "未归纳"}
              {event.study_day_override_reason && (
                <span className="studio-event-detail__subnote">
                  （覆写原因: {event.study_day_override_reason}）
                </span>
              )}
            </span>
          </div>

          <div className="studio-event-detail__field">
            <span className="studio-event-detail__label">发生时间</span>
            <span className="studio-event-detail__value">
              {formatIso(event.occurred_at)}
              <span className="studio-event-detail__subnote">
                （精度: {event.time_precision === "exact" ? "精确时刻" : event.time_precision === "date" ? "仅日期" : "时间未知"}）
              </span>
            </span>
          </div>

          <div className="studio-event-detail__field">
            <span className="studio-event-detail__label">系统接收时间</span>
            <span className="studio-event-detail__value">
              {formatIso(event.received_at)}
            </span>
          </div>

          <div className="studio-event-detail__field">
            <span className="studio-event-detail__label">证据核验</span>
            <span className="studio-event-detail__value">
              {evidenceLabelMap[event.evidence_status] ?? event.evidence_status}
            </span>
          </div>

          <div className="studio-event-detail__field">
            <span className="studio-event-detail__label">辅导与提示</span>
            <span className="studio-event-detail__value">
              {assistanceLabelMap[event.assistance] ?? event.assistance}
            </span>
          </div>

          <div className="studio-event-detail__field">
            <span className="studio-event-detail__label">执行模式</span>
            <span className="studio-event-detail__value">
              {executionModeLabelMap[event.execution_mode] ?? event.execution_mode}
            </span>
          </div>

          <div className="studio-event-detail__field">
            <span className="studio-event-detail__label">可见性</span>
            <span className="studio-event-detail__value studio-event-detail__value--private">
              私有（private）
            </span>
          </div>

          <div className="studio-event-detail__field studio-event-detail__field--full">
            <span className="studio-event-detail__label">来源记录</span>
            <span className="studio-event-detail__value studio-event-detail__value--mono">
              {event.source.type}
              {event.source.record_id ? ` · ${event.source.record_id}` : ""}
            </span>
          </div>

          <div className="studio-event-detail__field studio-event-detail__field--full">
            <span className="studio-event-detail__label">知识点关联</span>
            <div className="studio-event-detail__tags">
              {event.knowledge_ids && event.knowledge_ids.length > 0 ? (
                event.knowledge_ids.map((id) => (
                  <span key={id} className="studio-event-detail__tag">
                    {id}
                  </span>
                ))
              ) : (
                <span className="studio-event-detail__empty-note">未关联具体知识点</span>
              )}
            </div>
          </div>

          {event.plan_id && (
            <div className="studio-event-detail__field studio-event-detail__field--full">
              <span className="studio-event-detail__label">关联计划 ID</span>
              <span className="studio-event-detail__value studio-event-detail__value--mono">
                {event.plan_id}
              </span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
