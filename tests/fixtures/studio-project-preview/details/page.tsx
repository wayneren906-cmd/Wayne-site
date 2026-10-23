import StudioShell from '@/app/studio/studio-shell';
import StudioProjectDescription from '@/app/studio/studio-project-description';
import {websiteProjectDraft as draft} from '../content';

export const metadata={title:'Wayneo 本地草稿 · Studio',robots:{index:false,follow:false}};
export default function WebsiteProjectDetailPreview(){
  return <StudioShell active="projects" title="项目详情" description="本地草稿 · 未发布">
    <section id="wayneo" className="workbench-project studio-project-spread" aria-labelledby="wayneo-title">
      <header className="studio-project-heading">
        <p className="workbench-kicker">PERSONAL WEBSITE · 持续开发</p>
        <h2 id="wayneo-title">{draft.title}</h2>
        <p>{draft.tagline}</p>
        <div className="workbench-tags"><span>个人网站</span></div>
      </header>
      <div className="studio-project-body">
        <StudioProjectDescription description={draft.description} summary={draft.progress} nextStep={draft.nextStep} nextStepLabel="下一步建议"/>
        <div className="studio-project-links">
          <a href={draft.url}>访问网站 ↗</a>
          <a href="/studio/preview-wayneo">返回项目概览 ←</a>
        </div>
      </div>
    </section>
  </StudioShell>;
}
