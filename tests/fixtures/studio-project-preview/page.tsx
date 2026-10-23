import StudioShell from '@/app/studio/studio-shell';
import StudioCover from '@/app/studio/studio-cover';
import StudioPhotographyEssay from '@/app/studio/studio-photography-essay';
import {websiteProjectDraft as draft} from './content';
import '@/app/studio/studio-dashboard.css';

export const metadata={title:'本地项目草稿 · Studio',robots:{index:false,follow:false}};
export default function WebsiteProjectOverviewPreview(){
  return <StudioShell active="overview" title="项目概览" description="本地草稿 · 未发布" cover={<StudioCover/>}>
    <p className="workbench-kicker" role="status">本地草稿 · 未发布</p>
    <section id="projects" className="dashboard-section dashboard-projects" aria-labelledby="preview-projects-title">
      <header className="dashboard-section-heading"><h2 id="preview-projects-title">项目与进展</h2></header>
      <div className="dashboard-project-grid studio-project-index">
        <article>
          <div className="dashboard-project-meta"><p className="workbench-kicker">01</p><span className="dashboard-status">持续开发</span></div>
          <h3><a href="/studio/preview-wayneo/details#wayneo">{draft.title}</a></h3>
          <p>{draft.tagline}<br/>{draft.shortProgress}</p>
          <a href="/studio/preview-wayneo/details#wayneo">查看项目详情 →</a>
        </article>
      </div>
    </section>
    <StudioPhotographyEssay/>
  </StudioShell>;
}
