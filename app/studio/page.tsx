import {collectionItems} from '@/content/collection';
import {wayneoProject} from '@/content/wayneo';
import StudioShell from './studio-shell';
import StudioCover from './studio-cover';
import StudioPhotographyEssay from './studio-photography-essay';
import './wayneo-feature.css';
import './collection.css';

export const metadata={
  title:'Studio · 项目与收藏',
  description:'Studio：正在做的项目与个人收藏，以及摄影笔记。'
};

export default function StudioPage(){
  return (
    <StudioShell
      active="overview"
      title="项目与收藏"
      description="正在做的项目与个人收藏，以及公开的笔记。"
      cover={<StudioCover/>}
    >
      <article id="wayneo" className="wayneo-project-index" aria-labelledby="wayneo-project-title">
        <div className="wayneo-project-index-meta">
          <span className="wayneo-project-index-number" aria-hidden="true">01</span>
          <h2 id="wayneo-project-title" className="wayneo-project-index-name">{wayneoProject.title}</h2>
          <p className="wayneo-project-index-status">状态 · 持续完善</p>
        </div>
        <div className="wayneo-project-index-copy">
          <p className="wayneo-project-index-summary">{wayneoProject.summary}</p>
          <ul className="wayneo-project-index-topics" aria-label="项目主题">
            {wayneoProject.topics.map(topic=><li key={topic}>{topic}</li>)}
          </ul>
          <a className="wayneo-project-index-link" href={wayneoProject.url}>
            查看项目详情 <span aria-hidden="true">↗</span>
          </a>
        </div>
      </article>

      <article className="collection-entry" aria-labelledby="collection-entry-title">
        <div className="collection-entry-meta">
          <span className="collection-entry-number" aria-hidden="true">02</span>
          <h2 id="collection-entry-title" className="collection-entry-name">收藏馆</h2>
        </div>
        <div className="collection-entry-copy">
          <p className="collection-entry-deck">故事、剧集与游戏。</p>
          <ul className="collection-entry-titles" aria-label="收藏作品">
            {collectionItems.map(item=><li key={item.id}>{item.title}</li>)}
          </ul>
          <a className="collection-entry-link" href="/studio/collection">
            进入收藏馆 <span aria-hidden="true">↗</span>
          </a>
        </div>
      </article>

      <StudioPhotographyEssay/>
    </StudioShell>
  );
}
