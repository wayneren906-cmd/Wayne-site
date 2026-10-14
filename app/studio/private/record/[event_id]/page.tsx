import {env} from 'cloudflare:workers';
import {headers} from 'next/headers';
import {verifyStudioSession} from '@/lib/learning/auth';
import StudioShell from '../../../studio-shell';
import RecordEditor from '../record-editor';
import StudioLoginLink from '../../../studio-login-link';
export const dynamic='force-dynamic';
export const metadata={title:'记录与修订 · Studio',robots:{index:false,follow:false}};
export default async function RecordPage({params}:{params:Promise<{event_id:string}>}){
  const {event_id}=await params;let allowed=false;try{await verifyStudioSession(await headers(),env.DB);allowed=true;}catch{}
  return <StudioShell active="records" privateSection="records" title="记录与修订" description="保留原始来源和学习时间，用修订原因解释变化。"><a href="/studio/private">← 返回私人记录</a>{allowed?<RecordEditor eventId={event_id}/>:<p className="workbench-empty" role="alert">请登录管理员账号。当前无法验证访问权限。<StudioLoginLink returnTo={`/studio/private/record/${encodeURIComponent(event_id)}`}/></p>}</StudioShell>;
}
