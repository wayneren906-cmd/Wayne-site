import assert from 'node:assert/strict';

export async function verifyJournalReading({db,send,evaluate,navigate,wait,requests,setRecordsMode}){
  const primary='2026-10-15',older='2026-10-14',snapshot='2026-10-16';
  const hydrate=()=>wait(()=>evaluate('Object.keys(document.querySelector(".search input")??{}).some(key=>key.startsWith("__reactProps"))'),'Journal hydration');
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
  assert.equal(await evaluate('document.querySelector(".journal-reading-neighbors a").getAttribute("href")'),'/learning?date='+older,'an actual older record is available without returning to the calendar');
  await evaluate('document.querySelector(".journal-reading-neighbors a").click()');
  await wait(()=>evaluate('new URLSearchParams(location.search).get("date")==="2026-10-14"&&document.querySelector(".notes")?.textContent.includes("Synthetic older reading")'),'read the older record');await hydrate();
  assert.equal(await evaluate('document.querySelector(".journal-reading-neighbors a[data-direction=newer]").getAttribute("href")'),'/learning?date='+primary);
  await evaluate('document.querySelector(".journal-reading-neighbors a[data-direction=newer]").click()');
  await wait(()=>evaluate('new URLSearchParams(location.search).get("date")==="2026-10-15"&&document.querySelector(".notes")?.textContent.includes("Synthetic published reading")'),'return to the newer record');await hydrate();

  assert.equal(await evaluate('document.querySelectorAll(".journal-entry-actions,.journal-share-fallback,.journal-contents").length'),0,'reading stays free of the removed controls');

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
  assert.equal(await evaluate('new URLSearchParams(location.search).get("snapshot")'),snapshot,'historical reading preserves the selected snapshot');
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
