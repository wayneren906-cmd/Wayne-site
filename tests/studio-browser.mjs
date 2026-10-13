// Isolated Chrome -> same-origin HTTP handlers -> memory SQLite -> UI test.
// Does not load the production Vite/Wrangler config or credentials.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {fixture,now,signedOwner} from './helpers/learning-fixture.mjs';
import {handleStudioEvents,handleStudioContext} from '../lib/learning/http.ts';
import {createStudioWorkerEnvironment} from './helpers/studio-worker-environment.mjs';

const useWorker=process.argv.includes('--worker');
const root=path.resolve(import.meta.dirname,'..'),work=path.join(root,'tests/.generated/'+(useWorker?'worker-browser':'browser'));
const require=createRequire(fs.realpathSync(path.join(root,'node_modules/vite/package.json')));
const WebSocket=require('ws');
fs.mkdirSync(work,{recursive:true});
fs.writeFileSync(path.join(work,'index.html'),'<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="/entry.tsx"></script></html>');
fs.writeFileSync(path.join(work,'entry.tsx'),`import React from 'react';import{createRoot}from'react-dom/client';import StudioEntry from '@/app/studio/studio-entry';import '@/app/globals.css';import '@/app/studio/studio-overview.css';import '@/app/studio/studio-events.css';import '@/app/studio/studio-supplement-form.css';import '@/app/studio/studio-client.css';createRoot(document.getElementById('root')!).render(<main className="shell studio-page"><h1>合成 Studio 验证</h1><StudioEntry/></main>);`);
if(!useWorker)await build({configFile:false,root:work,base:'/',resolve:{alias:{'@':root}},esbuild:{jsx:'automatic'},build:{outDir:path.join(work,'dist'),emptyOutDir:false}});
const cleanups=[],f=useWorker?await createStudioWorkerEnvironment():await fixture({after:fn=>cleanups.push(fn)}),auth=useWorker?f.auth:await signedOwner();
const rowCount=async()=>(await f.db.prepare('SELECT COUNT(*) n FROM learning_events').first()).n;
let fault=null,posts=0,reads=0;const keys=[];
const server=http.createServer(async(req,res)=>{
  try {
    if(useWorker||req.url.startsWith('/api/studio/')){
      const chunks=[];for await(const chunk of req)chunks.push(chunk);
      const base=`http://127.0.0.1:${server.address().port}`;
      const headers=new Headers(req.headers);headers.set('cf-access-jwt-assertion',auth.jwt);
      const body=Buffer.concat(chunks).toString();
      if(req.method==='POST'){posts++;keys.push(JSON.parse(body).idempotency_key);}
      else if(req.url.startsWith('/api/studio/context'))reads++;
      if(fault==='offline'&&req.method==='POST'){fault=null;res.writeHead(503,{'content-type':'application/json'});res.end(JSON.stringify({error:{code:'SERVICE_UNAVAILABLE',message:'合成故障，请重试'}}));return;}
      const request=new Request(base+req.url,{method:req.method,headers,...(req.method==='POST'?{body}:{})});
      const response=useWorker?await f.runtime.dispatchFetch(base+req.url,{method:req.method,headers,...(req.method==='POST'?{body}:{})}):
        await (req.method==='POST'?handleStudioEvents:handleStudioContext)(request,{DB:f.db,...auth.config},{now,verification:auth.verification});
      if(useWorker)console.log('Worker browser HTTP '+response.status+' '+req.url+' '+response.headers.get('content-type'));
      if(fault==='partial'&&req.method==='POST'){fault=null;res.writeHead(200,{'content-type':'application/json'});res.end('{"saved":true,"receipt_id":"partial"}');return;}
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
    }
    const target=path.resolve(work,'dist',req.url==='/'?'index.html':'.'+req.url);
    if(!target.startsWith(path.join(work,'dist')+path.sep)){res.writeHead(404).end();return;}
    const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.woff2':'font/woff2'};
    res.setHeader('content-type',types[path.extname(target)]??'application/octet-stream');res.end(fs.readFileSync(target));
  }catch{res.writeHead(500).end('synthetic server error');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const profile=path.join(work,'profile-'+Date.now());let chrome,ws;
try {
  chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
  const portFile=path.join(profile,'DevToolsActivePort');
  const wait=async condition=>{for(let n=0;n<150;n++){if(await condition())return;await new Promise(r=>setTimeout(r,100));}throw Error('browser condition timed out');};
  await wait(()=>fs.existsSync(portFile));
  console.log('Isolated Chrome ready.');
  const port=fs.readFileSync(portFile,'utf8').split('\n')[0];
  const tabs=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('CDP connection timed out')),10000);ws.onopen=()=>{clearTimeout(timer);resolve();};ws.onerror=reject;});
  let sequence=0;const pending=new Map();
  ws.onmessage=event=>{const message=JSON.parse(event.data);if(message.method==='Runtime.exceptionThrown')console.log('Browser exception: '+JSON.stringify(message.params.exceptionDetails));if(message.method==='Runtime.consoleAPICalled'&&message.params.type==='error')console.log('Browser console: '+JSON.stringify(message.params.args));if(message.id){const pair=pending.get(message.id);pending.delete(message.id);message.error?pair.reject(Error(JSON.stringify(message.error))):pair.resolve(message.result);}};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>reject(Error('CDP command timed out: '+method)),10000);pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
  const visible=()=>evaluate(`!!document.querySelector('textarea')&&!document.body.innerText.includes('正在读取')`);
  await send('Runtime.enable');await send('Page.enable');await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/${useWorker?'studio/private':''}`});await wait(visible);
  await wait(()=>reads===1);
  await wait(()=>evaluate(`document.body.innerText.includes('尚未接入聊天记录')`));
  assert.equal(reads,1,'initial overview/list must share one context');
  console.log('Browser rendered; checking save and retry.');
  await evaluate(`document.querySelector('textarea').focus()`);await send('Input.insertText',{text:'合成浏览器学习记录'});
  fault='offline';await evaluate(`document.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));document.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))`);
  await wait(()=>evaluate(`document.body.innerText.includes('合成故障')`));assert.equal(posts,1);
  assert.equal(await evaluate(`document.querySelector('textarea').value`),'合成浏览器学习记录');
  await evaluate(`document.querySelector('button[type=submit]').click()`);await wait(()=>evaluate(`document.body.innerText.includes('记录已保存')`));
  assert.equal(keys[0],keys[1]);assert.equal(await rowCount(),1);
  await wait(()=>evaluate(`!!document.querySelector('[data-event-id]')`));
  await evaluate(`document.querySelector('textarea').focus()`);await send('Input.insertText',{text:'合成响应丢失记录'});fault='partial';
  await evaluate(`document.querySelector('button[type=submit]').click()`);await wait(()=>evaluate(`document.body.innerText.includes('回执不完整')`));
  assert.equal(await evaluate(`document.querySelector('textarea').value`),'合成响应丢失记录');
  await evaluate(`document.querySelector('button[type=submit]').click()`);await wait(()=>evaluate(`document.body.innerText.includes('记录已保存')`));
  assert.equal(keys[2],keys[3]);assert.equal(await rowCount(),2);
  await wait(()=>evaluate(`document.querySelectorAll('[data-event-id]').length===2`));
  await evaluate(`document.querySelector('textarea').focus()`);await send('Input.insertText',{text:'合成键盘检查草稿'});
  const viewportResults=[];
  for(const width of [320,390,1280]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
    await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    const result=await evaluate(`({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,controls:[...document.querySelectorAll('button,a')].every(e=>e.getBoundingClientRect().height>=44),motion:getComputedStyle(document.querySelector('[data-event-id]')).animationName})`);
    assert.equal(result.overflow,false,JSON.stringify(result));assert.equal(result.controls,true,JSON.stringify(result));
    await evaluate(`document.querySelector('textarea').focus()`);
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
    const outline=await evaluate(`getComputedStyle(document.activeElement).outlineStyle`);assert.notEqual(outline,'none');
    const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(work,`viewport-${width}.png`),Buffer.from(shot.data,'base64'));viewportResults.push({...result,outline});
  }
  await evaluate(`document.querySelector('[data-event-id]').focus();document.querySelector('[data-event-id]').click()`);await wait(()=>evaluate(`!!document.querySelector('.studio-client__detail-overlay')`));
  assert.equal(await evaluate(`document.activeElement.className`),'studio-client__detail-overlay');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await wait(()=>evaluate(`!document.querySelector('.studio-client__detail-overlay')`));
  assert.equal(await evaluate(`document.activeElement.hasAttribute('data-event-id')`),true);
  const publicViews=[];
  if(useWorker){
    for(let n=1;n<=4;n++)await f.db.prepare('INSERT INTO records(date,items,practice,revision,updated_at) VALUES(?,?,?,?,?)').bind(`2000-01-0${n}`,JSON.stringify([{label:'合成公开主题',text:'合成公开手记，用于隔离界面验证'}]),'',1,'2000-01-01T00:00:00Z').run();
    await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/studio`});await wait(()=>evaluate(`!!document.querySelector('.studio-topic-list')`));
    assert.equal(await evaluate(`document.querySelectorAll('.studio-note-list li').length`),4);
    assert.equal(await evaluate(`document.body.innerText.includes('合成浏览器学习记录')`),false,'private facts must not reach public Studio');
    assert.equal(reads,3,'public Studio must not call the private context API');
    for(const width of [320,390,1280])for(const theme of ['light','dark']){
      await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
      await evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);
      const view=await evaluate(`({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,controls:[...document.querySelectorAll('button,a')].every(e=>e.getBoundingClientRect().height>=44),headings:document.querySelectorAll('h1').length,studioActive:document.querySelector('.nav-links-cluster a[aria-current="page"]').textContent.trim()})`);
      assert.equal(view.overflow,false);assert.equal(view.controls,true);assert.equal(view.headings,1);assert.equal(view.studioActive,'Studio');
      const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(work,`public-${width}-${theme}.png`),Buffer.from(shot.data,'base64'));publicViews.push({...view,theme});
    }
  }
  const summary={posts,reads,rows:2,viewportResults,publicViews,passed:true,scope:useWorker?'Chrome + complete Worker build + actual Vinext dispatch + memory D1, synthetic Access JWT/JWKS':'synthetic browser + actual handlers + memory SQLite, not Worker route dispatch'};
  fs.writeFileSync(path.join(work,'summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
}finally{ws?.close();chrome?.kill();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));for(const cleanup of cleanups)cleanup();if(useWorker)await f.runtime.dispose();}
