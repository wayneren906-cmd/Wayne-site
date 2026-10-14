import {env} from 'cloudflare:workers';
import {headers} from 'next/headers';
import {verifyLearningOwner} from '@/lib/learning/auth';
import {getStudioManagement} from '@/lib/learning/reads';
import type {StudioManagementDTO} from '@/lib/learning/contracts';
import StudioShell from '../../studio-shell';
import ManagementClient from './management-client';
import './management.css';

export const dynamic='force-dynamic';
export const metadata={title:'管理总览 · Studio',robots:{index:false,follow:false}};
export default async function ManagementPage(){
  const token=(await headers()).get('cf-access-jwt-assertion');
  let allowed=false,initialData:StudioManagementDTO|null=null,initialError:string|null=null;
  try{
    const identity=await verifyLearningOwner(token,env,env.DB);
    allowed=true;
    initialData=await getStudioManagement(env.DB,identity);
  }catch{if(allowed)initialError='管理数据暂时无法读取，请重试。';}
  return <StudioShell active="management" title="管理我的数字空间" description="查看私人数据、接收来源与任务状态，让每一次更新都有迹可循。">
    <nav className="management-navigation" aria-label="管理员工作区"><a href="/studio">← 公开仪表盘</a><a href="/studio/private">私人记录</a><a href="/studio/private/projects">项目状态与发布</a><a href="/studio/private/workspace">练习与项目证据</a></nav>
    {allowed?<ManagementClient initialData={initialData} initialError={initialError}/>:<div className="workbench-empty" role="alert">请使用已登记并启用的所有者账户登录。当前无法验证管理权限。</div>}
  </StudioShell>;
}
