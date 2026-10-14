// Isolated Chrome -> same-origin HTTP handlers -> memory SQLite -> UI test.
// Does not load the production Vite/Wrangler config or credentials.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {fixture,now,signedOwner,input} from './helpers/learning-fixture.mjs';
import {handleStudioEvents,handleStudioContext} from '../lib/learning/http.ts';
import {handleStudioManagement} from '../lib/learning/http.ts';
import {handleAdminAuth,hashAdminPassword} from '../lib/admin-auth.ts';
import {createStudioWorkerEnvironment} from './helpers/studio-worker-environment.mjs';

const useWorker=process.argv.includes('--worker');
const emailOnly=process.argv.includes('--email-only');
const viewportResults=[],publicViews=[];
const root=path.resolve(import.meta.dirname,'..'),work=path.join(root,'tests/.generated/'+(useWorker?'worker-browser':'browser'));
const require=createRequire(fs.realpathSync(path.join(root,'node_modules/vite/package.json')));
const WebSocket=require('ws');
fs.mkdirSync(work,{recursive:true});
fs.writeFileSync(path.join(work,'index.html'),'<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="/entry.tsx"></script></html>');
fs.writeFileSync(path.join(work,'entry.tsx'),`import React from 'react';import{createRoot}from'react-dom/client';import StudioEntry from '@/app/studio/studio-entry';import '@/app/globals.css';import '@/app/studio/studio-overview.css';import '@/app/studio/studio-events.css';import '@/app/studio/studio-supplement-form.css';import '@/app/studio/studio-client.css';createRoot(document.getElementById('root')!).render(<main className="shell studio-page"><h1>合成 Studio 验证</h1><StudioEntry/></main>);`);
if(emailOnly&&!useWorker)fs.writeFileSync(path.join(work,'entry.tsx'),`import React,{useEffect,useState}from'react';import{createRoot}from'react-dom/client';import StudioShell from '@/app/studio/studio-shell';import LoginForm from '@/app/login/login-form';import LogoutButton from '@/app/login/logout-button';import AccountManager from '@/app/studio/private/management/account-manager';import ManagementClient from '@/app/studio/private/management/management-client';import '@/app/globals.css';import '@/app/login/login.css';import '@/app/studio/private/management/management.css';function TestPage(){const[session,setSession]=useState(null),[data,setData]=useState(null);useEffect(()=>{fetch('/api/auth/session').then(r=>r.json()).then(value=>{setSession(value);if(value.signed_in)fetch('/api/studio/management').then(r=>r.json()).then(setData);});},[]);const pathname=location.pathname;return <StudioShell active="login" title="回到你的数字空间" description="公开内容自由浏览。管理员登录后，可以管理记录、项目和目标。">{pathname==='/login'?<LoginForm/>:pathname==='/studio/private/management'?session?.signed_in?<><LogoutButton/>{data&&<ManagementClient initialData={data}/>}<AccountManager/></>:<p>当前无法验证管理权限。</p>:<section id="goals">当前暂无公开目标。</section>}</StudioShell>;}createRoot(document.getElementById('root')).render(<TestPage/>);`);
if(!useWorker)await build({configFile:false,root:work,base:'/',resolve:{alias:{'@':root}},esbuild:{jsx:'automatic'},build:{outDir:path.join(work,'dist'),emptyOutDir:false}});
const cleanups=[],f=useWorker?await createStudioWorkerEnvironment():await fixture({after:fn=>cleanups.push(fn)}),auth=useWorker?f.auth:await signedOwner();
if(emailOnly&&!useWorker)f.sqlite.prepare('UPDATE admin_accounts SET email=?,password_hash=? WHERE account_id=?').run('owner@example.com',hashAdminPassword('Synthetic-worker-password-42'),'synthetic-owner-account');
const rowCount=async()=>(await f.db.prepare('SELECT COUNT(*) n FROM learning_events').first()).n;
let injectIdentity=true,fault=null,posts=0,reads=0,managementReads=0;const keys=[];
const server=http.createServer(async(req,res)=>{
  try {
    if(useWorker||req.url.startsWith('/api/studio/')||req.url.startsWith('/api/auth/')){
      const chunks=[];for await(const chunk of req)chunks.push(chunk);
      const base=`http://127.0.0.1:${server.address().port}`;
      const headers=new Headers(req.headers);if(injectIdentity)headers.set('cookie',auth.cookie);
      const body=Buffer.concat(chunks).toString();
      if(req.method==='POST'){posts++;if(body.trim())keys.push(JSON.parse(body).idempotency_key);}
      else if(req.url.startsWith('/api/studio/context'))reads++;
      if(req.url.startsWith('/api/studio/management')){
        managementReads++;
        if(fault==='management'){fault=null;res.writeHead(503,{'content-type':'application/json'});res.end(JSON.stringify({error:{code:'SERVICE_UNAVAILABLE',message:'synthetic private error'}}));return;}
      }
      if(fault==='offline'&&req.method==='POST'){fault=null;res.writeHead(503,{'content-type':'application/json'});res.end(JSON.stringify({error:{code:'SERVICE_UNAVAILABLE',message:'合成故障，请重试'}}));return;}
      const request=new Request(base+req.url,{method:req.method,headers,...(req.method!=='GET'&&req.method!=='HEAD'?{body}:{})});
      const response=useWorker?await f.runtime.dispatchFetch(base+req.url,{method:req.method,headers,redirect:'manual',...(req.method!=='GET'&&req.method!=='HEAD'?{body}:{})}):req.url.startsWith('/api/auth/')?
        await handleAdminAuth(request,f.db,req.url.split('/').at(-1)):req.url.startsWith('/api/studio/management')?await handleStudioManagement(request,{DB:f.db},{}):
        await (req.method==='POST'?handleStudioEvents:handleStudioContext)(request,{DB:f.db,...auth.config},{now,verification:auth.verification});
      if(fault==='project-partial'&&req.method==='POST'&&req.url.startsWith('/api/studio/projects')){fault=null;res.writeHead(200,{'content-type':'application/json'});res.end('{"saved":true}');return;}
      if(fault==='plan-partial'&&req.method==='POST'&&req.url.startsWith('/api/studio/plans')){fault=null;res.writeHead(200,{'content-type':'application/json'});res.end('{"saved":true}');return;}
      if(useWorker)console.log('Worker browser HTTP '+response.status+' '+req.url+' '+response.headers.get('content-type'));
      if(fault==='partial'&&req.method==='POST'){fault=null;res.writeHead(200,{'content-type':'application/json'});res.end('{"saved":true,"receipt_id":"partial"}');return;}
      const responseBody=Buffer.from(await response.arrayBuffer());
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(responseBody);return;
    }
    const target=path.resolve(work,'dist',req.url==='/'||emailOnly&&!path.extname(req.url)?'index.html':'.'+req.url);
    if(!target.startsWith(path.join(work,'dist')+path.sep)){res.writeHead(404).end();return;}
    const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.woff2':'font/woff2'};
    res.setHeader('content-type',types[path.extname(target)]??'application/octet-stream');res.end(fs.readFileSync(target));
  }catch(error){console.log('Synthetic server error: '+String(error));if(res.headersSent)res.destroy();else res.writeHead(500).end('synthetic server error');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const profile=path.join(work,'profile-'+Date.now());let chrome,ws;
try {
  // Optional opt-in for restricted Windows runners; this browser only visits synthetic localhost data.
  const chromeRunnerFlags=process.env.CHROME_TEST_NO_SANDBOX==='1'?['--no-sandbox']:[];
  chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu',...chromeRunnerFlags,'--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
  const portFile=path.join(profile,'DevToolsActivePort');
  const wait=async condition=>{for(let n=0;n<150;n++){if(await condition())return;await new Promise(r=>setTimeout(r,100));}throw Error('browser condition timed out');};
  await wait(()=>fs.existsSync(portFile));
  console.log('Isolated Chrome ready.');
  const port=fs.readFileSync(portFile,'utf8').split('\n')[0];
  const tabs=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('CDP connection timed out')),10000);ws.onopen=()=>{clearTimeout(timer);resolve();};ws.onerror=reject;});
  let sequence=0,dialog=null;const pending=new Map();
  ws.onmessage=event=>{const message=JSON.parse(event.data);if(message.method==='Runtime.exceptionThrown')console.log('Browser exception: '+JSON.stringify(message.params.exceptionDetails));if(message.method==='Runtime.consoleAPICalled'&&message.params.type==='error')console.log('Browser console: '+JSON.stringify(message.params.args));if(message.id){const pair=pending.get(message.id);pending.delete(message.id);message.error?pair.reject(Error(JSON.stringify(message.error))):pair.resolve(message.result);}};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>reject(Error('CDP command timed out: '+method)),10000);pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
  const visible=()=>evaluate(`!!document.querySelector('textarea')&&!document.body?.innerText.includes('正在读取')`);
  ws.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.method==='Page.javascriptDialogOpening')dialog=message.params;});
  await send('Runtime.enable');await send('Page.enable');
  if(!emailOnly){
  if(!useWorker){
  await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/${useWorker?'studio/private':''}`});await wait(visible);
  await wait(()=>reads===1);
  await wait(()=>evaluate(`document.body?.innerText.includes('尚未接入聊天记录')`));
  assert.equal(reads,1,'initial overview/list must share one context');
  console.log('Browser rendered; checking save and retry.');
  await evaluate(`document.querySelector('textarea').focus()`);await send('Input.insertText',{text:'合成浏览器学习记录'});
  fault='offline';await evaluate(`document.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));document.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))`);
  await wait(()=>evaluate(`document.body?.innerText.includes('合成故障')`));assert.equal(posts,1);
  assert.equal(await evaluate(`document.querySelector('textarea').value`),'合成浏览器学习记录');
  await evaluate(`document.querySelector('button[type=submit]').click()`);await wait(()=>evaluate(`document.body?.innerText.includes('记录已保存')`));
  assert.equal(keys[0],keys[1]);assert.equal(await rowCount(),1);
  await wait(()=>evaluate(`!!document.querySelector('[data-event-id]')`));
  await evaluate(`document.querySelector('textarea').focus()`);await send('Input.insertText',{text:'合成响应丢失记录'});fault='partial';
  await evaluate(`document.querySelector('button[type=submit]').click()`);await wait(()=>evaluate(`document.body?.innerText.includes('回执不完整')`));
  assert.equal(await evaluate(`document.querySelector('textarea').value`),'合成响应丢失记录');
  await evaluate(`document.querySelector('button[type=submit]').click()`);await wait(()=>evaluate(`document.body?.innerText.includes('记录已保存')`));
  assert.equal(keys[2],keys[3]);assert.equal(await rowCount(),2);
  await wait(()=>evaluate(`document.querySelectorAll('[data-event-id]').length===2`));
  await evaluate(`document.querySelector('textarea').focus()`);await send('Input.insertText',{text:'合成键盘检查草稿'});
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
  dialog=null;
  await evaluate(`setTimeout(()=>location.assign('/login'),0)`);
  await wait(()=>dialog!==null);
  assert.equal(dialog.type,'beforeunload');
  await send('Page.handleJavaScriptDialog',{accept:false});
  assert.equal(await evaluate(`document.querySelector('textarea').value`),'合成键盘检查草稿');
  await evaluate(`document.querySelector('textarea').focus();document.querySelector('textarea').select()`);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Backspace',code:'Backspace',windowsVirtualKeyCode:8});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Backspace',code:'Backspace',windowsVirtualKeyCode:8});
  await wait(()=>evaluate(`document.querySelector('textarea').value===''`));
  }else{
    for(let index=0;index<2;index++){
      const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/studio/events',{method:'POST',headers:{'content-type':'application/json',origin:'http://127.0.0.1:'+server.address().port},body:JSON.stringify({...input('synthetic-browser-seed-'+index),content:{summary:index?'合成响应丢失记录':'合成浏览器学习记录'}})});assert.ok(response.ok);
    }
    await send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/studio/private'});await wait(()=>evaluate('document.querySelectorAll("[data-event-id]").length===2'));
    assert.equal(await evaluate('!!document.querySelector("textarea")'),false);
  }
  if(useWorker){
    await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/studio/private/workspace?practice=string-reverse`});await wait(()=>evaluate(`!!document.querySelector('.workbench-form')&&!document.body?.innerText.includes('正在读取…')`));
    assert.equal(await evaluate(`document.querySelector('select[aria-label="练习或项目里程碑"]').value`),'practice:string-reverse');
    assert.equal(await evaluate(`document.querySelectorAll('nav[aria-label="私人管理栏目"] a').length`),5);
    assert.equal(await evaluate(`document.querySelector('nav[aria-label="私人管理栏目"] a[aria-current=page]').textContent.includes('私人记录')`),true);
    await evaluate(`document.querySelector('textarea').focus()`);await send('Input.insertText',{text:'合成工作区练习记录'});fault='offline';
    await evaluate(`document.querySelector('button[type=submit]').click()`);await wait(()=>evaluate(`document.body?.innerText.includes('合成故障')`));
    assert.equal(await evaluate(`document.querySelector('textarea').value`),'合成工作区练习记录');
    await evaluate(`document.querySelector('button[type=submit]').click()`);await wait(()=>evaluate(`document.body?.innerText.includes('记录已保存')&&!!document.querySelector('.workbench-evidence a')`));
    assert.equal(keys.at(-1),keys.at(-2));assert.equal(await rowCount(),3);
    const recordURL=await evaluate(`document.querySelector('.workbench-evidence a').href`);
    await send('Page.navigate',{url:recordURL});await wait(()=>evaluate(`!!document.querySelector('input[aria-label="修订原因"]')`));
    await evaluate(`document.querySelector('textarea').focus();document.querySelector('textarea').select()`);await send('Input.insertText',{text:'合成工作区修订记录'});
    await evaluate(`document.querySelector('input[aria-label="修订原因"]').focus()`);await send('Input.insertText',{text:'合成修订原因'});
    await evaluate(`document.querySelector('button[type=submit]').click()`);await wait(()=>evaluate(`document.body?.innerText.includes('修订已保存')&&document.body?.innerText.includes('版本 r2')`));
    await evaluate(`document.querySelector('details summary').click();document.querySelector('input[type=checkbox]').click();[...document.querySelectorAll('button')].find(b=>b.textContent==='确认删除私人记录').click()`);
    await wait(()=>evaluate(`document.body?.innerText.includes('记录已删除')`));assert.equal(await rowCount(),2);
    await f.db.prepare("UPDATE processing_jobs SET status='failed',attempts=1,last_error_code='SYNTHETIC_PRIVATE_DIAGNOSTIC' WHERE job_id=(SELECT job_id FROM processing_jobs ORDER BY job_id LIMIT 1)").run();
    await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/studio/private/system`});await wait(()=>evaluate(`!!document.querySelector('.management-metrics')`));
    assert.equal(await evaluate(`document.querySelector('.management-metrics dd').textContent`),'2');
    assert.equal(await evaluate(`document.body?.innerText.includes('任务执行器尚未接入')`),true);
    assert.equal(await evaluate(`document.body?.innerText.includes('SYNTHETIC_PRIVATE_DIAGNOSTIC')`),false);
    assert.equal(managementReads,0,'management page uses the authorized server snapshot without a duplicate client load');
    await evaluate(`const select=document.querySelector('.management-section-heading select');select.value='attention';select.dispatchEvent(new Event('change',{bubbles:true}))`);
    await wait(()=>evaluate(`document.querySelectorAll('.management-job-list li').length===1`));
    await evaluate(`document.querySelector('.management-toolbar button').click()`);await wait(()=>managementReads===1);await wait(()=>evaluate(`!document.querySelector('.management-toolbar button').disabled`));
    fault='management';await evaluate(`document.querySelector('.management-toolbar button').click()`);await wait(()=>evaluate(`!!document.querySelector('[role=alert]')&&!document.querySelector('.management-metrics')`));
    assert.equal(await evaluate(`document.body?.innerText.includes('synthetic private error')`),false);
    await evaluate(`document.querySelector('.management-toolbar button').click()`);await wait(()=>evaluate(`!!document.querySelector('.management-metrics')&&!document.querySelector('[role=alert]')`));
    for(const width of [320,390,1280])for(const theme of ['light','dark']){
      await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);
      const view=await evaluate(`({overflow:document.documentElement.scrollWidth>innerWidth,controls:[...document.querySelectorAll('button,a,select')].every(e=>e.getBoundingClientRect().height>=44)})`);
      assert.equal(view.overflow,false);assert.equal(view.controls,true);
      const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(work,`management-${width}-${theme}.png`),Buffer.from(shot.data,'base64'));
    }
    await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/studio/private/projects`});await wait(()=>evaluate(`!!document.querySelector('.project-editor[data-ready=true] textarea')`));
    await evaluate(`document.querySelector('textarea').focus()`);await send('Input.insertText',{text:'合成公开项目进展，用于隔离验证'});
    await evaluate(`document.querySelectorAll('textarea')[1].focus()`);await send('Input.insertText',{text:'SYNTHETIC_PRIVATE_EDITOR_NOTE'});
    fault='project-partial';await evaluate(`document.querySelector('.project-editor form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))`);
    await wait(()=>evaluate(`document.querySelector('[role=alert]')?.textContent.includes('回执不完整')`));
    assert.equal(await evaluate(`document.querySelectorAll('textarea')[1].value`),'SYNTHETIC_PRIVATE_EDITOR_NOTE');
    await evaluate(`document.querySelector('.project-editor form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))`);
    await wait(()=>evaluate(`document.querySelector('[role=status]')?.textContent.includes('私人草稿已保存')`));
    assert.equal(await evaluate(`document.querySelector('.studio-save-state').textContent.includes('仅管理员可见')`),true);
    assert.equal(keys.at(-1),keys.at(-2),'lost project receipt must retry the original operation key');
    assert.equal((await f.db.prepare('SELECT revision FROM studio_project_records WHERE project_id=?').bind('c-engine').first()).revision,1);
    await evaluate(`[...document.querySelectorAll('.project-editor button')].find(button=>button.textContent==='预览并发布').click()`);
    await wait(()=>evaluate(`!!document.querySelector('.project-editor-preview')`));
    assert.equal(await evaluate(`document.querySelector('.project-editor-preview').textContent.includes('SYNTHETIC_PRIVATE_EDITOR_NOTE')`),false);
    assert.equal(await evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent==='确认发布').disabled`),true);
    await evaluate(`document.querySelector('.project-editor-confirm input').click()`);
    await wait(()=>evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent==='确认发布')?.disabled===false`));
    await evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent==='确认发布').click()`);
    await wait(()=>evaluate(`document.querySelector('[role=status]')?.textContent.includes('公开发布')`));
    assert.equal(await evaluate(`document.querySelector('.studio-save-state').textContent.includes('与已保存草稿一致')`),true);
    for(const width of [320,390,1280])for(const theme of ['light','dark']){
      await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);
      await evaluate(`window.scrollTo(0,0)`);
      const view=await evaluate(`({overflow:document.documentElement.scrollWidth>innerWidth,controls:[...document.querySelectorAll('button,a,select,input')].every(element=>element.getBoundingClientRect().height>=44)})`);
      assert.equal(view.overflow,false);assert.equal(view.controls,true);
      const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(work,`project-editor-${width}-${theme}.png`),Buffer.from(shot.data,'base64'));
      if(theme==='light'&&width!==320){const metrics=await send('Page.getLayoutMetrics');const full=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:metrics.cssContentSize.width,height:metrics.cssContentSize.height,scale:1}});fs.writeFileSync(path.join(work,`project-editor-full-${width}.png`),Buffer.from(full.data,'base64'));}
    }
    await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/studio/projects`});await wait(()=>evaluate(`document.body?.innerText.includes('合成公开项目进展')`));
    assert.equal(await evaluate(`document.body?.innerText.includes('SYNTHETIC_PRIVATE_EDITOR_NOTE')`),false);
    await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/studio/private/projects`});await wait(()=>evaluate(`!!document.querySelector('.project-editor[data-ready=true] textarea')`));
    await evaluate(`document.querySelector('textarea').focus();document.querySelector('textarea').select()`);await send('Input.insertText',{text:'合成未发布的第二版进展'});
    await evaluate(`document.querySelector('.project-editor form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))`);await wait(()=>evaluate(`document.querySelector('[role=status]')?.textContent.includes('私人草稿已保存')`));
    assert.equal(await evaluate(`document.querySelector('.studio-save-state').textContent.includes('待发布')`),true);
    await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/studio/projects`});await wait(()=>evaluate(`document.body?.innerText.includes('合成公开项目进展')`));
    assert.equal(await evaluate(`document.body?.innerText.includes('合成未发布的第二版进展')`),false);
    await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/studio/private/projects`});await wait(()=>evaluate(`!!document.querySelector('.project-editor[data-ready=true] textarea')`));
    await evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent==='撤下公开状态').click()`);
    await wait(()=>evaluate(`[...document.querySelectorAll('button')].some(button=>button.textContent==='确认撤下')`));
    await evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent==='确认撤下').click()`);
    await wait(()=>evaluate(`document.querySelector('[role=status]')?.textContent.includes('公开状态已撤下')`));
    await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/studio/projects`});await wait(()=>evaluate(`!!document.querySelector('.workbench-project')`));
    assert.equal(await evaluate(`document.body?.innerText.includes('合成公开项目进展')`),false);
    await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/studio/private/plans`});await wait(()=>evaluate(`!!document.querySelector('.plan-editor[data-ready=true]')`));
    await evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent==='添加目标').click()`);
    await wait(()=>evaluate(`!!document.querySelector('.plan-goal-fields input')`));
    await evaluate(`document.querySelector('.plan-goal-fields input').focus()`);await send('Input.insertText',{text:'合成公开目标，用于隔离验证'});
    await evaluate(`document.querySelector('.plan-goal-fields textarea').focus()`);await send('Input.insertText',{text:'合成目标说明'});
    await evaluate(`document.querySelectorAll('.plan-editor form textarea')[1].focus()`);await send('Input.insertText',{text:'SYNTHETIC_PRIVATE_GOAL_EDITOR_NOTE'});
    fault='plan-partial';await evaluate(`document.querySelector('.plan-editor form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))`);
    await wait(()=>evaluate(`document.querySelector('[role=alert]')?.textContent.includes('回执不完整')`));
    assert.equal(await evaluate(`document.activeElement.getAttribute('role')`),'alert');
    assert.equal(await evaluate(`document.querySelectorAll('.plan-editor form textarea')[1].value`),'SYNTHETIC_PRIVATE_GOAL_EDITOR_NOTE');
    await evaluate(`document.querySelector('.plan-editor form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))`);
    await wait(()=>evaluate(`document.querySelector('[role=status]')?.textContent.includes('私人目标已保存')`));
    assert.equal(keys.at(-1),keys.at(-2),'lost goal receipt retries the original key');
    assert.equal((await f.db.prepare('SELECT revision FROM studio_plan_records').first()).revision,1);
    await evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent==='预览并发布').click()`);
    await wait(()=>evaluate(`!!document.querySelector('.project-editor-preview')`));
    assert.equal(await evaluate(`document.querySelector('.project-editor-preview').textContent.includes('SYNTHETIC_PRIVATE_GOAL_EDITOR_NOTE')`),false);
    assert.equal(await evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent==='确认发布').disabled`),true);
    await evaluate(`document.querySelector('.project-editor-confirm input').click()`);
    await wait(()=>evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent==='确认发布')?.disabled===false`));
    await evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent==='确认发布').click()`);
    await wait(()=>evaluate(`document.querySelector('[role=status]')?.textContent.includes('目标已公开发布')`));
    for(const width of [320,390,1280])for(const theme of ['light','dark']){
      await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)};window.scrollTo(0,0)`);
      await evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
      const view=await evaluate(`({overflow:document.documentElement.scrollWidth>innerWidth,controls:[...document.querySelectorAll('.plan-editor button,.plan-editor select,.plan-editor input')].every(element=>element.getBoundingClientRect().height>=44)})`);assert.equal(view.overflow,false);assert.equal(view.controls,true);
      const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(work,`plan-editor-${width}-${theme}.png`),Buffer.from(shot.data,'base64'));
      if(width===1280&&theme==='light'){const metrics=await send('Page.getLayoutMetrics');const full=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:metrics.cssContentSize.width,height:metrics.cssContentSize.height,scale:1}});fs.writeFileSync(path.join(work,'plan-editor-full-1280.png'),Buffer.from(full.data,'base64'));}
    }
    await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/studio`});await wait(()=>evaluate(`document.querySelector('#goals')?.textContent.includes('合成公开目标')`));
    assert.equal(await evaluate(`document.body?.innerText.includes('SYNTHETIC_PRIVATE_GOAL_EDITOR_NOTE')`),false);
    await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/studio/private/plans`});await wait(()=>evaluate(`!!document.querySelector('.plan-editor[data-ready=true] .plan-goal-fields input')`));
    await evaluate(`document.querySelector('.plan-goal-fields input').focus();document.querySelector('.plan-goal-fields input').select()`);await send('Input.insertText',{text:'合成未发布目标新版本'});
    await evaluate(`document.querySelector('.plan-editor form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))`);await wait(()=>evaluate(`document.querySelector('[role=status]')?.textContent.includes('私人目标已保存')`));
    await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/studio`});await wait(()=>evaluate(`document.querySelector('#goals')?.textContent.includes('合成公开目标')`));assert.equal(await evaluate(`document.querySelector('#goals').textContent.includes('合成未发布目标新版本')`),false);
    await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/studio/private/plans`});await wait(()=>evaluate(`!!document.querySelector('.plan-editor[data-ready=true] .plan-goal-fields input')`));
    await evaluate(`document.querySelector('.plan-goal-fields input').focus();document.querySelector('.plan-goal-fields input').select()`);await send('Input.insertText',{text:'合成未保存的目标输入'});
    await evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent==='撤下公开目标').click()`);await wait(()=>evaluate(`[...document.querySelectorAll('button')].some(button=>button.textContent==='确认撤下')`));
    await evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent==='确认撤下').click()`);await wait(()=>evaluate(`document.querySelector('[role=status]')?.textContent.includes('公开目标已撤下')`));
    assert.equal(await evaluate(`document.querySelector('.plan-goal-fields input').value`),'合成未保存的目标输入');
    await evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent==='重新读取版本').click()`);await wait(()=>evaluate(`document.querySelector('[role=status]')?.textContent.includes('最新版本已读取')`));assert.equal(await evaluate(`document.querySelector('.plan-goal-fields input').value`),'合成未保存的目标输入');
    await evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent==='移除此目标').click()`);assert.equal(await evaluate(`document.querySelectorAll('.plan-goal-fields').length`),1);
    await evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent==='确认移除').click()`);await wait(()=>evaluate(`document.querySelectorAll('.plan-goal-fields').length===0`));
    await evaluate(`document.querySelector('.plan-editor form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))`);await wait(()=>evaluate(`document.querySelector('[role=status]')?.textContent.includes('私人目标已保存')`));
    await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/studio`});await wait(()=>evaluate(`document.querySelector('#goals')?.textContent.includes('暂无公开目标')`));assert.equal(await evaluate(`document.body?.innerText.includes('合成公开目标')`),false);
    const readsBeforePublic=reads;
    for(let n=1;n<=4;n++)await f.db.prepare('INSERT INTO records(date,items,practice,revision,updated_at) VALUES(?,?,?,?,?)').bind(`2000-01-0${n}`,JSON.stringify([{label:'合成公开主题',text:'合成公开手记，用于隔离界面验证'}]),'',1,'2000-01-01T00:00:00Z').run();
    await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/studio`});await wait(()=>evaluate(`!!document.querySelector('.workbench-content')`));
    assert.equal(await evaluate(`document.querySelectorAll('.studio-note-list li').length`),0);
    assert.equal(await evaluate(`document.body?.innerText.includes('合成浏览器学习记录')`),false,'private facts must not reach public Studio');
    assert.equal(reads,readsBeforePublic,'public Studio must not call the private context API');
    await wait(()=>evaluate(`document.querySelectorAll('.dashboard-bar-column').length===6`));
    await evaluate(`document.querySelector('.dashboard-segment button:last-child').click()`);
    await wait(()=>evaluate(`document.querySelector('.dashboard-segment button:last-child').getAttribute('aria-pressed')==='true'&&document.querySelector('.dashboard-chart-caption').textContent.includes('累计')`));
    await evaluate(`const select=document.querySelector('.dashboard-period select');select.value='12';select.dispatchEvent(new Event('change',{bubbles:true}))`);
    await wait(()=>evaluate(`document.querySelectorAll('.dashboard-bar-column').length===12`));
    await evaluate(`document.querySelector('.dashboard-chart-table summary').click()`);
    assert.equal(await evaluate(`document.querySelectorAll('.dashboard-chart-table tbody tr').length`),12);
    assert.equal(await evaluate(`document.querySelector('.dashboard-chart-table tbody tr:last-child td:last-child').textContent`),'4');
    await evaluate(`document.querySelector('.dashboard-chart-table summary').click()`);
    for(const width of [320,390,1280])for(const theme of ['light','dark']){
      await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
      await evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);
      await wait(()=>evaluate(`getComputedStyle(document.body).backgroundColor===${JSON.stringify(theme==='dark'?'rgb(18, 18, 17)':'rgb(243, 241, 236)')}&&document.querySelector('.editorial-shell').getBoundingClientRect().width>innerWidth*.95`));
      await evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
      const view=await evaluate(`({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,controls:[...document.querySelectorAll('button,a')].every(e=>e.getBoundingClientRect().height>=44),headings:document.querySelectorAll('h1').length,studioActive:document.querySelector('.nav-links-cluster a[aria-current="page"]').textContent.trim()})`);
      assert.equal(view.overflow,false);assert.equal(view.controls,true);assert.equal(view.headings,1);assert.equal(view.studioActive,'Studio');
      const header=await evaluate(`(()=>{const box=e=>e.getBoundingClientRect();const brand=box(document.querySelector('.brand-anchor')),nav=box(document.querySelector('.nav-links-cluster')),bar=box(document.querySelector('.editorial-nav-bar')),logo=box(document.querySelector('.wordmark-wrap img'));return {sameRow:Math.abs(brand.top+brand.height/2-nav.top-nav.height/2)<1,height:bar.height,logoRatio:logo.width/logo.height,inside:nav.right<=bar.right+1&&brand.right<=nav.left,brandRight:brand.right,navLeft:nav.left,navRight:nav.right,barRight:bar.right};})()`);
      if(!header.inside){const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(work,'header-failure.png'),Buffer.from(shot.data,'base64'));}
      assert.equal(header.sameRow,true,JSON.stringify(header));assert.equal(header.inside,true,JSON.stringify(header));assert.ok(Math.abs(header.logoRatio-1008/215)<.01,JSON.stringify(header));if(width<=390)assert.equal(header.height,64);
      const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(work,`public-${width}-${theme}.png`),Buffer.from(shot.data,'base64'));publicViews.push({...view,theme});
      if(theme==='light'&&width!==320){await evaluate(`(async()=>{const images=[...document.images];images.forEach(image=>image.loading='eager');await Promise.all(images.map(image=>image.decode()));window.scrollTo(0,0);await new Promise(resolve=>requestAnimationFrame(resolve));})()`);const metrics=await send('Page.getLayoutMetrics');const full=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:metrics.cssContentSize.width,height:metrics.cssContentSize.height,scale:1}});fs.writeFileSync(path.join(work,`public-full-${width}.png`),Buffer.from(full.data,'base64'));}
    }
    for(const pathname of ['roadmap','practice','projects','archive']){
      await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/studio/${pathname}`});await wait(()=>evaluate(`!!document.querySelector('.workbench-content')`));
      for(const width of [320,1280]){await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});const view=await evaluate(`({overflow:document.documentElement.scrollWidth>innerWidth,controls:[...document.querySelectorAll('button,a')].every(e=>e.getBoundingClientRect().height>=44),headings:document.querySelectorAll('h1').length})`);assert.equal(view.overflow,false,pathname);assert.equal(view.controls,true,pathname);assert.equal(view.headings,1,pathname);}
      if(pathname==='practice'){await evaluate(`document.querySelector('input[type=search]').focus()`);await send('Input.insertText',{text:'不存在的合成筛选'});await wait(()=>evaluate(`document.body?.innerText.includes('没有符合条件')`));await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent==='清除筛选').click()`);await wait(()=>evaluate(`document.querySelectorAll('.workbench-cards article').length===5`));}
      assert.equal(reads,readsBeforePublic,'catalog pages must not request private data');
    }
    for(const pathname of ['/','/learning']){
      await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}${pathname}`});await wait(()=>evaluate(`!!document.querySelector('.editorial-nav-bar')`));
      for(const width of [320,390,1280]){
        await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
        await evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
        const view=await evaluate(`(()=>{const bar=document.querySelector('.editorial-nav-bar').getBoundingClientRect(),brand=document.querySelector('.brand-anchor').getBoundingClientRect(),nav=document.querySelector('.nav-links-cluster').getBoundingClientRect();return {sameRow:Math.abs(brand.top+brand.height/2-nav.top-nav.height/2)<1,inside:nav.right<=bar.right+1&&brand.right<=nav.left,height:bar.height};})()`);
        assert.equal(view.sameRow,true,pathname+JSON.stringify(view));assert.equal(view.inside,true,pathname+JSON.stringify(view));if(width<520)assert.equal(view.height,64);
      }
    }
  }
  }
  if(useWorker||emailOnly){
    injectIdentity=false;
    await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/studio`});await wait(()=>evaluate(`!!document.querySelector('#goals')`));assert.equal(await evaluate(`!!document.querySelector('.login-form')`),false);
    await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/studio/private/system`});await wait(()=>evaluate(`document.body?.innerText.includes('无法验证管理权限')`));assert.equal(await evaluate(`!!document.querySelector('.management-metrics')`),false);
    await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/login`});await wait(()=>evaluate(`!!document.querySelector('.login-form input[type=password]')`));
    for(const width of [320,390,1280])for(const theme of ['light','dark']){
      await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)};window.scrollTo(0,0)`);
      await evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
      const view=await evaluate(`({overflow:document.documentElement.scrollWidth>innerWidth,controls:[...document.querySelectorAll('.login-form input,.login-form button')].every(element=>element.getBoundingClientRect().height>=44)})`);assert.equal(view.overflow,false);assert.equal(view.controls,true);
      const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(work,`email-login-${width}-${theme}.png`),Buffer.from(shot.data,'base64'));
    }
    await evaluate(`document.querySelector('.login-form input[type=email]').focus()`);await send('Input.insertText',{text:'OWNER@EXAMPLE.COM'});
    await evaluate(`document.querySelector('.login-form input[type=password]').focus()`);await send('Input.insertText',{text:'Synthetic-wrong-password'});
    await evaluate(`document.querySelector('.login-form button[type=submit]').click()`);await wait(()=>evaluate(`document.querySelector('.login-form [role=alert]')?.textContent.includes('邮箱或密码不正确')`));
    assert.equal(await evaluate(`document.querySelector('.login-form input[type=password]').value`),'');assert.equal(await evaluate(`document.activeElement.getAttribute('role')`),'alert');
    await evaluate(`document.querySelector('.login-form input[type=password]').focus()`);await send('Input.insertText',{text:'Synthetic-worker-password-42'});
    await evaluate(`document.querySelector('.login-form button[type=submit]').click()`);await wait(()=>evaluate(`location.pathname==='/studio/private/management'&&!!document.querySelector(${JSON.stringify(useWorker?'.studio-daily-workbench':'.management-metrics')})`));
    const session=await evaluate(`fetch('/api/auth/session').then(response=>response.json())`);assert.equal(session.signed_in,true);assert.equal(session.email,'owner@example.com');assert.equal(await evaluate(`document.cookie.includes('wayneo_session')`),false,'HttpOnly cookie is inaccessible to scripts');
    if(useWorker){await send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/studio/private/system'});await wait(()=>evaluate('!!document.querySelector(".management-metrics")'));}
    await wait(()=>evaluate(`!!document.querySelector('input[autocomplete=new-password]')`));
    await evaluate(`document.querySelector('input[autocomplete=off]').focus()`);await send('Input.insertText',{text:'synthetic-browser-admin@example.com'});
    await evaluate(`document.querySelector('input[autocomplete=new-password]').focus()`);await send('Input.insertText',{text:'Synthetic-browser-admin-password'});
    await evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent==='添加管理员').click()`);
    try{await wait(()=>evaluate(`document.body?.innerText.includes('管理员已添加')&&document.body?.innerText.includes('synthetic-browser-admin@example.com')`));}catch(error){console.log('Synthetic account UI diagnostic: '+await evaluate(`document.body?.innerText`));throw error;}
    assert.equal((await f.db.prepare('SELECT owner_id,role FROM admin_accounts WHERE email=?').bind('synthetic-browser-admin@example.com').first()).role,'admin');
    await evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent==='退出登录').click()`);await wait(()=>evaluate(`location.pathname==='/studio'&&!!document.querySelector('#goals')`));assert.equal((await evaluate(`fetch('/api/auth/session').then(response=>response.json())`)).signed_in,false);
    await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/studio/private/system`});await wait(()=>evaluate(`document.body?.innerText.includes('无法验证管理权限')`));
    if(useWorker){
      await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/studio/private/workspace?project=c-engine&milestone=implementation`});
      await wait(()=>evaluate(`document.querySelector('a[href^="/login?returnTo="]')?.href.includes('project%3Dc-engine')`));
      await evaluate(`document.querySelector('a[href^="/login?returnTo="]').click()`);
      await wait(()=>evaluate(`!!document.querySelector('.login-form[data-ready=true] input[type=password]')`));
      await evaluate(`document.querySelector('.login-form input[type=email]').focus()`);await send('Input.insertText',{text:'owner@example.com'});
      await evaluate(`document.querySelector('.login-form input[type=password]').focus()`);await send('Input.insertText',{text:'Synthetic-worker-password-42'});
      await evaluate(`document.querySelector('.login-form button[type=submit]').click()`);
      await wait(()=>evaluate(`location.pathname==='/studio/private/workspace'&&document.querySelector('select[aria-label="练习或项目里程碑"]')?.value==='project:c-engine:implementation'`));
      assert.equal(await evaluate(`location.search`),'?project=c-engine&milestone=implementation');
      await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/login?returnTo=${encodeURIComponent('//evil.invalid')}`});
      try{await wait(()=>evaluate(`location.pathname==='/studio/private/management'&&!!document.querySelector(${JSON.stringify(useWorker?'.studio-daily-workbench':'.management-metrics')})`));}
      catch(error){console.log('Login return diagnostic: '+JSON.stringify(await evaluate(`(async()=>({url:location.href,text:document.body?.innerText.slice(0,1000),session:await fetch('/api/auth/session').then(r=>r.json())}))()`)));throw error;}
    }
  }
  const summary={posts,reads,managementReads,rows:emailOnly?0:2,viewportResults,publicViews,emailLoginVerified:useWorker||emailOnly,passed:true,scope:useWorker?'Chrome + complete Worker build + actual Vinext dispatch + memory D1, synthetic native email sessions':'actual browser clients + HTTP handlers + memory SQLite; Worker route dispatch verified separately'};
  fs.writeFileSync(path.join(work,'summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
}finally{ws?.close();chrome?.kill();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));for(const cleanup of cleanups)cleanup();if(useWorker)await f.runtime.dispose();}
