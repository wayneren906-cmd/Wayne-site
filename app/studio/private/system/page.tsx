import {env} from 'cloudflare:workers';
import {headers} from 'next/headers';
import {readAdminSession} from '@/lib/admin-auth';
import LogoutButton from '../../../login/logout-button';
import AccountManager from '../management/account-manager';
import {verifyStudioSession} from '@/lib/learning/auth';
import {getStudioManagement} from '@/lib/learning/reads';
import type {StudioManagementDTO} from '@/lib/learning/contracts';
import StudioShell from '../../studio-shell';
import ManagementClient from '../management/management-client';
import StudioLoginLink from '../../studio-login-link';
import '../management/management.css';

export const dynamic='force-dynamic';
export const metadata={title:'系统与账号 · Studio',robots:{index:false,follow:false}};
export default async function SystemPage(){
  let allowed=false,accountOwner=false,initialData:StudioManagementDTO|null=null,initialError:string|null=null;
  try{
    const identity=await verifyStudioSession(await headers(),env.DB);
    allowed=true;
    accountOwner=(await readAdminSession(await headers(),env.DB))?.role==='owner';
    initialData=await getStudioManagement(env.DB,identity);
  }catch{if(allowed)initialError='管理数据暂时无法读取，请重试。';}
  return <StudioShell active="management" privateSection="system" title="系统与账号" description="查看数据来源、后台处理状态与管理员账号。刷新只读取状态，不会启动任务。" sessionControl={allowed?<LogoutButton/>:undefined}>
    {allowed?<><ManagementClient initialData={initialData} initialError={initialError}/>{accountOwner&&<AccountManager/>}</>:<div className="workbench-empty" role="alert">请登录管理员账号。当前无法验证管理权限。<StudioLoginLink returnTo="/studio/private/system"/></div>}
  </StudioShell>;
}
