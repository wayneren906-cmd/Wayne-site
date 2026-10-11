import {readFile,writeFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {recordSchema} from '../lib/records.ts';
import {checkRevision,verifyRecord} from './sync-client.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const statePath=resolve(root,'data/sync-state.json');
const pendingPath=resolve(root,'data/sync-pending.json');
const draftPath=process.argv[2];
if (!draftPath) throw Error('Usage: node scripts/sync-record.mjs data/draft.json [--adopt-existing]');
const draft=recordSchema.parse(JSON.parse(await readFile(resolve(draftPath),'utf8')));
const {token}=JSON.parse(await readFile(resolve(root,'data/sync-credential.json'),'utf8'));
if (!/^[a-f0-9]{64}$/.test(token)) throw Error('本机同步凭证格式无效');
let state={};
try {state=JSON.parse(await readFile(statePath,'utf8'));} catch(e) {if(e.code!=='ENOENT')throw e;}
let pending={};
try {pending=JSON.parse(await readFile(pendingPath,'utf8'));} catch(e) {if(e.code!=='ENOENT')throw e;}
async function persist(path,data) {
  const temporary=path+`.${process.pid}.tmp`;
  await writeFile(temporary,JSON.stringify(data,null,2)+'\n',{mode:0o600});
  await rename(temporary,path);
}
const endpoint='https://wayneo.dev/api/sync/records';
async function call(method,body) {
  const response=await fetch(endpoint,{method,redirect:'error',signal:AbortSignal.timeout(30000),
    headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{})});
  if (!response.ok) throw Error(`同步接口 HTTP ${response.status}`);
  return response.json();
}
const before=(await call('GET')).records.find(record=>record.date===draft.date);
checkRevision(draft,before,state,process.argv.includes('--adopt-existing'),pending);
pending[draft.date]=draft;
await persist(pendingPath,pending);
const result=await call('POST',draft);
const after=(await call('GET')).records.find(record=>record.date===draft.date);
verifyRecord(draft,result.record,after);
state[draft.date]={revision:after.revision,updatedAt:after.updatedAt};
await persist(statePath,state);
delete pending[draft.date];
await persist(pendingPath,pending);
console.log(JSON.stringify({date:draft.date,revision:after.revision,unchanged:result.unchanged,verified:true}));
