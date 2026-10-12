import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import SiteHeader from "../site-header";
import SiteFooter from "../site-footer";

export const metadata: Metadata = {
  title: "Works · wayneo",
  description: "wayneo 的工程实践、C 语言与嵌入式项目展录。",
};

const works = [
  {
    num: "NO. 01 / C-LANG ENGINE",
    title: "C 语言底层与状态机练习库",
    desc: "深入指针内存模型、结构体字节对齐与动态内存生命周期。从字符小程序逐步过渡到状态机驱动与测试框架。",
    tags: ["指针模型", "状态机", "内存管理", "单元测试"],
  },
  {
    num: "NO. 02 / EMBEDDED CONTROLLER",
    title: "单片机与外设感知实验",
    desc: "基于微控制器探索 GPIO、PWM 输出、I2C/SPI 传感器通信与中断处理机制，感受硬件世界的脉动。",
    tags: ["STM32", "传感器驱动", "中断与定时器", "嵌入式裸机"],
  },
  {
    num: "NO. 03 / AUTOMOTIVE BUS PROTOCOL",
    title: "汽车电子与车载总线",
    desc: "研读 CAN/LIN 通信协议、UDS 诊断与整车电子电气拓扑，探寻智能化汽车软件系统的奥秘。",
    tags: ["CAN 总线", "LIN 协议", "ECU 通信", "汽车网络"],
  },
];

export default function ProjectsPage() {
  return (
    <div className="editorial-shell">
      <SiteHeader active="projects" />

      <main>
        {/* 展录导言 */}
        <section className="editorial-section" style={{ borderBottom: "1px solid var(--line)" }}>
          <div className="section-label-bar">
            <span>SELECTED WORKS ARCHIVE</span>
            <span>VOL. 2026 INDEX</span>
          </div>

          <div className="personal-note-grid">
            <div className="note-headline-col">
              <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 650, letterSpacing: "-0.03em", margin: 0, lineHeight: 1.15 }}>
                Learning by<br />Building.
              </h1>
            </div>

            <div className="note-body-col">
              <p style={{ fontFamily: "var(--font-serif)", fontSize: "16px", color: "var(--ink)", fontStyle: "italic", margin: "0 0 12px 0" }}>
                “不仅要在屏幕上理解指针与寄存器，更要让真实世界的信号与电机听从指令。”
              </p>
              <p>
                这里陈列着我的项目蓝图与探索路线。从小范围练习、硬件调试到系统级整合，每一次迭代都如实收录于此。
              </p>
            </div>
          </div>
        </section>

        {/* 展板大图录 */}
        <section className="editorial-section" style={{ borderBottom: "1px solid var(--line)" }}>
          <div className="works-asymmetric-grid">
            {works.map((item, idx) => (
              <div
                key={item.num}
                className={`work-feature-card ${idx === 0 ? "card-primary" : idx === 1 ? "card-secondary" : "card-tertiary"}`}
              >
                <div className="work-card-top">
                  <span className="work-number">{item.num}</span>
                  <h3 className="work-title">{item.title}</h3>
                  <p className="work-desc">{item.desc}</p>
                </div>
                <div className="work-tech-tags">
                  {item.tags.map((tag) => (
                    <span key={tag} className="work-tech-pill">{tag}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* 工坊状态通知 */}
          <div style={{ marginTop: 40, border: "1px dashed var(--line)", background: "var(--surface-alt)", padding: "28px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            <div style={{ maxWidth: 560 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--stone)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
                STATUS: IN ACTIVE PROGRESS
              </div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>
                项目整理与调试进行中
              </div>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--ink-secondary)", lineHeight: 1.7 }}>
                目前正专注于 C 语言基础模块与外设库的扎实落地。
                当第一批具备完整工程结构的作品完成验证后，将在此刊登详尽的技术复盘、电路设计图与开源代码。
              </p>
            </div>
            <a className="editorial-arrow-link" href="/learning">
              <span>查阅目前的研习记录</span>
              <ArrowUpRight size={14} />
            </a>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
