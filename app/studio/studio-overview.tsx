import type { ReactElement } from "react";

export type StudioOverviewProps = {
  currentFocus: { title: string; detail: string } | null;
  notice: { kind: 'info' | 'action_required'; text: string } | null;
  connectionState: 'not_connected' | 'available' | 'temporarily_unavailable';
  lastContentUpdatedAt: string | null;
  supplementHref: string | null;
  loading: boolean;
};

function formatDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return isoString;
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  } catch {
    return isoString;
  }
}

export default function StudioOverview({
  currentFocus,
  notice,
  connectionState,
  lastContentUpdatedAt,
  supplementHref,
  loading,
}: StudioOverviewProps): ReactElement {
  const connectionLabelMap = {
    not_connected: "未接入",
    available: "通道可用",
    temporarily_unavailable: "暂时不可用",
  } as const;

  return (
    <section className="studio-overview" aria-label="学习概览与状态">
      {notice && (
        <div
          className={`studio-overview__notice studio-overview__notice--${notice.kind}`}
          role={notice.kind === "action_required" ? "alert" : "status"}
        >
          <span className="studio-overview__notice-badge">
            {notice.kind === "action_required" ? "需要确认" : "提示"}
          </span>
          <p className="studio-overview__notice-text">{notice.text}</p>
        </div>
      )}

      <div className="studio-overview__header">
        <div className="studio-overview__meta-strip">
          <span className="studio-overview__kicker">STUDIO / 学习操作台</span>
          <div className="studio-overview__status-pill" data-state={connectionState}>
            <span className="studio-overview__status-dot" aria-hidden="true" />
            <span className="studio-overview__status-text">
              {connectionLabelMap[connectionState]}
            </span>
          </div>
        </div>

        <h1 className="studio-overview__heading">当前学习安排</h1>
      </div>

      <div className="studio-overview__card">
        {loading ? (
          <div className="studio-overview__loading" aria-label="正在读取安排…">
            <span className="studio-overview__skeleton-bar" />
            <span className="studio-overview__skeleton-bar studio-overview__skeleton-bar--short" />
          </div>
        ) : currentFocus ? (
          <div className="studio-overview__focus">
            <h2 className="studio-overview__focus-title">{currentFocus.title}</h2>
            <p className="studio-overview__focus-detail">{currentFocus.detail}</p>
          </div>
        ) : (
          <div className="studio-overview__empty">
            <h2 className="studio-overview__empty-title">当前暂无已确认安排</h2>
            <p className="studio-overview__empty-hint">
              目前可保存和查看学习记录；能力评估与学习计划尚未接入。
            </p>
          </div>
        )}

        <div className="studio-overview__footer">
          <div className="studio-overview__update-meta">
            <span className="studio-overview__label">最近已知学习时间</span>
            <span className="studio-overview__value">
              {loading
                ? "正在读取…"
                : lastContentUpdatedAt
                ? formatDateTime(lastContentUpdatedAt)
                : "学习时间未知或暂无记录"}
            </span>
          </div>

          {supplementHref && (
            <a
              href={supplementHref}
              className="studio-overview__supplement-button"
            >
              <span>补充学习记录</span>
              <span aria-hidden="true">→</span>
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
