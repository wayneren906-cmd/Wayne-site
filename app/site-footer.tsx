export default function SiteFooter() {
  return (
    <footer className="colophon-editorial-footer" role="contentinfo">
      {/* 放大的 wayneo 品牌字标 (三种原版渐进色阶) */}
      <div className="colophon-big-brand" aria-label="wayneo">
        <span>way</span>
        <span>ne</span>
        <span>o</span>
      </div>

      <div className="colophon-details-grid">
        <div className="colophon-col-1">
          <p style={{ margin: 0, lineHeight: 1.8 }}>
            WAYNE / PERSONAL ARCHIVE.<br />
            C 语言 · 嵌入式 · 汽车电子。
          </p>
        </div>

        <div className="colophon-col-2">
          <p style={{ margin: 0, lineHeight: 1.8 }}>
            LEARNING / PRACTICE / EVERYDAY.<br />
            <a
              href="https://github.com/wayneren906-cmd/Wayne-site"
              target="_blank"
              rel="noopener noreferrer"
              className="colophon-link"
            >
              GITHUB REPOSITORY ↗
            </a>
          </p>
        </div>

        <div className="colophon-col-3">
          <p style={{ margin: 0, lineHeight: 1.8 }}>
            VOL. 2026 EDITION · ALL RIGHTS RESERVED.<br />
            <span style={{ textTransform: "none", fontStyle: "italic", fontFamily: "var(--font-serif)", fontSize: "13.5px", color: "var(--ink)" }}>
              一步一步，把想法做出来。
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}
