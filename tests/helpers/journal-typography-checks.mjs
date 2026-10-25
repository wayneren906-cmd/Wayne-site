import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

export async function verifyJournalTypography({db,send,evaluate,navigate,wait,work,screenshots}){
  const date='2026-10-15';
  const original=await db.prepare('SELECT items,practice FROM records WHERE date=?').bind(date).first();
  const items=[
    {label:'STM32 实机入门与开发流程',text:'使用 NUCLEO-F446RE（STM32F446RET6），安装并配置 STM32CubeMX 与 STM32CubeIDE 2.2.0，创建 LED_Blink 工程。练习 GPIO 配置、代码生成、编译、ST-LINK 烧录、断点暂停与继续运行。'},
    {label:'C 语言与 GPIO 输出',text:'复习位运算、寄存器指定位操作、条件判断和循环；学习 HAL_GPIO_WritePin()、HAL_GPIO_TogglePin() 与 HAL_Delay()。控制板载 LD2（PA5）定时闪烁，并用 for 循环优化重复代码。'},
    {label:'GPIO 输入与按键控制',text:'将板载 B1（PC13）配置为 GPIO 输入，使用 HAL_GPIO_ReadPin() 读取状态。\n\n保留原来的段落与空行。 <script>alert()</script> '+ 'Long_identifier_without_spaces_'.repeat(12)},
  ];
  try{
    await db.prepare('UPDATE records SET items=?,practice=? WHERE date=?').bind(JSON.stringify(items),'练习成绩 1/3 → 3/3。',date).run();
    await navigate('/learning?date='+date,'.note');
    await wait(()=>evaluate('Object.keys(document.querySelector(".search input")??{}).some(key=>key.startsWith("__reactProps"))'),'reading hydration');
    assert.deepEqual(await evaluate('[...document.querySelectorAll(".note-label")].map(el=>({tag:el.tagName,text:el.textContent}))'),items.map(item=>({tag:'H3',text:item.label})));
    assert.deepEqual(await evaluate('[...document.querySelectorAll(".note .journal-prose")].map(el=>el.textContent)'),items.map(item=>item.text),'formatting preserves every source character');
    assert.equal(await evaluate('!!document.querySelector(".note script")'),false,'technical prose never renders source HTML');
    assert.equal(await evaluate('document.querySelectorAll(".journal-prose code,.journal-contents,.journal-entry-actions,.journal-share-fallback").length'),0,'no code boxes, directory or link controls');
    assert.equal(await evaluate('document.querySelectorAll(".note:first-child .journal-prose p").length'),2,'technical notes use short paragraphs');
    const target='#journal-'+date+'-note-2';
    await evaluate('location.hash='+JSON.stringify(target));
    await wait(()=>evaluate('location.hash==='+JSON.stringify(target)+'&&document.activeElement.id==='+JSON.stringify(target.slice(1))),'existing topic links still reach their section');
    await evaluate('window.__typographyReloadMarker=true');await send('Page.reload');
    await wait(()=>evaluate('!window.__typographyReloadMarker&&location.hash==='+JSON.stringify(target)+'&&document.activeElement?.id==='+JSON.stringify(target.slice(1))),'reload retains the topic destination');
    assert.equal(await evaluate('document.querySelectorAll(".journal-reading-neighbors a").length'),0,'no invented neighbors for one record');
    await evaluate('location.hash=""');
    await wait(()=>evaluate('!location.hash&&document.activeElement?.id==="journal-2026-10-15-note-1"'),'return to the first reading section');
    for(const width of [320,390,768,1280])for(const theme of ['light','dark']){
      await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
      await evaluate('document.documentElement.dataset.theme='+JSON.stringify(theme)+';document.fonts.ready');
      await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
      await evaluate('window.scrollTo({top:scrollY+document.querySelector(".note").getBoundingClientRect().top-(innerWidth<=700?88:110),behavior:"instant"})');
      await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
      assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),true,'technical reading fits '+width+' '+theme);
      assert.equal(await evaluate('document.querySelector(".entry-body").getBoundingClientRect().width<=641'),true,'bounded reading width');
      assert.equal(await evaluate('parseFloat(getComputedStyle(document.querySelector(".note-label")).fontSize)>=28'),true,'prominent reading title');
      assert.equal(await evaluate('getComputedStyle(document.querySelector(".note")).borderBottomWidth'), '0px','chapters use whitespace instead of rules');
      const titlePosition=await evaluate('(()=>{const note=document.querySelector(".note"),heading=document.querySelector(".note-label");return {top:heading.getBoundingClientRect().top,viewport:innerHeight,sectionTop:note.getBoundingClientRect().top,padding:getComputedStyle(note).paddingTop,hash:location.hash};})()');
      if(titlePosition.top<=titlePosition.viewport*.23||titlePosition.top>=titlePosition.viewport*.65){const debug=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(work,'journal-canvas-layout-debug.png'),Buffer.from(debug.data,'base64'));}
      assert.ok(titlePosition.top>titlePosition.viewport*.23&&titlePosition.top<titlePosition.viewport*.65,'the first title sits within the middle reading area: '+JSON.stringify(titlePosition));
      assert.equal(await evaluate('document.querySelector(".journal-section-number").getAttribute("aria-hidden")'),'true','decorative numbers are not read as content');
      const shot=await send('Page.captureScreenshot',{format:'png'}),filename='journal-prose-'+width+'-'+theme+'.png';
      fs.writeFileSync(path.join(work,filename),Buffer.from(shot.data,'base64'));screenshots.push(filename);
    }
    await send('Emulation.setDeviceMetricsOverride',{width:320,height:1000,deviceScaleFactor:1,mobile:false});
    await evaluate('document.querySelectorAll(".journal-prose").forEach(el=>el.style.fontSize="32px")');
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),true,'long identifiers fit with doubled body text');
  }finally{await db.prepare('UPDATE records SET items=?,practice=? WHERE date=?').bind(original.items,original.practice,date).run();}
}
