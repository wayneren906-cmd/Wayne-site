"use client";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUpRight, RefreshCw } from "lucide-react";
import type { Entry } from "@/lib/records";
import SiteHeader from "./site-header";
import SiteFooter from "./site-footer";

function SectionLabel({ number, title, note }: { number: string; title: string; note: string }) {
  return <div className="pub-section-label"><span>{number} / {title}</span><span>{note}</span></div>;
}

export default function PersonalHome() {
  const [records, setRecords] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [copiedSocial, setCopiedSocial] = useState<string | null>(null);
  const [copyError, setCopyError] = useState("");

  const handleCopy = async (text: string, label: string) => {
    setCopiedSocial(null);
    setCopyError("");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      setCopiedSocial(label);
    } catch {
      setCopyError("复制未完成，请从按钮提示中手动复制账号。");
    }
  };
  useEffect(() => {
    if (!copiedSocial) return;
    const timer = window.setTimeout(() => setCopiedSocial(null), 2000);
    return () => window.clearTimeout(timer);
  }, [copiedSocial]);
  useEffect(() => {
    const controller = new AbortController();
    let refreshing = false;
    async function refresh() {
      if (refreshing) return;
      refreshing = true;
      try {
        const response = await fetch("/api/records", { signal: controller.signal });
        if (!response.ok) throw new Error("Failed to load records");
        const data = await response.json() as { records: Entry[] };
        if (!Array.isArray(data.records)) throw new Error("Invalid records response");
        if (!controller.signal.aborted) {
          setRecords([...data.records].sort((a, b) => b.date.localeCompare(a.date)));
          setError(false);
        }
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        refreshing = false;
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void refresh();
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(refresh, 60000);
    return () => { controller.abort(); window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [retry]);

  useEffect(() => {
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    const root = document.querySelector(".publication-home");
    const elements = root?.querySelectorAll(".pub-reveal, .pub-reveal-image") ?? [];
    root?.classList.add("motion-ready");
    elements.forEach((el) => observer.observe(el));
    return () => { observer.disconnect(); root?.classList.remove("motion-ready"); };
  }, [records]);

  return <div className="editorial-shell publication-home">
    <SiteHeader active="home" />
    <main>
      <section className="pub-cover" aria-labelledby="cover-title">
        <div className="pub-cover-meta"><span>A PERSONAL PUBLICATION</span><span>LEARNING / PRACTICE / EVERYDAY</span></div>
        <div className="pub-cover-title-group">
          <h1 id="cover-title" className="pub-cover-title">
            <span className="cover-line-1">
              <span className="pub-title-word">
                <span className="c-roslindale">Le</span>
                <span className="c-letter-glyph glyph-a">
                  <svg viewBox="0 0 58 96">
                    <path d="M56,2h-1.3l-3.7,3.2C49.7,4.4,46.7,2,42.7,2C21.7,2,1.8,41.6,1.8,75c0,12.9,3.5,19.3,10.1,19.3c7.4,0,14.6-10.2,22.1-29.9l-3.2,16.3l-2.3,11.7h11.9l0.2-1L40.4,79L56,2z M37.2,49.2c-7.5,22.1-14.3,36.7-20.5,36.7c-3.5,0-5.2-3.7-5.2-11.7c0-28.5,15.3-68.6,26.7-68.8c2.5,0,4.9,3,6.4,6.4L37.2,49.2z" />
                  </svg>
                </span>
                <span className="c-roslindale">rning.</span>
              </span>
            </span>
            <span className="cover-line-2">
              <span className="pub-title-word">
                <span className="c-roslindale">B</span>
                <span className="c-editorial-it">ui</span>
                <span className="c-roslindale">lding.</span>
              </span>
            </span>
            <span className="cover-line-3">
              <span className="pub-title-word">
                <span className="c-roslindale">B</span>
                <span className="c-editorial-it">e</span>
                <span className="c-roslindale">c</span>
                <span className="c-editorial-it">o</span>
                <span className="c-roslindale">ming.</span>
              </span>
            </span>
          </h1>
          <p className="pub-cover-subphrase">
            Notes on becoming — 2026.
          </p>
        </div>
        <div className="pub-cover-grid">
          <div className="pub-cover-intro"><span className="pub-small-label">WAYNE / 个人刊物</span><p className="pub-cover-deck">从一行代码，<br />到生活的细部。</p><p className="pub-body">物联网工程在读。C 语言与嵌入式。</p><a className="pub-text-link" href="#journal">翻开这一页 <ArrowDown size={15} /></a></div>
          <figure className="pub-cover-photo"><div className="pub-photo-window"><img src="/editorial-monument-light.jpg" alt="晨光穿透现代主义建筑廊柱与几何阶梯，独行者步入光芒之中" width={1376} height={768} fetchPriority="high" /></div><figcaption><span>01 / THE PASSAGE OF LIGHT</span><span>国际摄影大赛获奖构图 · 空间与光影</span></figcaption></figure>
        </div>
        <div className="pub-cover-bottom"><a href="/learning">进入学习档案 <ArrowUpRight size={13} /></a></div>
      </section>
      <section id="journal" className="pub-section pub-journal pub-reveal" aria-labelledby="journal-title">
        <SectionLabel number="01" title="JOURNAL" note="日常研习 / 按时间收录" />
        <div className="pub-section-heading pub-reveal"><h2 id="journal-title">写在学习之间。</h2></div>
        {error && <div className="pub-notice" role="status"><span>{records.length ? "暂时无法更新，以下保留上次读取的记录。" : "暂时无法读取学习记录。"}</span><button type="button" onClick={() => { setLoading(true); setRetry(v => v + 1); }} disabled={loading}><RefreshCw size={13} />{loading ? "读取中" : "重新读取"}</button></div>}
        <div className="pub-index pub-reveal" aria-busy={loading}>
          {loading && records.length === 0 ? <p className="pub-index-state" role="status">正在翻开学习档案…</p> : records.length === 0 ? <p className="pub-index-state">{error ? "记录恢复后，会在这里继续收录。" : "目录尚待写下，新的记录会从这里开始。"}</p> : records.slice(0, 3).map((record, index) => (
            <article className="pub-index-entry" key={record.date}>
              <span className="pub-index-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <div className="pub-index-copy">
                <h3><a href={`/learning?date=${record.date}`}>{record.items.map(item => <span key={item.label}>{item.label}</span>)}</a></h3>
              </div>
            </article>
          ))}
          <a href="/learning" className="pub-index-archive"><span className="pub-index-number" aria-hidden="true">{String(Math.min(records.length, 3) + 1).padStart(2, "0")}</span><div className="pub-index-copy"><h3>全部学习记录</h3></div></a>
        </div>
      </section>
      <section className="pub-section pub-practice pub-reveal" aria-labelledby="practice-title">
        <SectionLabel number="02" title="IN PRACTICE" note="从理解到动手" />
        <div className="pub-practice-grid">
          <figure className="pub-practice-image pub-reveal-image"><div className="pub-photo-window"><img src="/editorial-desk.jpg" alt="窗前原木长案、布面研习笔记与极简书写笔" width={1376} height={768} loading="lazy" /></div><figcaption><span>02 / THE DESK</span><span>实践意向 · 研习案头</span></figcaption></figure>
          <div className="pub-practice-copy pub-reveal"><span className="pub-small-label">WORK IN PROGRESS</span><h2 id="practice-title">让想法，<br />有迹可循。</h2><a className="pub-text-link" href="/projects">查看实践方向 <ArrowUpRight size={15} /></a><div className="pub-practice-topics"><span>C 语言</span><span>嵌入式</span><span>汽车电子</span></div></div>
        </div>
      </section>
      <section className="pub-section pub-fragments pub-reveal" aria-labelledby="fragments-title">
        <SectionLabel number="03" title="FRAGMENTS" note="影像随笔 / 光与空间" />
        <div className="pub-fragments-heading pub-reveal"><h2 id="fragments-title">Between<br /><em>the lines.</em></h2><div><span className="pub-small-label">在字里行间之外</span></div></div>
        <div className="pub-photo-essay">
          <figure className="pub-essay-main pub-reveal-image"><div className="pub-photo-window"><img src="/editorial-architecture.jpg" alt="天窗的自然光落在混凝土墙面与楼梯上" width={1376} height={768} loading="lazy" /></div><figcaption><span>01 — LIGHT, IN PASSING</span><span>光线经过的地方</span></figcaption></figure>
          <figure className="pub-essay-detail pub-reveal-image"><div className="pub-photo-window"><img src="/editorial-facade.jpg" alt="仰视城市建筑，玻璃立面在天空中形成交错的边界" width={1600} height={1067} loading="lazy" /></div><figcaption><span>02 — LOOKING UP</span><span>城市的另一种尺度</span></figcaption></figure>

        </div>
      </section>
      <div className="pub-endnote pub-reveal">
        <span>TO BE CONTINUED</span>

        <a href="#cover-title" aria-label="返回首页封面">↑</a>
      </div>
      {/* 1:1 复刻 Project Invitation & Contact 模块 (Chiara Luzzana 风格) */}
      <section id="contact" className="contact-replica-section pub-reveal" aria-label="Contact and project invitation">
        <div className="contact-replica-top">
          <div className="contact-replica-brand" aria-label="WAYNE REN">
            <span>WAYNE</span>
            <span>REN</span>
          </div>

          <a href="#cover-title" className="contact-stamp-toggle" aria-label="返回顶部">
            <svg viewBox="0 0 52 52" width="46" height="46" fill="none" stroke="currentColor">
              <circle cx="26" cy="26" r="23" strokeWidth="1" />
              <line x1="20" y1="23" x2="32" y2="23" strokeWidth="1.2" />
              <line x1="20" y1="29" x2="32" y2="29" strokeWidth="1.2" />
            </svg>
          </a>
        </div>

        <div className="contact-replica-grid">
          {/* 左侧大标题 */}
          <div className="contact-headline-col">
            <h2 className="sr-only">Want to start a new. project? Or just say hello.</h2>
            <div className="contact-title-group" aria-hidden="true">
              <div className="contact-title-line line-1">
                <span className="c-ayer-w">W</span>
                <span className="c-roslindale">ant to</span>
              </div>
              <div className="contact-title-line line-2">
                <span className="c-roslindale">st</span>
                <span className="c-letter-glyph glyph-a">
                  <svg viewBox="0 0 58 96">
                    <path d="M56,2h-1.3l-3.7,3.2C49.7,4.4,46.7,2,42.7,2C21.7,2,1.8,41.6,1.8,75c0,12.9,3.5,19.3,10.1,19.3c7.4,0,14.6-10.2,22.1-29.9l-3.2,16.3l-2.3,11.7h11.9l0.2-1L40.4,79L56,2z M37.2,49.2c-7.5,22.1-14.3,36.7-20.5,36.7c-3.5,0-5.2-3.7-5.2-11.7c0-28.5,15.3-68.6,26.7-68.8c2.5,0,4.9,3,6.4,6.4L37.2,49.2z" />
                  </svg>
                </span>
                <span className="c-roslindale">rt</span>
              </div>
              <div className="contact-title-line line-3">
                <span className="c-letter-glyph glyph-a glyph-a-word">
                  <svg viewBox="0 0 58 96">
                    <path d="M56,2h-1.3l-3.7,3.2C49.7,4.4,46.7,2,42.7,2C21.7,2,1.8,41.6,1.8,75c0,12.9,3.5,19.3,10.1,19.3c7.4,0,14.6-10.2,22.1-29.9l-3.2,16.3l-2.3,11.7h11.9l0.2-1L40.4,79L56,2z M37.2,49.2c-7.5,22.1-14.3,36.7-20.5,36.7c-3.5,0-5.2-3.7-5.2-11.7c0-28.5,15.3-68.6,26.7-68.8c2.5,0,4.9,3,6.4,6.4L37.2,49.2z" />
                  </svg>
                </span>
                <span className="c-roslindale">new.</span>
              </div>
              <div className="contact-title-line line-4">
                <span className="c-roslindale">pro</span>
                <span className="c-letter-glyph glyph-j">
                  <svg viewBox="0 0 27 81">
                    <path d="M22.3 9.5c2.1 0 3.9-1.8 3.9-3.9s-1.8-3.9-3.9-3.9-3.8 1.8-3.8 3.9S20.1 9.5 22.3 9.5zM19.4 22.4v32.1c0 3.9.4 6.5.8 8.5-2.8-.7-6.4-.4-10 1.1-6.4 2.7-10.4 7.9-8.8 11.7 1.6 3.8 8 4.9 14.4 2.2 1.5-.6 2.9-1.4 4-2.3 3.2-2.4 5.1-5.6 5-8.1l.6-30v-8.7-9.5l.1-3.4-7.3 1.5L19.4 22.4z" />
                  </svg>
                </span>
                <span className="c-roslindale">ect?</span>
              </div>
            </div>
            <p className="contact-replica-subinvite">
              Or just say hello.
            </p>
          </div>

          {/* 中间细环圈 */}
          <div className="contact-center-node" aria-hidden="true">
            <div className="contact-floating-ring" />
          </div>

          {/* 右侧交互区 */}
          <div className="contact-action-col">
            <div className="contact-email-line">
              <a href="mailto:wayne.ren906@gmail.com" className="contact-direct-email">
                wayne.ren906@gmail.com
              </a>
            </div>

            <div className="contact-social-matrix">
              <button
                type="button"
                className="contact-social-anchor"
                onClick={() => handleCopy("2746682776", "QQ")}
                title="QQ: 2746682776（点击复制）"
                aria-label="复制 QQ 号 2746682776"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21.395 15.035a40 40 0 0 0-.803-2.264l-1.079-2.695c.001-.032.014-.562.014-.836C19.526 4.632 17.351 0 12 0S4.474 4.632 4.474 9.241c0 .274.013.804.014.836l-1.08 2.695a39 39 0 0 0-.802 2.264c-1.021 3.283-.69 4.643-.438 4.673.54.065 2.103-2.472 2.103-2.472 0 1.469.756 3.387 2.394 4.771-.612.188-1.363.479-1.845.835-.434.32-.379.646-.301.778.343.578 5.883.369 7.482.189 1.6.18 7.14.389 7.483-.189.078-.132.132-.458-.301-.778-.483-.356-1.233-.646-1.846-.836 1.637-1.384 2.393-3.302 2.393-4.771 0 0 1.563 2.537 2.103 2.472.251-.03.581-1.39-.438-4.673"/>
                </svg>
                <span>{copiedSocial === "QQ" ? "已复制 QQ" : "QQ"}</span>
              </button>

              <button
                type="button"
                className="contact-social-anchor"
                onClick={() => handleCopy("wayneraining", "WeChat")}
                title="微信: wayneraining（点击复制）"
                aria-label="复制微信号 wayneraining"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.27-.027-.407-.03zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z"/>
                </svg>
                <span>{copiedSocial === "WeChat" ? "已复制微信" : "微信"}</span>
              </button>

              <a
                href="https://github.com/wayneren906-cmd"
                target="_blank"
                rel="noopener noreferrer"
                className="contact-social-anchor"
                title="GitHub: wayneren906-cmd"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
                </svg>
                <span>GitHub</span>
              </a>

              <a
                href="https://x.com"
                target="_blank"
                rel="noopener noreferrer"
                className="contact-social-anchor"
                title="X"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z"/>
                </svg>
                <span>X</span>
              </a>
            </div>

            {copyError && <p className="pub-body" role="status">{copyError}</p>}
          </div>
        </div>

        <div className="contact-bottom-wavy" aria-hidden="true">
          <svg viewBox="0 0 70 20" width="58" height="16" fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="M2 10 C 18 0, 24 20, 40 10 C 52 0, 58 16, 68 8" />
          </svg>
        </div>
      </section>
    </main>
    <SiteFooter />
  </div>;
}
