import {studioPhotography} from './studio-photography';
export default function StudioPhotographyEssay(){
  return <section className="studio-photography-essay" aria-labelledby="studio-photography-title">
    <header><p className="workbench-kicker">VISUAL NOTES / 摄影选作</p><h2 id="studio-photography-title">Form <em>&amp; space.</em></h2></header>
    <div className="studio-essay-grid">{[studioPhotography.essayMain,studioPhotography.essayDetail].map(photo=><figure key={photo.src}><div className="studio-photo-window"><img src={photo.src} alt={photo.title+'，摄影：'+photo.author} width={photo.width} height={photo.height} loading="lazy"/></div><figcaption><span>{photo.title}</span><a href={photo.source} target="_blank" rel="noopener noreferrer" title={photo.award}>© {photo.author} ↗</a></figcaption></figure>)}</div>
  </section>;
}
