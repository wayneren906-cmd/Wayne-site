"use client";
import { useState } from "react";
import type { WayneoProject } from "@/lib/public-content-contracts";
import WayneoSpecimen from "./wayneo-specimen";

type DemoWidth = "desktop" | "mobile";

// 只在局部切换容器宽度，复用同一个 WayneoSpecimen，让 @container 真实改变列数。
export default function WayneoExperience({ project }: { project: WayneoProject }) {
  const [width, setWidth] = useState<DemoWidth>("desktop");
  const [grid, setGrid] = useState(false);

  return (
    <div className="wayneo-demo" data-project-demo data-demo-grid={grid ? "true" : "false"}>
      <div className="wayneo-demo-controls">
        <div className="wayneo-demo-widths" role="group" aria-label="预览版式宽度">
          <button type="button" aria-pressed={width === "desktop"} onClick={() => setWidth("desktop")}>
            桌面版式
          </button>
          <button type="button" aria-pressed={width === "mobile"} onClick={() => setWidth("mobile")}>
            手机版式
          </button>
        </div>
        <label className="wayneo-demo-grid-toggle">
          <input type="checkbox" checked={grid} onChange={(event) => setGrid(event.target.checked)} />
          显示排版网格
        </label>
      </div>
      <p className="wayneo-demo-hint">切换宽度，看看标题与正文如何重新排列。</p>
      <p className="wayneo-demo-readout" aria-live="polite">
        当前：{width === "desktop" ? "桌面版式" : "手机版式"}，排版网格{grid ? "已开启" : "已关闭"}。
      </p>
      <div className="wayneo-demo-stage" data-demo-width={width}>
        <WayneoSpecimen project={project} />
        {grid && <div className="wayneo-demo-grid" aria-hidden="true" />}
      </div>
    </div>
  );
}
