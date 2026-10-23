// Browser -> generated app -> memory D1; optional explicit public snapshot, synthetic by default.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {createStudioWorkerEnvironment} from './helpers/studio-worker-environment.mjs';
import {loadPublicRecords,seedPublicRecords} from './helpers/public-record-preview.mjs';

const snapshotIndex=process.argv.indexOf('--records');
const publicRecords=snapshotIndex<0?null:loadPublicRecords(process.argv[snapshotIndex+1]);
const root=path.resolve(import.meta.dirname,'..'),work=path.join(root,'tests/.generated/'+(publicRecords?'public-record-browser':'display-browser'));
fs.mkdirSync(work,{recursive:true});
const require=createRequire(fs.realpathSync(path.join(root,'node_modules/vite/package.json'))),WebSocket=require('ws');
const f=await createStudioWorkerEnvironment(),requests=[];
let homeRecordsMode='normal';
const note='Synthetic published reading '+ 'public layout context '.repeat(24)+'deepneedle design conclusion';
if(publicRecords)await seedPublicRecords(f.db,publicRecords);
else await f.db.prepare('INSERT INTO records(date,items,practice,revision,updated_at) VALUES(?,?,?,?,?)').bind('2026-10-15',JSON.stringify([{label:'设计',text:note}]),'Synthetic public practice',1,new Date().toISOString()).run();
const server=http.createServer(async(req,res)=>{
  try{
    requests.push({method:req.method,url:req.url});
    if(req.url==='/api/records'&&homeRecordsMode!=='normal'){
      res.writeHead(homeRecordsMode==='error'?503:200,{'content-type':'application/json','cache-control':'no-store'});
      res.end(JSON.stringify(homeRecordsMode==='error'?{error:'SYNTHETIC_UNAVAILABLE'}:{records:[]}));return;
    }
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const response=await f.runtime.dispatchFetch('http://127.0.0.1:'+server.address().port+req.url,{method:req.method,headers:req.headers,redirect:'manual',...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch(error){if(res.headersSent)res.destroy();else res.writeHead(500).end('Synthetic preview error');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
let chrome,ws;
const screenshots=[];
try{
  const profile=path.join(work,'profile-'+Date.now());
  chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
  const wait=async(predicate,label='condition')=>{for(let n=0;n<150;n++){if(await predicate())return;await new Promise(resolve=>setTimeout(resolve,100));}throw Error('Display browser timeout: '+label);};
  await wait(()=>fs.existsSync(path.join(profile,'DevToolsActivePort')),'Chrome startup');
  const port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];
  const tabs=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
  ws=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  let sequence=0;const pending=new Map(),errors=[];
  ws.onmessage=event=>{const msg=JSON.parse(event.data);if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails.text);if(msg.id){const operation=pending.get(msg.id);pending.delete(msg.id);msg.error?operation.reject(Error(JSON.stringify(msg.error))):operation.resolve(msg.result);}};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>reject(Error('CDP timeout '+method)),15000);pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async(expression)=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
  const navigate=async(url,selector)=>{await send('Page.navigate',{url:base+url});await wait(()=>evaluate('location.pathname==='+JSON.stringify(new URL(base+url).pathname)+'&&!!document.querySelector('+JSON.stringify(selector)+')'),'navigate '+url);};
  const clickText=async(text)=>evaluate('(()=>{const button=[...document.querySelectorAll("button")].find(el=>el.textContent.trim()==='+JSON.stringify(text)+');if(!button)throw Error("Missing button");button.click();})()');
  const screenshot=async(name)=>{
    for(const width of [320,390,768,1280])for(const theme of ['light','dark']){
      await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
      await evaluate('document.documentElement.dataset.theme='+JSON.stringify(theme)+';window.scrollTo(0,0)');
      await evaluate('document.fonts.ready');
      await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
      assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),true,name+' overflow '+width+' '+theme);
      assert.equal(await evaluate('[...document.querySelectorAll(".nav-links-cluster a,.theme-toggle-btn")].every(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.width>0;})'),true,name+' navigation '+width+' '+theme);
      assert.equal(await evaluate('document.querySelectorAll("textarea,dialog.editor").length'),0,name+' has no content editor');
      const shot=await send('Page.captureScreenshot',{format:'png'}),filename=name+'-'+width+'-'+theme+'.png';
      fs.writeFileSync(path.join(work,filename),Buffer.from(shot.data,'base64'));screenshots.push(filename);
    }
  };
  const caseScreenshot=async(name)=>{
    if(!publicRecords)return;
    await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
    await evaluate('document.documentElement.dataset.theme="light";window.scrollTo(0,0);document.fonts.ready');
    await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    const shot=await send('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width:1280,height:720,scale:1}});
    fs.writeFileSync(path.join(work,name+'.png'),Buffer.from(shot.data,'base64'));screenshots.push(name+'.png');
  };
  await send('Runtime.enable');await send('Page.enable');await send('Page.bringToFront');
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await navigate('/studio','.wayneo-project-index');
  assert.equal(await evaluate('document.querySelectorAll("[data-project-demo],.wayneo-feature-index,.wayneo-page-guide").length'),0,'Studio index does not inline project details');
  assert.equal(await evaluate('document.querySelector(".wayneo-project-index a").getAttribute("href")'),'/studio/wayneo','project opens its own detail page');
  await screenshot('studio-index');
  for(const width of [390,1280]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
    await evaluate('document.documentElement.dataset.theme="light";document.documentElement.style.scrollBehavior="auto";window.scrollTo({top:Math.max(0,scrollY+document.querySelector(".wayneo-project-index").getBoundingClientRect().top-110),behavior:"instant"})');
    await wait(()=>evaluate('(()=>{const rect=document.querySelector(".wayneo-project-index").getBoundingClientRect();return rect.top>=100&&rect.top<=120;})()'),'project summary visible below header');
    await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    const shot=await send('Page.captureScreenshot',{format:'png'}),filename='studio-index-project-'+width+'.png';
    fs.writeFileSync(path.join(work,filename),Buffer.from(shot.data,'base64'));screenshots.push(filename);
  }
  await evaluate('document.querySelector(".wayneo-project-index a").click()');
  await wait(()=>evaluate('location.pathname==="/studio/wayneo"&&!!document.querySelector("[data-project-demo]")'),'project detail navigation');
  assert.equal(await evaluate('[...document.querySelectorAll(".wayneo-project-back-link a")].some(el=>el.getAttribute("href")==="/studio")'),true,'project detail has a return path');
  const guideImages=await evaluate('[...document.querySelectorAll(".wayneo-page-guide img")].map(img=>img.getAttribute("src"))');
  assert.deepEqual(guideImages,['/project-case/wayneo-index.png','/project-case/wayneo-journal.png']);
  for(const src of guideImages){
    await evaluate('(()=>{const img=[...document.images].find(img=>img.getAttribute("src")==='+JSON.stringify(src)+');img.scrollIntoView({block:"center"});})()');
    await wait(()=>evaluate('[...document.images].find(img=>img.getAttribute("src")==='+JSON.stringify(src)+')?.naturalWidth===1280'),'real guide image '+src);
  }
  assert.equal(await evaluate('document.querySelectorAll(".studio-section-nav,.workbench-tabs").length'),0,'one Studio feature, no redundant tabs');
  assert.equal(await evaluate('document.querySelectorAll(".wayneo-specimen").length>=2'),true,'article and experience reuse the same specimen');
  await wait(()=>evaluate('getComputedStyle(document.querySelector("[data-project-demo] .wayneo-specimen")).gridTemplateColumns.split(" ").length>1'),'desktop actual grid');
  await evaluate('document.querySelector("[data-project-demo]").scrollIntoView({block:"start"});window.scrollBy(0,-100);document.fonts.ready');
  const desktopDemo=await send('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(path.join(work,'studio-experience-desktop.png'),Buffer.from(desktopDemo.data,'base64'));screenshots.push('studio-experience-desktop.png');
  await clickText('手机版式');
  await wait(()=>evaluate('getComputedStyle(document.querySelector("[data-project-demo] .wayneo-specimen")).gridTemplateColumns.split(" ").length===1'),'mobile actual single column');
  await evaluate('document.querySelector("[data-project-demo] input[type=checkbox]").click()');
  assert.equal(await evaluate('!!document.querySelector("[data-demo-grid=true]")'),true,'grid overlay can be enabled');
  const mobileDemo=await send('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(path.join(work,'studio-experience-mobile.png'),Buffer.from(mobileDemo.data,'base64'));screenshots.push('studio-experience-mobile.png');
  await clickText('桌面版式');
  await wait(()=>evaluate('getComputedStyle(document.querySelector("[data-project-demo] .wayneo-specimen")).gridTemplateColumns.split(" ").length>1'),'restore desktop grid');
  await screenshot('studio-detail');
  await evaluate('document.documentElement.dataset.theme="light";document.querySelector(".wayneo-page-guide").scrollIntoView({block:"start"});window.scrollBy(0,-100)');
  const guideShot=await send('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(path.join(work,'studio-page-guide.png'),Buffer.from(guideShot.data,'base64'));screenshots.push('studio-page-guide.png');
  await evaluate('document.querySelector(".wayneo-project-back-link a").click()');
  await wait(()=>evaluate('location.pathname==="/studio"&&!!document.querySelector(".wayneo-project-index")&&!document.querySelector("[data-project-demo]")'),'return to Studio index');
  assert.equal(await evaluate('document.querySelector(".collection-entry a").getAttribute("href")'),'/studio/collection','Studio has a collection entry');
  await evaluate('document.querySelector(".collection-entry a").click()');
  await wait(()=>evaluate('location.pathname==="/studio/collection"&&!!document.getElementById("ice-and-fire")'),'collection entry navigation');
  assert.equal(await evaluate('document.querySelector("h1").textContent'),'收藏馆');
  assert.deepEqual(await evaluate('[...document.querySelectorAll(".nav-links-cluster a")].map(el=>el.textContent.trim())'),['Index','Journal','Studio'],'only three global destinations');
  assert.equal(await evaluate('document.querySelectorAll("input,textarea,form").length'),0,'collection has no search or content input');
  for(const id of ['ice-and-fire','breaking-bad','game-of-thrones','the-last-of-us','cs2'])assert.equal(await evaluate('!!document.getElementById('+JSON.stringify(id)+')'),true,'confirmed collection item '+id);
  for(const group of ['world','series','game']){
    await evaluate('(()=>{const link=[...document.querySelectorAll("nav a")].find(a=>a.getAttribute("href")==='+JSON.stringify('#'+group)+');if(!link)throw Error("Missing category");link.click();})()');
    await wait(()=>evaluate('location.hash==='+JSON.stringify('#'+group)),'category anchor '+group);
  }
  await screenshot('collection');
  for(const width of [390,1280]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
    await evaluate('document.documentElement.dataset.theme="light";document.documentElement.style.scrollBehavior="auto";window.scrollTo({top:0,behavior:"instant"});document.fonts.ready');
    await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    const shot=await send('Page.captureScreenshot',{format:'png'}),filename='collection-preview-'+width+'.png';fs.writeFileSync(path.join(work,filename),Buffer.from(shot.data,'base64'));screenshots.push(filename);
  }
  await send('Page.navigate',{url:base+'/search?q=CSGO'});
  await wait(()=>evaluate('location.pathname==="/studio"&&!!document.querySelector(".wayneo-project-index")'),'retired search returns to Studio');
  assert.equal(await evaluate('[...document.links].some(a=>a.getAttribute("href")?.startsWith("/search"))'),false,'no global search links');
  await navigate('/learning?date='+encodeURIComponent(publicRecords?'2026-10-12':'2026-10-15'),'.entries .entry');
  assert.equal(await evaluate('document.querySelector(".journal-related a")?.getAttribute("href")'),publicRecords?undefined:'/studio/wayneo','only matching topics link back to the project detail');
  await screenshot('journal');await caseScreenshot('wayneo-journal');
  await navigate('/','.publication-home');
  await wait(()=>evaluate('document.querySelectorAll(".pub-index-entry").length>0'),'home recent records');
  assert.deepEqual(await evaluate('[...document.querySelectorAll("main>section")].map(section=>section.id||section.classList[0]).slice(0,3)'),['pub-cover','journal','practice'],'home restores journal before atmospheric Studio entry');
  assert.equal(await evaluate('document.querySelector("#practice .pub-text-link").getAttribute("href")'),'/studio','home has only a Studio entry');
  assert.equal(await evaluate('document.querySelectorAll("#practice a").length'),1);
  assert.equal(await evaluate('!!document.querySelector("#selected,.pub-practice-topics,.pub-selected-more")||[...document.querySelectorAll("main a")].some(a=>a.getAttribute("href")==="/studio/wayneo")'),false,'no project detail on home');
  assert.equal(await evaluate('document.querySelector("#practice h2").textContent'),'让想法，有迹可循。');
  assert.equal(await evaluate('document.querySelector(".pub-cover-intro a").getAttribute("href")'),'#journal');
  assert.equal(await evaluate('document.querySelectorAll(".pub-index-entry").length'),Math.min(publicRecords?.length??1,3),'only the latest three records are featured');
  await screenshot('index');await caseScreenshot('wayneo-index');
  for(const width of [390,1280])for(const selector of ['#practice','#journal']){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
    await evaluate('document.documentElement.dataset.theme="light";document.documentElement.style.scrollBehavior="auto";window.scrollTo({top:Math.max(0,scrollY+document.querySelector('+JSON.stringify(selector)+').getBoundingClientRect().top-100),behavior:"instant"})');
    await evaluate('document.fonts.ready');
    await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    if(selector==='#practice')assert.equal(await evaluate('[...document.querySelectorAll("#practice a")].every(el=>el.getBoundingClientRect().height>=44)'),true,'Studio entry has touch target');
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),true,'home section fits '+width);
    const shot=await send('Page.captureScreenshot',{format:'png'}),filename='index-'+selector.slice(1)+'-'+width+'.png';
    fs.writeFileSync(path.join(work,filename),Buffer.from(shot.data,'base64'));screenshots.push(filename);
  }
  await evaluate('document.querySelector("#practice .pub-text-link").click()');
  await wait(()=>evaluate('location.pathname==="/studio"&&!!document.querySelector(".wayneo-project-index")'),'home Studio entry destination');
  await navigate('/','.pub-index-entry');
  const recentUrl=await evaluate('document.querySelector(".pub-index-entry").getAttribute("href")');
  await navigate(recentUrl,'.entries .entry');
  assert.equal(new URL(base+recentUrl).searchParams.has('date'),true,'home reading opens its date');
  homeRecordsMode='empty';await navigate('/','#practice');
  await wait(()=>evaluate('document.querySelector(".pub-index")?.getAttribute("aria-busy")==="false"'),'home empty source');
  assert.equal(await evaluate('document.querySelectorAll(".pub-index-entry").length'),0,'no invented reading in empty state');
  assert.equal(await evaluate('!!document.querySelector("#practice .pub-text-link")'),true,'Studio entry survives empty journal');
  homeRecordsMode='error';await send('Page.reload');
  await wait(()=>evaluate('!!document.querySelector(".pub-notice button:not(:disabled)")'),'home read failure');
  assert.equal(await evaluate('!!document.querySelector("#practice .pub-text-link")'),true,'Studio entry survives journal failure');
  homeRecordsMode='normal';await clickText('重新读取');
  await wait(()=>evaluate('document.querySelectorAll(".pub-index-entry").length>0&&!document.querySelector(".pub-notice")'),'home retry recovers');
  const retainedDates=await evaluate('[...document.querySelectorAll(".pub-index-entry time")].map(el=>el.dateTime)');
  homeRecordsMode='error';await evaluate('document.dispatchEvent(new Event("visibilitychange"))');
  await wait(()=>evaluate('document.querySelector(".pub-notice")?.textContent.includes("保留上次读取")'),'home failed refresh preserves previous records');
  assert.deepEqual(await evaluate('[...document.querySelectorAll(".pub-index-entry time")].map(el=>el.dateTime)'),retainedDates);
  homeRecordsMode='normal';
  assert.equal(requests.every(request=>['GET','HEAD'].includes(request.method)),true,'browsing and interaction never write content');
  assert.deepEqual(errors,[],'no browser exceptions');
  const summary={passed:true,screenshots,checks:['collection entry and five confirmed interests','category anchors','global search retired','real container-responsive component','local grid control','journal deep link','home failure recovery','no content writes','4 viewports and 2 themes'],scope:'complete local Worker + Chrome + memory D1; '+(publicRecords?'existing public records snapshot':'synthetic public reading only')};
  fs.writeFileSync(path.join(work,'summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
}finally{ws?.close();chrome?.kill();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await f.runtime.dispose();}
