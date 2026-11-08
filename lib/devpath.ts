import type {Entry} from './records';

export type DevPathBlock =
  | {type:'heading'|'paragraph';text:string}
  | {type:'list';items:string[]}
  | {type:'records';ids:string[]};
export type DevPathAside = {label:string;text?:string;link?:string;linkLabel?:string};
export type DevPathPage = {
  id:string;kind:string;title:string;symbol:string;meta:string;deck:string;
  blocks:DevPathBlock[];aside:DevPathAside[];related:string[];
};
export type DevPathTopic = DevPathPage & {summary:string;status:string};
export type DevPathDirection = {
  id:string;title:string;english:string;question:string;description:string;
  links:{id:string;label:string}[];
};
export type DevPathPractice = DevPathPage & {
  summary:string;status:'实机实践'|'持续完善';medium:string;
};
export type DevPathMilestone = {
  date:string;title:string;description:string;pageId:string;
};
export type DevPathRecordReference = Pick<DevPathPage,'id'|'kind'|'title'|'symbol'|'meta'|'related'> & {
  journalId:`journal:${string}`;
};

// The existing public Journal date is the canonical identity. Do not retain a second log body.
export function resolveDevPathRecords(refs:DevPathRecordReference[], records:Entry[], unavailable=false):DevPathPage[] {
  return refs.map(ref=>{
    const date=ref.journalId.slice('journal:'.length);
    const entry=records.find(record=>record.date===date);
    const blocks:DevPathBlock[]=entry?entry.items.flatMap(item=>[
      {type:'heading' as const,text:item.label}, {type:'paragraph' as const,text:item.text},
    ]):[{type:'paragraph',text:unavailable?'暂时无法读取这一天的公开记录，请前往 Journal 重试。':'这一天的公开记录暂未收录，请前往 Journal 查看。'}];
    if(entry?.practice)blocks.push({type:'heading',text:'练习与补充'},{type:'paragraph',text:entry.practice});
    return {
      id:ref.id,kind:ref.kind,title:ref.title,symbol:ref.symbol,meta:ref.meta,related:ref.related,
      deck:`${date} · Journal 公开手记`,blocks,
      aside:[{label:'完整日志',link:`/learning?date=${date}`,linkLabel:'在 Journal 阅读这一天 ↗'}],
    };
  });
}

export function devPathIdFromHash(hash:string, ids:readonly string[]):string|null {
  const id=hash.startsWith('#view/')?hash.slice(6):'';
  return ids.includes(id)?id:null;
}

export function devPathDetailHref(id:string):string {
  return `/studio/devpath/${encodeURIComponent(id)}`;
}

// Compatibility for the retained migration snapshot; current pages use ordinary links.
export type DevPathHistory = {id:string;parent:string|null;depth:number};
export function readDevPathHistory(state:unknown,id:string|null):DevPathHistory|null {
  if(!state||typeof state!=='object'||!('devpath' in state))return null;
  const value=state.devpath;
  if(!value||typeof value!=='object'||!('id' in value)||value.id!==id||!('depth' in value)||
    typeof value.depth!=='number'||!Number.isInteger(value.depth)||value.depth<1||!('parent' in value)||
    !(value.parent===null||typeof value.parent==='string'))return null;
  return value as DevPathHistory;
}
