import type { Metadata } from "next";
import { ArrowUpRight, Code2, Cpu, CarFront } from "lucide-react";
import SiteHeader from "../site-header";
import SiteFooter from "../site-footer";

export const metadata: Metadata = { title: "项目" };
export default function ProjectsPage() {
  return <div className="shell personal-shell"><SiteHeader active="projects"/><main>
    <section className="projects-intro"><p className="personal-kicker"><span/>项目与实践</p><h1>把学到的，<br/>变成做出来的。</h1><p className="hero-description">这里会记录我的项目、遇到的问题，以及每一次改进。</p></section>
    <section className="project-empty"><div className="project-empty-mark"><Code2 size={29}/></div><h2>项目展示，正在整理。</h2><p>目前在学习基础知识。等项目整理好，会在这里放上介绍、代码和实际效果。</p><a className="secondary" href="/learning">看看最近在学什么<ArrowUpRight size={15}/></a></section>
    <section className="project-directions"><p className="personal-section-index">计划探索的方向</p><div className="direction-list"><div><Code2 size={20}/><h3>C 语言练习</h3><p>把基础语法用于具体的小程序。</p></div><div><Cpu size={20}/><h3>嵌入式实践</h3><p>逐步学习单片机、传感器和控制。</p></div><div><CarFront size={20}/><h3>汽车电子</h3><p>继续了解相关技术和应用方向。</p></div></div></section>
  </main><SiteFooter/></div>;
}
