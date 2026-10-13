"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, Plus, Search, ChevronDown, ArrowUpRight, Pencil, X, Archive, ArrowLeft, RefreshCw } from "lucide-react";
import { dateSchema, learningDate, type Entry } from "@/lib/records";
import ActivityCalendar from "./activity-calendar";
import SiteHeader from "./site-header";
import SiteFooter from "./site-footer";

type Draft = { date: string; content: string; practice: string; revision: number; existing: boolean };
const weekday = (date: string) => new Intl.DateTimeFormat("zh-CN", {weekday:"long",timeZone:"Asia/Shanghai"}).format(new Date(date+"T12:00:00+08:00"));
const timeLabel = (s: string) => new Intl.DateTimeFormat("zh-CN", {month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"Asia/Shanghai",hour12:false}).format(new Date(s));
export default function Journal({signInPath, apiPath = "/api/records"}:{signInPath:string;apiPath?:string}) {
  const [records,setRecords] = useState<Entry[]>([]), [loading,setLoading] = useState(true), [error,setError] = useState("");
  const [query,setQuery] = useState(""), [month,setMonth] = useState("all"), [lastSync,setLastSync] = useState<string|null>(null);
  const [draft,setDraft] = useState<Draft|null>(null), [saving,setSaving] = useState(false), [formError,setFormError] = useState("");
  const [snapshots,setSnapshots] = useState<{date:string}[]>([]), [snapshot,setSnapshot] = useState(""), [historyRecords,setHistoryRecords] = useState<Entry[]>([]);
  const [notice,setNotice] = useState("");
  const [selectedDate,setSelectedDate] = useState("");
  const [canEdit,setCanEdit] = useState(false), [signedIn,setSignedIn] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const refresh = useCallback(async () => {
    try { const r=await fetch(apiPath); if(!r.ok) throw Error(); const j=await r.json() as {records:Entry[];lastSync:string|null;canEdit:boolean;signedIn:boolean}; setRecords(j.records); setLastSync(j.lastSync); setCanEdit(j.canEdit); setSignedIn(j.signedIn); setError(""); }
    catch { setError("暂时无法读取记录，请重试。"); } finally { setLoading(false); }
  },[apiPath]);
  useEffect(()=>{ refresh(); const onFocus=()=>refresh(); window.addEventListener("focus",onFocus); const t=setInterval(refresh,60000); return ()=>{clearInterval(t);window.removeEventListener("focus",onFocus);}; },[refresh]);
  useEffect(()=>{ const date = new URLSearchParams(window.location.search).get("date"); if(date && dateSchema.safeParse(date).success) setSelectedDate(date); },[]);
  useEffect(()=>{ if(draft && dialog.current && !dialog.current.open) dialog.current.showModal(); },[draft]);
  useEffect(()=>{ if(!notice)return; const t=setTimeout(()=>setNotice(""),3000);return ()=>clearTimeout(t);},[notice]);
  function edit(entry?:Entry){if(!canEdit){setNotice("只有站点所有者可以编辑记录");return;}setFormError("");setDraft(entry?{date:entry.date,content:entry.items.map(i=>i.label+"："+i.text).join("\n"),practice:entry.practice,revision:entry.revision,existing:true}:{date:selectedDate||learningDate(),content:"",practice:"",revision:0,existing:false});}
  function close(){dialog.current?.close();setDraft(null);}
  async function save(e:React.FormEvent){
    e.preventDefault();if(!draft)return;setSaving(true);setFormError("");
    const items=draft.content.split("\n").filter(l=>l.trim()).map(line=>{ const at=line.search(/[：:]/);return at<0?{label:"学习内容",text:line.trim()}:{label:line.slice(0,at).trim(),text:line.slice(at+1).trim()}; });
    const existing=records.find(r=>r.date===draft.date);
    if(!draft.existing && existing){setDraft({date:existing.date,content:existing.items.map(i=>i.label+"："+i.text).join("\n")+"\n"+draft.content,practice:draft.practice||existing.practice,revision:existing.revision,existing:true});setFormError("这个日期已有记录，已合并到同一天，请确认后保存。");setSaving(false);return;}
    try {const r=await fetch(apiPath,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({date:draft.date,items,practice:draft.practice,expectedRevision:draft.revision})});const j=await r.json() as {records:Entry[];error?:string};if(!r.ok)throw Error(j.error);setRecords(j.records);setMonth("all");setQuery("");setSelectedDate("");close();setNotice("记录已保存");}
    catch(e){setFormError(e instanceof Error?e.message:"保存失败，请重试");await refresh();}finally{setSaving(false);}
  }
  async function loadSnapshots(){try{const r=await fetch("/api/snapshots");if(!r.ok)throw Error();setSnapshots((await r.json() as {snapshots:{date:string}[]}).snapshots);setNotice("选择日期即可查看当时的记录");}catch{setNotice("暂时无法读取历史快照");}}
  async function viewSnapshot(date:string){if(!date){setSnapshot("");setSelectedDate("");return;}try{const r=await fetch("/api/snapshots?date="+encodeURIComponent(date));if(!r.ok)throw Error();setHistoryRecords((await r.json() as {records:Entry[]}).records);setSnapshot(date);setMonth("all");setQuery("");setSelectedDate("");}catch{setNotice("暂时无法读取这份快照");}}
  const source=snapshot?historyRecords:records;
  const months=[...new Set(source.map(r=>r.date.slice(0,7)))].sort().reverse();
  const visible=source.filter(r=>(!selectedDate||r.date===selectedDate) && (month==="all"||r.date.startsWith(month)) && (r.date+" "+r.items.map(i=>i.label+" "+i.text).join(" ")+" "+r.practice).toLowerCase().includes(query.trim().toLowerCase()));
  function selectDate(date:string){setSelectedDate(current=>current===date?"":date);setMonth("all");setQuery("");}
  return <div className="shell editorial-shell journal-shell">
    <SiteHeader active="learning"/>
    <main><section className="intro"><div><p className="eyebrow">JOURNAL / 学习档案</p><h1>写在学习之间。</h1><p className="subtitle">把每天学过的内容，留在这里。</p></div>{!loading&&(canEdit?<button className="primary" onClick={()=>edit()} disabled={!!snapshot}><Plus size={18}/>记一笔</button>:signedIn?<span className="readonly-label">只读查看</span>:<a className="secondary" href={signInPath} target="_top">登录编辑</a>)}</section>
    {!error&&<ActivityCalendar records={source} selectedDate={selectedDate} onSelectDate={selectDate} loading={loading}/> }
    <section className="toolbar" aria-label="查找记录"><div className="month-field"><BookOpen size={16}/><select aria-label="按月浏览" value={month} onChange={e=>{setMonth(e.target.value);setSelectedDate("");}}><option value="all">全部记录</option>{months.map(m=><option key={m} value={m}>{m.slice(0,4)} 年 {Number(m.slice(5))} 月</option>)}</select><ChevronDown size={14}/></div><label className="search"><Search size={17}/><input aria-label="搜索学习内容" placeholder="搜索日期或学习内容" value={query} onChange={e=>{setQuery(e.target.value);setSelectedDate("");}}/>{query&&<button className="icon-button small" onClick={()=>setQuery("")} aria-label="清空搜索"><X size={14}/></button>}</label></section>
    <div className="records-heading"><h2>每日记录</h2>{selectedDate&&<button className="text-button" onClick={()=>setSelectedDate("")}><X size={14}/>取消日期筛选</button>}</div>
    <div className="list-meta"><span>{selectedDate?selectedDate+" 的记录":snapshot?"历史快照 · "+snapshot:loading?"正在读取…":visible.length+" 天记录"}</span>{snapshot?<button className="text-button" onClick={()=>{setSnapshot("");setSelectedDate("");}}><ArrowLeft size={14}/>返回最新</button>:<span className="sync"><span/>{lastSync?"快照保存于 "+timeLabel(lastSync):"学习手记"}</span>}</div>
    {error?<div className="empty"><p>{error}</p><button className="secondary" onClick={refresh}><RefreshCw size={15}/>重新读取</button></div>:loading?<div className="loading-bars" aria-label="正在加载"><div/><div/></div>:visible.length===0?<div className="empty"><BookOpen size={28}/><h2>{selectedDate?"这一天还没有记录":query||month!=="all"?"没有找到这条记录":"新的一页，从今天开始"}</h2><p>{selectedDate?(canEdit?"可以选择其他日期，或补记这一天的学习内容。":"可以选择其他日期查看学习记录。"):query||month!=="all"?"换个关键词或月份试试。":"学了什么，简单记下来就好。"}</p>{canEdit&&!query&&month==="all"&&!snapshot&&<button className="secondary" onClick={()=>edit()}>{selectedDate?"补记这一天":"写下第一条记录"}</button>}</div>:<div className="entries">{visible.map((r,index)=><details className="entry" key={r.date+snapshot} open={index===0||!!query||undefined}><summary><div className="date-line"><span className="entry-date">{r.date.replaceAll("-",".")}</span><span className="weekday">{weekday(r.date)}</span>{r.date===source[0]?.date&&!snapshot&&<span className="latest">最近记录</span>}</div><div className="summary-right"><span className="category-preview">{r.items.map(i=>i.label).join(" · ")}</span><ChevronDown size={18} className="chevron"/></div></summary><div className="entry-body"><div className="notes">{r.items.map((item,i)=><div className="note" key={i}><span className="note-label">{item.label}</span><p>{item.text}</p></div>)}</div><div className="entry-bottom">{r.practice&&<div className="practice"><ArrowUpRight size={16}/><div><span>练习与补充</span><p>{r.practice}</p></div></div>}{canEdit&&!snapshot&&<button className="edit-button" onClick={()=>edit(r)} aria-label={"编辑 "+r.date+" 的记录"}><Pencil size={14}/><span>编辑</span></button>}</div></div></details>)}</div>}
    <footer><span>凌晨 6 点前归入前一天 · 北京时间</span><div className="history"><button className="text-button" onClick={loadSnapshots}><Archive size={14}/>历史快照</button>{snapshots.length>0&&<select aria-label="选择历史快照" value={snapshot} onChange={e=>viewSnapshot(e.target.value)}><option value="">最新记录</option>{snapshots.map(s=><option key={s.date} value={s.date}>{s.date}</option>)}</select>}</div></footer>
    </main><SiteFooter />
    <dialog ref={dialog} className="editor" onCancel={()=>setDraft(null)} onClick={e=>{if(e.target===dialog.current)close();}}>{draft&&<form onSubmit={save}><div className="editor-heading"><div><p className="eyebrow">每天的学习，慢慢积累</p><h2>{draft.existing?"编辑这一天":"记下一天"}</h2></div><button type="button" className="icon-button" onClick={close} aria-label="关闭编辑"><X size={20}/></button></div><label className="field">学习日期<input type="date" required value={draft.date} disabled={draft.existing} onChange={e=>setDraft({...draft,date:e.target.value})}/><span className="hint">凌晨 6 点前的学习，记在前一天。</span></label><label className="field">学过的内容<textarea required rows={5} autoFocus placeholder={'C 语言：结构体、枚举、switch\n编程练习：简单状态机'} value={draft.content} onChange={e=>setDraft({...draft,content:e.target.value})}/><span className="hint">每行一项，按「类别：内容」填写即可。</span></label><label className="field">练习与补充 <span className="optional">选填</span><textarea rows={2} placeholder="下一步，亲手写个小程序。" value={draft.practice} onChange={e=>setDraft({...draft,practice:e.target.value})}/></label>{formError&&<p className="form-error" role="alert">{formError}</p>}<div className="form-actions"><button type="button" className="secondary" onClick={close}>取消</button><button type="submit" className="primary" disabled={saving}>{saving?"保存中…":"保存记录"}</button></div></form>}</dialog>
    {notice&&<div className="toast" role="status">{notice}</div>}
  </div>;
}
