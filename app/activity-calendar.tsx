"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { learningDate, type Entry } from "@/lib/records";
import { activityByDate, activityLevel, shiftDate, startOfWeek, yearWeeks } from "@/lib/activity";

type Props = { records: Entry[]; selectedDate: string; onSelectDate: (date: string) => void; loading: boolean };
const labels = ["一", "二", "三", "四", "五", "六", "日"];

export default function ActivityCalendar({ records, selectedDate, onSelectDate, loading }: Props) {
  const today = learningDate();
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [weekStart, setWeekStart] = useState(startOfWeek(today));
  const [inspectedDate, setInspectedDate] = useState("");
  const scroll = useRef<HTMLDivElement>(null);
  const counts = useMemo(() => activityByDate(records), [records]);
  const weeks = useMemo(() => yearWeeks(year), [year]);
  const years = [...new Set([Number(today.slice(0, 4)), ...records.map(r => Number(r.date.slice(0, 4)))])].sort((a, b) => b - a);
  const days = Array.from({ length: 7 }, (_, i) => shiftDate(weekStart, i));
  const activeDays = [...counts.keys()].filter(date => date.startsWith(String(year)) && date <= today).length;
  const detailDate = inspectedDate || selectedDate;

  useEffect(() => {
    if (!selectedDate) return;
    setWeekStart(startOfWeek(selectedDate));
    setYear(Number(selectedDate.slice(0, 4)));
  }, [selectedDate]);
  useEffect(() => {
    const container = scroll.current;
    if (!container) return;
    const alignDate = () => {
      const target = container.querySelector<HTMLElement>(`[data-date="${selectedDate || today}"]`);
      if (target) container.scrollLeft = Math.max(0, target.offsetLeft - container.clientWidth + 70);
    };
    alignDate();
    // The embedded viewer can resize after the first render.
    const observer = new ResizeObserver(alignDate);
    observer.observe(container);
    return () => observer.disconnect();
  }, [year, selectedDate, today]);

  return <section className="calendar-panel" aria-label="学习日历">
    <div className="activity-header">
      <div><p className="section-kicker">日历与学习足迹</p><h2>学习足迹 <span>{loading ? "正在读取…" : `${year} 年 · ${activeDays} 天有记录`}</span></h2></div>
      <select className="year-select" aria-label="学习日历年份" value={year} onChange={e => { onSelectDate(""); setYear(Number(e.target.value)); setInspectedDate(""); }}>{years.map(y => <option value={y} key={y}>{y}</option>)}</select>
    </div>
    <div className="heatmap-scroll" ref={scroll}>
      <div className="heatmap-layout" style={{ "--week-count": weeks.length } as React.CSSProperties}>
        <div className="heatmap-months" aria-hidden="true">{weeks.map((week, i) => {
          const first = week.find(date => date.startsWith(String(year)) && date.endsWith("-01"));
          return first ? <span key={first} style={{ gridColumn: i + 1 }}>{Number(first.slice(5, 7))}月</span> : null;
        })}</div>
        <div className="heatmap-weekdays" aria-hidden="true"><span>一</span><span>三</span><span>五</span><span>日</span></div>
        <div className="heatmap-grid" aria-label={`${year} 年每日学习记录`}>
          {weeks.flatMap(week => week.map(date => {
            const inYear = date.startsWith(String(year));
            const future = date > today;
            const count = counts.get(date) ?? 0;
            const label = `${date}，${future ? "尚未到学习日期" : count ? `${count} 条学习内容` : "暂无记录"}`;
            return !inYear ? <span className="heatmap-padding" key={date} aria-hidden="true"/> : <button type="button" key={date} data-date={date} data-level={loading || future ? 0 : activityLevel(count)} className={`heatmap-cell${future ? " future" : ""}${date === selectedDate ? " selected" : ""}`} disabled={future || loading} aria-label={label} title={label} aria-pressed={date === selectedDate} onMouseEnter={() => setInspectedDate(date)} onMouseLeave={() => setInspectedDate("")} onFocus={() => setInspectedDate(date)} onBlur={() => setInspectedDate("")} onClick={() => onSelectDate(date)}/>;
          }))}
        </div>
      </div>
    </div>
    <div className="heatmap-footer"><span className="activity-detail" aria-live="polite">{loading ? "正在读取学习记录" : detailDate ? `${detailDate} · ${counts.get(detailDate) ?? 0} 条学习内容` : "每格一天，颜色深浅代表记录条目数"}</span><div className="heatmap-legend" aria-label="颜色越深，记录条目越多"><span>少</span>{[0,1,2,3,4].map(level => <i key={level} data-level={level}/>)}<span>多</span></div></div>
    <div className="date-index">
      <div className="week-heading"><span><CalendarDays size={15}/>{weekStart.slice(0,4)} 年 {Number(weekStart.slice(5,7))} 月{weekStart.slice(5,7) !== days[6].slice(5,7) ? ` — ${Number(days[6].slice(5,7))} 月` : ""}</span><div className="week-controls"><button className="text-button" type="button" onClick={() => { setWeekStart(startOfWeek(today)); onSelectDate(""); }}>本周</button><button className="icon-button" type="button" onClick={() => setWeekStart(shiftDate(weekStart, -7))} aria-label="上一周"><ChevronLeft size={17}/></button><button className="icon-button" type="button" disabled={shiftDate(weekStart, 7) > today} onClick={() => setWeekStart(shiftDate(weekStart, 7))} aria-label="下一周"><ChevronRight size={17}/></button></div></div>
      <div className="week-strip">{days.map((date, i) => <button type="button" key={date} className={`week-day${date === selectedDate ? " selected" : ""}${date === today ? " today" : ""}`} aria-label={`${date}，星期${labels[i]}，${counts.get(date) ? "有学习记录" : "暂无记录"}`} aria-pressed={date === selectedDate} disabled={date > today} onClick={() => onSelectDate(date)}><span>{labels[i]}</span><strong>{Number(date.slice(8))}</strong><i className={counts.get(date) ? "has-record" : ""} aria-hidden="true"/></button>)}</div>
    </div>
  </section>;
}
