// Local viewing of the isolated build; --workbench enables writes to memory D1 only.
// No production bindings. Default visual preview remains read-only.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createStudioWorkerEnvironment} from './helpers/studio-worker-environment.mjs';
import {websiteProjectDraft} from './fixtures/studio-project-preview/content.ts';
import {loadPublicRecords,seedPublicRecords} from './helpers/public-record-preview.mjs';

const manifest=JSON.parse(fs.readFileSync(path.join(import.meta.dirname,'.generated/worker-latest.json'),'utf8'));
const workbench=process.argv.includes('--workbench');
const display=process.argv.includes('--display');
if(!workbench&&!display)assert.equal(manifest.projectPreview,true,'Build with node tests/studio-worker.mjs --project-preview first, or use --display for the actual display site.');
const fixture=await createStudioWorkerEnvironment();
const recordsArgument=process.argv.indexOf('--records');
if(recordsArgument!==-1){
  assert.equal(display,true,'Public record snapshots are only supported in display preview mode');
  assert.ok(process.argv[recordsArgument+1],'Provide a local public records snapshot');
  await seedPublicRecords(fixture.db,loadPublicRecords(process.argv[recordsArgument+1]));
}
const routes=new Map(workbench||display?[]:[['/studio','/studio/preview-wayneo'],['/studio/projects','/studio/preview-wayneo/details']]);
if(workbench){
  // Only this explicit local demo mode seeds the approved copy, as a PRIVATE draft.
  const response=await fixture.runtime.dispatchFetch('http://synthetic.invalid/api/studio/projects',{method:'POST',headers:{cookie:fixture.auth.cookie,origin:'http://synthetic.invalid','content-type':'application/json'},body:JSON.stringify({action:'save_draft',project_id:'wayneo',expected_revision:0,idempotency_key:'local-approved-wayneo-draft',content:{status:'in_progress',description:websiteProjectDraft.description,summary:websiteProjectDraft.progress,next_step:websiteProjectDraft.nextStep,milestones:{interface:'not_started',implementation:'not_started',verification:'not_started'},private_note:''}})});
  assert.equal(response.status,200,'The local approved draft could not be saved.');
}
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,`http://127.0.0.1:${server.address().port}`);
  const canWrite=workbench&&req.method==='POST'&&['/api/auth/login','/api/auth/logout','/api/studio/projects'].includes(url.pathname);
  if(!['GET','HEAD'].includes(req.method)&&!canWrite){
    res.writeHead(405,{'allow':'GET, HEAD','cache-control':'no-store'}).end('Read-only local preview');
    return;
  }
  try{
    url.pathname=routes.get(url.pathname)??url.pathname;
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const body=Buffer.concat(chunks);
    const response=await fixture.runtime.dispatchFetch(url.href,{method:req.method,headers:new Headers(req.headers),redirect:'manual',...(canWrite?{body}:{})});
    const headers=Object.fromEntries(response.headers);
    headers['cache-control']='no-store';
    res.writeHead(response.status,headers).end(req.method==='HEAD'?undefined:Buffer.from(await response.arrayBuffer()));
  }catch{
    res.writeHead(500,{'content-type':'text/plain; charset=utf-8'}).end('Local preview unavailable');
  }
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const start=workbench?'/login?returnTo='+encodeURIComponent('/studio/private/projects?project=wayneo'):'/studio';
console.log(JSON.stringify({url:`http://127.0.0.1:${server.address().port}${start}`,scope:display?'Local display site; real application routes; memory D1; GET/HEAD only':workbench?'Local workbench demo; real application routes and email login; memory D1 only; approved private draft, not published':'Local unpublished draft; isolated Worker and memory D1; GET/HEAD only'}));
let closing=false;
async function close(){if(closing)return;closing=true;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await fixture.runtime.dispose();}
process.on('SIGINT',()=>{void close();});
process.on('SIGTERM',()=>{void close();});
