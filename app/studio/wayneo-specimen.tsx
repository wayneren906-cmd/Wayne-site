import type { WayneoProject } from "@/lib/public-content-contracts";

// 纯展示的共享项目介绍。刻意不设置任何 id，避免正文与体验区两个实例产生重复锚点。
export default function WayneoSpecimen({ project }: { project: WayneoProject }) {
  return (
    <div className="wayneo-specimen-frame">
      <section className="wayneo-specimen" aria-label={`${project.title} 项目介绍`}>
        <div className="wayneo-specimen-title">
          <p className="workbench-kicker">PROJECT / 项目介绍</p>
          <h2>{project.title}</h2>
        </div>
        <div className="wayneo-specimen-intro">
          <p className="wayneo-specimen-summary">{project.summary}</p>
          <dl className="wayneo-specimen-meta">
            <div>
              <dt>类型</dt>
              <dd>个人网站</dd>
            </div>
            <div>
              <dt>状态</dt>
              <dd>持续完善</dd>
            </div>
            <div>
              <dt>地址</dt>
              <dd>
                <a href="/">访问首页 ↗</a>
              </dd>
            </div>
          </dl>
          <ul className="wayneo-specimen-topics" aria-label="项目主题">
            {project.topics.map((topic) => (
              <li key={topic}>{topic}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
