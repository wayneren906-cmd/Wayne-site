import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

export async function verifyJournalReading({db,send,evaluate,navigate,wait,base,requests,setRecordsMode,work,screenshots}){
  const primary='2026-10-15',older='2026-10-14',snapshot='2026-10-16';
  const hydrate=()=>wait(()=>evaluate('Object.keys(document.querySelector(".journal-entry-actions button")??{}).some(key=>key.startsWith("__reactProps"))'),'Journal hydration');
  const input=async(value)=>evaluate('(()=>{const field=document.querySelector(".search input");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(field,'+JSON.stringify(value)+');field.dispatchEvent(new Event("input",{bubbles:true}));})()');
  const snapshotRecord={date:primary,items:[{label:'设计',text:'Synthetic historical reading'}],practice:'Historical practice',revision:1,updatedAt:'2026-10-15T00:00:00Z'};
  await db.prepare('INSERT INTO records(date,items,practice,revision,updated_at) VALUES(?,?,?,?,?)').bind(older,JSON.stringify([{label:'Older',text:'Synthetic older reading'}]),'',1,snapshotRecord.updatedAt).run();
  await db.prepare('INSERT INTO snapshots(date,data,updated_at) VALUES(?,?,?)').bind(snapshot,JSON.stringify([snapshotRecord]),snapshotRecord.updatedAt).run();

  // Readable before hydration, with JavaScript completely disabled.
  await send('Emulation.setScriptExecutionDisabled',{value:true});
  const disabledStart=requests.length;
  await navigate('/learning?date='+primary,'.entries .entry');
  assert.equal(await evaluate('document.querySelectorAll(".entries .entry").length'),1);
  assert.equal(await evaluate('document.querySelector(".notes").textContent.includes("Synthetic published reading")'),true);
  assert.equal(await evaluate('!!document.querySelector(".loading-bars")'),false);
  assert.equal(requests.slice(disabledStart).some(request=>request.url==='/api/records'),false);
  await send('Emulation.setScriptExecutionDisabled',{value:false});

  const start=requests.length;
  await navigate('/learning?date='+primary+'&month=2026-09&q=missing','.entries .entry');
  await hydrate();
  assert.equal(await evaluate('document.querySelectorAll(".entries .entry").length'),1);
  assert.equal(await evaluate('document.querySelector(".search input").value'),'');
  assert.equal(await evaluate('document.querySelector(".month-field select").value'),'all');
  assert.equal(requests.slice(start).some(request=>request.url==='/api/records'),false,'SSR data does not trigger a redundant initial API request');
  assert.equal(await evaluate('document.title'),'2026-10-15 学习手记 · Wayne');

  // Exercise the actual click handlers with an isolated clipboard, never the system clipboard.
  await evaluate('Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:async value=>{window.__journalCopied=value}}});document.querySelector(".journal-entry-actions button").click()');
  await wait(()=>evaluate('!!window.__journalCopied'),'copy success');
  assert.equal(await evaluate('window.__journalCopied'),base+'/learning?date='+primary);
  assert.equal(await evaluate('document.querySelector(".toast").textContent'),'已复制记录链接');
  await evaluate('navigator.clipboard.writeText=async()=>{throw Error("Synthetic clipboard denial")};document.querySelector(".journal-entry-actions button").click()');
  await wait(()=>evaluate('!!document.querySelector(".journal-share-fallback input")'),'copy fallback');
  assert.equal(await evaluate('document.querySelector(".journal-share-fallback input").value'),base+'/learning?date='+primary);
  await evaluate('document.querySelector(".journal-share-fallback input").focus()');
  assert.equal(await evaluate('(()=>{const field=document.querySelector(".journal-share-fallback input");return field.selectionStart===0&&field.selectionEnd===field.value.length;})()'),true);
  for(const width of [320,390,1280])for(const theme of ['light','dark']){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
    await evaluate('document.documentElement.dataset.theme='+JSON.stringify(theme)+';document.querySelector(".journal-entry-actions").scrollIntoView({block:"center",behavior:"instant"});document.fonts.ready');
    await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),true,'Journal sharing fits '+width+' '+theme);
    assert.equal(await evaluate('[...document.querySelectorAll(".journal-entry-actions a,.journal-entry-actions button,.journal-share-fallback input")].every(el=>el.getBoundingClientRect().height>=44)'),true,'sharing touch targets');
    const shot=await send('Page.captureScreenshot',{format:'png'}),name='journal-sharing-'+width+'-'+theme+'.png';
    fs.writeFileSync(path.join(work,name),Buffer.from(shot.data,'base64'));screenshots.push(name);
  }

  // Filters persist through browser history and a full reload.
  await navigate('/learning','.entries .entry');await hydrate();
  await evaluate('(()=>{const select=document.querySelector(".month-field select");select.value="2026-10";select.dispatchEvent(new Event("change",{bubbles:true}));})()');
  await wait(()=>evaluate('new URLSearchParams(location.search).get("month")==="2026-10"'),'month filter');
  await input('Older');
  await wait(()=>evaluate('document.querySelectorAll(".entries .entry").length===1&&document.querySelector(".notes").textContent.includes("Synthetic older reading")'),'text filter');
  await evaluate('history.back()');
  await wait(()=>evaluate('document.querySelector(".search input").value===""&&document.querySelectorAll(".entries .entry").length===2'),'back restores filters');
  await evaluate('history.forward()');
  await wait(()=>evaluate('document.querySelector(".search input").value==="Older"&&document.querySelectorAll(".entries .entry").length===1'),'forward restores filters');
  await evaluate('window.__journalReloadMarker=true');await send('Page.reload');
  await wait(()=>evaluate('!window.__journalReloadMarker&&document.querySelector(".search input")?.value==="Older"&&document.querySelectorAll(".entries .entry").length===1'),'reload retains filters');await hydrate();
  await evaluate(`document.querySelector('button[aria-label="清空搜索"]').click()`);
  await wait(()=>evaluate('document.querySelectorAll(".entries .entry").length===2'),'clear search');

  await navigate('/learning?date='+primary+'&snapshot='+snapshot,'.entries .entry');await hydrate();
  assert.equal(await evaluate('document.querySelector(".notes").textContent.includes("Synthetic historical reading")'),true);
  assert.equal(await evaluate('document.querySelector(".journal-entry-actions a").getAttribute("href")'),'/learning?date='+primary+'&snapshot='+snapshot);
  await evaluate('Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:async value=>{window.__journalCopied=value}}});document.querySelector(".journal-entry-actions button").click()');
  await wait(()=>evaluate('!!window.__journalCopied'),'historical copy');
  assert.equal(await evaluate('window.__journalCopied'),base+'/learning?date='+primary+'&snapshot='+snapshot);
  await db.prepare('INSERT INTO snapshots(date,data,updated_at) VALUES(?,?,?)').bind('2026-10-17','[',snapshotRecord.updatedAt).run();
  await evaluate('[...document.querySelectorAll("button")].find(button=>button.textContent.trim()==="历史快照").click()');
  await wait(()=>evaluate(`!!document.querySelector('select[aria-label="选择历史快照"]')`),'snapshot list');
  await evaluate(`(()=>{const select=document.querySelector('select[aria-label="选择历史快照"]');select.value='2026-10-17';select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await wait(()=>evaluate('document.querySelector(".empty")?.textContent.includes("暂时无法读取这份快照")'),'failed snapshot transition');
  assert.equal(await evaluate('!!document.querySelector(".entries")'),false,'a failed snapshot never relabels the previous snapshot as the requested one');
  await db.prepare('DELETE FROM snapshots WHERE date=?').bind('2026-10-17').run();
  await navigate('/learning?date='+primary+'&snapshot=2026-10-17','.empty');
  assert.equal(await evaluate('document.querySelector(".empty").textContent.includes("暂时无法读取这份快照")'),true);
  assert.equal(await evaluate('!!document.querySelector(".entries")'),false);

  // Initial server errors recover through the real API; later refresh failures retain the rendered text.
  await db.prepare('ALTER TABLE records RENAME TO synthetic_journal_unavailable').run();
  await navigate('/learning','.empty');
  await wait(()=>evaluate('Object.keys(document.querySelector(".empty button")??{}).some(key=>key.startsWith("__reactProps"))'),'error retry hydration');
  assert.equal(await evaluate('document.querySelector(".empty").textContent.includes("暂时无法读取记录，请重试。")'),true);
  await db.prepare('ALTER TABLE synthetic_journal_unavailable RENAME TO records').run();
  await evaluate('document.querySelector(".empty button").click()');
  await wait(()=>evaluate('document.querySelectorAll(".entries .entry").length===2'),'server error retry');
  setRecordsMode('error');await evaluate('window.dispatchEvent(new Event("focus"))');
  await wait(()=>evaluate('document.querySelector(".journal-refresh-notice")?.textContent.includes("保留上次读取")'),'failed refresh retains content');
  assert.equal(await evaluate('document.querySelectorAll(".entries .entry").length'),2);
  setRecordsMode('normal');await evaluate('document.querySelector(".journal-refresh-notice button").click()');
  await wait(()=>evaluate('!document.querySelector(".journal-refresh-notice")'),'refresh retry');
  await navigate('/learning?date=2026-10-13','.empty');
  assert.equal(await evaluate('document.querySelector(".empty").textContent.includes("这一天还没有公开手记")'),true);
  await db.prepare('DELETE FROM records WHERE date=?').bind(older).run();
  await db.prepare('DELETE FROM snapshots WHERE date=?').bind(snapshot).run();
}
