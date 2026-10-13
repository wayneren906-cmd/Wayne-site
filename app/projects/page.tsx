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
    <div className="editorial-shell works-shell">
      <SiteHeader active="projects" />

      <main>
        <section className="works-intro" aria-labelledby="works-title">
          <div className="section-label-bar">
            <span>WORKS / 实践目录</span>
            <span>项目蓝图 · 持续整理</span>
          </div>

          <div className="works-intro-grid">
            <div>
              <h1 id="works-title" className="works-page-title">
                Learning by<br />Building.
              </h1>
            </div>

            <div className="works-intro-copy">
              <p className="works-lead">
                “不仅要在屏幕上理解指针与寄存器，更要让真实世界的信号与电机听从指令。”
              </p>
              <p>
                这里陈列着我的项目蓝图与探索路线。从小范围练习、硬件调试到系统级整合，每一次迭代都如实收录于此。
              </p>
            </div>
          </div>
        </section>

        <section className="works-catalog" aria-label="项目方向目录">
          <div>
            {works.map((item, idx) => (
              <article key={item.num} className="work-entry">
                <span className="work-index" aria-hidden="true">{String(idx + 1).padStart(2, "0")}</span>
                <div className="work-heading">
                  <p className="work-number">{item.num}</p>
                  <h2 className="work-title">{item.title}</h2>
                </div>
                <div className="work-body">
                  <p className="work-desc">{item.desc}</p>
                  <ul className="work-tech-tags" aria-label="涉及技术">
                    {item.tags.map((tag) => <li key={tag}>{tag}</li>)}
                  </ul>
                </div>
              </article>
            ))}
          </div>

          <aside className="works-status" aria-labelledby="works-status-title">
            <div className="works-status-copy">
              <p className="work-number">
                STATUS: IN ACTIVE PROGRESS
              </p>
              <h2 id="works-status-title">
                项目整理与调试进行中
              </h2>
              <p>
                目前正专注于 C 语言基础模块与外设库的扎实落地。
                当第一批具备完整工程结构的作品完成验证后，将在此刊登详尽的技术复盘、电路设计图与开源代码。
              </p>
            </div>
            <a className="editorial-arrow-link" href="/learning">
              <span>查阅目前的研习记录</span>
              <ArrowUpRight size={14} />
            </a>
          </aside>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
