import type {ReactNode} from 'react';
import SiteHeader from '../../site-header';
import SiteFooter from '../../site-footer';
import './devpath.css';

export default function DevPathLayout({children}:{children:ReactNode}){
  return <div className="editorial-shell">
    <SiteHeader active="studio"/>
    {children}
    <SiteFooter/>
  </div>;
}
