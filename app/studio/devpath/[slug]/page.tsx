import type {Metadata} from 'next';
import {env} from 'cloudflare:workers';
import {notFound} from 'next/navigation';
import {devPathArticles,devPathRecords,devPathSnapshot} from '@/content/devpath';
import {devPathDetailHref,resolveDevPathRecords} from '@/lib/devpath';
import {readPublicJournalRecords} from '@/lib/public-content';
import DevPathArticle from '../devpath-article';

export const dynamic='force-dynamic';
type Props={params:Promise<{slug:string}>};

export async function generateMetadata({params}:Props):Promise<Metadata>{
  const {slug}=await params;
  const page=devPathArticles.find(page=>page.id===slug)??devPathRecords.find(page=>page.id===slug);
  if(!page)return {title:'内容未找到',robots:{index:false,follow:true}};
  const description='deck' in page?page.deck:`${page.meta} · Journal 公开学习手记`;
  const url=`https://wayneo.dev${devPathDetailHref(page.id)}`;
  return {title:`${page.title} · DevPath`,description,alternates:{canonical:url},
    openGraph:{title:page.title,description,url},twitter:{card:'summary',title:page.title,description}};
}

export default async function DevPathDetailPage({params}:Props){
  const {slug}=await params;
  let page=devPathArticles.find(page=>page.id===slug);
  const reference=devPathRecords.find(record=>record.id===slug);
  if(!page&&reference){
    try{page=resolveDevPathRecords([reference],await readPublicJournalRecords(env.DB))[0];}
    catch{page=resolveDevPathRecords([reference],[],true)[0];}
  }
  if(!page)notFound();
  return <main className="devpath dp-detail">
    <div className="dp-wrap">
      <nav className="dp-reader-nav" aria-label="DevPath 阅读导航"><a href="/studio/devpath#collection">← 返回成长档案</a><a href="/studio">Studio ↗</a></nav>
      <DevPathArticle page={page}/>
      <p className="dp-reader-end">内容整理 / {devPathSnapshot}<a className="dp-link" href="/studio/devpath">回到 DevPath <span aria-hidden="true">↗</span></a></p>
    </div>
  </main>;
}
