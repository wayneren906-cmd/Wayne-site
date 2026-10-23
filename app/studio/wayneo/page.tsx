import {env} from 'cloudflare:workers';
import {wayneoProject} from '@/content/wayneo';
import {readPublicContent} from '@/lib/public-content';
import type {PublicContentItem} from '@/lib/public-content-contracts';
import StudioShell from '../studio-shell';
import WayneoSpecimen from '../wayneo-specimen';
import WayneoExperience from '../wayneo-experience';
import WayneoPageGuide from '../wayneo-page-guide';
import '../wayneo-feature.css';

export const dynamic='force-dynamic';
export const metadata={
  title:'Wayneo · 项目详情',
  description:'Wayneo 项目详情：为什么做、页面体验、设计取舍与当前状态。'
};

const sectionNumbers=['01','02','03','04'];
const sectionNumber=(index:number)=>sectionNumbers[index]??String(index+1).padStart(2,'0');

export default async function WayneoDetailPage(){
  let items:PublicContentItem[]|null=null;
  try{
    items=await readPublicContent(env.DB);
  }catch{
    items=null;
  }

  const wayneoTopicSet=new Set(wayneoProject.topics);
  const relatedJournal=(items??[])
    .filter(item=>item.type==='journal'&&item.topics.some(topic=>wayneoTopicSet.has(topic)))
    .slice(0,3);

  return (
    <StudioShell
      active="projects"
      title="Wayneo"
      description="项目详情：为什么做、页面体验、设计取舍与当前状态。"
    >
      <p className="wayneo-project-back-link">
        <a href="/studio">← 返回 Studio</a>
      </p>

      <article id="wayneo" className="wayneo-feature" aria-label="Wayneo 项目特稿">
        <WayneoSpecimen project={wayneoProject}/>

        <nav className="wayneo-feature-index" aria-label="Wayneo 特稿段落">
          {wayneoProject.sections.map((section,index)=>(
            <a key={section.id} href={`#${section.id}`}>
              <span aria-hidden="true">{sectionNumber(index)}</span>
              {section.title}
            </a>
          ))}
        </nav>

        {wayneoProject.sections.map((section,index)=>(
          <section
            key={section.id}
            id={section.id}
            className="wayneo-feature-section"
            aria-labelledby={`${section.id}-title`}
          >
            <header className="wayneo-feature-heading">
              <p className="workbench-kicker">WAYNEO / {sectionNumber(index)}</p>
              <h2 id={`${section.id}-title`}>{section.title}</h2>
            </header>
            <div className="wayneo-feature-body">
              {section.paragraphs.map((paragraph,paragraphIndex)=>(
                <p key={paragraphIndex}>{paragraph}</p>
              ))}
              {section.id==='decisions'&&(
                <details className="wayneo-feature-details">
                  <summary>阅读设计说明</summary>
                  <p>
                    切换版式会重新安排标题与正文的位置，帮助观察宽度变化对阅读的影响。
                    网格只是辅助线，不会改变内容。
                  </p>
                </details>
              )}
            </div>
            {section.id==='experience'&&<>
              <WayneoExperience project={wayneoProject}/>
              <WayneoPageGuide/>
            </>}
          </section>
        ))}

        {items===null?(
          <p className="wayneo-feature-note" role="status">
            相关手记暂时无法读取。
          </p>
        ):relatedJournal.length>0&&(
          <section className="wayneo-feature-related" aria-labelledby="wayneo-related-title">
            <h2 id="wayneo-related-title">相关手记</h2>
            <ul>
              {relatedJournal.map(item=>(
                <li key={item.id}>
                  <a href={item.url}>
                    {item.date&&<time dateTime={item.date}>{item.date}</time>}
                    <span>{item.title}</span>
                  </a>
                  {item.topics.length>0&&(
                    <p className="wayneo-feature-related-topics">{item.topics.join(' · ')}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>

      <p className="wayneo-project-back-link">
        <a href="/studio">← 返回 Studio</a>
      </p>

      <p className="workbench-footnote">
        <a href="/learning">阅读 Journal ↗</a>
        {' · '}
        <a href="/studio/collection">逛逛收藏馆 ↗</a>
      </p>
    </StudioShell>
  );
}
