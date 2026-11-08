import {devPathArticles,devPathRecords} from '@/content/devpath';
import {devPathDetailHref} from '@/lib/devpath';
import type {DevPathPage} from '@/lib/devpath';

export default function DevPathArticle({page}:{page:DevPathPage}){
  const catalog=[...devPathArticles,...devPathRecords];
  return <article className="dp-article" aria-labelledby="article-title">
    <header className="dp-article-header"><p className="dp-eyebrow">DEVPATH / {page.kind}</p><span className="dp-article-symbol" aria-hidden="true">{page.symbol}</span><p className="dp-article-meta">{page.meta}</p><h1 id="article-title">{page.title}</h1><p className="dp-article-deck">{page.deck}</p></header>
    <div className="dp-article-grid"><div className="dp-article-body">{page.blocks.map((block,index)=>{
      if(block.type==='heading')return <h2 key={index}>{block.text}</h2>;
      if(block.type==='paragraph')return <p key={index}>{block.text}</p>;
      if(block.type==='list')return <ul key={index}>{block.items.map(item=><li key={item}>{item}</li>)}</ul>;
      if(block.type==='records')return <ul className="dp-record-links" key={index}>{block.ids.map(id=>{
        const record=devPathRecords.find(record=>record.id===id);
        return record?<li key={id}><a href={devPathDetailHref(id)}><span>{record.meta.split(' / ')[0]}</span><strong>{record.title}</strong><span aria-hidden="true">↗</span></a></li>:null;
      })}</ul>;
    })}</div><aside className="dp-article-aside" aria-label="专题旁注">{page.aside.map(item=><div key={item.label}><h2>{item.label}</h2>{item.text&&<p>{item.text}</p>}{item.link&&<a href={item.link}>{item.linkLabel}</a>}</div>)}</aside></div>
    <nav className="dp-related" aria-label="关联记录与方向"><p className="dp-eyebrow">继续翻阅 / RELATED NOTES</p><ul>{page.related.map(id=>{
      const related=catalog.find(item=>item.id===id);
      return related?<li key={id}><a href={devPathDetailHref(id)}>{related.title}<span aria-hidden="true">↗</span></a></li>:null;
    })}</ul></nav>
  </article>;
}
