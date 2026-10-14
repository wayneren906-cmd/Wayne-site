import {env} from 'cloudflare:workers';
import {headers} from 'next/headers';
import {verifyStudioSession} from '@/lib/learning/auth';
import {getStudioProjectDrafts} from '@/lib/studio-projects';
import type {StudioProjectDraftDTO} from '@/lib/learning/contracts';
import StudioShell from '../../studio-shell';
import ProjectEditor from './project-editor';
import StudioLoginLink from '../../studio-login-link';
import './project-editor.css';
export const dynamic='force-dynamic';
export const metadata={title:'项目状态管理 · Studio',robots:{index:false,follow:false}};
export default async function ProjectManagementPage({searchParams}:{searchParams:Promise<{project?:string|string[]}>}){
  const query=await searchParams;
  const initialProjectId=typeof query.project==='string'?query.project:undefined;
  let allowed=false,projects:StudioProjectDraftDTO[]|null=null,error:string|null=null;
  try{const identity=await verifyStudioSession(await headers(),env.DB);allowed=true;projects=await getStudioProjectDrafts(env.DB,identity);}
  catch{if(allowed)error='项目管理数据暂时无法读取，请刷新重试。';}
  return <StudioShell active="projects" privateSection="projects" title="项目进展与发布" description="维护项目状态，保存私人草稿，再决定让哪些进展公开可见。"><a href="/studio/projects">查看公开项目页 ↗</a>{allowed?<ProjectEditor initialProjects={projects} initialError={error} initialProjectId={initialProjectId}/>:<p className="workbench-empty" role="alert">请登录管理员账号。当前无法验证管理权限。<StudioLoginLink returnTo="/studio/private/projects"/></p>}</StudioShell>;
}
