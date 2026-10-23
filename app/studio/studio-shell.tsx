import type {ReactNode} from 'react';
import SiteHeader from '../site-header';
import SiteFooter from '../site-footer';
import StudioPrivateNavigation from './studio-private-navigation';
import type {PrivateSection} from './studio-private-navigation';
import StudioPublicMotion from './studio-public-motion';
import './studio-workbench.css';
import './studio-editorial.css';

const privateSections:PrivateSection[]=['management','records','projects','plans','system'];

export default function StudioShell({
  active,
  title,
  description,
  children,
  privateSection,
  cover,
  sessionControl,
  kicker
}:{
  active:string;
  title:string;
  description:string;
  children:ReactNode;
  privateSection?:PrivateSection;
  cover?:ReactNode;
  sessionControl?:ReactNode;
  kicker?:string;
}){
  // 公开页面不再有概览/详情双导航，只有私人分支保留原有栏目导航。
  const tabIndex=privateSection?privateSections.indexOf(privateSection):-1;
  const isProjectPage=!privateSection&&!cover&&(active==='overview'||active==='projects');

  const publicMotion=!privateSection&&(active==='overview'||active==='projects');
  const rootClassName=`editorial-shell studio-workbench studio-editorial${
    privateSection?' studio-editorial--private':' studio-editorial--public'
  }${cover?' studio-editorial--cover':''}${isProjectPage?' studio-editorial--project-page':''}${
    publicMotion?' studio-public-motion':''
  }`;
  const content=(
    <>
      <SiteHeader active="studio"/>
      <main>
        {cover??(
          <header className="workbench-heading">
            <div>
              <p className="workbench-kicker">
                {privateSection?'STUDIO / 私人管理空间':(kicker??'PROJECTS & PROGRESS')}
              </p>
              <h1>{title}</h1>
              <p>{description}</p>
            </div>
            <div className="studio-heading-aside">
              {tabIndex>=0&&(
                <span className="studio-page-marker" aria-hidden="true">
                  {String(tabIndex+1).padStart(2,'0')}
                </span>
              )}
              {privateSection&&(
                <a className="workbench-private-link" href="/studio">
                  查看公开 Studio ↗
                </a>
              )}
            </div>
          </header>
        )}
        {privateSection&&(
          <div className="studio-section-nav">
            <StudioPrivateNavigation active={privateSection}/>
            {sessionControl&&<div className="studio-session-actions">{sessionControl}</div>}
          </div>
        )}
        <div className="workbench-content">{children}</div>
      </main>
      <SiteFooter/>
    </>
  );

  return publicMotion
    ? <StudioPublicMotion className={rootClassName}>{content}</StudioPublicMotion>
    : <div className={rootClassName}>{content}</div>;
}
