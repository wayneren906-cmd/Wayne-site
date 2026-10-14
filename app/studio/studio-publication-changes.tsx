import type {PublicationChange} from '../../lib/ui/studio-publication-changes.ts';

export default function StudioPublicationChanges({changes}:{changes:PublicationChange[]}){
  return <section className="studio-publication-changes" aria-label="公开版本变化"><h4>此次发布将改变什么</h4>{changes.length?<ul className="workbench-evidence">{changes.map((change,index)=><li key={index}><h4>{change.label}</h4><dl><div><dt>访客现在看到</dt><dd>{change.before}</dd></div><div><dt>确认发布后</dt><dd>{change.after}</dd></div></dl></li>)}</ul>:<p>公开字段没有变化。</p>}</section>;
}
