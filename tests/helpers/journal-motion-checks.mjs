import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

export async function verifyJournalMotion({db,send,evaluate,navigate,wait,work,screenshots}){
  const dates=['2026-10-14','2026-10-13'];
  const items=[{label:'GPIO 输入与按键控制 · 软件消抖与非阻塞轮询',text:'合成动画验证材料。仅用于隔离浏览器中的展开检查。'},{label:'第二节',text:'保持阅读位置。'},{label:'第三节',text:'验证完整展开。'}];
  const results=[];
  try{
    for(const date of dates)await db.prepare('INSERT INTO records(date,items,practice,revision,updated_at) VALUES(?,?,?,?,?)').bind(date,JSON.stringify(items),'',1,'2026-10-25T00:00:00Z').run();
    for(const motion of ['no-preference','reduce']){
      await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
      await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
      await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:motion}]});
      await navigate('/learning','.entries .entry');
      await wait(()=>evaluate('document.querySelector(".journal-shell").classList.contains("journal-motion-ready")==='+JSON.stringify(motion==='no-preference')),'motion preference applied');
      await evaluate('document.querySelectorAll(".entries > .entry").forEach(entry=>entry.open=false);document.fonts.ready');
      await wait(()=>evaluate('document.querySelector(".entry").getBoundingClientRect().height-document.querySelector(".entry summary").getBoundingClientRect().height<3'),'entries closed');
      await evaluate('window.scrollTo({top:scrollY+document.querySelectorAll(".entry summary")[1].getBoundingClientRect().top-180,behavior:"instant"})');
      await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
      const point=await evaluate('(()=>{const rect=document.querySelectorAll(".entry summary")[1].getBoundingClientRect();return {x:rect.left+rect.width/2,y:rect.top+rect.height/2};})()');
      await evaluate(`(()=>{const entry=document.querySelectorAll('.entry')[1],summary=entry.querySelector('summary'),next=document.querySelectorAll('.entry')[2];window.__journalMotionSamples=[];window.__journalMotionDone=false;const start=performance.now();function sample(now){const rect=summary.getBoundingClientRect();window.__journalMotionSamples.push({ms:now-start,top:rect.top,summary:rect.height,entry:entry.getBoundingClientRect().height,next:next.getBoundingClientRect().top,scrollY});if(now-start<650)requestAnimationFrame(sample);else window.__journalMotionDone=true;}requestAnimationFrame(sample);})()`);
      await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
      await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await wait(()=>evaluate('window.__journalMotionDone'),'opening frame samples');
      const samples=await evaluate('window.__journalMotionSamples');
      const spread=key=>Math.max(...samples.map(s=>s[key]))-Math.min(...samples.map(s=>s[key]));
      const result={motion,topDrift:spread('top'),scrollDrift:spread('scrollY'),summaryDrift:spread('summary'),growth:spread('entry'),samples};
      results.push(result);
      fs.writeFileSync(path.join(work,'journal-motion-summary.json'),JSON.stringify(results,null,2));
      assert.equal(await evaluate('document.querySelectorAll(".entry")[1].open'),true,'touch opens the requested date');
      assert.ok(result.topDrift<2,'opening keeps the tapped date fixed: '+JSON.stringify({...result,samples:undefined}));
      assert.ok(result.scrollDrift<2,'opening does not scroll the viewport');
      assert.ok(result.summaryDrift<2,'date and topic summary do not shrink during opening');
      if(motion==='no-preference')assert.ok(result.growth>80,'entry expands downward');
      const shot=await send('Page.captureScreenshot',{format:'png'}),name='journal-mobile-open-'+motion+'.png';
      fs.writeFileSync(path.join(work,name),Buffer.from(shot.data,'base64'));screenshots.push(name);
      await evaluate('(async()=>{const summary=document.querySelectorAll(".entry")[1].querySelector("summary");for(let i=0;i<4;i++){summary.click();for(let frame=0;frame<4;frame++)await new Promise(requestAnimationFrame);}})()');
      await wait(()=>evaluate('document.querySelectorAll(".entry")[1].open&&document.querySelectorAll(".entry")[1].getBoundingClientRect().height>500'),'rapid reversals settle open');
    }
  }finally{
    for(const date of dates)await db.prepare('DELETE FROM records WHERE date=?').bind(date).run();
    await send('Emulation.setTouchEmulationEnabled',{enabled:false});
    await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  }
}
