import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

export async function verifyJournalArchive({db,send,evaluate,navigate,wait,work,screenshots}){
  const dates=[...Array.from({length:7},(_,i)=>`2026-10-${24-i}`),'2026-10-17','2026-09-12','2025-10-04'];
  const fixture=dates.map(date=>({date,items:[{label:'归档测试 '+date,text:'历史正文 '+date}],practice:'',revision:1,updatedAt:'2026-10-25T00:00:00Z'}));
  const hydrate=()=>wait(()=>evaluate('Object.keys(document.querySelector(".search input")??{}).some(key=>key.startsWith("__reactProps"))'),'archive hydration');
  try{
    for(const record of fixture)await db.prepare('INSERT INTO records(date,items,practice,revision,updated_at) VALUES(?,?,?,?,?)').bind(record.date,JSON.stringify(record.items),record.practice,record.revision,record.updatedAt).run();
    await db.prepare('INSERT INTO snapshots(date,data,updated_at) VALUES(?,?,?)').bind('2026-10-25',JSON.stringify(fixture),fixture[0].updatedAt).run();
    await send('Emulation.setScriptExecutionDisabled',{value:true});
    await navigate('/learning','.journal-archive');
    assert.deepEqual(await evaluate('[...document.querySelectorAll(".entries > .entry .entry-date")].map(el=>el.dateTime)'),dates.slice(0,7));
    assert.equal(await evaluate('document.querySelectorAll(".journal-archive-month").length'),3,'years have distinct month groups');
    assert.equal(await evaluate('document.querySelectorAll(".journal-archive-month[open]").length'),0,'all older months start closed');
    assert.equal(await evaluate('document.querySelectorAll(".journal-archive .entry-body").length'),0,'older prose does not lengthen the index');
    await evaluate('document.querySelector(".journal-archive-month summary").focus()');
    assert.equal(await evaluate('document.activeElement===document.querySelector(".journal-archive-month summary")'),true,'month summary accepts keyboard focus');
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
    await wait(()=>evaluate('document.querySelector(".journal-archive-month").open'),'native folding works with the keyboard and without JavaScript');
    await send('Emulation.setScriptExecutionDisabled',{value:false});
    await navigate('/learning','.journal-archive');await hydrate();
    for(const width of [320,1280]){
      await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
      await evaluate('document.documentElement.dataset.theme="light";document.querySelectorAll(".entries > .entry").forEach(el=>el.open=false);document.querySelector(".journal-archive-month").open=true;document.fonts.ready');
      await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
      await evaluate('document.querySelector(".journal-archive").scrollIntoView({block:"center",behavior:"instant"})');
      assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),true,'archive fits '+width);
      const shot=await send('Page.captureScreenshot',{format:'png'}),filename='journal-archive-'+width+'.png';
      fs.writeFileSync(path.join(work,filename),Buffer.from(shot.data,'base64'));screenshots.push(filename);
    }
    assert.equal(await evaluate('document.querySelector(".journal-archive-month a").getAttribute("href")'),'/learning?date=2026-10-17');
    await evaluate('document.querySelector(".journal-archive-month a").click()');
    await wait(()=>evaluate('location.search==="?date=2026-10-17"&&document.querySelector(".notes")?.textContent.includes("历史正文 2026-10-17")'),'read an archived date');await hydrate();
    assert.equal(await evaluate('document.querySelectorAll(".entries > .entry").length'),1);
    await navigate('/learning?q='+encodeURIComponent('历史正文 2026-09-12'),'.entries .entry');await hydrate();
    assert.equal(await evaluate('document.querySelector(".entry-date").dateTime'),'2026-09-12','search covers archived prose');
    assert.equal(await evaluate('!!document.querySelector(".journal-archive")'),false);
    await navigate('/learning?month=2026-10','.entries .entry');await hydrate();
    assert.equal(await evaluate('document.querySelectorAll(".entries > .entry").length'),9,'explicit month shows every matching date, including older records');
    await navigate('/learning?snapshot=2026-10-25','.journal-archive');await hydrate();
    assert.equal(await evaluate('document.querySelector(".journal-archive-month a").getAttribute("href")'),'/learning?date=2026-10-17&snapshot=2026-10-25','archive preserves snapshot identity');
    await evaluate('document.querySelector(".journal-archive-month").open=true;document.querySelector(".journal-archive-month a").click()');
    await wait(()=>evaluate('location.search==="?date=2026-10-17&snapshot=2026-10-25"&&document.querySelector(".notes")?.textContent.includes("历史正文 2026-10-17")'),'read an archived snapshot');
  }finally{
    await send('Emulation.setScriptExecutionDisabled',{value:false});
    for(const date of dates)await db.prepare('DELETE FROM records WHERE date=?').bind(date).run();
    await db.prepare('DELETE FROM snapshots WHERE date=?').bind('2026-10-25').run();
  }
}
