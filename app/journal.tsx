"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, Search, ChevronDown, ArrowUpRight, X, Archive, ArrowLeft, RefreshCw } from "lucide-react";
import { type Entry } from "@/lib/records";
import type {JournalData} from '@/lib/journal-reading';
import {journalEntryPath} from '@/lib/journal-sharing';
import ActivityCalendar from "./activity-calendar";
import SiteHeader from "./site-header";
import SiteFooter from "./site-footer";
import {emptyJournalLocation, readJournalLocation, journalLocationURL, type JournalLocation} from "@/lib/ui/journal-location";
import { wayneoProject } from "@/content/wayneo";
import { useJournalMotion } from "./journal-motion";
import JournalProse from './journal-prose';
import {journalArchive} from '@/lib/ui/journal-archive';

function RelatedProject({entry}:{entry:Entry}) {
  if(!entry.items.some(item=>wayneoProject.topics.includes(item.label.trim())))return null;
  return <p className="journal-related" data-journal-reveal><a href={wayneoProject.url}>同主题项目 · {wayneoProject.title} ↗</a></p>;
}

const weekday = (date: string) => new Intl.DateTimeFormat("zh-CN", {weekday:"long",timeZone:"Asia/Shanghai"}).format(new Date(date+"T12:00:00+08:00"));
const timeLabel = (s: string) => new Intl.DateTimeFormat("zh-CN", {month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"Asia/Shanghai",hour12:false}).format(new Date(s));
// signInPath 仅为兼容旧 admin 页面调用保留，纯展示站点不再渲染或使用任何写入口。
type Props={apiPath?:string;signInPath?:string;initialData?:JournalData;initialLocation?:JournalLocation};
export default function Journal({apiPath = "/api/records",initialData,initialLocation=emptyJournalLocation}:Props = {}) {
  const rootRef = useRef<HTMLDivElement>(null);
  useJournalMotion(rootRef);
  const [records,setRecords] = useState<Entry[]>(initialData?.records??[]), [loading,setLoading] = useState(!initialData), [error,setError] = useState(initialData?.error??'');
  const [location,setLocation] = useState<JournalLocation>(initialLocation);
  const {query,month,date:selectedDate,snapshot}=location;
  const [lastSync,setLastSync] = useState<string|null>(initialData?.lastSync??null);
  const [snapshots,setSnapshots] = useState<{date:string}[]>([]), [historyRecords,setHistoryRecords] = useState<Entry[]>(initialData?.snapshot?.records??[]);
  const [notice,setNotice] = useState("");
  const [snapshotLoading,setSnapshotLoading]=useState(false), [snapshotError,setSnapshotError]=useState(initialData?.snapshot?.error??'');
  const [loadedSnapshot,setLoadedSnapshot]=useState(initialData?.snapshot?.date??'');
  const initialSnapshot=useRef(initialData?.snapshot?.date??'');
  const readingHeading=useRef<HTMLHeadingElement>(null);
  const pendingReading=useRef(false), editingSearch=useRef(false);
  function navigate(next:JournalLocation,read=false,replace=false){
    const url=journalLocationURL(window.location.href,next);
    if(url!==window.location.pathname+window.location.search+window.location.hash){
      window.history[replace?'replaceState':'pushState'](window.history.state,'',url);
    }
    pendingReading.current=read;
    setLocation(next);
  }
  useEffect(()=>{
    function restore(){
      const next=readJournalLocation(window.location.search);
      pendingReading.current=!!(next.date||next.query||next.month!=='all'||next.snapshot||window.location.hash==='#journal-records'||/^#journal-\d{4}-\d{2}-\d{2}-note-\d+$/.test(window.location.hash));
      editingSearch.current=false;
      setLocation(next);
    }
    restore();
    window.addEventListener('popstate',restore);
    return ()=>window.removeEventListener('popstate',restore);
  },[]);
  useEffect(()=>{
    if(initialSnapshot.current===snapshot&&snapshot){initialSnapshot.current='';return;}
    if(!snapshot){setSnapshotLoading(false);setSnapshotError("");return;}
    const controller=new AbortController();
    setSnapshotLoading(true);setSnapshotError("");
    fetch('/api/snapshots?date='+encodeURIComponent(snapshot),{signal:controller.signal})
      .then(async r=>{if(!r.ok)throw Error();return r.json() as Promise<{records:Entry[]}>;})
      .then(j=>{if(!controller.signal.aborted)setHistoryRecords(j.records);})
      .catch(()=>{if(!controller.signal.aborted)setSnapshotError('暂时无法读取这份快照，请重新选择或返回最新记录。');})
      .finally(()=>{if(!controller.signal.aborted){setSnapshotLoading(false);setLoadedSnapshot(snapshot);}});
    return ()=>controller.abort();
  },[snapshot]);
  const refresh = useCallback(async () => {
    try { const r=await fetch(apiPath); if(!r.ok) throw Error(); const j=await r.json() as {records:Entry[];lastSync:string|null}; if(!Array.isArray(j.records))throw Error(); setRecords(j.records); setLastSync(j.lastSync??null); setError(""); }
    catch { setError("暂时无法读取记录，请重试。"); } finally { setLoading(false); }
  },[apiPath]);
  useEffect(()=>{ if(!initialData)void refresh(); const onFocus=()=>refresh(); window.addEventListener("focus",onFocus); const t=setInterval(refresh,60000); return ()=>{clearInterval(t);window.removeEventListener("focus",onFocus);}; },[refresh,initialData]);

  useEffect(()=>{ if(!notice)return; const t=setTimeout(()=>setNotice(""),3000);return ()=>clearTimeout(t);},[notice]);
  async function loadSnapshots(){try{const r=await fetch("/api/snapshots");if(!r.ok)throw Error();setSnapshots((await r.json() as {snapshots:{date:string}[]}).snapshots);setNotice("选择日期即可查看当时的记录");}catch{setNotice("暂时无法读取历史快照");}}
  function viewSnapshot(date:string){editingSearch.current=false;navigate({...emptyJournalLocation,snapshot:date},true);}
  const readingLoading=snapshot?(snapshotLoading||loadedSnapshot!==snapshot):loading;
  const readingError=snapshot?snapshotError:error;
  useEffect(()=>{
    if(!pendingReading.current||readingLoading)return;
    const frame=requestAnimationFrame(()=>{
      const fragment=/^#journal-\d{4}-\d{2}-\d{2}-note-\d+$/.test(window.location.hash)?document.getElementById(window.location.hash.slice(1)):null;
      const firstSection=selectedDate?rootRef.current?.querySelector<HTMLElement>('.entries .entry .note'):null;
      const heading=fragment??firstSection??readingHeading.current;
      if(!heading)return;
      pendingReading.current=false;
      const entry=heading.closest<HTMLDetailsElement>('details')??rootRef.current?.querySelector<HTMLDetailsElement>('.entries details');
      if(entry)entry.open=true;
      heading.focus({preventScroll:true});
      heading.scrollIntoView({block:'start',behavior:'instant'});
    });
    return ()=>cancelAnimationFrame(frame);
  },[location,selectedDate,readingLoading,readingError,records,historyRecords]);
  const source=snapshot?historyRecords:records;
  const blockingError=readingError&&(!!snapshot||source.length===0);
  const months=[...new Set(source.map(r=>r.date.slice(0,7)))].sort().reverse();
  const visible=source.filter(r=>(!selectedDate||r.date===selectedDate) && (month==="all"||r.date.startsWith(month)) && (r.date+" "+r.items.map(i=>i.label+" "+i.text).join(" ")+" "+r.practice).toLowerCase().includes(query.trim().toLowerCase()));
  const archive=(!selectedDate&&month==='all'&&!query.trim())?journalArchive(visible):{recent:visible,months:[]};
  const selectedIndex=selectedDate?source.findIndex(record=>record.date===selectedDate):-1;
  const older=selectedIndex>=0?source[selectedIndex+1]:undefined;
  const newer=selectedIndex>0?source[selectedIndex-1]:undefined;
  function selectDate(date:string){editingSearch.current=false;navigate({...location,date:selectedDate===date?"":date,month:"all",query:""},true);}
  return <div ref={rootRef} className="shell editorial-shell journal-shell">
    <SiteHeader active="learning"/>
    <main><section className="intro journal-cover" aria-labelledby="journal-title">
      <div className="journal-cover-meta"><p className="eyebrow">02 / LEARNING ARCHIVE</p><span>学习手记</span></div>
      <div className="journal-cover-copy"><h1 id="journal-title" className="journal-cover-title" aria-label="Journal · 学习档案"><span aria-hidden="true">Journal.</span></h1></div>
      <div className="journal-cover-bottom"><div className="journal-cover-intro"><p className="journal-cover-deck">写在学习之间。</p><p className="subtitle">把每天学过的内容，留在这里。</p></div><div className="journal-cover-action"><button className="secondary" disabled={loading||!!error||records.length===0} onClick={()=>{editingSearch.current=false;navigate({...emptyJournalLocation,date:records[0].date},true);}}>阅读最新记录 <ArrowUpRight size={16}/></button></div></div>
    </section>
    {!blockingError&&<ActivityCalendar records={source} selectedDate={selectedDate} onSelectDate={selectDate} loading={readingLoading}/> }
    <section className="toolbar" aria-label="查找记录"><div className="month-field"><BookOpen size={16}/><select aria-label="按月浏览" value={month} onChange={e=>{editingSearch.current=false;navigate({...location,month:e.target.value,date:""});}}><option value="all">全部记录</option>{month!=="all"&&!months.includes(month)&&<option value={month}>{month.replace("-"," 年 ")} 月</option>}{months.map(m=><option key={m} value={m}>{m.slice(0,4)} 年 {Number(m.slice(5))} 月</option>)}</select><ChevronDown size={14}/></div><label className="search"><Search size={17}/><input aria-label="搜索学习内容" placeholder="搜索日期或学习内容" value={query} onBlur={()=>{editingSearch.current=false;}} onChange={e=>{navigate({...location,query:e.target.value,date:""},false,editingSearch.current);editingSearch.current=true;}}/>{query&&<button className="icon-button small" onClick={()=>{editingSearch.current=false;navigate({...location,query:""});}} aria-label="清空搜索"><X size={14}/></button>}</label></section>
    <div className="records-heading"><h2 id="journal-records" ref={readingHeading} tabIndex={-1}>每日记录</h2>{selectedDate&&<button className="text-button" onClick={()=>navigate({...location,date:""})}><X size={14}/>取消日期筛选</button>}</div>
    <div className="list-meta"><span>{selectedDate?selectedDate+" 的记录":snapshot?"历史快照 · "+snapshot:loading?"正在读取…":visible.length+" 天记录"}</span>{snapshot?<button className="text-button" onClick={()=>viewSnapshot("")}><ArrowLeft size={14}/>返回最新</button>:<span className="sync"><span/>{lastSync?"快照保存于 "+timeLabel(lastSync):"学习手记"}</span>}</div>
    {readingError&&!blockingError&&<div className="journal-refresh-notice" role="alert"><p>暂时无法更新，以下保留上次读取的记录。</p>{!snapshot&&<button className="text-button" onClick={refresh}><RefreshCw size={15}/>重新读取</button>}</div>}
    {blockingError?<div className="empty"><p role="alert">{readingError}</p>{!snapshot&&<button className="secondary" onClick={refresh}><RefreshCw size={15}/>重新读取</button>}</div>:readingLoading?<div className="loading-bars" aria-label="正在加载"><div/><div/></div>:visible.length===0?<div className="empty"><BookOpen size={28}/><h2>{selectedDate?"这一天还没有公开手记":query||month!=="all"?"没有找到这条记录":"暂时还没有公开手记"}</h2><p>{selectedDate?"可以选择其他日期查看学习记录。":query||month!=="all"?"换个关键词或月份试试。":"这里会收录整理确认后的公开手记。"}</p></div>:<div className="entries">
      {archive.recent.map((r,index)=><details className="entry" key={r.date+snapshot} open={index===0||!!query||undefined}>
        <summary>
          <div className="date-line">
            <time className="entry-date" dateTime={r.date}>{r.date.replaceAll("-",".")}</time>
            <span className="date-annotation"><span className="weekday">{weekday(r.date)}</span>{r.date===source[0]?.date&&!snapshot&&<span className="latest">最近记录</span>}</span>
          </div>
          <div className="summary-right"><span className="category-preview">{r.items.map(i=>i.label).join(" · ")}</span><ChevronDown size={16} className="chevron" aria-hidden="true"/></div>
        </summary>
        <div className="entry-body">
          <div className="notes">{r.items.map((item,i)=><section className="note" id={`journal-${r.date}-note-${i+1}`} aria-labelledby={`journal-${r.date}-heading-${i+1}`} tabIndex={-1} data-journal-reveal key={i}>
            {i===0&&<p className="journal-reading-date"><time dateTime={r.date}>{r.date.replaceAll('-','.')}</time> / 学习手记</p>}
            <div className="journal-section-heading"><span className="journal-section-number" aria-hidden="true">{String(i+1).padStart(2,'0')}</span><h3 className="note-label" id={`journal-${r.date}-heading-${i+1}`}>{item.label}</h3></div>
            <JournalProse text={item.text}/>
          </section>)}</div>
          {(r.practice||r.items.some(item=>wayneoProject.topics.includes(item.label.trim())))&&<div className="entry-bottom">
            {r.practice&&<div className="practice" data-journal-reveal><span>练习与补充</span><JournalProse text={r.practice}/></div>}
            <RelatedProject entry={r}/>
          </div>}
        </div>
      </details>)}
      {archive.months.length>0&&<section className="journal-archive" aria-labelledby="journal-archive-title">
        <div className="journal-archive-heading"><h3 id="journal-archive-title">更早的记录</h3><p>最近 7 次之外，按月收起</p></div>
        {archive.months.map(group=><details className="journal-archive-month" key={group.month+snapshot}>
          <summary><span>{group.month.slice(0,4)} 年 {Number(group.month.slice(5))} 月</span><span className="journal-archive-count">{group.records.length} 次<ChevronDown size={16} aria-hidden="true"/></span></summary>
          <ul>{group.records.map(record=><li key={record.date}><a href={journalEntryPath(record.date,snapshot)}><time dateTime={record.date}>{record.date.replaceAll('-','.')}</time><span>{record.items.map(item=>item.label).join(' · ')}</span><ArrowUpRight size={15} aria-hidden="true"/></a></li>)}</ul>
        </details>)}
      </section>}
    </div>}
    {!readingLoading&&!readingError&&(older||newer)&&<nav className="journal-reading-neighbors" aria-label="相邻学习记录">{older&&<a href={journalEntryPath(older.date,snapshot)}><span>← 较早一篇</span><time dateTime={older.date}>{older.date}</time></a>}{newer&&<a data-direction="newer" href={journalEntryPath(newer.date,snapshot)}><span>较新一篇 →</span><time dateTime={newer.date}>{newer.date}</time></a>}</nav>}
    <footer><span>凌晨 6 点前归入前一天 · 北京时间</span><div className="history"><button className="text-button" onClick={loadSnapshots}><Archive size={14}/>历史快照</button>{snapshots.length>0&&<select aria-label="选择历史快照" value={snapshot} onChange={e=>viewSnapshot(e.target.value)}><option value="">最新记录</option>{snapshots.map(s=><option key={s.date} value={s.date}>{s.date}</option>)}</select>}</div></footer>
    </main><SiteFooter />
    {notice&&<div className="toast" role="status">{notice}</div>}
  </div>;
}
