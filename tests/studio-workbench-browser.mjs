// Real browser -> generated Worker -> memory D1. All identities and content are synthetic.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {createStudioWorkerEnvironment} from './helpers/studio-worker-environment.mjs';
import {buildWorkspaceInput} from '../lib/ui/studio-workspace.ts';
import {emptyProjectContent} from '../lib/ui/project-protocol.ts';

const root=path.resolve(import.meta.dirname,'..'),work=path.join(root,'tests/.generated/workbench-browser');
fs.mkdirSync(work,{recursive:true});
const require=createRequire(fs.realpathSync(path.join(root,'node_modules/vite/package.json'))),WebSocket=require('ws');
const f=await createStudioWorkerEnvironment();
let injectIdentity=true,fault=null;
const requests=[];
const server=http.createServer(async(req,res)=>{
  try{
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const body=Buffer.concat(chunks).toString(),headers=new Headers(req.headers);
    if(injectIdentity)headers.set('cookie',f.auth.cookie);
    if(req.method==='POST'&&req.url==='/api/studio/events')requests.push(JSON.parse(body));
    if(fault==='context'&&req.url.startsWith('/api/studio/context')){fault=null;res.writeHead(503,{'content-type':'application/json'}).end(JSON.stringify({error:{code:'SERVICE_UNAVAILABLE',message:'合成读取失败，请重试。'}}));return;}
    const response=await f.runtime.dispatchFetch('http://127.0.0.1:'+server.address().port+req.url,{method:req.method,headers,redirect:'manual',...(req.method!=='GET'&&req.method!=='HEAD'?{body}:{})});
    if(fault==='receipt'&&req.method==='POST'&&req.url==='/api/studio/events'){fault=null;res.writeHead(200,{'content-type':'application/json'}).end('{"saved":true}');return;}
    const data=Buffer.from(await response.arrayBuffer());res.writeHead(response.status,Object.fromEntries(response.headers));res.end(data);
  }catch(error){if(res.headersSent)res.destroy();else res.writeHead(500).end('Synthetic proxy error');console.log(String(error));}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
async function mutate(url,payload){const response=await fetch(base+url,{method:'POST',headers:{'content-type':'application/json',origin:base},body:JSON.stringify(payload)});assert.ok(response.ok,await response.clone().text());return response.json();}
const projectId='automotive-bus';
const published={...emptyProjectContent(),status:'in_progress',summary:'Synthetic old public progress',next_step:'Synthetic old action',milestones:{interface:'completed',implementation:'in_progress',verification:'not_started'}};
const draft={...published,summary:'Synthetic new draft progress',next_step:'Synthetic project next action'};
const goal={id:'synthetic-kept',title:'Synthetic current goal',status:'planned',summary:'Synthetic goal description',next_step:'Synthetic goal next action',target_date:null};
const removedGoal={...goal,id:'synthetic-removed',title:'Synthetic removed goal'};
const note={summary:'Synthetic milestone evidence',date:'',assistance:'unknown',execution:'unknown'};
let chrome,ws;
const screenshots=[];
try{
  await mutate('/api/studio/projects',{action:'save_draft',project_id:projectId,expected_revision:0,idempotency_key:'synthetic-project-1',content:{...published,private_note:'SYNTHETIC_PRIVATE_PROJECT_NOTE'}});
  await mutate('/api/studio/projects',{action:'publish',project_id:projectId,expected_revision:1,idempotency_key:'synthetic-project-2',confirm_public:true});
  await mutate('/api/studio/projects',{action:'save_draft',project_id:projectId,expected_revision:2,idempotency_key:'synthetic-project-3',content:{...draft,private_note:'SYNTHETIC_PRIVATE_PROJECT_NOTE'}});
  await mutate('/api/studio/plans',{action:'save_draft',plan_id:'personal-goals',expected_revision:0,idempotency_key:'synthetic-plan-1',content:{goals:[goal,removedGoal],private_note:'SYNTHETIC_PRIVATE_PLAN_NOTE'}});
  await mutate('/api/studio/plans',{action:'publish',plan_id:'personal-goals',expected_revision:1,idempotency_key:'synthetic-plan-2',confirm_public:true});
  await mutate('/api/studio/plans',{action:'save_draft',plan_id:'personal-goals',expected_revision:2,idempotency_key:'synthetic-plan-3',content:{goals:[goal],private_note:'SYNTHETIC_PRIVATE_PLAN_NOTE'}});
  await mutate('/api/studio/events',buildWorkspaceInput({kind:'project',id:projectId,milestone:'implementation'},note,{key:'synthetic-evidence',instance:'11111111-1111-4111-8111-111111111111'}));
  const profile=path.join(work,'profile-'+Date.now());
  chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu',...(process.env.CHROME_TEST_NO_SANDBOX==='1'?['--no-sandbox']:[]),'--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
  const wait=async predicate=>{for(let n=0;n<150;n++){if(await predicate())return;await new Promise(resolve=>setTimeout(resolve,100));}throw Error('Workbench browser condition timed out');};
  await wait(()=>fs.existsSync(path.join(profile,'DevToolsActivePort')));
  const port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];
  const tabs=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
  ws=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  let sequence=0,dialog=null;const pending=new Map();
  ws.onmessage=event=>{const message=JSON.parse(event.data);if(message.method==='Page.javascriptDialogOpening')dialog=message.params;if(message.id){const operation=pending.get(message.id);pending.delete(message.id);message.error?operation.reject(Error(JSON.stringify(message.error))):operation.resolve(message.result);}};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>reject(Error('CDP timeout: '+method)),10000);pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
  const navigate=async(url,selector)=>{await send('Page.navigate',{url:base+url});await wait(()=>evaluate('!!document.querySelector('+JSON.stringify(selector)+')'));};
  const insert=async(selector,text)=>{await evaluate('document.querySelector('+JSON.stringify(selector)+').focus()');await send('Input.insertText',{text});};
  const screenshot=async(name)=>{
    for(const width of [320,390,768,1280])for(const theme of ['light','dark']){
      await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
      await evaluate('document.documentElement.dataset.theme='+JSON.stringify(theme));
      await wait(()=>evaluate('getComputedStyle(document.body).backgroundColor==='+JSON.stringify(theme==='dark'?'rgb(18, 18, 17)':'rgb(243, 241, 236)')));
      await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
      assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false,name+' '+width+' '+theme);
      if(name==='public-studio-wayneo'){
        assert.equal(await evaluate('(()=>{const index=document.querySelector(".studio-project-index");return index.firstElementChild.getBoundingClientRect().width>=index.getBoundingClientRect().width-1;})()'),true,'a project entry fills the index width '+width+' '+theme);
      }
      assert.equal(await evaluate('document.querySelectorAll("h1").length'),1);
      assert.equal(await evaluate('[...document.querySelectorAll(".studio-photo-window img")].every(image=>getComputedStyle(image).filter==="none"&&getComputedStyle(image).opacity==="1")'),true,name+' ungraded photographs '+width+' '+theme);
      const navigation=await evaluate(`(()=>{
        const links=[...document.querySelectorAll('.studio-section-nav nav a')];
        const logout=document.querySelector('.studio-session-actions button')?.getBoundingClientRect();
        return links.map(link=>{const box=link.getBoundingClientRect();return {
          visible:box.left>=0&&box.right<=innerWidth&&box.height>=44,
          overlapped:!!logout&&box.left<logout.right&&box.right>logout.left&&box.top<logout.bottom&&box.bottom>logout.top
        };});
      })()`);
      assert.equal(navigation.length,name.startsWith('public-studio')?2:5);
      assert.equal(navigation.every(link=>link.visible&&!link.overlapped),true,name+' navigation '+width+' '+theme);
      const shot=await send('Page.captureScreenshot',{format:'png'}),filename=name+'-'+width+'-'+theme+'.png';
      fs.writeFileSync(path.join(work,filename),Buffer.from(shot.data,'base64'));screenshots.push(filename);
      if((name==='public-studio'&&width===1280||['public-studio-wayneo','public-studio-wayneo-detail'].includes(name)&&[320,1280].includes(width))&&theme==='light'){
        const fullHeight=await evaluate('Math.ceil(document.documentElement.scrollHeight)');
        await send('Emulation.setDeviceMetricsOverride',{width,height:fullHeight,deviceScaleFactor:1,mobile:false});
        await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
        const full=await send('Page.captureScreenshot',{format:'png'});
        const fullName=name==='public-studio'?'public-studio-full.png':name+'-'+width+'-full.png';
        fs.writeFileSync(path.join(work,fullName),Buffer.from(full.data,'base64'));
        await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
      }
    }
  };
  await send('Runtime.enable');await send('Page.enable');await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  if(process.argv.includes('--public-motion')){
    await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
    await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
    await navigate('/studio','.studio-cover--public');
    await wait(()=>evaluate('document.querySelector("[data-studio-motion-ready=true]")!==null'));
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".studio-cover-title span")).animationName!=="none"||getComputedStyle(document.querySelector(".studio-cover-title")).animationName!=="none"'),true,'public cover has editorial entrance');
    const pendingSelector='[data-studio-reveal]:not([data-studio-revealed=true])';
    await wait(()=>evaluate('document.querySelectorAll('+JSON.stringify(pendingSelector)+').length>0'));
    await evaluate('document.querySelector(".studio-essay-grid figure:last-child").scrollIntoView({block:"center"})');
    await wait(()=>evaluate('document.querySelector(".studio-essay-grid figure:last-child").dataset.studioRevealed==="true"'));
    await evaluate('window.scrollTo(0,0)');
    assert.equal(await evaluate('document.querySelector(".studio-essay-grid figure:last-child").dataset.studioRevealed'), 'true','reveals once, does not hide again');
    await send('Page.bringToFront');
    await evaluate('document.querySelector(".studio-project-index h3 a").focus()');
    const focusedReveal=await evaluate('(()=>{const el=document.querySelector(".studio-project-index article");return {opacity:getComputedStyle(el).opacity,immediate:el.dataset.studioImmediate,active:document.activeElement===el.querySelector("h3 a")};})()');
    assert.equal(focusedReveal.immediate,'true',JSON.stringify(focusedReveal));
    assert.equal(Number(focusedReveal.opacity)>.999,true,'keyboard focus reveals immediately');
    await evaluate('document.querySelector(".studio-project-index h3 a").blur()');
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".studio-project-index article")).animationName'), 'none','leaving keyboard focus does not replay the entrance');
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:false});
    await navigate('/studio?motion=mobile','.studio-cover--public');
    await wait(()=>evaluate('document.querySelector("[data-studio-motion-ready=true]")!==null'));
    await evaluate('document.querySelector(".studio-essay-grid figure:last-child").scrollIntoView({block:"center"})');
    await wait(()=>evaluate('document.querySelector(".studio-essay-grid figure:last-child").dataset.studioRevealed==="true"'));
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".studio-essay-grid figure:last-child")).animationName'),'studio-public-reveal-media-short','mobile reveal has shorter travel');
    await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
    await navigate('/studio/projects#automotive-bus','.studio-project-spread');
    await wait(()=>evaluate('document.querySelectorAll("#automotive-bus [data-studio-reveal]").length===2&&[...document.querySelectorAll("#automotive-bus [data-studio-reveal]")].every(el=>el.dataset.studioRevealed==="true")'));
    assert.equal(await evaluate('getComputedStyle(document.querySelector("#automotive-bus .studio-project-body")).animationName'),'studio-public-reveal','the first project uses the new reveal rather than an old override');
    await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await wait(()=>evaluate('[...document.querySelectorAll("[data-studio-reveal]")].every(el=>getComputedStyle(el).opacity==="1"&&getComputedStyle(el).transform==="none")'));
    await evaluate('window.scrollTo(0,0)');
    await screenshot('public-studio-motion-detail');
    await navigate('/studio','.studio-cover--public');
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".studio-cover-title span")).animationName'), 'none','reduced-motion title is static');
    await screenshot('public-studio-motion');
    await navigate('/studio/private/management','.studio-editorial--private');
    assert.equal(await evaluate('document.querySelectorAll("[data-studio-reveal], [data-studio-motion-ready], .studio-public-motion").length'),0,'private workbench has no new motion controller or targets');
    await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
    await send('Emulation.setScriptExecutionDisabled',{value:true});
    await navigate('/studio','.studio-cover--public');
    assert.equal(await evaluate('[...document.querySelectorAll(".studio-project-index article, .studio-essay-grid figure")].every(el=>getComputedStyle(el).opacity==="1")'),true,'SSR remains visible with JavaScript disabled');
    await send('Emulation.setScriptExecutionDisabled',{value:false});
    const fallbackScript=await send('Page.addScriptToEvaluateOnNewDocument',{source:'delete window.IntersectionObserver;'});
    await navigate('/studio/projects','.studio-project-spread');
    assert.equal(await evaluate('[...document.querySelectorAll(".studio-project-heading, .studio-project-body")].every(el=>getComputedStyle(el).opacity==="1")'),true,'content visible without IntersectionObserver');
    await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:fallbackScript.identifier});
  }else if(process.argv.includes('--project-preview')){
    await navigate('/studio/preview-wayneo','.dashboard-project-grid');
    assert.equal(await evaluate('document.body.innerText.includes("本地草稿 · 未发布")'),true);
    assert.equal(await evaluate('document.querySelector(".dashboard-project-grid h3").textContent'),'Wayneo');
    assert.equal(await evaluate('document.querySelectorAll("time").length'),0,'the unpublished preview has no fabricated publication date');
    await evaluate('Promise.all([...document.images].map(image=>{image.loading="eager";return image.decode();}))');
    await screenshot('public-studio-wayneo');
    await evaluate('document.querySelector(".dashboard-project-grid h3 a").click()');
    await wait(()=>evaluate('!!document.querySelector(".studio-project-description")'));
    assert.equal(await evaluate('location.hash'),'#wayneo');
    assert.equal(await evaluate('[...document.querySelectorAll(".studio-project-description h3")].map(h=>h.textContent).join("|")'),'项目介绍|当前进展|下一步建议');
    assert.equal(await evaluate('document.querySelectorAll("time").length'),0);
    assert.equal(await evaluate('document.querySelector("a[href=\\"https://wayneo.dev\\"]").textContent.includes("访问网站")'),true);
    await screenshot('public-studio-wayneo-detail');
    await evaluate('document.querySelector("a[href=\\"/studio/preview-wayneo\\"]").click()');
    await wait(()=>evaluate('!!document.querySelector(".dashboard-project-grid")'));
    await navigate('/studio','.studio-cover');
    assert.equal(await evaluate('document.querySelector(".dashboard-project-grid h3").textContent.includes("Wayneo")'),false,'the draft is absent from the real public project list');
  }else if(process.argv.includes('--wayneo-management')){
    await mutate('/api/studio/projects',{action:'save_draft',project_id:'wayneo',expected_revision:0,idempotency_key:'synthetic-incomplete-website',content:{...emptyProjectContent(),summary:'Synthetic incomplete website',private_note:''}});
    const publicHTML=async()=>await(await f.runtime.dispatchFetch('http://synthetic.invalid/studio/projects')).text();
    const changeField=async(label,text)=>{
      await evaluate(`(()=>{const label=[...document.querySelectorAll('.project-editor form label')].find(node=>node.textContent.startsWith(${JSON.stringify(label)}));const input=label.querySelector('textarea,input');input.focus();input.select();})()`);
      await send('Input.insertText',{text});
    };
    const clickText=async text=>evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent===${JSON.stringify(text)}).click()`);
    const saveDraft=async()=>{
      await evaluate('document.querySelector(".project-editor form").dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}))');
      await wait(()=>evaluate('document.querySelector("[role=status]")?.textContent.includes("私人草稿已保存")'));
    };
    const publishDraft=async()=>{
      await clickText('预览并发布');
      await wait(()=>evaluate('!!document.querySelector(".project-editor-confirm input")'));
      assert.equal(await evaluate('[...document.querySelectorAll("button")].find(button=>button.textContent==="确认发布").disabled'),true);
      assert.equal(await evaluate('document.querySelector(".project-editor-preview").textContent.includes("SYNTHETIC_WAYNEO_BROWSER_PRIVATE")'),false);
      await evaluate('document.querySelector(".project-editor-confirm input").click()');
      await clickText('确认发布');
      await wait(()=>evaluate('document.querySelector("[role=status]")?.textContent.includes("公开发布")'));
    };
    await navigate('/studio/private/projects?project=wayneo','.project-editor[data-ready=true]');
    assert.equal(await evaluate('document.querySelector(".project-editor-toolbar select").value'),'wayneo');
    assert.equal(await evaluate('document.querySelector(".project-editor-toolbar select").options.length'),4);
    assert.equal(await evaluate('document.body.innerText.includes("本页有未保存的项目修改")'),false,'initial introduction fallback is not a dirty edit');
    assert.equal(await evaluate('document.querySelector(".project-editor form button[type=submit]").disabled'),false,'the default introduction of an incomplete saved draft can be saved');
    await changeField('项目介绍','Synthetic Wayneo first introduction');
    await changeField('进展说明','Synthetic Wayneo first progress');
    await changeField('私人备注','SYNTHETIC_WAYNEO_BROWSER_PRIVATE');
    await saveDraft();
    assert.equal((await publicHTML()).includes('Synthetic Wayneo first introduction'),false);
    await screenshot('wayneo-project-saved');
    await publishDraft();
    await navigate('/studio/projects','#wayneo');
    assert.equal(await evaluate('document.querySelector("#wayneo .studio-project-description").textContent.includes("Synthetic Wayneo first introduction")'),true);
    assert.equal(await evaluate('document.body.innerText.includes("SYNTHETIC_WAYNEO_BROWSER_PRIVATE")'),false);
    await screenshot('public-studio-wayneo-managed');
    await navigate('/studio/private/projects?project=wayneo','.project-editor[data-ready=true]');
    await changeField('项目介绍','Synthetic Wayneo second introduction');
    await saveDraft();
    const oldPublic=await publicHTML();assert.ok(oldPublic.includes('Synthetic Wayneo first introduction'));assert.ok(!oldPublic.includes('Synthetic Wayneo second introduction'));
    await clickText('预览并发布');
    await wait(()=>evaluate('!!document.querySelector(".studio-publication-changes")'));
    assert.equal(await evaluate('document.querySelector(".studio-publication-changes").textContent.includes("Synthetic Wayneo first introduction")'),true);
    assert.equal(await evaluate('document.querySelector(".studio-publication-changes").textContent.includes("Synthetic Wayneo second introduction")'),true);
    await screenshot('wayneo-project-changes');
    await evaluate('document.querySelector(".project-editor-confirm input").click()');
    await clickText('确认发布');
    await wait(()=>evaluate('document.querySelector("[role=status]")?.textContent.includes("公开发布")'));
    assert.ok((await publicHTML()).includes('Synthetic Wayneo second introduction'));
    await clickText('撤下公开状态');await clickText('确认撤下');
    await wait(()=>evaluate('document.querySelector("[role=status]")?.textContent.includes("已撤下")'));
    assert.ok(!(await publicHTML()).includes('Synthetic Wayneo second introduction'));
    const stored=await f.db.prepare("SELECT draft_json,published_json,private_note FROM studio_project_records WHERE project_id='wayneo'").first();
    assert.equal(JSON.parse(stored.draft_json).description,'Synthetic Wayneo second introduction');assert.equal(stored.published_json,null);assert.equal(stored.private_note,'SYNTHETIC_WAYNEO_BROWSER_PRIVATE');
  }else{
  await navigate('/studio','.studio-cover');
  assert.equal(await evaluate('document.body.innerText.includes("Synthetic old public progress")'),true);
  assert.equal(await evaluate('document.body.innerText.includes("Synthetic new draft progress")'),false);
  assert.equal(await evaluate('document.body.innerText.includes("Synthetic current goal")'),false);
  assert.equal(await evaluate('!!document.querySelector(".dashboard-metrics, .dashboard-chart, #connections, #goals")'),false);
  await evaluate('Promise.all([...document.images].map(image=>{image.loading="eager";return image.decode();}))');
  assert.equal(await evaluate('new Set([...document.querySelectorAll(".studio-photo-window img")].map(image=>image.src)).size'),3);
  await screenshot('public-studio');
  await navigate('/studio/projects','.workbench-project');
  assert.equal(await evaluate('document.querySelectorAll(".workbench-project").length'),1);
  assert.equal(await evaluate('document.querySelector(".workbench-project").id'),'automotive-bus');
  assert.equal(await evaluate('document.querySelector(".workbench-details").open'),false);
  await evaluate('document.querySelector(".workbench-details > summary").click()');
  assert.equal(await evaluate('document.querySelector(".workbench-details").open'),true);
  assert.equal(await evaluate('document.body.innerText.includes("SYNTHETIC_PRIVATE_PROJECT_NOTE")'),false);
  await screenshot('public-studio-projects');
  await navigate('/studio/private/management','.studio-daily-workbench');
  assert.equal(await evaluate('document.body.innerText.includes("Synthetic goal next action")'),true);
  assert.equal(await evaluate('document.body.innerText.includes("Synthetic project next action")'),true);
  assert.equal(await evaluate('document.body.innerText.includes("SYNTHETIC_PRIVATE_PROJECT_NOTE")'),false);
  assert.equal(await evaluate('!!document.querySelector(".management-metrics")'),false);
  await screenshot('workbench');

  if(!process.argv.includes('--visual-only')){
  await navigate('/studio/private/workspace','.studio-record-composer[data-ready=true]');
  assert.equal(await evaluate('document.querySelector(".studio-record-composer form label")?.textContent.includes("实际过程与结果")'),true);
  assert.equal(await evaluate('document.querySelector("select").value'),'note');
  await insert('textarea','Synthetic everyday record');
  dialog=null;await evaluate('setTimeout(()=>location.assign("/studio/private"),0)');await wait(()=>dialog!==null);
  assert.equal(dialog.type,'beforeunload');await send('Page.handleJavaScriptDialog',{accept:false});
  assert.equal(await evaluate('document.querySelector("textarea").value'),'Synthetic everyday record');
  fault='receipt';await evaluate('document.querySelector("button[type=submit]").click()');
  await wait(()=>evaluate('document.querySelector("[role=alert]")?.textContent.includes("回执不完整")'));
  assert.equal(await evaluate('document.querySelector("textarea").value'),'Synthetic everyday record');
  await evaluate('document.querySelector("button[type=submit]").click()');await wait(()=>evaluate('!!document.querySelector("[role=status] a")'));
  assert.equal(requests.at(-1).idempotency_key,requests.at(-2).idempotency_key);
  assert.equal(requests.at(-1).source.type,'studio_supplement');assert.deepEqual(requests.at(-1).knowledge_ids,[]);
  assert.equal((await f.db.prepare('SELECT COUNT(*) n FROM learning_events').first()).n,2);
  await navigate('/studio/private','.studio-client--records');
  await wait(()=>evaluate('!!document.querySelector("[data-event-id]")'));
  assert.equal(await evaluate('!!document.querySelector("textarea")'),false);

  await navigate('/studio/private/projects?project='+projectId,'.project-editor[data-ready=true]');
  assert.equal(await evaluate('document.querySelector(".project-editor-toolbar select").value'),projectId);
  await wait(()=>evaluate('document.querySelector(".studio-project-evidence")?.textContent.includes("Synthetic milestone evidence")'));
  await navigate('/studio/private/workspace?project='+projectId+'&milestone=implementation','.studio-record-composer[data-ready=true]');
  assert.equal(await evaluate('document.querySelector("select").value'),'project:'+projectId+':implementation');
  await insert('textarea','Synthetic new project process');await evaluate('document.querySelector("button[type=submit]").click()');
  await wait(()=>evaluate('!!document.querySelector("[role=status] a[href*=milestone]")'));
  await evaluate('document.querySelector("[role=status] a[href*=milestone]").click()');
  await wait(()=>evaluate('!!document.querySelector(".project-editor[data-ready=true]")'));
  assert.equal(await evaluate('document.querySelector(".project-editor-toolbar select").value'),projectId);
  assert.equal(await evaluate('document.querySelector("#milestone-implementation select").value'),'in_progress');
  await wait(()=>evaluate('document.querySelector(".studio-project-evidence")?.textContent.includes("Synthetic new project process")'));
  await evaluate('const select=document.querySelector("#milestone-implementation select");select.value="completed";select.dispatchEvent(new Event("change",{bubbles:true}))');
  await evaluate('document.querySelector(".project-editor form").dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}))');
  await wait(()=>evaluate('document.querySelector("[role=status]")?.textContent.includes("私人草稿已保存")'));
  await evaluate('[...document.querySelectorAll("button")].find(button=>button.textContent==="预览并发布").click()');
  await wait(()=>evaluate('!!document.querySelector(".project-editor-preview")'));
  assert.equal(await evaluate('document.querySelector(".studio-publication-changes").textContent.includes("Synthetic old public progress")'),true);
  assert.equal(await evaluate('document.querySelector(".studio-publication-changes").textContent.includes("Synthetic new draft progress")'),true);
  assert.equal(await evaluate('document.querySelector(".project-editor-preview").textContent.includes("SYNTHETIC_PRIVATE_PROJECT_NOTE")'),false);
  await screenshot('project-changes');
  await evaluate('document.querySelector(".project-editor-confirm input").click();[...document.querySelectorAll("button")].find(button=>button.textContent==="确认发布").click()');
  await wait(()=>evaluate('document.querySelector("[role=status]")?.textContent.includes("公开发布")'));
  await navigate('/studio/projects','.workbench-project');
  assert.equal(await evaluate('document.body.innerText.includes("Synthetic new draft progress")'),true);
  assert.equal(await evaluate('document.body.innerText.includes("Synthetic new project process")'),false);

  await navigate('/studio/private/plans','.plan-editor[data-ready=true]');
  await evaluate('[...document.querySelectorAll("button")].find(button=>button.textContent==="预览并发布").click()');
  await wait(()=>evaluate('!!document.querySelector(".studio-publication-changes")'));
  assert.equal(await evaluate('document.querySelector(".studio-publication-changes").textContent.includes("Synthetic removed goal")'),true);
  assert.equal(await evaluate('document.querySelector(".project-editor-preview").textContent.includes("SYNTHETIC_PRIVATE_PLAN_NOTE")'),false);
  await evaluate('document.querySelector(".project-editor-confirm input").click();[...document.querySelectorAll("button")].find(button=>button.textContent==="确认发布").click()');
  await wait(()=>evaluate('document.querySelector("[role=status]")?.textContent.includes("公开发布")'));
  await navigate('/studio/private/management','.studio-daily-workbench');
  assert.equal(await evaluate('document.body.innerText.includes("目前没有待发布的变化")'),true);

  await f.db.prepare('ALTER TABLE studio_plan_records RENAME TO synthetic_unavailable_plans').run();
  try{await navigate('/studio/private/management','.studio-daily-workbench');assert.equal(await evaluate('document.body.innerText.includes("目标暂时无法读取")'),true);assert.equal(await evaluate('document.body.innerText.includes("Synthetic project next action")'),true);assert.equal(await evaluate('document.body.innerText.includes("暂无未完成的目标")'),false);}
  finally{await f.db.prepare('ALTER TABLE synthetic_unavailable_plans RENAME TO studio_plan_records').run();}
  fault='context';await navigate('/studio/private/projects?project='+projectId,'.project-editor[data-ready=true]');
  await wait(()=>evaluate('document.querySelector(".studio-project-evidence [role=alert]")?.textContent.includes("合成读取失败")'));
  assert.equal(await evaluate('document.querySelector(".studio-project-evidence").textContent.includes("当前快照中暂无关联记录")'),false);
  await evaluate('document.querySelector(".studio-project-evidence button").click()');await wait(()=>evaluate('document.querySelector(".studio-project-evidence").textContent.includes("Synthetic new project process")'));
  await navigate('/studio/private/system','.management-metrics');await wait(()=>evaluate('!!document.querySelector("input[autocomplete=new-password]")'));
  await screenshot('system');

  injectIdentity=false;
  await navigate('/studio/private/workspace?project='+projectId+'&milestone=verification','a[href^="/login?returnTo="]');
  await wait(()=>evaluate('document.querySelector("a[href^=\\"/login?returnTo=\\"]")?.href.includes("milestone%3Dverification")'));
  assert.equal(await evaluate('!!document.querySelector("textarea")'),false);
  await evaluate('document.querySelector("a[href^=\\"/login?returnTo=\\"]").click()');
  await wait(()=>evaluate('!!document.querySelector(".login-form[data-ready=true]")'));
  await insert('input[type=email]','owner@example.com');await insert('input[type=password]','Synthetic-worker-password-42');
  await evaluate('document.querySelector(".login-form button").click()');
  await wait(()=>evaluate('document.querySelector(".studio-record-composer[data-ready=true] select")?.value==="project:automotive-bus:verification"'));
  await screenshot('composer');
  }
  }
  const summary={passed:true,publicMotion:process.argv.includes('--public-motion'),visualOnly:process.argv.includes('--visual-only'),projectPreview:process.argv.includes('--project-preview'),wayneoManagement:process.argv.includes('--wayneo-management'),recordCount:(await f.db.prepare('SELECT COUNT(*) n FROM learning_events').first()).n,screenshots,scope:'Generated application Worker + Chrome + memory D1 only; synthetic records, projects, goals and email session'};
  fs.writeFileSync(path.join(work,'summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
}finally{ws?.close();chrome?.kill();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await f.runtime.dispose();}
