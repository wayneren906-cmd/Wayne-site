import type {ReactNode} from 'react';
import SiteHeader from '../site-header';
import SiteFooter from '../site-footer';
import StudioPrivateNavigation from './studio-private-navigation';
import type {PrivateSection} from './studio-private-navigation';
import './studio-workbench.css';
import './studio-editorial.css';
const tabs=[['overview','/studio','仪表盘'],['roadmap','/studio/roadmap','学习与知识'],['practice','/studio/practice','练习目录'],['projects','/studio/projects','项目与创作'],['archive','/studio/archive','活动档案']];
export default function StudioShell({active,title,description,children,privateSection,cover,sessionControl}:{active:string;title:string;description:string;children:ReactNode;privateSection?:PrivateSection;cover?:ReactNode;sessionControl?:ReactNode}){
  const index=privateSection?['management','records','projects','plans','system'].indexOf(privateSection):tabs.findIndex(tab=>tab[0]===active);
  return <div className={`editorial-shell studio-workbench studio-editorial${privateSection?' studio-editorial--private':' studio-editorial--public'}${cover?' studio-editorial--cover':''}`}><SiteHeader active="studio"/><main>
    {cover??<header className="workbench-heading"><div><p className="workbench-kicker">{privateSection?'STUDIO / 私人管理空间':'STUDIO / PERSONAL DASHBOARD'}</p><h1>{title}</h1><p>{description}</p></div><div className="studio-heading-aside"><span className="studio-page-marker" aria-hidden="true">{index>=0?String(index+1).padStart(2,'0'):'↗'}</span><a className="workbench-private-link" href={privateSection?'/studio':'/studio/private/management'}>{privateSection?'查看公开 Studio ↗':'进入管理空间 ↗'}</a></div></header>}
    <div className="studio-section-nav">{privateSection?<StudioPrivateNavigation active={privateSection}/>:<nav className="workbench-tabs" aria-label="Studio 栏目">{tabs.map(([id,href,label],index)=><a key={id} href={href} aria-current={active===id?'page':undefined}><span className="studio-tab-number" aria-hidden="true">{String(index+1).padStart(2,'0')}</span>{label}</a>)}</nav>}{sessionControl&&<div className="studio-session-actions">{sessionControl}</div>}</div>
    <div className="workbench-content">{children}</div>
  </main><SiteFooter/></div>;
}
