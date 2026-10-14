"use client";

import {useState} from 'react';
import type {PublicActivityMonth} from '../../lib/studio-public';

export default function StudioActivityChart({months}:{months:PublicActivityMonth[]}){
  const [mode,setMode]=useState<'monthly'|'cumulative'>('monthly');
  const [period,setPeriod]=useState(6);
  const visible=months.slice(-period);
  const value=(month:PublicActivityMonth)=>mode==='monthly'?month.entryCount:month.cumulativeEntries;
  const max=Math.max(1,...visible.map(value));
  if(!months.length)return <p className="dashboard-empty">发布第一条公开记录后，这里将呈现长期变化。</p>;
  return <div className="dashboard-chart">
    <div className="dashboard-chart-controls">
      <div className="dashboard-segment" role="group" aria-label="统计方式">
        <button type="button" aria-pressed={mode==='monthly'} onClick={()=>setMode('monthly')}>每月公开内容</button>
        <button type="button" aria-pressed={mode==='cumulative'} onClick={()=>setMode('cumulative')}>累计公开内容</button>
      </div>
      <label className="dashboard-period">时间范围<select value={period} onChange={event=>setPeriod(Number(event.target.value))}><option value={6}>最近 6 个月</option><option value={12}>最近 12 个月</option></select></label>
    </div>
    <p className="dashboard-chart-caption" aria-live="polite">{visible[0].month} — {visible.at(-1)!.month} · {mode==='monthly'?'每月已发布的内容条数':'截至各月的公开内容累计条数'}</p>
    <div className="dashboard-bars" aria-hidden="true">
      {visible.map(month=><div className="dashboard-bar-column" key={month.month} title={`${month.month} · ${value(month)} 条公开内容 · ${month.recordedDays} 个公开记录日`}>
        <span className="dashboard-bar-value">{value(month)}</span>
        <div className="dashboard-bar-track"><span className="dashboard-bar-fill" style={{height:`${value(month)/max*100}%`}}/></div>
        <span className="dashboard-bar-month">{month.month.slice(5)}</span>
      </div>)}
    </div>
    <details className="dashboard-chart-table"><summary>查看统计明细</summary><div className="dashboard-table-scroll"><table><caption>公开活动 · {visible[0].month} 至 {visible.at(-1)!.month}</caption><thead><tr><th scope="col">月份</th><th scope="col">记录日</th><th scope="col">公开内容</th><th scope="col">累计内容</th></tr></thead><tbody>{visible.map(month=><tr key={month.month}><th scope="row">{month.month}</th><td>{month.recordedDays}</td><td>{month.entryCount}</td><td>{month.cumulativeEntries}</td></tr>)}</tbody></table></div></details>
    <p className="dashboard-chart-note">仅统计公开 Journal；没有公开记录的月份记为 0，不代表没有学习或创作。</p>
  </div>;
}
