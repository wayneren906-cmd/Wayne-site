import {env} from 'cloudflare:workers';
import {headers} from 'next/headers';
import {verifyLearningOwner} from '@/lib/learning/auth';
import StudioShell from '../../../studio-shell';
import RecordEditor from '../record-editor';
export const dynamic='force-dynamic';
export const metadata={title:'记录与修订 · Studio',robots:{index:false,follow:false}};
export default async function RecordPage({params}:{params:Promise<{event_id:string}>}){
  const {event_id}=await params;let allowed=false;try{await verifyLearningOwner((await headers()).get('cf-access-jwt-assertion'),env,env.DB);allowed=true;}catch{}
  return <StudioShell active="archive" title="记录与修订" description="保留原始来源和学习时间，用修订原因解释变化。"><a href="/studio/private/workspace">← 返回私人工作区</a>{allowed?<RecordEditor eventId={event_id}/>:<p className="workbench-empty">当前无法验证访问权限，请使用已授权的所有者账户。</p>}</StudioShell>;
}
