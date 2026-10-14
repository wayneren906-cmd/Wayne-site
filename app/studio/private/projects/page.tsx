import {env} from 'cloudflare:workers';
import {headers} from 'next/headers';
import {verifyStudioSession} from '@/lib/learning/auth';
import {getStudioProjectDrafts} from '@/lib/studio-projects';
import type {StudioProjectDraftDTO} from '@/lib/learning/contracts';
import StudioShell from '../../studio-shell';
import ProjectEditor from './project-editor';
import './project-editor.css';
export const dynamic='force-dynamic';
export const metadata={title:'项目状态管理 · Studio',robots:{index:false,follow:false}};
export default async function ProjectManagementPage(){
  let allowed=false,projects:StudioProjectDraftDTO[]|null=null,error:string|null=null;
  try{const identity=await verifyStudioSession(await headers(),env.DB);allowed=true;projects=await getStudioProjectDrafts(env.DB,identity);}
  catch{if(allowed)error='项目管理数据暂时无法读取，请刷新重试。';}
  return <StudioShell active="management" title="项目进展与发布" description="维护项目状态，保存私人草稿，再决定让哪些进展公开可见。"><nav className="project-editor-navigation" aria-label="项目管理导航"><a href="/studio/private/management">← 管理总览</a><a href="/studio/projects">公开项目页 ↗</a></nav>{allowed?<ProjectEditor initialProjects={projects} initialError={error}/>:<p className="workbench-empty" role="alert">请登录管理员账号。当前无法验证管理权限。</p>}</StudioShell>;
}
