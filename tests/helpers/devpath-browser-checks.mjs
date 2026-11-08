import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

export async function verifyDevPathArchive({db,send,evaluate,navigate,wait,base,work,screenshots}){
  const settle=()=>evaluate('document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))');
  async function dimensions(width){await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});}
  async function fits(label){
    const overflow=await evaluate(`[...document.querySelectorAll('.devpath h1,.devpath h2,.devpath h3,.devpath p,.devpath a,.dp-direction,.dp-practice,.dp-article-aside')].filter(el=>!el.classList.contains('dp-skip')).filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&(r.left < -1 || r.right>innerWidth+1)}).map(el=>({tag:el.tagName,class:el.className,text:el.textContent.slice(0,55)}))`);
    assert.deepEqual(overflow,[],label+' visible content fits');
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),true,label+' document fits');
    assert.equal(await evaluate('[...document.querySelectorAll(".dp-wordmark,.dp-hero-description,.dp-article-body")].every(el=>el.scrollWidth<=el.clientWidth+1)'),true,label+' text is not clipped');
  }
  async function shot(name,full=false){
    await settle();
    const options={format:'png'};
    if(full){const metrics=await send('Page.getLayoutMetrics');options.captureBeyondViewport=true;options.clip={x:0,y:0,width:metrics.cssContentSize.width,height:metrics.cssContentSize.height,scale:1};}
    const result=await send('Page.captureScreenshot',options);
    const filename=name+'.png';fs.writeFileSync(path.join(work,filename),Buffer.from(result.data,'base64'));screenshots.push(filename);
  }
  await navigate('/studio/devpath','.dp-hero');
  assert.equal(await evaluate('document.querySelectorAll(".dp-direction").length'),5);
  assert.equal(await evaluate('document.querySelectorAll("dialog,textarea,input").length'),0);
  for(const width of [360,390,768,1440])for(const theme of ['light','dark']){
    await dimensions(width);
    await evaluate('document.documentElement.dataset.theme='+JSON.stringify(theme)+';window.scrollTo({top:0,behavior:"instant"})');
    await settle();await fits('archive '+width+' '+theme);
    await shot('devpath-'+width+'-'+theme);
    if(theme==='light'&&[390,1440].includes(width))await shot('devpath-'+width+'-full',true);
  }

  await dimensions(390);
  await evaluate('document.documentElement.dataset.theme="light"');
  for(const selector of ['#current','#collection','#practice','#changes']){
    await evaluate('document.documentElement.style.scrollBehavior="auto";document.querySelector('+JSON.stringify(selector)+').scrollIntoView({behavior:"instant"})');
    await shot('devpath-mobile-'+selector.slice(1));
  }
  await navigate('/studio/devpath/spi-tft','.dp-article-body');
  assert.equal(await evaluate('document.querySelector("h1").textContent'),'SPI 彩屏：显示与按键交互');
  assert.equal(await evaluate('document.querySelector(".dp-article-body").textContent.includes("模拟数据")'),true);
  assert.equal(await evaluate('document.querySelector("link[rel=canonical]").href'),base.replace(/http:\/\/127.0.0.1:\d+/,'https://wayneo.dev')+'/studio/devpath/spi-tft');
  for(const width of [360,390,768,1440])for(const theme of ['light','dark']){
    await dimensions(width);await evaluate('document.documentElement.dataset.theme='+JSON.stringify(theme)+';window.scrollTo({top:0,behavior:"instant"})');
    await settle();await fits('reader '+width+' '+theme);await shot('devpath-reader-'+width+'-'+theme);
  }

  // Double actual reading text, including the long brand word. Artwork is an illustration.
  for(const route of ['/studio/devpath','/studio/devpath/spi-tft']){
    await dimensions(390);await navigate(route,route.endsWith('spi-tft')?'.dp-article-body':'.dp-hero');
    await evaluate(`(()=>{const els=[...document.querySelectorAll('.devpath h1,.devpath h2,.devpath h3,.devpath p,.devpath a,.devpath span,.devpath li')].filter(el=>!el.closest('.dp-path-study,.dp-screen-study,.dp-website-study'));const sizes=els.map(el=>parseFloat(getComputedStyle(el).fontSize)*2);els.forEach((el,i)=>el.style.fontSize=sizes[i]+'px')})()`);
    await settle();await fits('doubled text '+route);
    await shot(route.endsWith('spi-tft')?'devpath-reader-doubled-text':'devpath-doubled-text');
  }

  await send('Emulation.setScriptExecutionDisabled',{value:true});
  try{
    await navigate('/studio/devpath','.dp-directions');
    assert.equal(await evaluate('document.querySelectorAll(".dp-direction").length'),5,'overview without JS');
    await navigate('/studio/devpath/spi-tft','.dp-article-body');
    assert.equal(await evaluate('document.querySelector(".dp-article-body").textContent.includes("模拟数据")'),true,'article without JS');
    assert.ok(await evaluate('document.querySelector(".dp-related a").getAttribute("href").startsWith("/studio/devpath/")'));
  }finally{await send('Emulation.setScriptExecutionDisabled',{value:false});}

  await navigate('/studio/devpath','.dp-hero');
  await evaluate('document.querySelector(".dp-art-link").click()');
  await wait(()=>evaluate('location.pathname==="/studio/devpath/spi-tft"&&!!document.querySelector(".dp-article-body")'),'practice navigation');
  await evaluate('history.back()');
  await wait(()=>evaluate('location.pathname==="/studio/devpath"&&!!document.querySelector(".dp-hero")'),'back to archive');
  await evaluate('history.forward()');
  await wait(()=>evaluate('location.pathname==="/studio/devpath/spi-tft"&&!!document.querySelector(".dp-article-body")'),'forward to practice');
  await send('Page.reload');
  await wait(()=>evaluate('!!document.querySelector(".dp-article-body")'),'detail refresh');

  // Every legacy fragment is replaced, rather than inserting a fake reader state.
  for(const id of ['hardware','wayneo','product','career','ai','about','chapter','first-board','exti']){
    await send('Page.navigate',{url:base+'/studio/devpath#view/'+id});
    await wait(()=>evaluate('location.pathname==='+JSON.stringify('/studio/devpath/'+id)+'&&!!document.querySelector(".dp-article-body")'),'legacy fragment '+id);
  }
  await navigate('/studio/devpath#collection','.dp-directions');
  assert.equal(await evaluate('location.pathname+location.hash'),'/studio/devpath#collection');
  await send('Page.navigate',{url:base+'/studio/devpath#view/unknown'});
  await wait(()=>evaluate('location.hash==="#view/unknown"&&!!document.querySelector(".dp-hero")'),'unknown fragment stays on archive');
  assert.equal(await evaluate('location.pathname'),'/studio/devpath','unknown fragment does not redirect');

  // Theme controls are the same shared controls; route CSS must not reset them.
  await navigate('/studio/devpath','.dp-hero');
  await wait(()=>evaluate('!!document.querySelector(".theme-toggle-btn")'),'theme control');
  const previousTheme=await evaluate('document.documentElement.dataset.theme');
  await evaluate('document.querySelector(".theme-toggle-btn").click()');
  await wait(()=>evaluate('document.documentElement.dataset.theme!=='+JSON.stringify(previousTheme)),'theme toggles');
  const chosenTheme=await evaluate('document.documentElement.dataset.theme');
  await navigate('/studio/devpath/spi-tft','.dp-article-body');
  await wait(()=>evaluate('document.documentElement.dataset.theme==='+JSON.stringify(chosenTheme)),'theme retained');
  await evaluate('document.querySelector(".dp-reader-nav a").focus()');
  assert.equal(await evaluate('getComputedStyle(document.activeElement).outlineStyle!=="none"'),true,'visible keyboard focus');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  assert.equal(await evaluate('document.activeElement?.getAttribute("href")'),'/studio','keyboard moves to Studio link');

  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await navigate('/studio/devpath','.dp-hero');
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".dp-hero-spread")).animationName'),'none','reduced motion');
  await dimensions(1440);
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  await navigate('/studio/devpath','.dp-hero');
  await wait(()=>evaluate('getComputedStyle(document.querySelector(".dp-hero-spread")).animationName==="dp-arrive"'),'normal motion');

  // Basic destination and shared-style regression, in the same browser after DevPath.
  for(const [url,selector] of [['/','.publication-home'],['/studio','.wayneo-project-index'],['/learning','.journal-page'],['/studio/collection','.collection-root']]){
    // Journal's root has changed over time, so wait on its main element instead.
    await navigate(url,url==='/learning'?'main':selector);
    await settle();
    assert.equal(await evaluate('document.querySelectorAll(".devpath").length'),0,url+' has no DevPath root');
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),true,url+' fits after DevPath');
    if(url==='/studio'){
      assert.equal(await evaluate('document.querySelectorAll("#devpath .wayneo-project-index-topics li").length'),5);
      assert.equal(await evaluate('document.querySelector("#devpath a").getAttribute("href")'),'/studio/devpath');
    }
    if(url==='/')assert.equal(await evaluate('document.querySelector("#practice .pub-text-link").getAttribute("href")'),'/studio');
  }

  await db.prepare('INSERT INTO records(date,items,practice,revision,updated_at) VALUES(?,?,?,?,?)').bind('2026-10-24',JSON.stringify([{label:'Synthetic canonical entry',text:'BROWSER_PUBLIC_EVIDENCE'}]),'',1,'2026-11-08T00:00:00Z').run();
  await navigate('/studio/devpath/first-board','.dp-article-body');
  assert.equal(await evaluate('document.querySelector(".dp-article-body").textContent.includes("BROWSER_PUBLIC_EVIDENCE")'),true);
  await db.prepare('ALTER TABLE records RENAME TO synthetic_unavailable_records').run();
  try{
    await navigate('/studio/devpath/first-board','.dp-article-body');
    assert.equal(await evaluate('document.querySelector(".dp-article-body").textContent.includes("暂时无法读取")'),true);
    await navigate('/studio/devpath','.dp-hero');
  }finally{await db.prepare('ALTER TABLE synthetic_unavailable_records RENAME TO records').run();}
}
