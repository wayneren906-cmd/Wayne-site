import {journalParagraphs} from '@/lib/ui/journal-prose';

export default function JournalProse({text}:{text:string}){
  return <div className="journal-prose">{journalParagraphs(text).map((paragraph,index)=><p key={index}>{paragraph}</p>)}</div>;
}
