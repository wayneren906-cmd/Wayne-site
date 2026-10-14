import type { ReactElement } from "react";
import type { LearningEventDTO, EventKind, EvidenceStatus, Assistance } from "@/lib/learning/contracts";

export type StudioEventListProps = {
  events: readonly LearningEventDTO[];
  selectedEventId: string | null;
  loading: boolean;
  errorMessage: string | null;
  onSelect: (eventId: string) => void;
  onRetry: () => void;
};

const kindLabelMap: Record<EventKind, string> = {
  learning_activity: "学习活动",
  historical_summary: "历史摘要",
  user_correction: "用户修正",
};

const evidenceLabelMap: Record<EvidenceStatus, string> = {
  unknown: "证据未知",
  self_reported: "自述记录",
  artifact_checked: "物证已核实",
};

const assistanceLabelMap: Record<Assistance, string> = {
  unknown: "辅助未知",
  none: "独立完成",
  concept_hint: "概念提示",
  code_outline: "代码大纲",
  full_solution: "完整解答",
};

function formatEventTime(event: LearningEventDTO): string {
  if (event.time_precision === "unknown" || !event.occurred_at) {
    return event.study_day ? `学习日 ${event.study_day} · 时间未知` : "发生时间未知";
  }
  try {
    const d = new Date(event.occurred_at);
    if (Number.isNaN(d.getTime())) {
      return event.occurred_at;
    }
    const formatted = new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
    return event.study_day ? `${formatted} (日: ${event.study_day})` : formatted;
  } catch {
    return event.occurred_at;
  }
}

export default function StudioEventList({
  events,
  selectedEventId,
  loading,
  errorMessage,
  onSelect,
  onRetry,
}: StudioEventListProps): ReactElement {
  return (
    <section className="studio-event-list" aria-label="学习事件记录列表">
      <div className="studio-event-list__header">
        <div className="studio-event-list__title-group">
          <h2 className="studio-event-list__heading">近期学习记录</h2>
          <span className="studio-event-list__count">
            {loading ? "正在读取…" : `本次读取 ${events.length} 条`}
          </span>
        </div>
      </div>

      <p className="workbench-note">此处展示当前读取范围内的近期记录，不是完整档案；未显示不代表没有记录。</p>

      {errorMessage ? (
        <div className="studio-event-list__error" role="alert">
          <p className="studio-event-list__error-message">{errorMessage}</p>
          <button
            type="button"
            className="studio-event-list__retry-button"
            onClick={onRetry}
          >
            重试读取
          </button>
        </div>
      ) : loading ? (
        <div className="studio-event-list__loading" aria-label="正在加载事件列表…">
          <div className="studio-event-list__skeleton-item" />
          <div className="studio-event-list__skeleton-item" />
          <div className="studio-event-list__skeleton-item" />
        </div>
      ) : events.length === 0 ? (
        <div className="studio-event-list__empty">
          <p className="studio-event-list__empty-title">暂无学习事件</p>
          <p className="studio-event-list__empty-hint">
            新的学习事实或补充记录保存后，将在此作为独立事件展示。
          </p>
        </div>
      ) : (
        <ul className="studio-event-list__items" role="listbox" aria-label="事件列表项">
          {events.map((event) => {
            const isSelected = selectedEventId === event.event_id;
            return (
              <li
                key={event.event_id}
                className="studio-event-list__item"
                role="option"
                aria-selected={isSelected}
              >
                <button
                  type="button"
                  data-event-id={event.event_id}
                  className={`studio-event-list__card ${
                    isSelected ? "studio-event-list__card--selected" : ""
                  }`}
                  onClick={() => onSelect(event.event_id)}
                >
                  <div className="studio-event-list__meta-line">
                    <span className="studio-event-list__time">
                      {formatEventTime(event)}
                    </span>
                    <span className="studio-event-list__tag studio-event-list__tag--kind">
                      {kindLabelMap[event.kind] ?? event.kind}
                    </span>
                  </div>

                  <p className="studio-event-list__summary">
                    {event.content.summary}
                  </p>

                  <div className="studio-event-list__badge-strip">
                    <span className="studio-event-list__badge">
                      {evidenceLabelMap[event.evidence_status] ?? event.evidence_status}
                    </span>
                    <span className="studio-event-list__badge">
                      {assistanceLabelMap[event.assistance] ?? event.assistance}
                    </span>
                    {event.knowledge_ids && event.knowledge_ids.length > 0 && (
                      <span className="studio-event-list__badge studio-event-list__badge--knowledge">
                        {event.knowledge_ids.length} 项知识点
                      </span>
                    )}
                    <span className="studio-event-list__revision-tag">
                      r{event.revision}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
