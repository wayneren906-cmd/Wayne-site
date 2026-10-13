import {env} from 'cloudflare:workers';
import {headers} from 'next/headers';
import {verifyLearningOwner} from '@/lib/learning/auth';
import {prepareOwnerRegistration} from '@/lib/learning/registration';
import SiteHeader from '../../site-header';
import SiteFooter from '../../site-footer';
import StudioEntry from '../studio-entry';
import StudioClient from '../studio-client';
import '../studio-overview.css';
import '../studio-events.css';
import '../studio-supplement-form.css';
import '../studio-client.css';

export const dynamic='force-dynamic';
export const metadata={title:'私人学习空间',robots:{index:false,follow:false}};
export default async function PrivateStudioPage(){
  const token=(await headers()).get('cf-access-jwt-assertion');
  let content;
  try{await verifyLearningOwner(token,env,env.DB);content=<StudioEntry/>;}
  catch{
    try{
      const registration=await prepareOwnerRegistration(token,env,env.DB);
      if(registration.registration_required)content=<StudioClient readOnly initialOverview={{currentFocus:null,notice:{kind:'info',text:'当前为只读预览。所有者账户尚未登记，私人保存尚未开放。'},connectionState:'not_connected',lastContentUpdatedAt:null,supplementHref:null,loading:false}}/>;
    }catch{/* Invalid identity stays denied. */}
    content??=<p role="alert">请使用已获授权的所有者账户登录。当前无法验证访问权限。</p>;
  }
  return <div className="editorial-shell studio-private-shell"><SiteHeader active="studio"/><main className="studio-page"><a className="studio-back-link" href="/studio">← 返回 Studio</a><div className="studio-page__header"><div><p className="studio-private-kicker">PRIVATE NOTEBOOK / 私人手记</p><h1>私人学习空间</h1></div>{token&&<a href="/cdn-cgi/access/logout">退出登录</a>}</div><a className="studio-back-link" href="/studio/private/workspace">练习与项目关联工作区 →</a>{content}</main><SiteFooter/></div>;
}
