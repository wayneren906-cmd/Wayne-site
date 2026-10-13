import {env} from 'cloudflare:workers';
import {headers} from 'next/headers';
import {verifyLearningOwner} from '@/lib/learning/auth';
import {prepareOwnerRegistration} from '@/lib/learning/registration';
import StudioEntry from './studio-entry';
import StudioClient from './studio-client';
import './studio-overview.css';
import './studio-events.css';
import './studio-supplement-form.css';
import './studio-client.css';

export const dynamic='force-dynamic';
export const metadata={title:'私人学习空间',robots:{index:false,follow:false}};
export default async function StudioPage() {
  const token=(await headers()).get('cf-access-jwt-assertion');
  try {await verifyLearningOwner(token,env,env.DB);}
  catch {
    try {
      const registration=await prepareOwnerRegistration(token,env,env.DB);
      if(registration.registration_required)return <main className="shell studio-page"><div className="studio-page__header"><h1>私人学习空间</h1><a href="/cdn-cgi/access/logout">退出登录</a></div><StudioClient readOnly initialOverview={{currentFocus:null,notice:{kind:'action_required',text:'当前为只读预览。所有者账户尚未登记，私人保存尚未开放；这里没有示例学习记录。'},connectionState:'not_connected',lastContentUpdatedAt:null,supplementHref:'#supplement',loading:false}}/></main>;
    }catch {/* Failed identity verification remains denied. */}
    return <main className="shell studio-page"><h1>私人学习空间</h1><p>请使用已获授权的所有者账户登录。当前无法验证访问权限。</p><a href="/learning">返回公开学习记录</a></main>;
  }
  return <main className="shell studio-page"><div className="studio-page__header"><h1>私人学习空间</h1><a href="/cdn-cgi/access/logout">退出登录</a></div><StudioEntry/></main>;
}
