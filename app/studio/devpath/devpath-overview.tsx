import {devPathDirections,devPathIntroduction,devPathMilestones,devPathPractices,devPathSnapshot} from '@/content/devpath';
import {devPathDetailHref} from '@/lib/devpath';

function SectionLabel({number,title,note}:{number:string;title:string;note:string}){
  return <div className="dp-section-label"><span>{number} / {title}</span><span>{note}</span></div>;
}

function PathStudy(){
  return <figure className="dp-path-study">
    <svg viewBox="0 0 440 380" role="img" aria-labelledby="path-study-title">
      <title id="path-study-title">从同一个起点，向学习、创造与生活展开的路径示意</title>
      <g className="dp-study-rules" fill="none"><path d="M20 80H420M20 160H420M20 240H420M20 320H420"/></g>
      <g fill="none" strokeWidth="1.5"><path className="dp-path-muted" d="M60 320V202Q60 160 104 160H176Q220 160 220 116V48"/><path className="dp-path-olive" d="M60 320V282Q60 240 104 240H336Q380 240 380 196V132"/><path className="dp-path-accent" d="M60 320V282Q60 240 104 240H176Q220 240 220 284V332"/><path className="dp-path-muted" d="M220 160H280Q300 160 300 140V88"/></g>
      <g className="dp-study-nodes"><circle cx="60" cy="320" r="5"/><circle cx="220" cy="48" r="4"/><circle cx="380" cy="132" r="4"/><circle cx="220" cy="332" r="4"/><circle cx="300" cy="88" r="4"/></g>
      <g className="dp-study-words"><text x="234" y="50">LEARN</text><text x="315" y="86">BUILD</text><text x="346" y="115">LIVE</text><text x="234" y="337">REVIEW</text><text x="24" y="348">START HERE</text></g>
      <text className="dp-study-question" x="123" y="210">notes / experiments</text>
    </svg>
    <figcaption><span>FIELD NOTES / NO FIXED ROUTE</span><span>路径示意</span></figcaption>
  </figure>;
}

function ScreenStudy(){
  return <div className="dp-screen-study" aria-label="SPI 彩屏实验示意图，不是实机照片">
    <div className="dp-screen-label"><span>DISPLAY STUDY / 01</span><span>示意</span></div>
    <div className="dp-screen"><span>WAYNE / OS</span><div className="dp-screen-rule"/><strong>Hello,<br/>hardware.</strong>
      <div className="dp-colour-bars" aria-hidden="true"><i/><i/><i/><i/><i/></div>
      <span>SPI → PIXELS → INTERACTION</span>
    </div>
    <div className="dp-screen-caption"><span>NUCLEO-F446RE</span><span>ST7735S / SPI</span></div>
  </div>;
}

function WebsiteStudy(){
  return <div className="dp-website-study" aria-label="Wayneo 排版示意，不是网站截图">
    <div className="dp-website-label"><span>wayneo</span><span>个人刊物 / 示意</span></div>
    <div className="dp-website-type">Learning.<br/>Building.<br/><em>Becoming.</em></div>
    <div className="dp-website-bottom"><span>INDEX / JOURNAL / STUDIO</span><span>↗</span></div>
  </div>;
}

export default function DevPathOverview(){
  const practice=devPathPractices[0];
  return <div className="dp-wrap">
    <header className="dp-hero">
      <div className="dp-edition"><a href="/studio">STUDIO / DEVPATH</a><span>A PERSONAL GROWTH ARCHIVE</span><span>VOL. 02 — 2026</span></div>
      <div className="dp-hero-spread">
        <div><h1><span className="dp-wordmark" lang="en">DevPath<span>.</span></span><span className="dp-hero-statement">学习、实践，<br/>与阶段记录。</span></h1><p className="dp-hero-description">{devPathIntroduction.description}</p></div>
        <PathStudy/>
      </div>
      <div className="dp-hero-bottom"><a className="dp-link" href={devPathDetailHref('about')}>关于 DevPath <span aria-hidden="true">↗</span></a><a className="dp-link" href="#current">查看当前进展 <span aria-hidden="true">↓</span></a></div>
    </header>

    <section id="current" className="dp-section" aria-labelledby="current-title">
      <SectionLabel number="01" title="IN THIS CHAPTER" note={'内容整理 / '+devPathSnapshot}/>
      <div className="dp-current-grid">
        <div><p className="dp-eyebrow"><span className="dp-status-dot"/>当前阶段 / 2026.11</p><h2 id="current-title">基础学习，<br/><em>与工程实践。</em></h2><p className="dp-copy">{devPathIntroduction.stageText}</p><a className="dp-link" href={devPathDetailHref('chapter-02')}>阅读本阶段记录 <span aria-hidden="true">↗</span></a></div>
        <div className="dp-current-notes"><article><h3>正在关注</h3><p>{devPathIntroduction.focus}</p></article><article><h3>计划中的项目</h3><p>{devPathIntroduction.next}</p><a className="dp-link" href={devPathDetailHref('hardware')}>查看外设实践 <span aria-hidden="true">↗</span></a></article></div>
      </div>
    </section>

    <section id="collection" className="dp-section" aria-labelledby="directions-title">
      <SectionLabel number="02" title="DIRECTIONS" note="五个关注方向"/>
      <div className="dp-section-heading"><h2 id="directions-title">学习与实践方向。</h2><p>技术学习、项目与个人安排，<br/>按当前进展整理。</p></div>
      <div className="dp-directions">{devPathDirections.map((direction,index)=><article className="dp-direction" key={direction.id} id={direction.id}>
        <div className="dp-direction-meta"><span>{String(index+1).padStart(2,'0')}</span><span>{direction.english}</span></div>
        <p className="dp-eyebrow">{direction.title}</p><h3>{direction.question}</h3><p className="dp-copy">{direction.description}</p>
        {direction.links.length>0&&<ul className="dp-inline-links" aria-label={direction.title+'相关内容'}>{direction.links.map(link=><li key={link.id}><a href={devPathDetailHref(link.id)}>{link.label} <span aria-hidden="true">↗</span></a></li>)}</ul>}
      </article>)}</div>
    </section>

    <section id="practice" className="dp-section" aria-labelledby="practice-title">
      <SectionLabel number="03" title="PRACTICE & PROJECTS" note="实践与作品"/>
      <div className="dp-section-heading"><h2 id="practice-title">实验与项目。</h2><p>已开展的硬件实验，<br/>以及持续维护的个人网站。</p></div>
      <div className="dp-practices">
        <article className="dp-practice"><a className="dp-art-link" href={devPathDetailHref(practice.id)} aria-label="阅读彩屏显示与交互实验"><ScreenStudy/></a>
          <div className="dp-practice-meta"><span>{practice.medium}</span><span>{practice.status}</span></div><h3><a href={devPathDetailHref(practice.id)}>{practice.title}</a></h3><p className="dp-copy">{practice.summary}</p><a className="dp-link" href={devPathDetailHref(practice.id)}>阅读实践记录 <span aria-hidden="true">↗</span></a>
        </article>
        <article className="dp-practice"><a className="dp-art-link" href="/studio/wayneo" aria-label="阅读 Wayneo 网站项目"><WebsiteStudy/></a>
          <div className="dp-practice-meta"><span>WEB / WAYNEO.DEV</span><span>持续完善</span></div><h3><a href="/studio/wayneo">Wayneo 个人网站</a></h3><p className="dp-copy">个人网站，包含学习手记、项目与收藏。持续调整内容组织、排版和阅读体验。</p><a className="dp-link" href="/studio/wayneo">阅读网站项目 <span aria-hidden="true">↗</span></a>
        </article>
      </div>
      <div className="dp-open-note"><span className="dp-eyebrow">独立产品 / 选题中</span><p>尚未确定题目。<br/>目前在了解实际需求与交付范围。</p><a className="dp-link" href={devPathDetailHref('product')}>查看选题与服务方向 <span aria-hidden="true">↗</span></a></div>
    </section>

    <section id="changes" className="dp-section" aria-labelledby="changes-title">
      <SectionLabel number="04" title="CHAPTER NOTES" note="阶段记录"/>
      <div className="dp-timeline-grid"><div className="dp-timeline-intro"><h2 id="changes-title">近期进展与调整。</h2><p className="dp-copy">按时间整理实验结果，<br/>以及计划调整的原因。</p></div>
      <ol className="dp-timeline">{devPathMilestones.map(item=><li key={item.title}><span className="dp-timeline-date">{item.date}</span><h3><a href={devPathDetailHref(item.pageId)}>{item.title} <span aria-hidden="true">↗</span></a></h3><p>{item.description}</p></li>)}</ol></div>
    </section>
    <footer className="dp-endnote"><span className="dp-eyebrow">THE DAILY DETAILS / JOURNAL</span><div><h2>每日学习与实验，<br/>收录在 Journal。</h2><a className="dp-link" href="/learning">翻开学习手记 <span aria-hidden="true">↗</span></a></div><p>专题按阶段整理。<br/>每日学习内容保留在 Journal。</p></footer>
  </div>;
}
