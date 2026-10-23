"use client";
import { useCallback, useEffect, useState } from "react";
import { BookOpen, Search, ChevronDown, ArrowUpRight, X, Archive, ArrowLeft, RefreshCw } from "lucide-react";
import { dateSchema, type Entry } from "@/lib/records";
import ActivityCalendar from "./activity-calendar";
import SiteHeader from "./site-header";
import SiteFooter from "./site-footer";
import { wayneoProject } from "@/content/wayneo";

function RelatedProject({entry}:{entry:Entry}) {
  if(!entry.items.some(item=>wayneoProject.topics.includes(item.label.trim())))return null;
  return <p className="journal-related"><a href={wayneoProject.url}>同主题项目 · {wayneoProject.title} ↗</a></p>;
}

const weekday = (date: string) => new Intl.DateTimeFormat("zh-CN", {weekday:"long",timeZone:"Asia/Shanghai"}).format(new Date(date+"T12:00:00+08:00"));
const timeLabel = (s: string) => new Intl.DateTimeFormat("zh-CN", {month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"Asia/Shanghai",hour12:false}).format(new Date(s));
// signInPath 仅为兼容旧 admin 页面调用保留，纯展示站点不再渲染或使用任何写入口。
export default function Journal({apiPath = "/api/records"}:{apiPath?:string;signInPath?:string} = {}) {
  const [records,setRecords] = useState<Entry[]>([]), [loading,setLoading] = useState(true), [error,setError] = useState("");
  const [query,setQuery] = useState(""), [month,setMonth] = useState("all"), [lastSync,setLastSync] = useState<string|null>(null);
  const [snapshots,setSnapshots] = useState<{date:string}[]>([]), [snapshot,setSnapshot] = useState(""), [historyRecords,setHistoryRecords] = useState<Entry[]>([]);
  const [notice,setNotice] = useState("");
  const [selectedDate,setSelectedDate] = useState("");
  const refresh = useCallback(async () => {
    try { const r=await fetch(apiPath); if(!r.ok) throw Error(); const j=await r.json() as {records:Entry[];lastSync:string|null}; setRecords(j.records); setLastSync(j.lastSync); setError(""); }
    catch { setError("暂时无法读取记录，请重试。"); } finally { setLoading(false); }
  },[apiPath]);
  useEffect(()=>{ refresh(); const onFocus=()=>refresh(); window.addEventListener("focus",onFocus); const t=setInterval(refresh,60000); return ()=>{clearInterval(t);window.removeEventListener("focus",onFocus);}; },[refresh]);
  useEffect(()=>{ const date = new URLSearchParams(window.location.search).get("date"); if(date && dateSchema.safeParse(date).success) setSelectedDate(date); },[]);
  useEffect(()=>{ if(!notice)return; const t=setTimeout(()=>setNotice(""),3000);return ()=>clearTimeout(t);},[notice]);
  async function loadSnapshots(){try{const r=await fetch("/api/snapshots");if(!r.ok)throw Error();setSnapshots((await r.json() as {snapshots:{date:string}[]}).snapshots);setNotice("选择日期即可查看当时的记录");}catch{setNotice("暂时无法读取历史快照");}}
  async function viewSnapshot(date:string){if(!date){setSnapshot("");setSelectedDate("");return;}try{const r=await fetch("/api/snapshots?date="+encodeURIComponent(date));if(!r.ok)throw Error();setHistoryRecords((await r.json() as {records:Entry[]}).records);setSnapshot(date);setMonth("all");setQuery("");setSelectedDate("");}catch{setNotice("暂时无法读取这份快照");}}
  const source=snapshot?historyRecords:records;
  const months=[...new Set(source.map(r=>r.date.slice(0,7)))].sort().reverse();
  const visible=source.filter(r=>(!selectedDate||r.date===selectedDate) && (month==="all"||r.date.startsWith(month)) && (r.date+" "+r.items.map(i=>i.label+" "+i.text).join(" ")+" "+r.practice).toLowerCase().includes(query.trim().toLowerCase()));
  function selectDate(date:string){setSelectedDate(current=>current===date?"":date);setMonth("all");setQuery("");}
  return <div className="shell editorial-shell journal-shell">
    <SiteHeader active="learning"/>
    <main><section className="intro journal-cover" aria-labelledby="journal-title">
      <div className="journal-cover-meta"><p className="eyebrow">02 / LEARNING ARCHIVE</p><span>学习手记</span></div>
      <div className="journal-cover-copy"><h1 id="journal-title" className="journal-cover-title" aria-label="Journal · 学习档案"><span aria-hidden="true">Journal.</span></h1></div>
      <div className="journal-cover-bottom"><div className="journal-cover-intro"><p className="journal-cover-deck">写在学习之间。</p><p className="subtitle">把每天学过的内容，留在这里。</p></div><div className="journal-cover-action" /></div>
    </section>
    {!error&&<ActivityCalendar records={source} selectedDate={selectedDate} onSelectDate={selectDate} loading={loading}/> }
    <section className="toolbar" aria-label="查找记录"><div className="month-field"><BookOpen size={16}/><select aria-label="按月浏览" value={month} onChange={e=>{setMonth(e.target.value);setSelectedDate("");}}><option value="all">全部记录</option>{months.map(m=><option key={m} value={m}>{m.slice(0,4)} 年 {Number(m.slice(5))} 月</option>)}</select><ChevronDown size={14}/></div><label className="search"><Search size={17}/><input aria-label="搜索学习内容" placeholder="搜索日期或学习内容" value={query} onChange={e=>{setQuery(e.target.value);setSelectedDate("");}}/>{query&&<button className="icon-button small" onClick={()=>setQuery("")} aria-label="清空搜索"><X size={14}/></button>}</label></section>
    <div className="records-heading"><h2>每日记录</h2>{selectedDate&&<button className="text-button" onClick={()=>setSelectedDate("")}><X size={14}/>取消日期筛选</button>}</div>
    <div className="list-meta"><span>{selectedDate?selectedDate+" 的记录":snapshot?"历史快照 · "+snapshot:loading?"正在读取…":visible.length+" 天记录"}</span>{snapshot?<button className="text-button" onClick={()=>{setSnapshot("");setSelectedDate("");}}><ArrowLeft size={14}/>返回最新</button>:<span className="sync"><span/>{lastSync?"快照保存于 "+timeLabel(lastSync):"学习手记"}</span>}</div>
    {error?<div className="empty"><p>{error}</p><button className="secondary" onClick={refresh}><RefreshCw size={15}/>重新读取</button></div>:loading?<div className="loading-bars" aria-label="正在加载"><div/><div/></div>:visible.length===0?<div className="empty"><BookOpen size={28}/><h2>{selectedDate?"这一天还没有公开手记":query||month!=="all"?"没有找到这条记录":"暂时还没有公开手记"}</h2><p>{selectedDate?"可以选择其他日期查看学习记录。":query||month!=="all"?"换个关键词或月份试试。":"这里会收录整理确认后的公开手记。"}</p></div>:<div className="entries">{visible.map((r,index)=><details className="entry" key={r.date+snapshot} open={index===0||!!query||undefined}><summary><div className="date-line"><span className="entry-date">{r.date.replaceAll("-",".")}</span><span className="weekday">{weekday(r.date)}</span>{r.date===source[0]?.date&&!snapshot&&<span className="latest">最近记录</span>}</div><div className="summary-right"><span className="category-preview">{r.items.map(i=>i.label).join(" · ")}</span><ChevronDown size={18} className="chevron"/></div></summary><div className="entry-body"><div className="notes">{r.items.map((item,i)=><div className="note" key={i}><span className="note-label">{item.label}</span><p>{item.text}</p></div>)}</div><div className="entry-bottom">{r.practice&&<div className="practice"><ArrowUpRight size={16}/><div><span>练习与补充</span><p>{r.practice}</p></div></div>}<RelatedProject entry={r}/></div></div></details>)}</div>}
    <footer><span>凌晨 6 点前归入前一天 · 北京时间</span><div className="history"><button className="text-button" onClick={loadSnapshots}><Archive size={14}/>历史快照</button>{snapshots.length>0&&<select aria-label="选择历史快照" value={snapshot} onChange={e=>viewSnapshot(e.target.value)}><option value="">最新记录</option>{snapshots.map(s=><option key={s.date} value={s.date}>{s.date}</option>)}</select>}</div></footer>
    </main><SiteFooter />
    {notice&&<div className="toast" role="status">{notice}</div>}
  </div>;
}
