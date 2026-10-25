import type { Metadata } from "next";
import {cache} from 'react';
import {env} from 'cloudflare:workers';
import {readJournalData} from '@/lib/journal-reading';
import {describeJournalEntry, journalEntryPath} from '@/lib/journal-sharing';
import {readJournalSearchParams} from '@/lib/ui/journal-location';
import Journal from "../journal";

export const dynamic = "force-dynamic";

type Props={searchParams:Promise<Record<string,string|string[]|undefined>>};
// Share one public read between metadata and the page within this request.
const readData=cache((snapshot:string)=>readJournalData(env.DB,snapshot));

export async function generateMetadata({searchParams}:Props):Promise<Metadata> {
  const location=readJournalSearchParams(await searchParams);
  const data=await readData(location.snapshot);
  const source=location.snapshot?data.snapshot?.records??[]:data.records;
  const error=location.snapshot?data.snapshot?.error:data.error;
  const entry=location.date?source.find(record=>record.date===location.date):undefined;
  const details=entry?describeJournalEntry(entry,location.snapshot):{
    title:location.date?`${location.date} · 暂无公开手记`:'学习记录',
    description:'公开学习手记，按日期、月份或关键词浏览学习与实践记录。',
  };
  if(error){details.title='学习记录';details.description='学习记录暂时无法读取，请稍后重试。';}
  const path=location.date?journalEntryPath(location.date,location.snapshot):location.snapshot?`/learning?snapshot=${location.snapshot}`:'/learning';
  const url=new URL(path,'https://wayneo.dev').href;
  return {
    title:details.title,
    description:details.description,
    alternates:{canonical:url},
    openGraph:{title:`${details.title} · Wayne`,description:details.description,url,siteName:'Wayneo',locale:'zh_CN',type:'website'},
    twitter:{card:'summary',title:`${details.title} · Wayne`,description:details.description},
    ...((error||(location.date&&!entry)||location.query||location.month!=='all')?{robots:{index:false,follow:true}}:{}),
  };
}

export default async function LearningPage({searchParams}:Props) {
  const location=readJournalSearchParams(await searchParams);
  return <Journal initialData={await readData(location.snapshot)} initialLocation={location}/>;
}
