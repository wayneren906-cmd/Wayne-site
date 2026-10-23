// 静态服务器组件：只陈列站点两个页面的真实截图与职责，不含状态、不请求数据。
// 图片来源为 public/project-case 下的真实截图，保持原始像素尺寸与原色，不裁切、不加滤镜。
const guideEntries = [
  {
    id: "index",
    label: "Index",
    title: "首页",
    duty: "个人介绍与精选导读",
    href: "/",
    src: "/project-case/wayneo-index.png",
    alt: "Wayneo 首页封面：Learning、Building、Becoming 的大字标题",
    caption: "首页 · 个人介绍与精选导读",
  },
  {
    id: "journal",
    label: "Journal",
    title: "学习手记",
    duty: "按日期回看公开手记",
    href: "/learning",
    src: "/project-case/wayneo-journal.png",
    alt: "Wayneo 学习手记截图：年度日历中标记了五天公开记录",
    caption: "Journal · 按日期回看公开学习手记",
  },
];

export default function WayneoPageGuide() {
  return (
    <section className="wayneo-page-guide" aria-labelledby="wayneo-page-guide-title">
      <header className="wayneo-page-guide-heading">
        <p className="workbench-kicker">WAYNEO / 页面导览</p>
        <h3 id="wayneo-page-guide-title">首页与学习手记</h3>
      </header>
      <ol className="wayneo-page-guide-list">
        {guideEntries.map((entry, index) => (
          <li className="wayneo-page-guide-item" key={entry.id}>
            <figure className="wayneo-page-guide-shot">
              <a className="wayneo-page-guide-frame" href={entry.href}>
                <img
                  src={entry.src}
                  alt={entry.alt}
                  width={1280}
                  height={720}
                  loading="lazy"
                  decoding="async"
                />
              </a>
              <figcaption className="wayneo-page-guide-caption">
                <span className="wayneo-page-guide-number" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="wayneo-page-guide-text">
                  <span className="wayneo-page-guide-label">{entry.label}</span>
                  {entry.caption}
                </span>
              </figcaption>
            </figure>
            <div className="wayneo-page-guide-copy">
              <h4 className="wayneo-page-guide-name">{entry.title}</h4>
              <p className="wayneo-page-guide-duty">{entry.duty}</p>
              <a className="wayneo-page-guide-read" href={entry.href}>
                打开{entry.title} ↗
              </a>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
