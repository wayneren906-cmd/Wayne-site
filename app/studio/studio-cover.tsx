import {studioPhotography} from './studio-photography';

export default function StudioCover({privateView=false}:{privateView?:boolean}){
  const photo=studioPhotography[privateView?'private':'cover'];
  return (
    <section
      className={`studio-cover studio-cover--${privateView?'private':'public'}`}
      aria-label={privateView?'私人工作台封面':'Studio 公开封面：项目与收藏'}
    >
      <div className="studio-cover-meta">
        <span>{privateView?'STUDIO / PRIVATE WORKSPACE':'PROJECTS & COLLECTIONS'}</span>
        <span>{privateView?'NOTES · PROJECTS · NEXT STEPS':'A WORKING COLLECTION'}</span>
      </div>
      <div className="studio-cover-grid">
        <div className="studio-cover-copy">
          <h1
            className="studio-cover-title"
            aria-label={privateView?'私人工作台':'Studio · 项目与收藏'}
          >
            {privateView?(
              <>
                <span aria-hidden="true">Working</span>
                <em aria-hidden="true">notes.</em>
              </>
            ):(
              <span aria-hidden="true">St<em>u</em>dio.</span>
            )}
          </h1>
          {!privateView&&<p className="studio-cover-subphrase">Work in progress.</p>}
          <div className="studio-cover-intro">
            <p className="studio-cover-deck">{privateView?'每一步，留下痕迹。':'项目与收藏'}</p>
            <p className="studio-cover-description">
              {privateView
                ?'记录实际过程，推进手里的项目，再决定哪些进展公开。'
                :'正在做的项目，以及个人的兴趣与收藏。'}
            </p>
            <div className="studio-cover-links">
              {privateView?(
                <a href="/studio">
                  查看公开 Studio <span aria-hidden="true">↗</span>
                </a>
              ):(
                <a href="#wayneo">
                  查看 Wayneo 项目 <span aria-hidden="true">↘</span>
                </a>
              )}
            </div>
          </div>
        </div>
        <figure className="studio-cover-image">
          <div className="studio-photo-window">
            <img
              src={photo.src}
              alt={photo.title+'，摄影：'+photo.author}
              width={photo.width}
              height={photo.height}
              fetchPriority="high"
            />
          </div>
          <figcaption>
            <span>{photo.title}</span>
            <a href={photo.source} target="_blank" rel="noopener noreferrer" title={photo.award}>
              © {photo.author} ↗
            </a>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
