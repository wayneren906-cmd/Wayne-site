// Test toolbar only: send browser touch traces through the real React handlers.
// This does not simulate device scrolling; inspect touch-action separately.
const gestureFrame=document.querySelector('iframe');
const gestureToolbar=document.createElement('nav');
gestureToolbar.setAttribute('aria-label','摄影集手势验收');
document.querySelector('nav').after(gestureToolbar);
for(const [name,trace] of [
  ['模拟左滑','left'],['模拟右滑','right'],['模拟纵向滚动','vertical'],
  ['模拟取消手势','cancel'],['模拟双指缩放','pinch'],
]){
  const button=document.createElement('button');button.textContent=name;
  button.onclick=()=>{
    const w=gestureFrame.contentWindow,stage=w.document.querySelector('.pub-fragment-stage');
    const send=(type,points,changed=points)=>{
      const event=new w.Event(type,{bubbles:true});
      Object.defineProperties(event,{touches:{value:points},changedTouches:{value:changed}});
      stage.dispatchEvent(event);
    };
    const start={clientX:200,clientY:100};
    send('touchstart',[start]);
    if(trace==='cancel')send('touchcancel',[]);
    if(trace==='pinch')send('touchmove',[start,{clientX:100,clientY:100}]);
    const end=trace==='right'?{clientX:310,clientY:104}:trace==='vertical'?{clientX:205,clientY:260}:{clientX:80,clientY:104};
    send('touchend',[],[end]);
  };
  gestureToolbar.append(button);
}

// Position the actual contact section before and after its headline is visible.
for (const [name, target, edge] of [
  ['摄影轮播', '.pub-fragment-stage', false],
  ['联系区上缘', '#contact', true], ['联系标题进入', '.contact-headline-col', false],
]) {
  const button = document.createElement('button');
  button.textContent = name;
  button.onclick = () => {
    const w = gestureFrame.contentWindow, el = w.document.querySelector(target);
    if (el) w.scrollTo({ top: w.scrollY + el.getBoundingClientRect().top - (edge ? w.innerHeight - 200 : 120), behavior: 'instant' });
  };
  gestureToolbar.append(button);
}

const rotationOutput=document.createElement('output');rotationOutput.id='rotation-timing';
const timingButton=document.createElement('button');timingButton.textContent='记录自动切换间隔';
let rotationObserver,rotationTimeout;
timingButton.onclick=()=>{
  rotationObserver?.disconnect();clearTimeout(rotationTimeout);
  const w=gestureFrame.contentWindow,gallery=w.document.querySelector('.pub-fragment-gallery');
  const changes=[];const started=Date.now();let previous=gallery.querySelector('.is-active').getAttribute('aria-label');
  rotationOutput.textContent='[]';
  rotationObserver=new w.MutationObserver(()=>{
    const active=gallery.querySelector('.is-active').getAttribute('aria-label');
    if(active===previous)return;previous=active;
    const outgoing=gallery.querySelector('.is-previous');
    changes.push({time:Date.now(),elapsed:Date.now()-started,active,outgoingOpacity:outgoing?w.getComputedStyle(outgoing).opacity:null});
    rotationOutput.textContent=JSON.stringify(changes);
    if(changes.length===2){rotationObserver.disconnect();clearTimeout(rotationTimeout);}
  });
  rotationObserver.observe(gallery,{subtree:true,attributes:true,attributeFilter:['class']});
  rotationTimeout=setTimeout(()=>rotationObserver.disconnect(),14000);
};
gestureToolbar.append(timingButton,rotationOutput);
const focusedRotation=document.createElement('button');focusedRotation.textContent='验证手动切换后持续轮播';
focusedRotation.onclick=()=>{
  const gallery=gestureFrame.contentDocument.querySelector('.pub-fragment-gallery');
  const choices=[...gallery.querySelectorAll('.pub-fragment-selectors button')];
  const current=choices.findIndex(button=>button.getAttribute('aria-pressed')==='true');
  const next=choices[(current+1)%choices.length];next.click();next.focus();
  setTimeout(()=>timingButton.onclick(),0);
};
gestureToolbar.append(focusedRotation);
for(const [name,hidden]of [['模拟隐藏页面',true],['恢复页面可见',false]]){
  const button=document.createElement('button');button.textContent=name;
  button.onclick=()=>{
    const w=gestureFrame.contentWindow;
    Object.defineProperty(w.document,'visibilityState',{configurable:true,get:()=>hidden?'hidden':'visible'});
    w.document.dispatchEvent(new w.Event('visibilitychange'));
  };
  gestureToolbar.append(button);
}
