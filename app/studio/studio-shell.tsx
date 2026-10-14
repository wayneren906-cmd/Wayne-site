import type {ReactNode} from 'react';
import SiteHeader from '../site-header';
import SiteFooter from '../site-footer';
import './studio-workbench.css';
const tabs=[['overview','/studio','仪表盘'],['roadmap','/studio/roadmap','学习与知识'],['practice','/studio/practice','任务与练习'],['projects','/studio/projects','项目与创作'],['archive','/studio/archive','活动档案']];
export default function StudioShell({active,title,description,children}:{active:string;title:string;description:string;children:ReactNode}){
  return <div className="editorial-shell studio-workbench"><SiteHeader active="studio"/><main>
    <header className="workbench-heading"><div><p className="workbench-kicker">STUDIO / PERSONAL DASHBOARD</p><h1>{title}</h1><p>{description}</p></div><a className="workbench-private-link" href="/studio/private">管理员入口 ↗</a></header>
    <nav className="workbench-tabs" aria-label="Studio 栏目">{tabs.map(([id,href,label])=><a key={id} href={href} aria-current={active===id?'page':undefined}>{label}</a>)}</nav>
    <div className="workbench-content">{children}</div>
  </main><SiteFooter/></div>;
}
