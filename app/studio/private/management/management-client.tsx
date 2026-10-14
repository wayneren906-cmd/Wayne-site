"use client";

import {useEffect,useRef,useState} from 'react';
import type {StudioJobStatus,StudioManagementDTO} from '@/lib/learning/contracts';
import {studioManagementSchema} from '@/lib/learning/management-schema';

const statusLabels:Record<StudioJobStatus,string>={pending:'等待处理',running:'处理中',succeeded:'已完成',failed:'失败',needs_attention:'需处理'};
const sourceLabels={studio:'Studio',chatgpt:'ChatGPT 标记',other:'其他来源'};
const timeFormat=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
const formatTime=(value:string|null)=>value?timeFormat.format(new Date(value)):'暂无记录';

export default function ManagementClient({initialData,initialError=null}:{initialData:StudioManagementDTO|null;initialError?:string|null}){
  const [data,setData]=useState(initialData);
  const [error,setError]=useState(initialError);
  const [loading,setLoading]=useState(false);
  const [filter,setFilter]=useState('all');
  const controller=useRef<AbortController|null>(null);
  useEffect(()=>()=>{controller.current?.abort();},[]);

  async function refresh(){
    controller.current?.abort();
    const current=new AbortController();controller.current=current;
    setLoading(true);setError(null);
    const timeout=setTimeout(()=>{
      if(controller.current===current&&!current.signal.aborted){setData(null);setError('读取超时，请稍后重试。');setLoading(false);current.abort();}
    },20000);
    try{
      const response=await fetch('/api/studio/management',{credentials:'same-origin',cache:'no-store',redirect:'error',signal:current.signal});
      if(!response.ok)throw new Error(response.status===401||response.status===403?'管理权限无法验证，请重新登录已授权账户。':'管理数据暂时无法读取，请重试。');
      const result=studioManagementSchema.safeParse(await response.json());
      if(!result.success)throw new Error('管理数据不完整，请重试。');
      if(controller.current===current&&!current.signal.aborted)setData(result.data);
    }catch(cause){
      if(controller.current===current&&!current.signal.aborted){setData(null);setError(cause instanceof Error&&cause.message.includes('请')?cause.message:'读取失败，请检查连接后重试。');}
    }finally{clearTimeout(timeout);if(controller.current===current&&!current.signal.aborted)setLoading(false);}
  }
  const jobs=data?.jobs.recent.filter(job=>filter==='all'||(filter==='attention'?(job.status==='failed'||job.status==='needs_attention'||job.has_error):filter==='open'?(job.status==='pending'||job.status==='running'):job.status==='succeeded'))??[];
  return <div className="management-overview" aria-busy={loading}>
    <div className="management-toolbar"><p aria-live="polite">{loading?'正在读取管理状态…':data?`本次读取 · ${formatTime(data.generated_at)}（北京时间）`:'尚未读取管理状态'}</p><button type="button" className="workbench-action" onClick={refresh} disabled={loading}>{loading?'读取中…':'刷新状态'}</button></div>
    {error&&<p className="workbench-feedback" role="alert">{error}</p>}
    {data&&<>
      <dl className="management-metrics" aria-label="私人数据概况"><div><dt>私人学习记录</dt><dd>{data.private_event_count}</dd></div><div><dt>学习接收回执</dt><dd>{data.received_change_count}</dd></div><div><dt>学习数据版本</dt><dd>v{data.data_version}</dd></div><div><dt>失败与需处理</dt><dd>{data.jobs.counts.failed+data.jobs.counts.needs_attention}</dd></div></dl>
      <div className="workbench-grid">
        <section className="workbench-panel" aria-labelledby="management-received"><p className="workbench-kicker">01 / DATA & SOURCES</p><h2 id="management-received">记录从哪里来</h2><dl className="management-details"><div><dt>最近接收</dt><dd>{formatTime(data.latest_received_at)}</dd></div><div><dt>最近数据变更</dt><dd>{formatTime(data.last_data_change_at)}</dd></div></dl>
          {data.sources.length?<ul className="management-sources">{data.sources.map(source=><li key={source.type}><div><h3>{sourceLabels[source.type]}</h3><p>最近接收 · {formatTime(source.latest_received_at)}</p></div><span>{source.event_count} 条</span></li>)}</ul>:<p className="workbench-note">暂无私人来源记录。公开 Journal 与私人记录分别管理。</p>}
          <p className="workbench-note">接收时间表示数据到达系统的时间。来源标记不代表自动同步已接通；回执数量包含现存修订，不等于学习次数。</p>
        </section>
        <section className="workbench-panel" aria-labelledby="management-processing"><p className="workbench-kicker">02 / PROCESSING</p><h2 id="management-processing">后台处理状态</h2><p>任务执行器尚未接入。此处显示已保存的任务状态，刷新不会启动任务。</p><dl className="management-status-list">{(Object.keys(statusLabels) as StudioJobStatus[]).map(status=><div key={status}><dt>{statusLabels[status]}</dt><dd>{data.jobs.counts[status]}</dd></div>)}</dl><p className="workbench-note">统计覆盖当前账户未删除记录关联的任务，包含历史版本。保存成功与后台处理完成分别显示。</p></section>
      </div>
      <section className="management-jobs" aria-labelledby="management-jobs-title"><div className="management-section-heading"><div><p className="workbench-kicker">03 / RECENT TASKS</p><h2 id="management-jobs-title">近期任务</h2></div><label>显示<select value={filter} onChange={event=>setFilter(event.target.value)}><option value="all">全部近期任务</option><option value="open">等待与处理中</option><option value="attention">异常与需处理</option><option value="done">已完成</option></select></label></div>
        <p className="workbench-note">{data.jobs.truncated?'仅展示最近 20 条任务，筛选范围限于这些任务。':'展示已读取的近期任务。'} 时间为任务创建时间。</p>
        {jobs.length?<ul className="management-job-list">{jobs.map(job=><li key={job.job_id}><div className="management-job-top"><h3>记录修订 r{job.revision}</h3><span className="management-job-status" data-status={job.status}>{statusLabels[job.status]}</span></div><p><time dateTime={job.created_at}>{formatTime(job.created_at)}</time> · 数据 v{job.data_version} · 尝试 {job.attempts} 次</p><div className="management-job-bottom"><span>{job.is_current_revision?'当前版本':'历史版本'}{job.has_error?' · 有错误记录':''}</span><a href={`/studio/private/record/${encodeURIComponent(job.event_id)}`}>查看关联记录 ↗</a></div></li>)}</ul>:<p className="workbench-empty">{data.jobs.recent.length?'近期任务中没有符合筛选条件的记录。':'暂无后台任务。保存或修订私人记录后，可在这里查看接收后的处理状态。'}</p>}
      </section>
    </>}
  </div>;
}
