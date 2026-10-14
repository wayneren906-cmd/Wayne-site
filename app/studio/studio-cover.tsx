import {studioPhotography} from './studio-photography';
export default function StudioCover({privateView=false}:{privateView?:boolean}){
  const photo=studioPhotography[privateView?'private':'cover'];
  return <section className={`studio-cover studio-cover--${privateView?'private':'public'}`} aria-label={privateView?'私人工作台封面':'Studio 封面'}>
    <div className="studio-cover-meta"><span>{privateView?'STUDIO / PRIVATE WORKSPACE':'STUDIO / PERSONAL DASHBOARD'}</span><span>{privateView?'NOTES · PROJECTS · NEXT STEPS':'A WORKING COLLECTION'}</span></div>
    <div className="studio-cover-grid">
      <div className="studio-cover-copy">
        <h1 className="studio-cover-title" aria-label={privateView?'私人工作台':'成长、工作与探索。'}>{privateView?<><span aria-hidden="true">Working</span><em aria-hidden="true">notes.</em></>:<span aria-hidden="true">St<em>u</em>dio.</span>}</h1>
        {!privateView&&<p className="studio-cover-subphrase">Notes on work &amp; becoming.</p>}
        <div className="studio-cover-intro">
          <p className="studio-cover-deck">{privateView?'每一步，留下痕迹。':'成长、工作与探索。'}</p>
          <p className="studio-cover-description">{privateView?'记录实际过程，推进手里的项目，再决定哪些进展公开。':'从理解到动手，从想法到作品。这里收录正在进行的探索，以及一路留下的记录。'}</p>
          <div className="studio-cover-links">{!privateView&&<a href="#projects">翻开项目与探索 <span aria-hidden="true">↘</span></a>}<a href={privateView?'/studio':'/studio/private/management'}>{privateView?'查看公开 Studio':'进入私人工作台'} <span aria-hidden="true">↗</span></a></div>
        </div>
      </div>
      <figure className="studio-cover-image"><div className="studio-photo-window"><img src={photo.src} alt={photo.title+'，摄影：'+photo.author} width={photo.width} height={photo.height} fetchPriority="high"/></div><figcaption><span>{photo.title}</span><a href={photo.source} target="_blank" rel="noopener noreferrer" title={photo.award}>© {photo.author} ↗</a></figcaption></figure>
    </div>
  </section>;
}
