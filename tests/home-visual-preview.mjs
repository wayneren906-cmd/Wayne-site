// Local visual acceptance harness. Real application, isolated memory D1, GET/HEAD only.
// The toolbar belongs to this test server, never to the shipped application.
import http from 'node:http';
import fs from 'node:fs';
import {createStudioWorkerEnvironment} from './helpers/studio-worker-environment.mjs';
import {loadPublicRecords,seedPublicRecords} from './helpers/public-record-preview.mjs';

const argument=name=>{const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1];};
const baseline=argument('--baseline');
if(baseline&&!/^http:\/\/127\.0\.0\.1:\d+$/.test(baseline))throw Error('Baseline must be a local preview');
const fixture=baseline?null:await createStudioWorkerEnvironment();
if(fixture&&argument('--records'))await seedPublicRecords(fixture.db,loadPublicRecords(argument('--records')));
// Optional snapshot in this isolated memory database, for Journal reading checks only.
if(fixture&&argument('--snapshot-date')){
  const date=argument('--snapshot-date');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!argument('--records'))throw Error('Snapshot preview requires a date and explicit records');
  await fixture.db.prepare('INSERT INTO snapshots(date,data,updated_at) VALUES(?,?,?)').bind(date,JSON.stringify(loadPublicRecords(argument('--records'))),new Date().toISOString()).run();
}
let mode='normal',reduce=false,recordReads=0,failNext=false,recordLimit=null;
const server=http.createServer(async(req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
  const origin=`http://127.0.0.1:${server.address().port}`,url=new URL(req.url,origin);
  try{
    if(url.pathname==='/__fragments-gestures.js'){
      res.writeHead(200,{'content-type':'text/javascript; charset=utf-8','cache-control':'no-store'}).end(fs.readFileSync(new URL('./fixtures/fragments-gestures.js',import.meta.url)));return;
    }
    if(url.pathname==='/__journal-motion.js'){
      res.writeHead(200,{'content-type':'text/javascript; charset=utf-8','cache-control':'no-store'}).end(fs.readFileSync(new URL('./fixtures/journal-motion.js',import.meta.url)));return;
    }
    if(url.pathname==='/__preview'){
      const width=Number(url.searchParams.get('width')||390);
      if(![320,390,768,1280,1440].includes(width)){res.writeHead(400).end();return;}
      mode=['normal','empty','retry','slow'].includes(url.searchParams.get('mode'))?url.searchParams.get('mode'):'normal';
      const requestedLimit=Number(url.searchParams.get('count'));
      recordLimit=url.searchParams.has('count')&&[1,2,3].includes(requestedLimit)?requestedLimit:null;
      reduce=url.searchParams.get('motion')==='reduce';recordReads=0;failNext=mode==='retry';
      const theme=url.searchParams.get('theme')==='dark'?'dark':'light';
      const page=['/','/learning','/studio'].includes(url.searchParams.get('page'))?url.searchParams.get('page'):'/';
      res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
      res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>首页视觉验收</title><style>body{margin:0;background:#dedbd4;font:13px system-ui}nav{padding:12px;display:flex;gap:16px;align-items:center}iframe{display:block;border:0;background:#f4f2ed;width:${width}px;height:900px}a{color:#222}output{font-size:12px}pre{white-space:pre-wrap}</style></head><body><nav><strong>${baseline?'修改前':'修改后'} · ${width}px · ${theme}</strong><button id="refresh">刷新记录</button><button id="measure">检查布局</button><button data-target=".pub-cover-title">封面</button><button data-target=".pub-cover-grid">摄影</button><button data-target="#journal">手记</button><button data-target="#contact">联系</button><output id="proof">等待页面</output></nav><script>localStorage.setItem('journal-theme',${JSON.stringify(theme)});</script><iframe title="首页预览" src="${page}"></iframe><pre id="metrics">等待布局</pre>${url.searchParams.has('gestures')?'<script src="/__fragments-gestures.js" defer></script>':''}<script>
      const frame=document.querySelector('iframe'),proof=document.querySelector('output');let removed=0;
      frame.addEventListener('load',async()=>{const doc=frame.contentDocument,w=frame.contentWindow;new MutationObserver(changes=>{for(const c of changes)if((c.oldValue||'').includes('is-revealed')&&!c.target.classList.contains('is-revealed'))removed++;proof.textContent='显现状态重置次数：'+removed;}).observe(doc.body,{subtree:true,attributes:true,attributeOldValue:true,attributeFilter:['class']});proof.textContent='显现状态重置次数：'+removed;
      await doc.fonts.ready;const measure=()=>{const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};document.querySelector('#metrics').textContent=JSON.stringify({width:w.innerWidth,scrollWidth:doc.documentElement.scrollWidth,theme:doc.documentElement.dataset.theme,title:doc.querySelector('h1')?.getAttribute('aria-label'),lines:[...doc.querySelectorAll('.pub-title-word')].map(rect),cover:[...doc.querySelectorAll('.pub-cover-intro,.pub-cover-photo')].map(rect),nav:[...doc.querySelectorAll('header a,header button')].map(rect),reduce:w.matchMedia('(prefers-reduced-motion: reduce)').matches,motionReady:doc.querySelector('.publication-home')?.classList.contains('motion-ready'),animations:[...doc.querySelectorAll('.pub-title-word,.contact-floating-ring')].map(el=>w.getComputedStyle(el).animationName),visibleText:doc.querySelector('.pub-index')?.innerText},null,2);};document.querySelector('#measure').onclick=measure;measure();});
      document.querySelector('#refresh').onclick=()=>frame.contentDocument.dispatchEvent(new Event('visibilitychange'));
      document.querySelectorAll('[data-target]').forEach(button=>button.onclick=()=>{const d=frame.contentDocument,w=frame.contentWindow,el=d.querySelector(button.dataset.target);if(el)w.scrollTo({top:w.scrollY+el.getBoundingClientRect().top-110,behavior:'instant'});});
      </script>${url.searchParams.has('journal-motion')?'<script src="/__journal-motion.js" defer></script>':''}</body></html>`);return;
    }
    if(url.pathname==='/__status'){res.writeHead(200,{'content-type':'application/json'}).end(JSON.stringify({mode,reduce,recordReads,recordLimit}));return;}
    if(url.pathname==='/api/records'){
      recordReads++;
      if(mode==='empty'||failNext){const failed=failNext;failNext=false;res.writeHead(failed?503:200,{'content-type':'application/json','cache-control':'no-store'}).end(JSON.stringify(failed?{error:'SYNTHETIC_UNAVAILABLE'}:{records:[],lastSync:null}));return;}
    }
    if(mode==='slow'&&(/\.(jpg|png|woff2?|ttf)$/.test(url.pathname)||url.pathname==='/api/records'))await new Promise(r=>setTimeout(r,4000));
    const response=baseline?await fetch(baseline+url.pathname+url.search,{redirect:'manual'}):await fixture.runtime.dispatchFetch(url.href,{method:req.method,redirect:'manual'});
    const headers=Object.fromEntries(response.headers);headers['cache-control']='no-store';delete headers['content-length'];delete headers['content-encoding'];
    let body=Buffer.from(await response.arrayBuffer());
    // Preview fewer of the seeded public records; the real application's data stays untouched.
    if(url.pathname==='/api/records'&&response.ok&&recordLimit!==null){
      const data=JSON.parse(body.toString());
      data.records=[...data.records].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,recordLimit);
      body=Buffer.from(JSON.stringify(data));
    }
    // Exercise the actual reduced-motion CSS/JS branches without changing the user's OS setting.
    if(reduce&&headers['content-type']?.includes('text/css'))body=Buffer.from(body.toString().replaceAll(/prefers-reduced-motion\s*:\s*reduce/g,'min-width: 0px'));
    if(reduce&&headers['content-type']?.includes('text/html'))body=Buffer.from(body.toString().replace('<head>','<head><script>const nativeMatch=window.matchMedia.bind(window);window.matchMedia=q=>q.includes("prefers-reduced-motion")?nativeMatch("(min-width: 0px)"):nativeMatch(q);</script>'));
    res.writeHead(response.status,headers).end(req.method==='HEAD'?undefined:body);
  }catch(error){console.error(error.message);if(!res.headersSent)res.writeHead(500);res.end('Local visual preview failed');}
});
const previewPort=Number(argument('--port')??0);
if(!Number.isInteger(previewPort)||previewPort<0||previewPort>65535)throw Error('Invalid local preview port');
await new Promise(r=>server.listen(previewPort,'127.0.0.1',r));
console.log(`HOME_VISUAL_PREVIEW http://127.0.0.1:${server.address().port}/__preview?width=390`);
async function close(){server.closeAllConnections();await new Promise(r=>server.close(r));await fixture?.runtime.dispose();}
process.on('SIGINT',()=>void close());process.on('SIGTERM',()=>void close());
