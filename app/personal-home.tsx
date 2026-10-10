"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUpRight, BookOpen, Code2, Cpu, RefreshCw } from "lucide-react";
import type { Entry } from "@/lib/records";
import SiteHeader from "./site-header";
import SiteFooter from "./site-footer";

export default function PersonalHome() {
  const [records, setRecords] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function refresh() {
      try {
        const response = await fetch("/api/records", { signal: controller.signal });
        if (!response.ok) throw new Error("Failed to load records");
        const data = await response.json() as { records: Entry[] };
        setRecords(data.records);
        setError(false);
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void refresh();
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(refresh, 60000);
    return () => { controller.abort(); window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [retry]);

  return <div className="shell personal-shell">
    <SiteHeader active="home"/>
    <main>
      <section className="personal-hero">
        <div className="hero-copy"><p className="personal-kicker"><span/>学习中，也在探索中</p><h1>你好，我是 <span>Wayne.</span></h1><p className="hero-description">一名物联网工程学生。<br/>正在学习 C 语言，探索嵌入式与汽车电子。</p><p className="hero-note">这里放着我学过的内容，以及慢慢做出来的东西。</p><div className="hero-actions"><a className="primary" href="/learning">看看学习记录<ArrowUpRight size={16}/></a><a className="text-button hero-about" href="#about">关于我<ArrowDown size={15}/></a></div></div>
        <div className="identity-art" aria-hidden="true"><div className="art-grid"/><div className="identity-letter">W<span>.</span></div><div className="art-caption"><Code2 size={15}/><span>从一行代码开始</span></div><span className="art-coordinate">01 / WAYNE</span></div>
      </section>
      <section className="about-section" id="about"><div><p className="personal-section-index">01 / 关于我</p><h2>从基础开始，<br/>把知识用起来。</h2></div><div className="about-content"><p>我想逐渐做出自己能理解、维护，也能讲清楚的项目。现在先把 C 语言和编程基础学扎实，再一步步走向单片机、嵌入式和汽车电子。</p><div className="interest-tags"><span><Code2 size={14}/>C 语言</span><span><Cpu size={14}/>嵌入式</span><span>汽车电子</span></div></div></section>
      <section className="recent-section" aria-labelledby="recent-title"><div className="personal-section-heading"><div><p className="personal-section-index">02 / 最近在学</p><h2 id="recent-title">每天留下，一点进步。</h2></div><a className="text-button" href="/learning">全部记录<ArrowUpRight size={15}/></a></div>
        {loading ? <div className="home-loading" role="status">正在读取最近的学习记录…</div> : error ? <div className="home-loading" role="status">暂时无法读取学习记录。<button type="button" className="text-button" onClick={() => { setLoading(true); setRetry(value => value + 1); }}><RefreshCw size={14}/>重试</button></div> : records.length ? <div className="recent-list">{records.slice(0, 3).map((record, index) => <a className="recent-record" key={record.date} href={`/learning?date=${record.date}`}><div className="recent-date"><span>{record.date.slice(5).replace("-", " / ")}</span><small>{record.date.slice(0, 4)}{index === 0 ? " · 最近记录" : ""}</small></div><div className="recent-content"><h3>{record.items.map(item => item.label).join(" · ")}</h3><p>{record.items.map(item => item.text).join("；")}</p></div><ArrowUpRight size={18}/></a>)}</div> : <div className="home-loading">还没有学习记录。<a className="text-button" href="/learning">去记下第一天<ArrowUpRight size={15}/></a></div>}
      </section>
      <a className="projects-invitation" href="/projects"><div className="invitation-icon"><BookOpen size={23}/></div><div><p className="personal-section-index">03 / 项目</p><h2>让学习有一个具体的结果。</h2><p>从小练习开始，逐步整理成自己的作品。</p></div><ArrowUpRight size={22}/></a>
    </main>
    <SiteFooter/>
  </div>;
}
